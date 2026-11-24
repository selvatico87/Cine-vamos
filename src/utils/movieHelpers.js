const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

const ALLOWED_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function getPosterUrl(posterPath, fallback = '') {
  if (!posterPath || typeof posterPath !== 'string') return fallback;
  if (posterPath.startsWith('http://') || posterPath.startsWith('https://')) {
    return posterPath;
  }
  return `${TMDB_IMAGE_BASE}${posterPath.startsWith('/') ? '' : '/'}${posterPath}`;
}

function getBackdropUrl(backdropPath, fallback = '') {
  if (!backdropPath || typeof backdropPath !== 'string') return fallback;
  if (backdropPath.startsWith('http://') || backdropPath.startsWith('https://')) {
    return backdropPath;
  }
  return `${TMDB_BACKDROP_BASE}${backdropPath.startsWith('/') ? '' : '/'}${backdropPath}`;
}

function formatReleaseYear(releaseDate) {
  if (!releaseDate || typeof releaseDate !== 'string') return 'S/F';
  const match = releaseDate.match(/^(\d{4})/);
  return match ? match[1] : 'S/F';
}

function formatRating(voteAverage) {
  if (typeof voteAverage !== 'number' || Number.isNaN(voteAverage) || voteAverage <= 0) {
    return 'N/D';
  }
  return voteAverage.toFixed(1);
}

function truncateText(text, maxLength = 140) {
  if (!text || typeof text !== 'string') return '';
  const clean = text.trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildCinemaNewsFromMovies(upcomingMovies = [], trendingMovies = []) {
  const seenIds = new Set();
  const pickUnique = (list) =>
    (Array.isArray(list) ? list : []).filter((m) => {
      if (!m || !m.id || seenIds.has(m.id)) return false;
      if (!m.title) return false;
      seenIds.add(m.id);
      return true;
    });

  const trending = pickUnique(trendingMovies);
  const upcoming = pickUnique(upcomingMovies);

  const leadSource = trending[0] || upcoming[0];
  const secondarySources = [...upcoming.slice(0, 2), ...trending.slice(1, 3)].slice(0, 2);
  const briefSources = [...upcoming.slice(2, 6), ...trending.slice(2, 6)].slice(0, 4);

  const toNewsItem = (movie, category, deckPrefix) => ({
    id: movie.id,
    movieId: movie.id,
    category,
    title: movie.title,
    headline:
      category === 'Estreno'
        ? `${movie.title} encabeza los próximos estrenos en cartelera`
        : category === 'Tendencia'
        ? `${movie.title} domina la conversación cinematográfica de la semana`
        : `${movie.title}: fecha confirmada y primeras claves de producción`,
    summary:
      movie.overview && movie.overview.trim().length > 0
        ? truncateText(movie.overview, 185)
        : `${deckPrefix} Descubre sinopsis, tráiler oficial, plataformas disponibles y ficha completa en Vamos Al Cine.`,
    releaseDate: movie.release_date || 'Próximamente',
    year: formatReleaseYear(movie.release_date),
    rating: formatRating(movie.vote_average),
    backdropUrl: getBackdropUrl(movie.backdrop_path || movie.poster_path),
    posterUrl: getPosterUrl(movie.poster_path || movie.backdrop_path),
  });

  return {
    lead: leadSource
      ? toNewsItem(leadSource, 'Tendencia', 'Destacada en cartelera mundial.')
      : null,
    secondary: secondarySources.map((m, idx) =>
      toNewsItem(
        m,
        idx === 0 ? 'Estreno' : 'Cartelera',
        'Actualización de cartelera y estrenos.'
      )
    ),
    briefs: briefSources.map((m) =>
      toNewsItem(m, 'Próximamente', 'Seguimiento de próximos estrenos.')
    ),
  };
}

function sanitizeFavoritePayload(movie, userId) {
  if (!userId || typeof userId !== 'string' || !ALLOWED_ID_REGEX.test(userId) || userId.length > 128) {
    throw new Error('Identificador de usuario inválido para guardar favoritos.');
  }
  const numericMovieId = parseInt(movie?.id ?? movie?.movieId, 10);
  if (!Number.isInteger(numericMovieId) || numericMovieId <= 0) {
    throw new Error('Identificador de película inválido.');
  }
  const rawTitle = typeof movie?.title === 'string' && movie.title.trim() ? movie.title.trim() : 'Película sin título';
  const rawImg =
    typeof movie?.imgURL === 'string' && movie.imgURL.trim()
      ? movie.imgURL.trim()
      : getPosterUrl(movie?.poster_path, '/favicon.png');

  return {
    userId: userId.slice(0, 128),
    movieId: numericMovieId,
    title: rawTitle.slice(0, 200),
    imgURL: rawImg.slice(0, 512),
  };
}

function validateRecommendationPrompt(prompt) {
  if (typeof prompt !== 'string') {
    return { valid: false, error: 'Ingresa una descripción para buscar recomendaciones.' };
  }
  const trimmed = prompt.trim();
  if (trimmed.length < 3) {
    return {
      valid: false,
      error: 'Escribe al menos 3 caracteres (por ejemplo: "thriller psicológico" o "como Interstellar").',
    };
  }
  if (trimmed.length > 400) {
    return {
      valid: false,
      error: 'La consulta no debe superar los 400 caracteres.',
    };
  }
  return { valid: true, prompt: trimmed };
}

const TMDB_PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';

function getProfileUrl(profilePath, fallback = '') {
  if (!profilePath || typeof profilePath !== 'string') return fallback;
  if (profilePath.startsWith('http://') || profilePath.startsWith('https://')) {
    return profilePath;
  }
  return `${TMDB_PROFILE_BASE}${profilePath.startsWith('/') ? '' : '/'}${profilePath}`;
}

function pickBestTrailer(videos = []) {
  if (!Array.isArray(videos) || videos.length === 0) return null;
  const youtubeVideos = videos.filter(
    (v) => v && v.key && (!v.site || v.site.toLowerCase() === 'youtube')
  );
  if (youtubeVideos.length === 0) return null;

  const officialTrailer = youtubeVideos.find(
    (v) => v.type === 'Trailer' && v.official
  );
  if (officialTrailer) return officialTrailer;

  const anyTrailer = youtubeVideos.find((v) => v.type === 'Trailer');
  if (anyTrailer) return anyTrailer;

  const teaser = youtubeVideos.find((v) => v.type === 'Teaser');
  return teaser || youtubeVideos[0];
}

function detectPreferredCountryFromLocale(locale = '') {
  if (typeof locale !== 'string' || !locale.trim()) return 'AR';
  const parts = locale.trim().split(/[-_]/);
  if (parts.length > 1 && /^[A-Za-z]{2}$/.test(parts[1])) {
    return parts[1].toUpperCase();
  }
  return 'ES';
}

function selectWatchProvidersForRegion(resultsByCountry = {}, preferredRegion = 'AR') {
  if (!resultsByCountry || typeof resultsByCountry !== 'object') {
    return null;
  }
  const availableCodes = Object.keys(resultsByCountry);
  if (availableCodes.length === 0) return null;

  const candidateOrder = [
    preferredRegion?.toUpperCase(),
    'AR',
    'ES',
    'MX',
    'CO',
    'CL',
    'US',
    ...availableCodes,
  ].filter(Boolean);

  for (const code of candidateOrder) {
    const entry = resultsByCountry[code];
    if (
      entry &&
      ((Array.isArray(entry.flatrate) && entry.flatrate.length > 0) ||
        (Array.isArray(entry.rent) && entry.rent.length > 0) ||
        (Array.isArray(entry.buy) && entry.buy.length > 0))
    ) {
      return {
        region: code,
        link: entry.link || '',
        flatrate: entry.flatrate || [],
        rent: entry.rent || [],
        buy: entry.buy || [],
      };
    }
  }

  const firstWithLink = availableCodes.find((code) => resultsByCountry[code]?.link);
  if (!firstWithLink) return null;
  return {
    region: firstWithLink,
    link: resultsByCountry[firstWithLink].link || '',
    flatrate: resultsByCountry[firstWithLink].flatrate || [],
    rent: resultsByCountry[firstWithLink].rent || [],
    buy: resultsByCountry[firstWithLink].buy || [],
  };
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const nums = [lat1, lng1, lat2, lng2];
  if (nums.some((n) => typeof n !== 'number' || Number.isNaN(n))) {
    return null;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistance(km) {
  if (typeof km !== 'number' || Number.isNaN(km) || km < 0) return '';
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

function buildNewsArticlePath(movieId, category = '') {
  const numericId = parseInt(movieId, 10);
  if (!Number.isInteger(numericId) || numericId <= 0) return '/';
  if (category && typeof category === 'string' && category.trim()) {
    return `/noticia/${numericId}?cat=${encodeURIComponent(category.trim())}`;
  }
  return `/noticia/${numericId}`;
}

function formatFullReleaseDate(releaseDate) {
  if (!releaseDate || typeof releaseDate !== 'string') return 'Por confirmar';
  const match = releaseDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return releaseDate;
  const [, year, month, day] = match;
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  const monthIdx = parseInt(month, 10) - 1;
  const monthLabel = months[monthIdx] || month;
  return `${parseInt(day, 10)} ${monthLabel} ${year}`;
}

function formatVoteCount(count) {
  if (typeof count !== 'number' || Number.isNaN(count) || count <= 0) return '';
  return count.toLocaleString('es-ES');
}

function sanitizeExternalUrl(url) {
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

function mergeSimilarMovies(recommendations = [], similar = [], excludeMovieId = null, limit = 8) {
  const seen = new Set();
  const excluded = parseInt(excludeMovieId, 10);
  if (Number.isInteger(excluded) && excluded > 0) {
    seen.add(excluded);
  }

  const combined = [
    ...(Array.isArray(recommendations) ? recommendations : []),
    ...(Array.isArray(similar) ? similar : []),
  ];

  const output = [];
  for (const item of combined) {
    if (!item || !item.id || !item.title || seen.has(item.id)) continue;
    seen.add(item.id);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

module.exports = {
  getPosterUrl,
  getBackdropUrl,
  getProfileUrl,
  formatReleaseYear,
  formatRating,
  truncateText,
  buildCinemaNewsFromMovies,
  sanitizeFavoritePayload,
  validateRecommendationPrompt,
  pickBestTrailer,
  detectPreferredCountryFromLocale,
  selectWatchProvidersForRegion,
  calculateDistanceKm,
  formatDistance,
  buildNewsArticlePath,
  formatFullReleaseDate,
  formatVoteCount,
  sanitizeExternalUrl,
  mergeSimilarMovies,
};
