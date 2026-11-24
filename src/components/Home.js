import React, { useEffect, useMemo, useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { useMovieModal } from '../context/MovieModalContext';
import tmdbService from '../services/tmdbService';
import {
  buildCinemaNewsFromMovies,
  formatRating,
  formatReleaseYear,
  getBackdropUrl,
  getPosterUrl,
  truncateText,
} from '../utils/movieHelpers';
import noPoster from '../img/no-poster.png';
import CinemaNews from './CinemaNews';
import AiRecommender from './AiRecommender';
import ListaGeneral from './ListaGeneral';

const CATEGORY_TABS = [
  { id: 'trending', label: 'En tendencia' },
  { id: 'top_rated', label: 'Mejor valoradas' },
  { id: 'now_playing', label: 'En cartelera' },
  { id: 'upcoming', label: 'Próximos estrenos' },
];

function Home() {
  const { favorites, toggleFavorite } = useFirebase();
  const { openMovieModal } = useMovieModal();
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [recommendedByTab, setRecommendedByTab] = useState({
    trending: [],
    top_rated: [],
    now_playing: [],
    upcoming: [],
  });
  const [activeTab, setActiveTab] = useState('trending');
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadInitialFeed() {
      setLoading(true);
      setFeedError('');
      try {
        const { trending, recommended, upcoming, nowPlaying } =
          await tmdbService.getHomeFeedData();
        if (!active) return;
        setTrendingMovies(trending);
        setRecommendedByTab({
          trending,
          top_rated: recommended,
          now_playing: nowPlaying,
          upcoming,
        });
      } catch (err) {
        console.error('Error cargando datos iniciales de TMDB:', err);
        if (active) {
          setFeedError(
            'No pudimos cargar los estrenos y tendencias desde TMDB. Reintenta en unos segundos.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadInitialFeed();
    return () => {
      active = false;
    };
  }, []);

  const heroMovie = trendingMovies[0] || null;

  const cinemaNews = useMemo(
    () =>
      buildCinemaNewsFromMovies(
        recommendedByTab.upcoming,
        recommendedByTab.trending
      ),
    [recommendedByTab.upcoming, recommendedByTab.trending]
  );

  const smallCardsMovies = (recommendedByTab[activeTab] || []).slice(0, 12);

  const isFav = (movieId) => favorites.some((fav) => fav.id === movieId);

  return (
    <main className="vac-main-wrapper">
      {feedError && (
        <div className="vac-error-panel" role="alert">
          {feedError}
        </div>
      )}

      {/* Hero Spotlight with Trending Movie */}
      {heroMovie && (
        <section className="vac-hero" aria-label="Película en tendencia destacada">
          <img
            src={getBackdropUrl(heroMovie.backdrop_path || heroMovie.poster_path, noPoster)}
            alt={heroMovie.title}
            className="vac-hero-bg"
            referrerPolicy="no-referrer"
          />
          <div className="vac-hero-scrim" />
          <div className="vac-hero-content">
            <p className="vac-hero-kicker">Tendencia principal de la semana</p>
            <h1 className="vac-hero-title">{heroMovie.title}</h1>
            <div className="vac-hero-meta">
              <span>Año {formatReleaseYear(heroMovie.release_date)}</span>
              <span aria-hidden="true">·</span>
              <span>★ {formatRating(heroMovie.vote_average)}</span>
              <span aria-hidden="true">·</span>
              <span>Popularidad {Math.round(heroMovie.popularity || 0)}</span>
            </div>
            <p className="vac-hero-overview">
              {truncateText(
                heroMovie.overview ||
                  'Descubre la película que lidera las tendencias internacionales esta semana en Vamos Al Cine.',
                210
              )}
            </p>
            <div className="vac-hero-actions">
              <button
                type="button"
                className="vac-btn-primary"
                onClick={() => openMovieModal(heroMovie.id)}
              >
                Ver ficha y tráiler
              </button>
              <button
                type="button"
                className="vac-btn-secondary"
                onClick={() =>
                  toggleFavorite({
                    id: heroMovie.id,
                    title: heroMovie.title,
                    imgURL: getPosterUrl(heroMovie.poster_path, noPoster),
                  })
                }
              >
                {isFav(heroMovie.id) ? 'En tus favoritos ❤️' : 'Guardar en favoritos'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Compact Recommended Movie Cards */}
      <section className="vac-section" aria-label="Películas recomendadas">
        <div className="vac-section-header">
          <div>
            <p className="vac-kicker">Selección curada TMDB</p>
            <h2 className="vac-section-title">Películas recomendadas</h2>
          </div>

          <div className="vac-tabs" role="tablist" aria-label="Categorías de películas">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`vac-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="vac-muted-copy">Cargando películas recomendadas...</p>
        ) : (
          <div className="vac-small-cards-grid">
            {smallCardsMovies.map((movie) => {
              const poster = getPosterUrl(movie.poster_path, noPoster);
              const favActive = isFav(movie.id);

              return (
                <article key={movie.id} className="vac-small-card">
                  <div className="vac-small-poster-wrap">
                    <button
                      type="button"
                      className="vac-poster-trigger"
                      onClick={() => openMovieModal(movie.id)}
                      aria-label={`Abrir detalles de ${movie.title}`}
                    >
                      <img
                        src={poster}
                        alt={movie.title}
                        className="vac-small-poster"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                    <button
                      type="button"
                      className="favorite-btn"
                      aria-label={
                        favActive
                          ? `Quitar ${movie.title} de favoritos`
                          : `Agregar ${movie.title} a favoritos`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite({
                          id: movie.id,
                          title: movie.title,
                          imgURL: poster,
                        });
                      }}
                    >
                      {favActive ? '❤️' : '🖤'}
                    </button>
                  </div>

                  <div className="vac-small-body">
                    <div className="vac-meta-line">
                      <span>{formatReleaseYear(movie.release_date)}</span>
                      <span aria-hidden="true">·</span>
                      <span>★ {formatRating(movie.vote_average)}</span>
                    </div>
                    <h3 className="vac-small-title">
                      <button
                        type="button"
                        className="vac-title-trigger"
                        onClick={() => openMovieModal(movie.id)}
                      >
                        {movie.title}
                      </button>
                    </h3>
                    <button
                      type="button"
                      className="vac-small-link vac-small-link-btn"
                      onClick={() => openMovieModal(movie.id)}
                    >
                      Ver detalles →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Editorial Cinema News */}
      <CinemaNews news={cinemaNews} loading={loading} />

      {/* AI Movie Recommender */}
      <AiRecommender favorites={favorites} onToggleFavorite={toggleFavorite} />

      {/* Discovery Catalog */}
      <section className="vac-section" aria-label="Explorar catálogo completo">
        <div className="vac-section-header">
          <div>
            <p className="vac-kicker">Archivo general</p>
            <h2 className="vac-section-title">Explorar cartelera completa</h2>
          </div>
          <p className="vac-muted-copy">Navega por páginas del catálogo general de TMDB</p>
        </div>
        <ListaGeneral />
      </section>
    </main>
  );
}

export default Home;