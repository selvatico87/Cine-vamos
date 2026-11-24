import axios from 'axios';
import { mergeSimilarMovies } from '../utils/movieHelpers';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const RAW_TMDB_KEY = (
  process.env.REACT_APP_TMDB_API_KEY || 'c963b2c1865802b4fc57f70679b6a724'
).trim();
const DEFAULT_LANGUAGE = 'es-ES';
const IS_BEARER_JWT = RAW_TMDB_KEY.startsWith('eyJ') && RAW_TMDB_KEY.includes('.');

const tmdbClient = axios.create({
  baseURL: TMDB_BASE_URL,
  headers: IS_BEARER_JWT
    ? {
        Authorization: `Bearer ${RAW_TMDB_KEY}`,
      }
    : undefined,
  params: {
    ...(IS_BEARER_JWT ? {} : { api_key: RAW_TMDB_KEY }),
    language: DEFAULT_LANGUAGE,
  },
});

export async function getTrendingMovies(timeWindow = 'week', page = 1) {
  const { data } = await tmdbClient.get(`/trending/movie/${timeWindow}`, {
    params: { page },
  });
  return data?.results || [];
}

export async function getRecommendedMovies(category = 'top_rated', page = 1) {
  const validCategories = ['top_rated', 'popular', 'now_playing', 'upcoming'];
  const endpointCategory = validCategories.includes(category) ? category : 'top_rated';
  const { data } = await tmdbClient.get(`/movie/${endpointCategory}`, {
    params: { page },
  });
  return data?.results || [];
}

export async function getDiscoverMovies(page = 1) {
  const { data } = await tmdbClient.get('/discover/movie', {
    params: { page },
  });
  return data?.results || [];
}

export async function searchMovies(keyword, year) {
  const params = { query: keyword };
  if (year) {
    params.year = year;
  }
  const { data } = await tmdbClient.get('/search/movie', { params });
  return data?.results || [];
}

export async function getMovieDetails(movieID) {
  const { data } = await tmdbClient.get(`/movie/${movieID}`);
  return data;
}

export async function getMovieVideos(movieID) {
  const { data } = await tmdbClient.get(`/movie/${movieID}/videos`);
  return data?.results || [];
}

export async function getMovieProviders(movieID) {
  const { data } = await tmdbClient.get(`/movie/${movieID}/watch/providers`, {
    params: { language: undefined },
  });
  return data?.results || {};
}

export async function getMovieCredits(movieID) {
  const { data } = await tmdbClient.get(`/movie/${movieID}/credits`);
  return data;
}

export async function getMovieFullDetails(movieID) {
  const [{ data }, providers] = await Promise.all([
    tmdbClient.get(`/movie/${movieID}`, {
      params: {
        append_to_response: 'credits,videos,similar,recommendations',
      },
    }),
    getMovieProviders(movieID),
  ]);

  let videos = data?.videos?.results || [];
  if (!videos.some((v) => v?.site === 'YouTube' && (v?.type === 'Trailer' || v?.type === 'Teaser'))) {
    try {
      const { data: allLangVideos } = await tmdbClient.get(`/movie/${movieID}/videos`, {
        params: { language: undefined },
      });
      if (Array.isArray(allLangVideos?.results) && allLangVideos.results.length > 0) {
        videos = [...videos, ...allLangVideos.results];
      }
    } catch (err) {
      console.error('Error cargando videos alternativos:', err);
    }
  }

  return {
    movie: data,
    cast: Array.isArray(data?.credits?.cast) ? data.credits.cast.slice(0, 10) : [],
    crew: Array.isArray(data?.credits?.crew) ? data.credits.crew : [],
    videos,
    providers,
    similarMovies: mergeSimilarMovies(
      data?.recommendations?.results,
      data?.similar?.results,
      data?.id,
      8
    ),
  };
}

export async function getHomeFeedData() {
  const [trending, recommended, upcoming, nowPlaying] = await Promise.all([
    getTrendingMovies('week', 1),
    getRecommendedMovies('top_rated', 1),
    getRecommendedMovies('upcoming', 1),
    getRecommendedMovies('now_playing', 1),
  ]);

  return {
    trending,
    recommended,
    upcoming,
    nowPlaying,
  };
}

export async function matchRecommendationsWithTmdb(aiRecommendations = []) {
  const matches = await Promise.all(
    aiRecommendations.map(async (rec) => {
      try {
        const primaryQuery = rec.originalTitle || rec.title;
        let candidates = primaryQuery
          ? await searchMovies(primaryQuery, rec.year)
          : [];
        if (!candidates.length && primaryQuery && rec.year) {
          candidates = await searchMovies(primaryQuery);
        }
        if (!candidates.length && rec.title && rec.title !== rec.originalTitle) {
          candidates = await searchMovies(rec.title);
        }
        const bestMatch = candidates[0] || null;
        return {
          ...rec,
          tmdbMovie: bestMatch,
        };
      } catch (err) {
        console.error('Error buscando coincidencia TMDB para recomendación:', rec.title, err);
        return {
          ...rec,
          tmdbMovie: null,
        };
      }
    })
  );
  return matches;
}

const tmdbService = {
  getTrendingMovies,
  getRecommendedMovies,
  getDiscoverMovies,
  searchMovies,
  getMovieDetails,
  getMovieVideos,
  getMovieProviders,
  getMovieCredits,
  getMovieFullDetails,
  getHomeFeedData,
  matchRecommendationsWithTmdb,
};

export default tmdbService;
