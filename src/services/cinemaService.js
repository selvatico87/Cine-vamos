export async function searchNearbyCinemas({ lat, lng, query } = {}) {
  const response = await fetch('/api/cinemas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lat, lng, query }),
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 429 || data?.code === 'RESOURCE_EXHAUSTED') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
    throw new Error(
      data?.error || 'Se alcanzó la cuota de consultas de Google Maps Platform.'
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error || 'No pudimos consultar los cines cercanos en este momento.'
    );
  }

  return {
    cinemas: Array.isArray(data?.cinemas) ? data.cinemas : [],
    detectedCountry: data?.detectedCountry || '',
    mode: data?.mode || 'nearby',
  };
}
