import { Link } from 'react-router-dom';
import { useFirebase } from '../context/FirebaseContext';
import { useMovieModal } from '../context/MovieModalContext';
import noPoster from '../img/no-poster.png';

function Favoritos(props) {
  const { user, signInWithGoogle, authLoading } = useFirebase();
  const { openMovieModal } = useMovieModal();

  const handleRemoveFav = (e, movieId) => {
    e.stopPropagation();
    props.addOrRemoveFav(e, movieId);
  };

  return (
    <main className="vac-main-wrapper">
      <div className="vac-section-header">
        <div>
          <p className="vac-kicker">Colección personal</p>
          <h1 className="vac-section-title">Tus películas favoritas</h1>
        </div>
      </div>

      {!user && (
        <div className="vac-ai-panel">
          <p className="vac-muted-copy" style={{ marginBottom: '1rem' }}>
            Inicia sesión con tu cuenta de Google para guardar y sincronizar tus películas favoritas en Firestore.
          </p>
          <button
            type="button"
            className="vac-btn-primary"
            onClick={() => signInWithGoogle().catch(() => {})}
            disabled={authLoading}
          >
            {authLoading ? 'Conectando...' : 'Continuar con Google'}
          </button>
        </div>
      )}

      {user && !props.favorites.length && (
        <div className="vac-ai-panel">
          <p className="vac-muted-copy">
            No hay películas guardadas en tu sección de favoritos todavía. Explora la cartelera inicial y toca el corazón en cualquier película.
          </p>
          <Link to="/" className="vac-btn-outline mt-3">
            Ir a la cartelera
          </Link>
        </div>
      )}

      <div className="vac-small-cards-grid">
        {props.favorites.map((oneMovie) => (
          <article className="vac-small-card" key={oneMovie.id}>
            <div className="vac-small-poster-wrap">
              <button
                type="button"
                className="vac-poster-trigger"
                onClick={() => openMovieModal(oneMovie.id)}
                aria-label={`Abrir detalles de ${oneMovie.title}`}
              >
                <img
                  src={oneMovie.imgURL || noPoster}
                  className="vac-small-poster"
                  alt={oneMovie.title}
                  referrerPolicy="no-referrer"
                />
              </button>
              <button
                type="button"
                onClick={(e) => handleRemoveFav(e, oneMovie.id)}
                className="favorite-btn"
                data-movie-id={oneMovie.id}
                data-movie-title={oneMovie.title}
                data-movie-img={oneMovie.imgURL}
                aria-label={`Quitar ${oneMovie.title} de favoritos`}
              >
                ❤️
              </button>
            </div>
            <div className="vac-small-body">
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
        ))}
      </div>
    </main>
  );
}

export default Favoritos;
