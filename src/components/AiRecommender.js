import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAiMovieRecommendations } from '../services/aiRecommendationService';
import { useMovieModal } from '../context/MovieModalContext';
import {
  formatRating,
  formatReleaseYear,
  getPosterUrl,
  validateRecommendationPrompt,
} from '../utils/movieHelpers';
import noPoster from '../img/no-poster.png';

const QUICK_PROMPTS = [
  'Ciencia ficción con giros mentales como Inception',
  'Thrillers de misterio oscuros de los años 90',
  'Cine animado emotivo para ver en familia',
  'Dramas históricos basados en hechos reales',
];

function AiRecommender({ favorites = [], onToggleFavorite }) {
  const { openMovieModal } = useMovieModal();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [recommendations, setRecommendations] = useState([]);

  const runRecommendationSearch = async (queryText) => {
    const check = validateRecommendationPrompt(queryText);
    if (!check.valid) {
      setError(check.error);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const result = await fetchAiMovieRecommendations({ prompt: check.prompt });
      const items = Array.isArray(result?.recommendations) ? result.recommendations : [];
      if (items.length === 0) {
        setSummary('');
        setRecommendations([]);
        setError('La IA no devolvió recomendaciones para esa búsqueda. Prueba reformular tu descripción.');
      } else {
        setSummary(result.summary || '');
        setRecommendations(items);
      }
    } catch (err) {
      setSummary('');
      setRecommendations([]);
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos obtener recomendaciones en este momento.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runRecommendationSearch(prompt);
  };

  const handleQuickPrompt = (text) => {
    setPrompt(text);
    runRecommendationSearch(text);
  };

  const isFav = (movieId) => favorites.some((fav) => fav.id === movieId);

  return (
    <section id="recomendador-ia" className="vac-section" aria-label="Recomendador de películas con IA">
      <div className="vac-section-header">
        <div>
          <p className="vac-kicker">Curaduría inteligente</p>
          <h2 className="vac-section-title">Buscador de recomendaciones con IA</h2>
        </div>
        <p className="vac-muted-copy">
          Describe tu estado de ánimo, temática o una película que te gustó y recibe sugerencias cruzadas con TMDB.
        </p>
      </div>

      <div className="vac-ai-panel">
        <form onSubmit={handleSubmit} className="vac-ai-form">
          <label htmlFor="ai-movie-prompt" className="visually-hidden">
            Describe qué tipo de película buscas
          </label>
          <input
            id="ai-movie-prompt"
            type="text"
            className="vac-ai-input"
            placeholder="Ej: Busco un thriller de ciencia ficción tenso y elegante como Arrival..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={400}
          />
          <button type="submit" className="vac-btn-primary" disabled={loading}>
            {loading ? 'Buscando con IA...' : 'Recomendar películas'}
          </button>
        </form>

        <div className="vac-ai-prompts" aria-label="Sugerencias rápidas de búsqueda">
          {QUICK_PROMPTS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="vac-ai-prompt-btn"
              onClick={() => handleQuickPrompt(suggestion)}
              disabled={loading}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {loading && (
          <p className="vac-muted-copy" role="status" style={{ marginTop: '1rem' }}>
            Analizando tu petición con IA y buscando coincidencias en TMDB...
          </p>
        )}

        {error && (
          <div className="vac-error-panel vac-ai-error" role="alert">
            <span>{error}</span>
            {prompt.trim().length >= 3 && (
              <button
                type="button"
                className="vac-btn-outline"
                onClick={() => runRecommendationSearch(prompt)}
                disabled={loading}
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        {summary && !error && (
          <div className="vac-ai-summary" role="status">
            <p className="vac-ai-summary-text">{summary}</p>
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="vac-ai-results-grid" role="region" aria-label="Resultados recomendados por IA">
            {recommendations.map((rec, index) => {
              const tmdb = rec.tmdbMovie;
              const movieId = tmdb?.id;
              const displayTitle = tmdb?.title || rec.title;
              const poster = getPosterUrl(tmdb?.poster_path, noPoster);
              const year = tmdb ? formatReleaseYear(tmdb.release_date) : rec.year;
              const rating = tmdb ? formatRating(tmdb.vote_average) : 'N/D';
              const favoriteActive = movieId ? isFav(movieId) : false;

              return (
                <article key={`${rec.title}-${index}`} className="vac-ai-card">
                  <div className="vac-small-poster-wrap">
                    {movieId ? (
                      <button
                        type="button"
                        className="vac-poster-trigger"
                        onClick={() => openMovieModal(movieId)}
                        aria-label={`Abrir detalles de ${displayTitle}`}
                      >
                        <img
                          src={poster}
                          alt={displayTitle}
                          className="vac-small-poster"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ) : (
                      <img
                        src={poster}
                        alt={displayTitle}
                        className="vac-small-poster"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {movieId && (
                      <button
                        type="button"
                        className="favorite-btn"
                        aria-label={
                          favoriteActive
                            ? `Quitar ${displayTitle} de favoritos`
                            : `Agregar ${displayTitle} a favoritos`
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite({
                            id: movieId,
                            title: displayTitle,
                            imgURL: poster,
                          });
                        }}
                      >
                        {favoriteActive ? '❤️' : '🖤'}
                      </button>
                    )}
                  </div>
                  <div className="vac-small-body">
                    <div className="vac-meta-line">
                      <span>{year}</span>
                      <span aria-hidden="true">·</span>
                      <span>★ {rating}</span>
                      <span aria-hidden="true">·</span>
                      <span>{rec.matchAngle}</span>
                    </div>
                    <h3 className="vac-small-title">
                      {movieId ? (
                        <button
                          type="button"
                          className="vac-title-trigger"
                          onClick={() => openMovieModal(movieId)}
                        >
                          {displayTitle}
                        </button>
                      ) : (
                        displayTitle
                      )}
                    </h3>
                    <p className="vac-ai-reason">{rec.reason}</p>
                    {movieId ? (
                      <button
                        type="button"
                        className="vac-small-link vac-small-link-btn"
                        onClick={() => openMovieModal(movieId)}
                      >
                        Ver detalles →
                      </button>
                    ) : (
                      <Link
                        to={`/resultados?keyword=${encodeURIComponent(rec.title)}`}
                        className="vac-small-link"
                      >
                        Buscar en catálogo →
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default AiRecommender;
