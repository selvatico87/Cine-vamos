import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import tmdbService from '../services/tmdbService';
import { getPosterUrl } from '../utils/movieHelpers';
import { useFirebase } from '../context/FirebaseContext';
import { useMovieModal } from '../context/MovieModalContext';
import noPoster from '../img/no-poster.png';

function Listado(props) {
  const { isAuthenticated } = useFirebase();
  const { openMovieModal } = useMovieModal();
  const [movieList, setMovieList] = useState([]);

  useEffect(() => {
    let active = true;
    tmdbService
      .getDiscoverMovies(1)
      .then((results) => {
        if (active) setMovieList(results);
      })
      .catch((error) => {
        console.error(error);
      });
    return () => {
      active = false;
    };
  }, []);

  const isMovieInFavorites = (movieId) => {
    return props.favorites.find((id) => id.id === movieId);
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <main className="vac-main-wrapper">
      <div className="vac-section-header">
        <div>
          <p className="vac-kicker">Ranking semanal</p>
          <h1 className="vac-section-title">Top 20 en cartelera</h1>
        </div>
      </div>

      <div className="row g-3">
        {movieList.map((oneMovie, idx) => {
          const isFavorite = isMovieInFavorites(oneMovie.id);
          const poster = getPosterUrl(oneMovie.poster_path, noPoster);

          return (
            <div className="col-6 col-md-4 col-lg-3" key={oneMovie.id}>
              <div className="card h-100 position-relative">
                <div className="position-relative" style={{ height: '360px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    className="vac-poster-trigger"
                    onClick={() => openMovieModal(oneMovie.id)}
                    aria-label={`Abrir detalles de ${oneMovie.title}`}
                  >
                    <img
                      src={poster}
                      className="card-img-top"
                      style={{ width: '100%', height: '360px', objectFit: 'cover' }}
                      alt={oneMovie.title}
                      referrerPolicy="no-referrer"
                    />
                  </button>
                  <span className="position-top-movies tabular-nums">{idx + 1}</span>
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
                <div className="card-body d-flex flex-column justify-content-between">
                  <h5 className="card-title" style={{ fontSize: '1em' }}>
                    <button
                      type="button"
                      className="vac-title-trigger"
                      onClick={() => openMovieModal(oneMovie.id)}
                    >
                      {oneMovie.title.substring(0, 40)}
                    </button>
                  </h5>
                  <button
                    type="button"
                    onClick={() => openMovieModal(oneMovie.id)}
                    className="btn btn-dark mt-2"
                  >
                    Ver detalles
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default Listado;
