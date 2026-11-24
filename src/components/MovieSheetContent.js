import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMovieModal } from '../context/MovieModalContext';
import { useFirebase } from '../context/FirebaseContext';
import { searchNearbyCinemas } from '../services/cinemaService';
import { fetchMovieRealNews } from '../services/newsService';
import {
  buildNewsArticlePath,
  calculateDistanceKm,
  formatDistance,
  formatFullReleaseDate,
  formatRating,
  formatReleaseYear,
  formatVoteCount,
  getBackdropUrl,
  getPosterUrl,
  getProfileUrl,
  pickBestTrailer,
  sanitizeExternalUrl,
  selectWatchProvidersForRegion,
} from '../utils/movieHelpers';
import noPoster from '../img/no-poster.png';

const REGION_OPTIONS = [
  { code: 'AR', label: 'Argentina' },
  { code: 'ES', label: 'España' },
  { code: 'MX', label: 'México' },
  { code: 'CO', label: 'Colombia' },
  { code: 'CL', label: 'Chile' },
  { code: 'US', label: 'Estados Unidos' },
];

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function MovieSheetContent({
  details,
  variant = 'modal',
  onCloseModal,
  titleId = 'vac-sheet-title',
}) {
  const { openMovieModal, userCoords, setUserCoords, preferredRegion, setPreferredRegion } =
    useMovieModal();
  const { favorites, toggleFavorite } = useFirebase();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [showEmbeddedTrailer, setShowEmbeddedTrailer] = useState(false);

  const [cinemas, setCinemas] = useState([]);
  const [cinemasLoading, setCinemasLoading] = useState(false);
  const [cinemasError, setCinemasError] = useState('');
  const [cinemasSearched, setCinemasSearched] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [cityQuery, setCityQuery] = useState('');

  const [realNews, setRealNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState('');

  const movie = details?.movie || null;
  const movieId = movie?.id;

  const handleSelectRelatedMovie = (relatedMovieId) => {
    if (variant === 'modal') {
      openMovieModal(relatedMovieId);
    } else {
      navigate(`/detalle?movieID=${relatedMovieId}`);
    }
  };

  useEffect(() => {
    setActiveTab('overview');
    setShowEmbeddedTrailer(false);
    setRealNews(null);
    setNewsError('');
    setNewsLoading(false);
  }, [movieId]);

  const fetchCinemasByCoords = useCallback(
    async (coords) => {
      setCinemasLoading(true);
      setCinemasError('');
      setCinemasSearched(true);
      try {
        const res = await searchNearbyCinemas({
          lat: coords.lat,
          lng: coords.lng,
        });
        setCinemas(res.cinemas);
        setLocationLabel('cerca de tu ubicación actual');
        if (res.detectedCountry) {
          setPreferredRegion(res.detectedCountry);
        }
      } catch (err) {
        setCinemas([]);
        setCinemasError(
          err instanceof Error
            ? err.message
            : 'No pudimos obtener cines cercanos en este momento.'
        );
      } finally {
        setCinemasLoading(false);
      }
    },
    [setPreferredRegion]
  );

  useEffect(() => {
    if (movieId && userCoords && !cinemasSearched) {
      fetchCinemasByCoords(userCoords);
    }
  }, [movieId, userCoords, cinemasSearched, fetchCinemasByCoords]);

  const loadMovieRealNews = useCallback(
    async (forceRefresh = false) => {
      if (!movie?.id || !movie?.title) return;
      setNewsLoading(true);
      setNewsError('');
      try {
        const data = await fetchMovieRealNews({
          movieId: movie.id,
          title: movie.title,
          originalTitle: movie.original_title || '',
          releaseDate: movie.release_date || '',
          forceRefresh,
        });
        setRealNews(data);
      } catch (err) {
        setNewsError(
          err instanceof Error
            ? err.message
            : 'No pudimos recuperar noticias reales en internet sobre esta película.'
        );
      } finally {
        setNewsLoading(false);
      }
    },
    [movie?.id, movie?.title, movie?.original_title, movie?.release_date]
  );

  useEffect(() => {
    if (activeTab === 'news' && movie?.id && !realNews && !newsLoading && !newsError) {
      loadMovieRealNews(false);
    }
  }, [activeTab, movie?.id, realNews, newsLoading, newsError, loadMovieRealNews]);

  const handleUseMyLocation = () => {
    setCinemasError('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCinemasError(
        'Tu navegador no admite geolocalización. Escribe tu ciudad o barrio abajo para buscar cines.'
      );
      return;
    }

    setCinemasLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserCoords(coords);
        fetchCinemasByCoords(coords);
      },
      (geoError) => {
        setCinemasLoading(false);
        if (geoError?.code === 1) {
          setCinemasError(
            'Permiso de ubicación denegado. Puedes ingresar tu ciudad o zona manualmente aquí abajo.'
          );
        } else {
          setCinemasError(
            'No pudimos detectar tu ubicación actual. Ingresa tu ciudad o barrio para ver cines cercanos.'
          );
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  const handleCitySearch = async (event) => {
    event.preventDefault();
    const trimmed = cityQuery.trim();
    if (!trimmed) {
      setCinemasError('Escribe una ciudad o barrio para buscar cines.');
      return;
    }

    setCinemasLoading(true);
    setCinemasError('');
    setCinemasSearched(true);
    try {
      const res = await searchNearbyCinemas({ query: trimmed });
      setCinemas(res.cinemas);
      setLocationLabel(`en "${trimmed}"`);
      if (res.detectedCountry) {
        setPreferredRegion(res.detectedCountry);
      }
    } catch (err) {
      setCinemas([]);
      setCinemasError(
        err instanceof Error ? err.message : 'No pudimos buscar cines en esa zona.'
      );
    } finally {
      setCinemasLoading(false);
    }
  };

  const cast = details?.cast || [];
  const trailer = useMemo(() => pickBestTrailer(details?.videos || []), [details?.videos]);
  const watchProviders = useMemo(
    () => selectWatchProvidersForRegion(details?.providers || {}, preferredRegion),
    [details?.providers, preferredRegion]
  );

  if (!movie) return null;

  const isFav = favorites.some((fav) => fav.id === movie.id);
  const trailerWatchUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '';
  const posterUrl = getPosterUrl(movie.poster_path, noPoster);
  const backdropUrl = getBackdropUrl(movie.backdrop_path || movie.poster_path, '');
  const director = (details?.crew || []).find((person) => person.job === 'Director');
  const votesLabel = formatVoteCount(movie.vote_count);
  const companies = (movie.production_companies || [])
    .slice(0, 3)
    .map((c) => c.name)
    .join(', ');
  const articlePath = buildNewsArticlePath(movie.id, 'Crítica y prensa');

  return (
    <>
      <div className={`vac-modal-hero ${variant === 'page' ? 'vac-sheet-hero-page' : ''}`}>
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt=""
            className="vac-modal-hero-bg"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="vac-modal-hero-scrim" />
        <div className="vac-modal-hero-content">
          <img
            src={posterUrl}
            alt={movie.title}
            className="vac-modal-poster"
            referrerPolicy="no-referrer"
          />
          <div className="vac-modal-hero-info">
            <div className="vac-modal-meta-light">
              <span>{formatReleaseYear(movie.release_date)}</span>
              <span aria-hidden="true">·</span>
              <span>
                ★ {formatRating(movie.vote_average)}
                {votesLabel ? ` (${votesLabel})` : ''}
              </span>
              {movie.runtime > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{movie.runtime} min</span>
                </>
              )}
              {director && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Dir. {director.name}</span>
                </>
              )}
            </div>

            {variant === 'page' ? (
              <h1 id={titleId} className="vac-modal-title">
                {movie.title}
              </h1>
            ) : (
              <h2 id={titleId} className="vac-modal-title">
                {movie.title}
              </h2>
            )}

            {movie.tagline && <p className="vac-modal-tagline">{movie.tagline}</p>}

            {(movie.genres || []).length > 0 && (
              <p className="vac-modal-genres">
                {movie.genres.map((g) => g.name).join(' · ')}
              </p>
            )}

            <div className="vac-modal-actions">
              {trailer ? (
                <>
                  <a
                    href={trailerWatchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vac-btn-primary"
                  >
                    Ver tráiler en YouTube ↗
                  </a>
                  <button
                    type="button"
                    className="vac-btn-secondary"
                    onClick={() => setShowEmbeddedTrailer((prev) => !prev)}
                  >
                    {showEmbeddedTrailer ? 'Ocultar reproductor' : 'Reproducir aquí'}
                  </button>
                </>
              ) : (
                <span className="vac-modal-no-trailer">
                  Tráiler oficial no disponible en TMDB
                </span>
              )}

              <button
                type="button"
                className="vac-btn-secondary"
                onClick={() =>
                  toggleFavorite({
                    id: movie.id,
                    title: movie.title,
                    imgURL: posterUrl,
                  })
                }
              >
                {isFav ? 'En favoritos ❤️' : 'Guardar en favoritos'}
              </button>

              <Link
                to={articlePath}
                state={{
                  newsItem: {
                    movieId: movie.id,
                    category: 'Crítica y prensa',
                    title: movie.title,
                    summary: movie.overview,
                    releaseDate: movie.release_date,
                    backdropUrl,
                    posterUrl,
                  },
                }}
                onClick={() => {
                  if (onCloseModal) onCloseModal();
                }}
                className="vac-btn-secondary"
              >
                Crónica del crítico IA →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Editorial Tab Strip */}
      <div className="vac-sheet-tabbar-wrap">
        <div
          className="vac-tabs vac-sheet-tabs"
          role="tablist"
          aria-label="Secciones de la ficha de película"
        >
          <button
            type="button"
            role="tab"
            id={`${titleId}-tab-overview`}
            aria-selected={activeTab === 'overview'}
            className={`vac-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Resumen y reparto
          </button>
          <button
            type="button"
            role="tab"
            id={`${titleId}-tab-watch`}
            aria-selected={activeTab === 'watch'}
            className={`vac-tab-btn ${activeTab === 'watch' ? 'active' : ''}`}
            onClick={() => setActiveTab('watch')}
          >
            Dónde ver
          </button>
          <button
            type="button"
            role="tab"
            id={`${titleId}-tab-news`}
            aria-selected={activeTab === 'news'}
            className={`vac-tab-btn ${activeTab === 'news' ? 'active' : ''}`}
            onClick={() => setActiveTab('news')}
          >
            Noticias reales
          </button>
        </div>
      </div>

      <div className="vac-modal-body">
        {showEmbeddedTrailer && trailer && (
          <section className="vac-modal-section" aria-label="Reproductor de tráiler">
            <div className="ratio ratio-16x9 vac-modal-video-wrap">
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title={`Tráiler de ${movie.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        )}

        {/* TAB 1: Overview & Cast */}
        {activeTab === 'overview' && (
          <div role="tabpanel" aria-labelledby={`${titleId}-tab-overview`} className="vac-sheet-tabpanel">
            <div className="vac-sheet-overview-grid">
              <section className="vac-modal-section" aria-label="Sinopsis">
                <p className="vac-kicker">Sinopsis</p>
                <p className="vac-modal-synopsis">
                  {movie.overview ||
                    'Sinopsis en español no disponible por el momento en TMDB.'}
                </p>
              </section>

              <aside className="vac-sheet-spec-card" aria-label="Ficha técnica">
                <p className="vac-kicker" style={{ marginBottom: '0.45rem' }}>
                  Ficha técnica
                </p>
                <dl className="vac-spec-list">
                  <div className="vac-spec-row">
                    <dt className="vac-spec-label">Estreno</dt>
                    <dd className="vac-spec-value tabular-nums">
                      {formatFullReleaseDate(movie.release_date)}
                    </dd>
                  </div>
                  {director && (
                    <div className="vac-spec-row">
                      <dt className="vac-spec-label">Dirección</dt>
                      <dd className="vac-spec-value">{director.name}</dd>
                    </div>
                  )}
                  {movie.runtime > 0 && (
                    <div className="vac-spec-row">
                      <dt className="vac-spec-label">Duración</dt>
                      <dd className="vac-spec-value tabular-nums">{movie.runtime} minutos</dd>
                    </div>
                  )}
                  {movie.original_language && (
                    <div className="vac-spec-row">
                      <dt className="vac-spec-label">Idioma original</dt>
                      <dd className="vac-spec-value">
                        {movie.original_language.toUpperCase()}
                      </dd>
                    </div>
                  )}
                  {companies && (
                    <div className="vac-spec-row">
                      <dt className="vac-spec-label">Producción</dt>
                      <dd className="vac-spec-value">{companies}</dd>
                    </div>
                  )}
                  {movie.homepage && sanitizeExternalUrl(movie.homepage) && (
                    <div className="vac-spec-row">
                      <dt className="vac-spec-label">Sitio oficial</dt>
                      <dd className="vac-spec-value">
                        <a
                          href={sanitizeExternalUrl(movie.homepage)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="vac-small-link"
                          style={{ marginTop: 0, paddingTop: 0 }}
                        >
                          Visitar web ↗
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </aside>
            </div>

            <section className="vac-modal-section" aria-label="Elenco principal">
              <div className="vac-modal-section-head">
                <div>
                  <p className="vac-kicker">Reparto</p>
                  <h3 className="vac-modal-subtitle">Elenco principal</h3>
                </div>
              </div>

                {cast.length > 0 ? (
                <div className="vac-cast-grid">
                  {cast.slice(0, 8).map((person) => {
                    const photo = getProfileUrl(person.profile_path, '');
                    return (
                      <div key={person.id} className="vac-cast-card">
                        {photo ? (
                          <img
                            src={photo}
                            alt={person.name}
                            className="vac-cast-avatar"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="vac-cast-avatar-fallback" aria-hidden="true">
                            {getInitials(person.name)}
                          </div>
                        )}
                        <div className="vac-cast-text">
                          <p className="vac-cast-name">{person.name}</p>
                          {person.character && (
                            <p className="vac-cast-role">{person.character}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="vac-muted-copy">
                  Información de elenco no disponible en TMDB para este título.
                </p>
              )}
            </section>

            {Array.isArray(details?.similarMovies) && details.similarMovies.length > 0 && (
              <section
                className="vac-modal-section vac-sheet-similar-section"
                aria-label="Películas similares que podrían gustarte"
              >
                <div className="vac-modal-section-head">
                  <div>
                    <p className="vac-kicker">Sugerencias relacionadas</p>
                    <h3 className="vac-modal-subtitle">
                      Si te gustó, también podrían gustarte
                    </h3>
                  </div>
                </div>

                <div className="vac-sheet-similar-grid">
                  {details.similarMovies.map((sim) => {
                    const simPoster = getPosterUrl(sim.poster_path, noPoster);
                    const simFav = favorites.some((fav) => fav.id === sim.id);
                    return (
                      <article key={sim.id} className="vac-small-card">
                        <div className="vac-small-poster-wrap">
                          <button
                            type="button"
                            className="vac-poster-trigger"
                            onClick={() => handleSelectRelatedMovie(sim.id)}
                            aria-label={`Abrir ficha de ${sim.title}`}
                          >
                            <img
                              src={simPoster}
                              alt={sim.title}
                              className="vac-small-poster"
                              referrerPolicy="no-referrer"
                            />
                          </button>
                          <button
                            type="button"
                            className="favorite-btn"
                            aria-label={
                              simFav
                                ? `Quitar ${sim.title} de favoritos`
                                : `Agregar ${sim.title} a favoritos`
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite({
                                id: sim.id,
                                title: sim.title,
                                imgURL: simPoster,
                              });
                            }}
                          >
                            {simFav ? '❤️' : '🖤'}
                          </button>
                        </div>
                        <div className="vac-small-body">
                          <div className="vac-meta-line">
                            <span>{formatReleaseYear(sim.release_date)}</span>
                            <span aria-hidden="true">·</span>
                            <span>★ {formatRating(sim.vote_average)}</span>
                          </div>
                          <h4 className="vac-small-title">
                            <button
                              type="button"
                              className="vac-title-trigger"
                              onClick={() => handleSelectRelatedMovie(sim.id)}
                            >
                              {sim.title}
                            </button>
                          </h4>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: Where to Watch (Streaming + Cinemas) */}
        {activeTab === 'watch' && (
          <div role="tabpanel" aria-labelledby={`${titleId}-tab-watch`} className="vac-sheet-tabpanel">
            <div className="vac-modal-watch-grid">
              <section
                className="vac-modal-watch-panel"
                aria-label="Dónde ver en streaming"
              >
                <div className="vac-modal-section-head">
                  <div>
                    <p className="vac-kicker">Plataformas digitales</p>
                    <h3 className="vac-modal-subtitle">Dónde ver en streaming</h3>
                  </div>

                  <div className="vac-region-select-wrap">
                    <label htmlFor={`${titleId}-region`} className="visually-hidden">
                      País de streaming
                    </label>
                    <select
                      id={`${titleId}-region`}
                      className="vac-region-select"
                      value={preferredRegion}
                      onChange={(e) => setPreferredRegion(e.target.value)}
                    >
                      {REGION_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {watchProviders ? (
                  <>
                    <p className="vac-meta-line" style={{ marginBottom: '0.25rem' }}>
                      <span>Catálogo detectado para {watchProviders.region}</span>
                      {watchProviders.link && (
                        <>
                          <span aria-hidden="true">·</span>
                          <a
                            href={watchProviders.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="vac-small-link"
                            style={{ marginTop: 0, paddingTop: 0 }}
                          >
                            Ver enlaces oficiales en JustWatch / TMDB ↗
                          </a>
                        </>
                      )}
                    </p>

                    {watchProviders.flatrate.length > 0 && (
                      <div className="vac-provider-group">
                        <p className="vac-provider-group-label">Suscripción</p>
                        <div className="vac-provider-list">
                          {watchProviders.flatrate.map((provider) => (
                            <a
                              key={provider.provider_id}
                              href={
                                watchProviders.link ||
                                `https://www.themoviedb.org/movie/${movie.id}/watch`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="vac-provider-link"
                            >
                              <img
                                src={getPosterUrl(provider.logo_path, noPoster)}
                                alt={provider.provider_name}
                                className="vac-provider-logo"
                                referrerPolicy="no-referrer"
                              />
                              <span>{provider.provider_name} ↗</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {watchProviders.rent.length > 0 && (
                      <div className="vac-provider-group">
                        <p className="vac-provider-group-label">Alquiler o compra</p>
                        <div className="vac-provider-list">
                          {watchProviders.rent.slice(0, 6).map((provider) => (
                            <a
                              key={provider.provider_id}
                              href={
                                watchProviders.link ||
                                `https://www.themoviedb.org/movie/${movie.id}/watch`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="vac-provider-link"
                            >
                              <img
                                src={getPosterUrl(provider.logo_path, noPoster)}
                                alt={provider.provider_name}
                                className="vac-provider-logo"
                                referrerPolicy="no-referrer"
                              />
                              <span>{provider.provider_name} ↗</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {watchProviders.flatrate.length === 0 &&
                      watchProviders.rent.length === 0 &&
                      watchProviders.buy.length > 0 && (
                        <div className="vac-provider-group">
                          <p className="vac-provider-group-label">Compra digital</p>
                          <div className="vac-provider-list">
                            {watchProviders.buy.slice(0, 6).map((provider) => (
                              <a
                                key={provider.provider_id}
                                href={
                                  watchProviders.link ||
                                  `https://www.themoviedb.org/movie/${movie.id}/watch`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="vac-provider-link"
                              >
                                <img
                                  src={getPosterUrl(provider.logo_path, noPoster)}
                                  alt={provider.provider_name}
                                  className="vac-provider-logo"
                                  referrerPolicy="no-referrer"
                                />
                                <span>{provider.provider_name} ↗</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                  </>
                ) : (
                  <p className="vac-muted-copy">
                    Aún no figura en plataformas de streaming para esta región; prueba cambiar de país o revisa los cines cercanos.
                  </p>
                )}
              </section>

              <section
                className="vac-modal-watch-panel"
                aria-label="Cines cercanos según tu ubicación"
              >
                <div className="vac-modal-section-head">
                  <div>
                    <p className="vac-kicker">Cartelera presencial</p>
                    <h3 className="vac-modal-subtitle">Cines cerca de ti</h3>
                  </div>
                </div>

                <div className="vac-cinema-controls">
                  <button
                    type="button"
                    className="vac-btn-primary"
                    onClick={handleUseMyLocation}
                    disabled={cinemasLoading}
                  >
                    {cinemasLoading ? 'Buscando cines...' : 'Usar mi ubicación'}
                  </button>

                  <form onSubmit={handleCitySearch} className="vac-cinema-city-form">
                    <label htmlFor="vac-cinema-city-input" className="visually-hidden">
                      Buscar cines por ciudad o barrio
                    </label>
                    <input
                      id="vac-cinema-city-input"
                      type="text"
                      className="vac-cinema-city-input"
                      placeholder="Ciudad o zona (ej: Buenos Aires)"
                      value={cityQuery}
                      onChange={(e) => setCityQuery(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="vac-btn-outline"
                      disabled={cinemasLoading}
                    >
                      Buscar cines
                    </button>
                  </form>
                </div>

                {cinemasError && (
                  <div className="vac-error-panel" role="alert">
                    {cinemasError}
                  </div>
                )}

                {!cinemasSearched && !cinemasLoading && !cinemasError && (
                  <p className="vac-muted-copy">
                    Comparte tu ubicación o ingresa tu ciudad para encontrar salas de cine cercanas y abrir su cartelera o ruta en Google Maps.
                  </p>
                )}

                {cinemasSearched && !cinemasLoading && !cinemasError && cinemas.length === 0 && (
                  <p className="vac-muted-copy">
                    No encontramos cines {locationLabel}. Prueba indicando una ciudad principal cercana.
                  </p>
                )}

                {cinemas.length > 0 && (
                  <div className="vac-cinema-results">
                    <p className="vac-meta-line" style={{ marginBottom: '0.5rem' }}>
                      <span>Resultados {locationLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>Datos de Google Maps</span>
                    </p>

                    {cinemas.map((cinema) => {
                      const distKm =
                        userCoords && cinema.location
                          ? calculateDistanceKm(
                              userCoords.lat,
                              userCoords.lng,
                              cinema.location.lat,
                              cinema.location.lng
                            )
                          : null;
                      const distText = distKm !== null ? formatDistance(distKm) : '';

                      return (
                        <article key={cinema.id || cinema.name} className="vac-cinema-item">
                          <div className="vac-cinema-item-top">
                            <h4 className="vac-cinema-name">{cinema.name}</h4>
                            <div className="vac-meta-line">
                              {distText && <span>{distText}</span>}
                              {distText && cinema.rating && <span aria-hidden="true">·</span>}
                              {cinema.rating && (
                                <span>
                                  ★ {cinema.rating.toFixed(1)}
                                  {cinema.userRatingCount
                                    ? ` (${cinema.userRatingCount})`
                                    : ''}
                                </span>
                              )}
                              {cinema.openNow !== null && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{cinema.openNow ? 'Abierto ahora' : 'Cerrado'}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {cinema.address && (
                            <p className="vac-cinema-address">{cinema.address}</p>
                          )}

                          <div className="vac-cinema-links">
                            {cinema.placeUri && (
                              <a
                                href={cinema.placeUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="vac-small-link"
                                style={{ marginTop: 0, paddingTop: 0 }}
                              >
                                Ver cine en Maps ↗
                              </a>
                            )}
                            {cinema.directionsUri && (
                              <a
                                href={cinema.directionsUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="vac-small-link"
                                style={{ marginTop: 0, paddingTop: 0 }}
                              >
                                Cómo llegar ↗
                              </a>
                            )}
                            {cinema.websiteUri && (
                              <a
                                href={cinema.websiteUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="vac-small-link"
                                style={{ marginTop: 0, paddingTop: 0 }}
                              >
                                Sitio del cine ↗
                              </a>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* TAB 3: Real Web-Grounded Movie News */}
        {activeTab === 'news' && (
          <div role="tabpanel" aria-labelledby={`${titleId}-tab-news`} className="vac-sheet-tabpanel">
            <div className="vac-modal-section-head">
              <div>
                <p className="vac-kicker">Prensa verificada en internet</p>
                <h3 className="vac-modal-subtitle">
                  Noticias reales sobre {movie.title}
                </h3>
              </div>

              <div className="vac-sheet-news-actions">
                <button
                  type="button"
                  className="vac-btn-outline"
                  onClick={() => loadMovieRealNews(true)}
                  disabled={newsLoading}
                >
                  {newsLoading ? 'Buscando prensa...' : 'Actualizar noticias'}
                </button>
                <Link
                  to={articlePath}
                  state={{
                    newsItem: {
                      movieId: movie.id,
                      category: 'Crítica y prensa',
                      title: movie.title,
                      summary: movie.overview,
                      releaseDate: movie.release_date,
                      backdropUrl,
                      posterUrl,
                    },
                  }}
                  onClick={() => {
                    if (onCloseModal) onCloseModal();
                  }}
                  className="vac-btn-primary"
                >
                  Leer nota completa del crítico IA →
                </Link>
              </div>
            </div>

            {newsLoading && (
              <div className="vac-article-loading" role="status">
                <p className="vac-muted-copy">
                  Buscando artículos reales, críticas publicadas y novedades de prensa sobre <strong>{movie.title}</strong>...
                </p>
                <div className="vac-skeleton-lines" aria-hidden="true">
                  <div className="vac-skeleton-line vac-skeleton-line-lg" />
                  <div className="vac-skeleton-line" />
                  <div className="vac-skeleton-line vac-skeleton-line-md" />
                </div>
              </div>
            )}

            {newsError && !newsLoading && (
              <div className="vac-error-panel" role="alert">
                <p style={{ margin: '0 0 0.75rem', fontWeight: 600 }}>{newsError}</p>
                <button
                  type="button"
                  className="vac-btn-primary"
                  onClick={() => loadMovieRealNews(true)}
                >
                  Reintentar búsqueda
                </button>
              </div>
            )}

            {realNews && !newsLoading && (
              <>
                {realNews.contextSummary && (
                  <p className="vac-sheet-news-lead">{realNews.contextSummary}</p>
                )}

                {realNews.items && realNews.items.length > 0 ? (
                  <div className="vac-sheet-news-grid">
                    {realNews.items.map((item, idx) => {
                      const safeUrl = sanitizeExternalUrl(item.url);
                      return (
                        <article key={`${item.title}-${idx}`} className="vac-sheet-news-card">
                          <div className="vac-meta-line">
                            <span>{item.sourceName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.publishedLabel}</span>
                            {item.angle && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{item.angle}</span>
                              </>
                            )}
                          </div>
                          <h4 className="vac-sheet-news-title">{item.title}</h4>
                          <p className="vac-muted-copy" style={{ fontSize: '0.86rem' }}>
                            {item.summary}
                          </p>
                          {safeUrl && (
                            <a
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="vac-small-link"
                            >
                              Abrir fuente original ↗
                            </a>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="vac-muted-copy">
                    No se encontraron titulares recientes específicos en este momento. Puedes generar la nota completa de contexto con nuestro crítico experto en IA.
                  </p>
                )}

                {realNews.sources && realNews.sources.length > 0 && (
                  <div className="vac-sheet-sources-strip">
                    <p className="vac-provider-group-label" style={{ marginBottom: '0.45rem' }}>
                      Fuentes web verificadas
                    </p>
                    <div className="vac-cinema-links">
                      {realNews.sources.slice(0, 6).map((src) => {
                        const safeUrl = sanitizeExternalUrl(src.url);
                        if (!safeUrl) return null;
                        return (
                          <a
                            key={safeUrl}
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="vac-small-link"
                            style={{ marginTop: 0, paddingTop: 0 }}
                          >
                            {src.publisher} ↗
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {variant === 'modal' && (
          <div className="vac-modal-footer-row">
            <Link
              to={`/detalle?movieID=${movie.id}`}
              className="vac-btn-outline"
              onClick={onCloseModal}
            >
              Abrir ficha completa en página →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

export default MovieSheetContent;
