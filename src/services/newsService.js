const articleMemoryCache = new Map();
const movieNewsMemoryCache = new Map();
const inflightArticlePromises = new Map();
const inflightMovieNewsPromises = new Map();

async function postJson(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error || 'No se pudo completar la investigación periodística en internet.'
    );
  }
  return data;
}

export async function fetchEditorialArticle({
  movieId,
  title,
  originalTitle,
  releaseDate,
  overview,
  category = 'Actualidad',
  originalHeadline = '',
  forceRefresh = false,
}) {
  const key = `${movieId || title}:${category}`;
  if (!forceRefresh && articleMemoryCache.has(key)) {
    return articleMemoryCache.get(key);
  }
  if (!forceRefresh && inflightArticlePromises.has(key)) {
    return inflightArticlePromises.get(key);
  }

  const requestPromise = postJson('/api/news-article', {
    movieId,
    title,
    originalTitle,
    releaseDate,
    overview,
    category,
    originalHeadline,
    forceRefresh,
  })
    .then((data) => {
      articleMemoryCache.set(key, data);
      return data;
    })
    .finally(() => {
      inflightArticlePromises.delete(key);
    });

  inflightArticlePromises.set(key, requestPromise);
  return requestPromise;
}

export async function fetchMovieRealNews({
  movieId,
  title,
  originalTitle,
  releaseDate,
  forceRefresh = false,
}) {
  const key = String(movieId || title);
  if (!forceRefresh && movieNewsMemoryCache.has(key)) {
    return movieNewsMemoryCache.get(key);
  }
  if (!forceRefresh && inflightMovieNewsPromises.has(key)) {
    return inflightMovieNewsPromises.get(key);
  }

  const requestPromise = postJson('/api/movie-news', {
    movieId,
    title,
    originalTitle,
    releaseDate,
    forceRefresh,
  })
    .then((data) => {
      movieNewsMemoryCache.set(key, data);
      return data;
    })
    .finally(() => {
      inflightMovieNewsPromises.delete(key);
    });

  inflightMovieNewsPromises.set(key, requestPromise);
  return requestPromise;
}
