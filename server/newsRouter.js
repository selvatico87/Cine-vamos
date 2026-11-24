const { GoogleGenAI, ThinkingLevel, Type } = require('@google/genai');

const CACHE_TTL_MS = 20 * 60 * 1000;
const articleCache = new Map();
const movieNewsCache = new Map();

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
      timeout: 25000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

function formatErrorMessage(error) {
  const raw = error?.message || '';
  if (raw.includes('high demand') || error?.status === 503) {
    return 'El servicio de investigación periodística con IA tiene alta demanda en este momento. Inténtalo de nuevo en unos segundos.';
  }
  if (error?.status === 429 || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Se alcanzó el límite de cuota para consultas con búsqueda web en IA. Reintenta en unos instantes o verifica tu clave con facturación en Settings > Secrets.';
  }
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.error?.message || 'Error al investigar noticias reales con IA.';
    } catch {
      return 'Error al investigar noticias reales con IA.';
    }
  }
  return raw || 'Error al investigar noticias reales con IA.';
}

function sanitizeHttpUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

function extractHostname(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host;
  } catch {
    return '';
  }
}

function extractGroundingSources(response) {
  const metadata = response?.candidates?.[0]?.groundingMetadata;
  const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
  const seenUrls = new Set();
  const sources = [];

  for (const chunk of chunks) {
    const web = chunk?.web;
    const validUrl = sanitizeHttpUrl(web?.uri);
    if (!validUrl || seenUrls.has(validUrl)) continue;
    seenUrls.add(validUrl);
    const publisher = extractHostname(validUrl) || 'Fuente web';
    const rawTitle = typeof web?.title === 'string' && web.title.trim() ? web.title.trim() : publisher;
    sources.push({
      title: rawTitle.slice(0, 140),
      url: validUrl,
      publisher,
    });
  }

  return {
    sources: sources.slice(0, 8),
    searchQueries: Array.isArray(metadata?.webSearchQueries)
      ? metadata.webSearchQueries.slice(0, 4)
      : [],
  };
}

function extractJsonObject(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('La IA devolvió una respuesta vacía.');
  }
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip markdown code fences if present
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // Continue to outer brace match
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error('No se pudo interpretar el formato JSON de la respuesta editorial.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateGroundedJson(ai, { systemInstruction, prompt, responseSchema }) {
  const attempts = [
    { model: 'gemini-3.1-flash-lite', delayMs: 0 },
    { model: 'gemini-4-hydrogen', delayMs: 700 },
  ];
  let lastError;

  for (const { model, delayMs } of attempts) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    for (const withSchema of [true, false]) {
      try {
        const config = {
          ...(model === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          systemInstruction,
          tools: [{ googleSearch: {} }],
        };

        if (withSchema) {
          config.responseMimeType = 'application/json';
          config.responseSchema = responseSchema;
        }

        const response = await ai.models.generateContent({
          model,
          contents: withSchema
            ? prompt
            : `${prompt}\n\nResponde ÚNICAMENTE con un objeto JSON válido sin texto adicional ni bloques Markdown.`,
          config,
        });

        const parsed = extractJsonObject(response.text || '');
        const grounding = extractGroundingSources(response);
        return { parsed, grounding };
      } catch (error) {
        lastError = error;
        const status = error?.status || error?.statusCode;
        // If structured JSON + googleSearch is unsupported cleanly, retry without responseSchema
        if (withSchema && (status === 400 || error instanceof SyntaxError)) {
          continue;
        }
        if (status === 503 || status === 429) {
          break;
        }
        throw error;
      }
    }
  }

  throw lastError;
}

const EDITORIAL_ARTICLE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    deck: { type: Type.STRING },
    category: { type: Type.STRING },
    readingTimeMinutes: { type: Type.INTEGER },
    leadParagraph: { type: Type.STRING },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          body: { type: Type.STRING },
        },
        required: ['heading', 'body'],
      },
    },
    pullQuote: { type: Type.STRING },
    verdict: { type: Type.STRING },
    keyFacts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING },
        },
        required: ['label', 'value'],
      },
    },
  },
  required: [
    'headline',
    'deck',
    'category',
    'readingTimeMinutes',
    'leadParagraph',
    'sections',
    'pullQuote',
    'verdict',
    'keyFacts',
  ],
};

const MOVIE_REAL_NEWS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    contextSummary: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          sourceName: { type: Type.STRING },
          publishedLabel: { type: Type.STRING },
          angle: { type: Type.STRING },
          sourceIndex: { type: Type.INTEGER },
        },
        required: ['title', 'summary', 'sourceName', 'publishedLabel', 'angle'],
      },
    },
  },
  required: ['contextSummary', 'items'],
};

async function handleNewsArticle(req, res) {
  try {
    const body = await readJsonBody(req);
    const movieId = parseInt(body?.movieId, 10);
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
    const originalTitle =
      typeof body?.originalTitle === 'string' ? body.originalTitle.trim().slice(0, 160) : '';
    const releaseDate =
      typeof body?.releaseDate === 'string' ? body.releaseDate.trim().slice(0, 40) : '';
    const overview =
      typeof body?.overview === 'string' ? body.overview.trim().slice(0, 600) : '';
    const category =
      typeof body?.category === 'string' && body.category.trim()
        ? body.category.trim().slice(0, 40)
        : 'Actualidad';
    const originalHeadline =
      typeof body?.originalHeadline === 'string'
        ? body.originalHeadline.trim().slice(0, 200)
        : '';
    const forceRefresh = Boolean(body?.forceRefresh);

    if (!title && (!Number.isInteger(movieId) || movieId <= 0)) {
      return sendJson(res, 400, {
        error: 'Se requiere identificar la película o titular de la noticia.',
      });
    }

    const cacheKey = `article:${movieId || title.toLowerCase()}:${category.toLowerCase()}`;
    const cached = articleCache.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return sendJson(res, 200, cached.payload);
    }

    const ai = createAiClient();
    const systemInstruction =
      'Eres un crítico de cine experto y periodista cultural senior de habla hispana para "Vamos Al Cine". ' +
      'Debes investigar en internet con la herramienta de búsqueda información real, actualizada y verificable sobre la película indicada: estado de estreno o cartelera, recepción de la crítica especializada (festivales, consenso, prensa cinematográfica), taquilla o impacto en streaming, enfoque autoral de la dirección y claves interpretativas del reparto. ' +
      'Redacta en español una nota periodística completamente nueva de tono analítico equilibrado, riguroso y elegante, sin inventar premios, citas o cifras que no estén respaldadas por tu búsqueda. ' +
      'Devuelve el objeto JSON completo siguiendo el esquema solicitado: un titular periodístico nuevo (headline), bajada informativa (deck), categoría corta (category), tiempo estimado de lectura en minutos entre 3 y 6 (readingTimeMinutes), párrafo de apertura sólido (leadParagraph), 3 o 4 apartados con subtítulo y desarrollo extenso de 1-2 párrafos bien escritos cada uno (sections), una cita crítica editorial destacada sin atribución falsa (pullQuote), un veredicto periodístico final (verdict) y 4 datos clave objetivos (keyFacts con label y value cortos).';

    const prompt = [
      `Película a investigar: "${title || originalTitle}"`,
      originalTitle && originalTitle !== title ? `Título original: "${originalTitle}"` : '',
      releaseDate ? `Fecha de estreno registrada en TMDB: ${releaseDate}` : '',
      category ? `Sección origen: ${category}` : '',
      originalHeadline ? `Titular previo en portada: "${originalHeadline}"` : '',
      overview ? `Sinopsis base de referencia: ${overview}` : '',
      'Investiga noticias reales, entrevistas, críticas publicadas, taquilla, festivales o novedades en plataformas sobre esta película en internet y redacta la nota periodística completa.',
    ]
      .filter(Boolean)
      .join('\n');

    const { parsed, grounding } = await generateGroundedJson(ai, {
      systemInstruction,
      prompt,
      responseSchema: EDITORIAL_ARTICLE_SCHEMA,
    });

    const normalizedSections = Array.isArray(parsed?.sections)
      ? parsed.sections
          .filter((s) => s && typeof s.heading === 'string' && typeof s.body === 'string')
          .slice(0, 5)
      : [];

    if (!parsed?.headline || !parsed?.leadParagraph || normalizedSections.length === 0) {
      return sendJson(res, 502, {
        error: 'No se pudo redactar la nota completa con el formato esperado.',
      });
    }

    const payload = {
      movieId: Number.isInteger(movieId) && movieId > 0 ? movieId : null,
      headline: String(parsed.headline).trim(),
      deck: String(parsed.deck || '').trim(),
      category: String(parsed.category || category).trim(),
      byline: 'Redacción Crítica · Vamos Al Cine',
      readingTimeMinutes: Math.min(8, Math.max(2, parseInt(parsed.readingTimeMinutes, 10) || 4)),
      leadParagraph: String(parsed.leadParagraph).trim(),
      sections: normalizedSections,
      pullQuote: String(parsed.pullQuote || '').trim(),
      verdict: String(parsed.verdict || '').trim(),
      keyFacts: Array.isArray(parsed.keyFacts)
        ? parsed.keyFacts
            .filter((k) => k && typeof k.label === 'string' && typeof k.value === 'string')
            .slice(0, 5)
        : [],
      sources: grounding.sources,
      searchQueries: grounding.searchQueries,
      generatedAt: new Date().toISOString(),
    };

    articleCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return sendJson(res, 200, payload);
  } catch (error) {
    const status = error?.statusCode || error?.status || 500;
    if (status === 429 || status === 503) {
      console.warn(`/api/news-article upstream limit (${status}):`, formatErrorMessage(error));
    } else {
      console.error('Error en /api/news-article:', error);
    }
    return sendJson(res, status >= 400 && status < 600 ? status : 500, {
      error: formatErrorMessage(error),
    });
  }
}

async function handleMovieNews(req, res) {
  try {
    const body = await readJsonBody(req);
    const movieId = parseInt(body?.movieId, 10);
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
    const originalTitle =
      typeof body?.originalTitle === 'string' ? body.originalTitle.trim().slice(0, 160) : '';
    const releaseDate =
      typeof body?.releaseDate === 'string' ? body.releaseDate.trim().slice(0, 40) : '';
    const forceRefresh = Boolean(body?.forceRefresh);

    if (!title && (!Number.isInteger(movieId) || movieId <= 0)) {
      return sendJson(res, 400, {
        error: 'Se requiere una película válida para buscar noticias reales.',
      });
    }

    const cacheKey = `movienews:${movieId || title.toLowerCase()}`;
    const cached = movieNewsCache.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return sendJson(res, 200, cached.payload);
    }

    const ai = createAiClient();
    const systemInstruction =
      'Eres un periodista cinematográfico especializado que recopila noticias reales y verificadas en internet para la ficha de cada película en "Vamos Al Cine". ' +
      'Usa Google Search para encontrar noticias reales, cobertura de prensa, reseñas destacadas, cifras reales de taquilla, novedades de festivales o fechas de lanzamiento en cines y streaming sobre esta película específica. ' +
      'Devuelve en español un resumen de contexto periodístico (contextSummary, 1-2 oraciones) y hasta 4 noticias reales concretas (items) encontradas en tu búsqueda web. Cada item debe incluir: title (titular periodístico fiel a la cobertura real encontrada), summary (resumen informativo de 1-2 frases), sourceName (nombre del medio o publicación real), publishedLabel (fecha o período aproximado verificado en la noticia, o "Cobertura reciente" si no figura día exacto), angle (etiqueta corta de 1-3 palabras como "Crítica", "Taquilla", "Estreno", "Producción", "Entrevista"), y sourceIndex (índice base-0 de la fuente web consultada si corresponde). Nunca inventes URLs ni medios falsos.';

    const prompt = [
      `Busca noticias reales y artículos de prensa actuales en internet sobre la película "${title || originalTitle}".`,
      originalTitle && originalTitle !== title ? `Título original: "${originalTitle}"` : '',
      releaseDate ? `Año / fecha de estreno en TMDB: ${releaseDate}` : '',
      'Prioriza prensa cinematográfica reconocida, novedades de estreno, recepción crítica y repercusión reciente.',
    ]
      .filter(Boolean)
      .join('\n');

    const { parsed, grounding } = await generateGroundedJson(ai, {
      systemInstruction,
      prompt,
      responseSchema: MOVIE_REAL_NEWS_SCHEMA,
    });

    const rawItems = Array.isArray(parsed?.items) ? parsed.items.slice(0, 4) : [];
    const items = rawItems
      .filter((item) => item && typeof item.title === 'string' && typeof item.summary === 'string')
      .map((item, idx) => {
        const refIdx = Number.isInteger(item.sourceIndex) ? item.sourceIndex : idx;
        const matchedSource = grounding.sources[refIdx] || grounding.sources[idx] || null;
        return {
          title: item.title.trim(),
          summary: item.summary.trim(),
          sourceName:
            (typeof item.sourceName === 'string' && item.sourceName.trim()) ||
            matchedSource?.publisher ||
            'Prensa especializada',
          publishedLabel:
            (typeof item.publishedLabel === 'string' && item.publishedLabel.trim()) ||
            'Cobertura reciente',
          angle:
            (typeof item.angle === 'string' && item.angle.trim()) || 'Prensa',
          url: matchedSource?.url || '',
        };
      });

    const payload = {
      movieId: Number.isInteger(movieId) && movieId > 0 ? movieId : null,
      contextSummary:
        typeof parsed?.contextSummary === 'string' ? parsed.contextSummary.trim() : '',
      items,
      sources: grounding.sources,
      searchQueries: grounding.searchQueries,
      fetchedAt: new Date().toISOString(),
    };

    movieNewsCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return sendJson(res, 200, payload);
  } catch (error) {
    const status = error?.statusCode || error?.status || 500;
    if (status === 429 || status === 503) {
      console.warn(`/api/movie-news upstream limit (${status}):`, formatErrorMessage(error));
    } else {
      console.error('Error en /api/movie-news:', error);
    }
    return sendJson(res, status >= 400 && status < 600 ? status : 500, {
      error: formatErrorMessage(error),
    });
  }
}

module.exports = {
  handleNewsArticle,
  handleMovieNews,
  extractJsonObject,
  sanitizeHttpUrl,
};
