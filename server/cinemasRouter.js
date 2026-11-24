const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.addressComponents',
  'places.location',
  'places.googleMapsLinks',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.websiteUri',
  'places.currentOpeningHours.openNow',
].join(',');

function getMapsApiKey() {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
    ''
  );
}

function readJsonBody(req, maxBytes = 16 * 1024) {
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

function extractCountryCode(place) {
  const components = place?.addressComponents;
  if (!Array.isArray(components)) return '';
  const country = components.find(
    (comp) => Array.isArray(comp.types) && comp.types.includes('country')
  );
  return country?.shortText || '';
}

function normalizePlace(place) {
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;
  return {
    id: place?.id || '',
    name: place?.displayName?.text || 'Cine local',
    address: place?.shortFormattedAddress || place?.formattedAddress || '',
    fullAddress: place?.formattedAddress || '',
    countryCode: extractCountryCode(place),
    location:
      typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null,
    rating: typeof place?.rating === 'number' ? place.rating : null,
    userRatingCount:
      typeof place?.userRatingCount === 'number' ? place.userRatingCount : null,
    openNow:
      typeof place?.currentOpeningHours?.openNow === 'boolean'
        ? place.currentOpeningHours.openNow
        : null,
    websiteUri: place?.websiteUri || '',
    placeUri: place?.googleMapsLinks?.placeUri || place?.googleMapsUri || '',
    directionsUri: place?.googleMapsLinks?.directionsUri || '',
  };
}

async function handleCinemasSearch(req, res) {
  try {
    const apiKey = getMapsApiKey();
    if (!apiKey) {
      return sendJson(res, 500, {
        error: 'Google Maps API Key no está configurada en el servidor.',
      });
    }

    const body = await readJsonBody(req);
    const lat = typeof body?.lat === 'number' ? body.lat : Number(body?.lat);
    const lng = typeof body?.lng === 'number' ? body.lng : Number(body?.lng);
    const hasValidCoords =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      body?.lat !== undefined &&
      body?.lng !== undefined &&
      body?.lat !== null &&
      body?.lng !== null &&
      body?.lat !== '' &&
      body?.lng !== '';

    const rawQuery = typeof body?.query === 'string' ? body.query.trim().slice(0, 120) : '';

    if (!hasValidCoords && !rawQuery) {
      return sendJson(res, 400, {
        error: 'Envía coordenadas de ubicación o el nombre de una ciudad/zona para buscar cines.',
      });
    }

    let endpoint = NEARBY_URL;
    let payload;

    if (hasValidCoords && !rawQuery) {
      endpoint = NEARBY_URL;
      payload = {
        includedTypes: ['movie_theater'],
        maxResultCount: 6,
        rankPreference: 'DISTANCE',
        languageCode: 'es',
        locationRestriction: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng,
            },
            radius: 15000.0,
          },
        },
      };
    } else {
      endpoint = TEXT_SEARCH_URL;
      const normalizedQuery = /cine|cinema|teatro|movie theater/i.test(rawQuery)
        ? rawQuery
        : `cines en ${rawQuery}`;
      payload = {
        textQuery: normalizedQuery,
        includedType: 'movie_theater',
        pageSize: 6,
        languageCode: 'es',
      };
      if (hasValidCoords) {
        payload.locationBias = {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 20000.0,
          },
        };
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 429 || data?.error?.status === 'RESOURCE_EXHAUSTED') {
      return sendJson(res, 429, {
        error: 'Se alcanzó la cuota diaria de Google Maps Platform.',
        code: 'RESOURCE_EXHAUSTED',
      });
    }

    if (!response.ok) {
      const msg =
        data?.error?.message ||
        `No pudimos consultar cines cercanos (código ${response.status}).`;
      return sendJson(res, response.status >= 400 && response.status < 600 ? response.status : 502, {
        error: msg,
        code: data?.error?.status || 'PLACES_ERROR',
      });
    }

    const places = Array.isArray(data?.places) ? data.places.map(normalizePlace) : [];
    const detectedCountry = places.find((p) => p.countryCode)?.countryCode || '';

    return sendJson(res, 200, {
      cinemas: places,
      detectedCountry,
      mode: endpoint === NEARBY_URL ? 'nearby' : 'text',
    });
  } catch (error) {
    console.error('Error en /api/cinemas:', error);
    const status = error?.statusCode || 500;
    return sendJson(res, status >= 400 && status < 600 ? status : 500, {
      error: error?.message || 'Error interno al buscar cines cercanos.',
    });
  }
}

module.exports = {
  handleCinemasSearch,
};
