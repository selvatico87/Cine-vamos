import { useEffect, useState } from 'react';
import tmdbService from '../services/tmdbService';
import { formatRating, formatReleaseYear, getPosterUrl } from '../utils/movieHelpers';
import noPoster from '../img/no-poster.png';
import { useFirebase } from '../context/FirebaseContext';
import { useMovieModal } from '../context/MovieModalContext';

function ListaGeneral() {
  const { favorites, toggleFavorite } = useFirebase();
  const { openMovieModal } = useMovieModal();
  const [movieList, setMovieList] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;
    tmdbService
      .getDiscoverMovies(currentPage)
      .then((results) => {
        if (active) setMovieList(results);
      })
      .catch((error) => {
        console.error(error);
      });
    return () => {
      active = false;
    };
  }, [currentPage]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const isFav = (movieId) => favorites.some((fav) => fav.id === movieId);

  return (
    <>
      <div className="pagination" role="navigation" aria-label="Paginación superior">
        {Array.from({ length: 15 }, (_, index) => index + 1).map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={currentPage === pageNumber ? 'active' : ''}
            onClick={() => handlePageChange(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
      </div>

      <div className="vac-small-cards-grid">
        {movieList.map((oneMovie) => {
          const poster = getPosterUrl(oneMovie.poster_path, noPoster);
          const favActive = isFav(oneMovie.id);

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
                  className="favorite-btn"
                  aria-label={
                    favActive
                      ? `Quitar ${oneMovie.title} de favoritos`
                      : `Agregar ${oneMovie.title} a favoritos`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite({
                      id: oneMovie.id,
                      title: oneMovie.title,
                      imgURL: poster,
                    });
                  }}
                >
                  {favActive ? '❤️' : '🖤'}
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
                  className="vac-small-link vac-small-link-btn"
                  onClick={() => openMovieModal(oneMovie.id)}
                >
                  Ver detalles →
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="pagination" role="navigation" aria-label="Paginación inferior">
        {Array.from({ length: 15 }, (_, index) => index + 1).map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={currentPage === pageNumber ? 'active' : ''}
            onClick={() => handlePageChange(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
      </div>
    </>
  );
}

export default ListaGeneral;
