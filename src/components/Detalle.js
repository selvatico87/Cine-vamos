import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import tmdbService from '../services/tmdbService';
import MovieSheetContent from './MovieSheetContent';

function Detalle() {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const movieID = query.get('movieID');

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!movieID) {
      setError('No se especificó ninguna película.');
      setLoading(false);
      return undefined;
    }
    let active = true;
    setDetails(null);
    setError('');
    setLoading(true);
    window.scrollTo({ top: 0, behavior: 'auto' });

    tmdbService
      .getMovieFullDetails(movieID)
      .then((movieData) => {
        if (active) setDetails(movieData);
      })
      .catch((err) => {
        console.error('Hay un error:', err);
        if (active) setError('No pudimos cargar los detalles de esta película.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [movieID]);

  return (
    <main className="vac-main-wrapper">
      <nav className="vac-article-topbar" aria-label="Navegación de ficha">
        <Link to="/" className="vac-btn-outline">
          ← Volver a cartelera
        </Link>
        <Link to="/listado" className="vac-btn-outline">
          Explorar Top 20
        </Link>
      </nav>

      {error && (
        <div className="vac-error-panel" role="alert">
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="vac-ai-panel" role="status">
          <p className="vac-kicker">Consultando TMDB</p>
          <h1 className="vac-section-title">Cargando ficha de la película...</h1>
        </div>
      )}

      {details?.movie && !loading && (
        <article className="vac-sheet-page-card">
          <MovieSheetContent
            details={details}
            variant="page"
            titleId="vac-detalle-title"
          />
        </article>
      )}
    </main>
  );
}

export default Detalle;
