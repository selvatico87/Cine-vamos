import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import tmdbService from '../services/tmdbService';
import { useMovieModal } from '../context/MovieModalContext';
import { formatRating, formatReleaseYear, getPosterUrl } from '../utils/movieHelpers';
import noPoster from '../img/no-poster.png';

function Resultados(props) {
  const { openMovieModal } = useMovieModal();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const keyword = query.get('keyword') || '';
  const [moviesResults, setMoviesResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!keyword) {
      setMoviesResults([]);
      return undefined;
    }
    let active = true;
    setLoading(true);

    tmdbService
      .searchMovies(keyword)
      .then((results) => {
        if (active) setMoviesResults(results);
      })
      .catch((error) => {
        console.error('Error buscando películas:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [keyword]);

  const isMovieInFavorites = (movieId) => {
    return props.favorites.find((fav) => fav.id === movieId);
  };

  return (
    <main className="vac-main-wrapper">
      <div className="vac-section-header">
        <div>
          <p className="vac-kicker">Búsqueda en TMDB</p>
          <h1 className="vac-section-title">
            Resultados para: <em>{keyword}</em>
          </h1>
        </div>
      </div>

      {loading && <p className="vac-muted-copy">Buscando películas...</p>}
      {!loading && moviesResults.length === 0 && (
        <p className="vac-muted-copy">No se encontraron resultados para "{keyword}".</p>
      )}

      <div className="vac-small-cards-grid">
        {moviesResults.map((oneMovie) => {
          const isFavorite = isMovieInFavorites(oneMovie.id);
          const poster = getPosterUrl(oneMovie.poster_path, noPoster);

          return (
            <article className="vac-small-card" key={oneMovie.id}>
              <div className="vac-small-poster-wrap">
                <button
                  type="button"
                  className="vac-poster-trigger"
                  onClick={() => openMovieModal(oneMovie.id)}
                  aria-label={`Abrir detalles de ${oneMovie.title}`}
                >
                  <img
                    src={poster}
                    className="vac-small-poster"
                    alt={oneMovie.title}
                    referrerPolicy="no-referrer"
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.addOrRemoveFav(e);
                  }}
                  className="favorite-btn"
                  data-movie-id={oneMovie.id}
                  data-movie-title={oneMovie.title}
                  data-movie-img={poster}
                  aria-label={
                    isFavorite
                      ? `Quitar ${oneMovie.title} de favoritos`
                      : `Agregar ${oneMovie.title} a favoritos`
                  }
                >
                  {isFavorite ? '❤️' : '🖤'}
                </button>
              </div>
              <div className="vac-small-body">
                <div className="vac-meta-line">
                  <span>{formatReleaseYear(oneMovie.release_date)}</span>
                  <span aria-hidden="true">·</span>
                  <span>★ {formatRating(oneMovie.vote_average)}</span>
                </div>
                <h3 className="vac-small-title">
                  <button
                    type="button"
                    className="vac-title-trigger"
                    onClick={() => openMovieModal(oneMovie.id)}
                  >
                    {oneMovie.title}
                  </button>
                </h3>
                <button
                  type="button"
                  onClick={() => openMovieModal(oneMovie.id)}
                  className="vac-small-link vac-small-link-btn"
                >
                  Ver detalles →
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

export default Resultados;
