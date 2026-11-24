import React, { createContext, useCallback, useContext, useState } from 'react';
import { detectPreferredCountryFromLocale } from '../utils/movieHelpers';

const MovieModalContext = createContext(null);

export function MovieModalProvider({ children }) {
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [preferredRegion, setPreferredRegion] = useState(() =>
    typeof navigator !== 'undefined'
      ? detectPreferredCountryFromLocale(navigator.language)
      : 'AR'
  );

  const openMovieModal = useCallback((movieId) => {
    const numericId = parseInt(movieId, 10);
    if (!Number.isInteger(numericId) || numericId <= 0) return;
    setSelectedMovieId(numericId);
  }, []);

  const closeMovieModal = useCallback(() => {
    setSelectedMovieId(null);
  }, []);

  return (
    <MovieModalContext.Provider
      value={{
        selectedMovieId,
        openMovieModal,
        closeMovieModal,
        userCoords,
        setUserCoords,
        preferredRegion,
        setPreferredRegion,
      }}
    >
      {children}
    </MovieModalContext.Provider>
  );
}

export function useMovieModal() {
  const ctx = useContext(MovieModalContext);
  if (!ctx) {
    throw new Error('useMovieModal debe usarse dentro de MovieModalProvider.');
  }
  return ctx;
}
