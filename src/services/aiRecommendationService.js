import { matchRecommendationsWithTmdb } from './tmdbService';

export async function fetchAiMovieRecommendations({ prompt, mood = '', genre = '' }) {
  const response = await fetch('/api/recommendations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, mood, genre }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudieron obtener recomendaciones de IA.');
  }

  const enriched = await matchRecommendationsWithTmdb(data.recommendations || []);
  return {
    summary: data.summary || '',
    recommendations: enriched,
  };
}
