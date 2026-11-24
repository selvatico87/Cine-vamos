const { GoogleGenAI, ThinkingLevel, Type } = require('@google/genai');

const CACHE_TTL_MS = 20 * 60 * 1000;
const recommendationCache = new Map();

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY no está configurada en el servidor.');
    err.statusCode = 500;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 20000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJsonObject(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('La IA devolvió una respuesta vacía.');
  }
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error('Formato JSON inválido recibido de la IA.');
  }
}

async function generateMovieRecommendations(ai, userContext) {
  const attempts = [
    { model: 'gemini-3.1-flash-lite', delayMs: 0 },
    { model: 'gemini-4-hydrogen', delayMs: 600 },
  ];
  let lastError;

  for (const { model, delayMs } of attempts) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    try {
      return await ai.models.generateContent({
        model,
        contents: userContext,
        config: {
          ...(model === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          systemInstruction:
            'Eres un curador experto de cine en español para la plataforma Vamos Al Cine. Recomienda exactamente 5 películas reales y bien conocidas que encajen con la petición del usuario. Devuelve el título en español (title), el título original en inglés o idioma original (originalTitle) para buscar con precisión en TMDB, el año de estreno (year), una razón concisa y atractiva de 1-2 frases en español (reason), y una etiqueta breve de enfoque de 2 a 4 palabras sin signos raros (matchAngle). Incluye además un resumen editorial breve (summary) en español.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'Resumen editorial breve en español explicando la selección.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description: 'Título de la película en español.',
                    },
                    originalTitle: {
                      type: Type.STRING,
                      description: 'Título original de la película para búsqueda en TMDB.',
                    },
                    year: {
                      type: Type.INTEGER,
                      description: 'Año de estreno de la película.',
                    },
                    reason: {
                      type: Type.STRING,
                      description: 'Explicación breve en español de por qué encaja con la búsqueda.',
                    },
                    matchAngle: {
                      type: Type.STRING,
                      description: 'Frase corta de 2-4 palabras sobre el punto fuerte de la recomendación.',
                    },
                  },
                  required: ['title', 'originalTitle', 'year', 'reason', 'matchAngle'],
                },
              },
            },
            required: ['summary', 'recommendations'],
          },
        },
      });
    } catch (error) {
      lastError = error;
      const status = error?.status || error?.statusCode;
      if (status !== 503 && status !== 429) {
        throw error;
      }
    }
  }
  throw lastError;
}

function formatErrorMessage(error) {
  const raw = error?.message || '';
  if (raw.includes('high demand') || error?.status === 503) {
    return 'El servicio de recomendaciones con IA tiene alta demanda en este momento. Inténtalo de nuevo en unos segundos.';
  }
  if (error?.status === 429 || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Se alcanzó el límite temporal de consultas de la API de Gemini. Espera un momento o revisa el plan de la clave en Settings > Secrets.';
  }
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.error?.message || 'Error al generar recomendaciones de películas con IA.';
    } catch {
      return 'Error al generar recomendaciones de películas con IA.';
    }
  }
  return raw || 'Error al generar recomendaciones de películas con IA.';
}

function readJsonBody(req, maxBytes = 32 * 1024) {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    const fail = (message, statusCode) => {
      if (settled) return;
      settled = true;
      const err = new Error(message);
      err.statusCode = statusCode;
      reject(err);
    };

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        fail('La solicitud excede el tamaño máximo permitido.', 413);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        settled = true;
        resolve({});
        return;
      }
      try {
        settled = true;
        resolve(JSON.parse(raw));
      } catch {
        settled = false;
        fail('El cuerpo JSON de la solicitud no es válido.', 400);
      }
    });

    req.on('error', (err) => {
      fail(err?.message || 'Error leyendo la solicitud.', 400);
    });
  });
}

function sendJson(res, statusCode, payload) {
  if (res.headersSent) return;
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8'));
  res.end(body);
}

async function handleRecommendations(req, res) {
  try {
    const body = await readJsonBody(req);
    const rawPrompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const mood = typeof body?.mood === 'string' ? body.mood.trim().slice(0, 80) : '';
    const genre = typeof body?.genre === 'string' ? body.genre.trim().slice(0, 80) : '';

    if (!rawPrompt) {
      return sendJson(res, 400, {
        error: 'Ingresa una descripción, estado de ánimo o película de referencia para recomendar.',
      });
    }

    const prompt = rawPrompt.slice(0, 400);
    const cacheKey = `${prompt.toLowerCase()}|${mood.toLowerCase()}|${genre.toLowerCase()}`;
    const cached = recommendationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return sendJson(res, 200, cached.payload);
    }

    const ai = createAiClient();

    const userContext = [
      `Solicitud del usuario: "${prompt}"`,
      mood ? `Estado de ánimo preferido: ${mood}` : '',
      genre ? `Género de interés: ${genre}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await generateMovieRecommendations(ai, userContext);

    const parsed = extractJsonObject(response.text || '{}');

    if (!Array.isArray(parsed.recommendations)) {
      return sendJson(res, 502, {
        error: 'No se pudo interpretar la respuesta de recomendaciones de IA.',
      });
    }

    const payload = {
      summary: parsed.summary || '',
      recommendations: parsed.recommendations.slice(0, 6),
    };

    recommendationCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return sendJson(res, 200, payload);
  } catch (error) {
    const status = error?.statusCode || error?.status || 500;
    if (status === 429 || status === 503) {
      console.warn(`/api/recommendations upstream limit (${status}):`, formatErrorMessage(error));
    } else {
      console.error('Error en /api/recommendations:', error);
    }
    return sendJson(res, status >= 400 && status < 600 ? status : 500, {
      error: formatErrorMessage(error),
    });
  }
}

module.exports = {
  handleRecommendations,
};
