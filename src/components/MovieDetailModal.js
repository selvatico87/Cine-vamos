import React, { useEffect, useRef, useState } from 'react';
import { useMovieModal } from '../context/MovieModalContext';
import tmdbService from '../services/tmdbService';
import MovieSheetContent from './MovieSheetContent';

function MovieDetailModal() {
  const { selectedMovieId, closeMovieModal } = useMovieModal();

  const [details, setDetails] = useState(null);
  const [loadingMovie, setLoadingMovie] = useState(false);
  const [movieError, setMovieError] = useState('');

  const closeBtnRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!selectedMovieId) return undefined;

    let active = true;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (dialogRef.current) {
      dialogRef.current.scrollTop = 0;
    }

    setDetails(null);
    setMovieError('');
    setLoadingMovie(true);

    tmdbService
      .getMovieFullDetails(selectedMovieId)
      .then((data) => {
        if (active) setDetails(data);
      })
      .catch((err) => {
        console.error('Error cargando detalles del modal:', err);
        if (active) {
          setMovieError('No pudimos cargar la ficha completa de esta película.');
        }
      })
      .finally(() => {
        if (active) setLoadingMovie(false);
      });

    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 30);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMovieModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      active = false;
      clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedMovieId, closeMovieModal]);

  if (!selectedMovieId) {
    return null;
  }

  return (
    <div
      className="vac-modal-backdrop"
      onClick={closeMovieModal}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="vac-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vac-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          type="button"
          className="vac-modal-close"
          onClick={closeMovieModal}
          aria-label="Cerrar detalle de película"
        >
          ✕
        </button>

        {loadingMovie && (
          <div className="vac-modal-loading" role="status">
            <p className="vac-kicker">Consultando TMDB</p>
            <h2 id="vac-modal-title" className="vac-section-title">
              Cargando ficha de la película...
            </h2>
          </div>
        )}

        {movieError && !loadingMovie && (
          <div className="vac-modal-body">
            <h2 id="vac-modal-title" className="vac-section-title">
              No disponible
            </h2>
            <div className="vac-error-panel" role="alert">
              {movieError}
            </div>
          </div>
        )}

        {details?.movie && !loadingMovie && (
          <MovieSheetContent
            details={details}
            variant="modal"
            onCloseModal={closeMovieModal}
            titleId="vac-modal-title"
          />
        )}
      </div>
    </div>
  );
}

export default MovieDetailModal;
