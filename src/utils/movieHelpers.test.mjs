import test from 'node:test';
import assert from 'node:assert/strict';
import movieHelpers from './movieHelpers.js';

const {
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
} = movieHelpers;

test('getPosterUrl, getBackdropUrl, and getProfileUrl handle relative TMDB paths, full URLs, and missing values', () => {
  assert.equal(getPosterUrl('/abc.jpg'), 'https://image.tmdb.org/t/p/w500/abc.jpg');
  assert.equal(getPosterUrl('abc.jpg'), 'https://image.tmdb.org/t/p/w500/abc.jpg');
  assert.equal(getPosterUrl('https://cdn.example.com/p.jpg'), 'https://cdn.example.com/p.jpg');
  assert.equal(getPosterUrl(null, '/fallback.png'), '/fallback.png');
  assert.equal(getBackdropUrl('/bg.jpg'), 'https://image.tmdb.org/t/p/w1280/bg.jpg');
  assert.equal(getProfileUrl('/actor.jpg'), 'https://image.tmdb.org/t/p/w185/actor.jpg');
  assert.equal(getProfileUrl('', '/avatar.png'), '/avatar.png');
});

test('formatReleaseYear and formatRating format TMDB metadata cleanly', () => {
  assert.equal(formatReleaseYear('2025-11-14'), '2025');
  assert.equal(formatReleaseYear(''), 'S/F');
  assert.equal(formatRating(8.26), '8.3');
  assert.equal(formatRating(0), 'N/D');
  assert.equal(formatRating(null), 'N/D');
});

test('truncateText caps long synopses cleanly', () => {
  assert.equal(truncateText('Corto', 20), 'Corto');
  assert.equal(truncateText('Una historia larga sobre cine', 15), 'Una historia l…');
});

test('buildCinemaNewsFromMovies structures lead, secondary, and brief items without duplicates', () => {
  const trending = [
    { id: 1, title: 'Dune 2', overview: 'Epica espacial', release_date: '2024-03-01', vote_average: 8.4, backdrop_path: '/d2.jpg', poster_path: '/d2p.jpg' },
    { id: 2, title: 'Oppenheimer', overview: 'Historia nuclear', release_date: '2023-07-20', vote_average: 8.1, backdrop_path: '/op.jpg', poster_path: '/opp.jpg' },
  ];
  const upcoming = [
    { id: 2, title: 'Oppenheimer', overview: 'Duplicado', release_date: '2023-07-20', vote_average: 8.1 },
    { id: 3, title: 'Estreno Futuro', overview: 'Muy pronto', release_date: '2026-12-01', vote_average: 7.5, backdrop_path: '/ef.jpg' },
    { id: 4, title: 'Segunda Novedad', overview: 'En salas', release_date: '2026-12-10', vote_average: 7.2, backdrop_path: '/sn.jpg' },
    { id: 5, title: 'Breve Uno', overview: 'Breve', release_date: '2026-12-15', vote_average: 7.0 },
  ];

  const news = buildCinemaNewsFromMovies(upcoming, trending);
  assert.equal(news.lead.movieId, 1);
  assert.equal(news.secondary.length, 2);
  assert.equal(news.secondary[0].movieId, 3);
  assert.equal(news.secondary[1].movieId, 4);
  assert.ok(news.briefs.some((item) => item.movieId === 5));
});

test('sanitizeFavoritePayload enforces blueprint schema and rejects invalid inputs', () => {
  const payload = sanitizeFavoritePayload(
    {
      id: 603,
      title: 'A'.repeat(250),
      imgURL: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
    },
    'user_123-abc'
  );
  assert.equal(payload.userId, 'user_123-abc');
  assert.equal(payload.movieId, 603);
  assert.equal(payload.title.length, 200);

  assert.throws(() => sanitizeFavoritePayload({ id: 603, title: 'Matrix' }, '../bad-uid'));
  assert.throws(() => sanitizeFavoritePayload({ id: 'invalid', title: 'Matrix' }, 'user123'));
});

test('validateRecommendationPrompt rejects empty, too short, and oversized queries', () => {
  assert.equal(validateRecommendationPrompt('   ').valid, false);
  assert.equal(validateRecommendationPrompt('ab').valid, false);
  assert.equal(validateRecommendationPrompt('a'.repeat(401)).valid, false);
  assert.deepEqual(validateRecommendationPrompt('  ciencia ficción como Arrival  '), {
    valid: true,
    prompt: 'ciencia ficción como Arrival',
  });
});

test('pickBestTrailer prioritizes official YouTube trailers and skips non-YouTube clips', () => {
  assert.equal(pickBestTrailer([]), null);
  const videos = [
    { site: 'Vimeo', type: 'Trailer', official: true, key: 'v1' },
    { site: 'YouTube', type: 'Teaser', official: true, key: 'yt-teaser' },
    { site: 'YouTube', type: 'Trailer', official: false, key: 'yt-unofficial' },
    { site: 'YouTube', type: 'Trailer', official: true, key: 'yt-official' },
  ];
  assert.equal(pickBestTrailer(videos)?.key, 'yt-official');
  assert.equal(pickBestTrailer(videos.slice(0, 2))?.key, 'yt-teaser');
});

test('detectPreferredCountryFromLocale and selectWatchProvidersForRegion resolve streaming providers cleanly', () => {
  assert.equal(detectPreferredCountryFromLocale('es-MX'), 'MX');
  assert.equal(detectPreferredCountryFromLocale('es'), 'ES');
  assert.equal(detectPreferredCountryFromLocale(''), 'AR');

  const results = {
    US: { link: 'https://tmdb/us', rent: [{ provider_id: 2, provider_name: 'Apple TV' }] },
    ES: {
      link: 'https://tmdb/es',
      flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/nf.jpg' }],
    },
  };
  const selectedEs = selectWatchProvidersForRegion(results, 'AR');
  assert.equal(selectedEs.region, 'ES');
  assert.equal(selectedEs.flatrate[0].provider_name, 'Netflix');
  assert.equal(selectWatchProvidersForRegion(results, 'US').region, 'US');
  assert.equal(selectWatchProvidersForRegion({}, 'AR'), null);
});

test('calculateDistanceKm and formatDistance compute readable cinema distances', () => {
  const samePoint = calculateDistanceKm(-34.6037, -58.3816, -34.6037, -58.3816);
  assert.equal(samePoint, 0);
  assert.equal(formatDistance(0.45), '450 m');
  assert.equal(formatDistance(2.34), '2.3 km');
  assert.equal(formatDistance(null), '');
});

test('buildNewsArticlePath, formatFullReleaseDate, formatVoteCount, and sanitizeExternalUrl work cleanly', () => {
  assert.equal(buildNewsArticlePath(603, 'Estreno'), '/noticia/603?cat=Estreno');
  assert.equal(buildNewsArticlePath('bad'), '/');
  assert.equal(formatFullReleaseDate('2026-11-24'), '24 nov 2026');
  assert.equal(formatFullReleaseDate(''), 'Por confirmar');
  assert.ok(formatVoteCount(1250).length > 0);
  assert.equal(sanitizeExternalUrl('https://elpais.com/cultura'), 'https://elpais.com/cultura');
  assert.equal(sanitizeExternalUrl('javascript:alert(1)'), '');
});

test('mergeSimilarMovies deduplicates, excludes active movie, and respects limit', () => {
  const recs = [
    { id: 10, title: 'Active Movie' },
    { id: 11, title: 'Rec One' },
  ];
  const sim = [
    { id: 11, title: 'Rec One Duplicate' },
    { id: 12, title: 'Sim Two' },
    { id: 13, title: 'Sim Three' },
  ];
  const merged = mergeSimilarMovies(recs, sim, 10, 2);
  assert.deepEqual(
    merged.map((m) => m.id),
    [11, 12]
  );
});
