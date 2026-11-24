import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import tmdbService from '../services/tmdbService';
import { fetchEditorialArticle } from '../services/newsService';
import { useMovieModal } from '../context/MovieModalContext';
import {
  formatFullReleaseDate,
  formatRating,
  formatReleaseYear,
  getBackdropUrl,
  getPosterUrl,
  sanitizeExternalUrl,
} from '../utils/movieHelpers';
import noPoster from '../img/no-poster.png';

function NoticiaArticulo() {
  const { movieId: paramMovieId } = useParams();
  const location = useLocation();
  const { openMovieModal } = useMovieModal();

  const searchParams = new URLSearchParams(location.search);
  const resolvedMovieId = parseInt(
    paramMovieId || searchParams.get('movieID') || location.state?.newsItem?.movieId || '',
    10
  );
  const categoryFromQuery =
    searchParams.get('cat') || location.state?.newsItem?.category || 'Actualidad';
  const initialNewsItem = location.state?.newsItem || null;

  const [movieDetails, setMovieDetails] = useState(null);
  const [article, setArticle] = useState(null);
  const [loadingMovie, setLoadingMovie] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const loadArticleAndMovie = useCallback(
    async (forceRefresh = false) => {
      if (!Number.isInteger(resolvedMovieId) || resolvedMovieId <= 0) {
        setErrorMsg('No se indicó una película válida para redactar la nota periodística.');
        setLoadingMovie(false);
        setLoadingArticle(false);
        return;
      }

      setErrorMsg('');
      if (!forceRefresh) {
        setLoadingMovie(true);
      }
      setLoadingArticle(true);

      try {
        const fullDetails = await tmdbService.getMovieFullDetails(resolvedMovieId);
        setMovieDetails(fullDetails);
        setLoadingMovie(false);

        const movie = fullDetails?.movie;
        const generated = await fetchEditorialArticle({
          movieId: resolvedMovieId,
          title: movie?.title || initialNewsItem?.title || '',
          originalTitle: movie?.original_title || '',
          releaseDate: movie?.release_date || initialNewsItem?.releaseDate || '',
          overview: movie?.overview || initialNewsItem?.summary || '',
          category: categoryFromQuery,
          originalHeadline: initialNewsItem?.headline || '',
          forceRefresh,
        });
        setArticle(generated);
      } catch (err) {
        console.error('Error cargando nota periodística:', err);
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'No pudimos completar la investigación en internet para esta nota.'
        );
      } finally {
        setLoadingMovie(false);
        setLoadingArticle(false);
      }
    },
    [
      resolvedMovieId,
      categoryFromQuery,
      initialNewsItem?.title,
      initialNewsItem?.releaseDate,
      initialNewsItem?.summary,
      initialNewsItem?.headline,
    ]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    loadArticleAndMovie(false);
  }, [loadArticleAndMovie]);

  const movie = movieDetails?.movie || null;
  const director = (movieDetails?.crew || []).find((p) => p.job === 'Director');
  const displayTitle = movie?.title || initialNewsItem?.title || 'Nota de cine';
  const heroImageUrl = movie
    ? getBackdropUrl(movie.backdrop_path || movie.poster_path, noPoster)
    : initialNewsItem?.backdropUrl || initialNewsItem?.posterUrl || noPoster;
  const posterImageUrl = movie
    ? getPosterUrl(movie.poster_path, noPoster)
    : initialNewsItem?.posterUrl || noPoster;

  const formattedGeneratedAt = article?.generatedAt
    ? new Date(article.generatedAt).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : formatFullReleaseDate(movie?.release_date || initialNewsItem?.releaseDate);

  return (
    <main className="vac-main-wrapper vac-article-page">
      <nav className="vac-article-topbar" aria-label="Navegación de artículo">
        <Link to="/" className="vac-btn-outline">
          ← Volver a cartelera y noticias
        </Link>

        <div className="vac-article-topbar-actions">
          {Number.isInteger(resolvedMovieId) && resolvedMovieId > 0 && (
            <button
              type="button"
              className="vac-btn-outline"
              onClick={() => openMovieModal(resolvedMovieId)}
            >
              Ver ficha rápida
            </button>
          )}
          <button
            type="button"
            className="vac-btn-primary"
            onClick={() => loadArticleAndMovie(true)}
            disabled={loadingArticle}
          >
            {loadingArticle ? 'Investigando en internet...' : 'Actualizar nota con IA'}
          </button>
        </div>
      </nav>

      <header className="vac-article-header">
        <div className="vac-meta-line" style={{ marginBottom: '0.65rem' }}>
          <span className="vac-kicker" style={{ margin: 0 }}>
            {article?.category || categoryFromQuery}
          </span>
          <span aria-hidden="true">·</span>
          <span>{article?.byline || 'Redacción Crítica · Vamos Al Cine'}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {article?.readingTimeMinutes
              ? `Lectura de ${article.readingTimeMinutes} min`
              : 'Crónica periodística'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{formattedGeneratedAt}</span>
        </div>

        <h1 className="vac-article-headline">
          {article?.headline ||
            initialNewsItem?.headline ||
            `Análisis editorial sobre ${displayTitle}`}
        </h1>

        <p className="vac-article-deck">
          {article?.deck ||
            movie?.overview ||
            initialNewsItem?.summary ||
            'Investigando cobertura crítica, recepción en taquilla y contexto de producción en fuentes reales de internet.'}
        </p>
      </header>

      <div className="vac-article-layout">
        <article className="vac-article-main">
          <figure className="vac-article-figure">
            <img
              src={heroImageUrl}
              alt={displayTitle}
              className="vac-article-hero-img"
              referrerPolicy="no-referrer"
            />
            <figcaption className="vac-article-figcaption">
              Fig. 1 — {displayTitle} ({formatReleaseYear(movie?.release_date || initialNewsItem?.releaseDate)})
              {director ? ` · Dirección de ${director.name}` : ''}
            </figcaption>
          </figure>

          {loadingArticle && (
            <div className="vac-article-loading" role="status">
              <p className="vac-kicker">Investigación en curso</p>
              <h2 className="vac-modal-subtitle">
                Consultando prensa cinematográfica y críticas reales en internet...
              </h2>
              <p className="vac-muted-copy">
                Nuestro crítico experto con IA está contrastando recepción, datos de estreno y fuentes verificadas para redactar la nota completa sobre <strong>{displayTitle}</strong>.
              </p>
              <div className="vac-skeleton-lines" aria-hidden="true">
                <div className="vac-skeleton-line vac-skeleton-line-lg" />
                <div className="vac-skeleton-line" />
                <div className="vac-skeleton-line" />
                <div className="vac-skeleton-line vac-skeleton-line-md" />
              </div>
            </div>
          )}

          {errorMsg && !loadingArticle && (
            <div className="vac-error-panel" role="alert">
              <p style={{ margin: '0 0 0.75rem', fontWeight: 600 }}>{errorMsg}</p>
              <button
                type="button"
                className="vac-btn-primary"
                onClick={() => loadArticleAndMovie(true)}
              >
                Reintentar investigación
              </button>
            </div>
          )}

          {article && !loadingArticle && (
            <div className="vac-article-prose">
              <p className="vac-article-lead-p">{article.leadParagraph}</p>

              {article.sections.map((section, idx) => (
                <section key={`${section.heading}-${idx}`} className="vac-article-section">
                  <h2 className="vac-article-subheading">{section.heading}</h2>
                  {section.body
                    .split(/\n{2,}/)
                    .map((para, pIdx) => (
                      <p key={pIdx} className="vac-article-body-p">
                        {para.trim()}
                      </p>
                    ))}
                </section>
              ))}

              {article.pullQuote && (
                <blockquote className="vac-article-pullquote">
                  “{article.pullQuote}”
                </blockquote>
              )}

              {article.verdict && (
                <section className="vac-article-verdict" aria-label="Veredicto editorial">
                  <p className="vac-kicker">Veredicto del crítico</p>
                  <p className="vac-article-body-p" style={{ marginBottom: 0 }}>
                    {article.verdict}
                  </p>
                </section>
              )}
            </div>
          )}
        </article>

        <aside className="vac-article-sidebar" aria-label="Contexto de la película y fuentes">
          <div className="vac-article-sidecard">
            <div className="vac-article-side-movie">
              <img
                src={posterImageUrl}
                alt={displayTitle}
                className="vac-article-side-poster"
                referrerPolicy="no-referrer"
              />
              <div>
                <p className="vac-kicker" style={{ marginBottom: '0.25rem' }}>
                  Película protagonista
                </p>
                <h2 className="vac-article-side-title">{displayTitle}</h2>
                <p className="vac-meta-line">
                  <span>{formatReleaseYear(movie?.release_date || initialNewsItem?.releaseDate)}</span>
                  <span aria-hidden="true">·</span>
                  <span>★ {formatRating(movie?.vote_average)}</span>
                  {movie?.runtime > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{movie.runtime} min</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {!loadingMovie && Number.isInteger(resolvedMovieId) && resolvedMovieId > 0 && (
              <div className="vac-article-side-actions">
                <Link
                  to={`/detalle?movieID=${resolvedMovieId}`}
                  className="vac-btn-primary"
                  style={{ width: '100%' }}
                >
                  Abrir ficha completa y cines
                </Link>
              </div>
            )}

            {article?.keyFacts && article.keyFacts.length > 0 && (
              <div className="vac-article-facts">
                <p className="vac-kicker" style={{ marginBottom: '0.5rem' }}>
                  Claves del reportaje
                </p>
                <dl className="vac-spec-list">
                  {article.keyFacts.map((fact, idx) => (
                    <div key={`${fact.label}-${idx}`} className="vac-spec-row">
                      <dt className="vac-spec-label">{fact.label}</dt>
                      <dd className="vac-spec-value">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="vac-article-sources">
              <p className="vac-kicker" style={{ marginBottom: '0.5rem' }}>
                Fuentes consultadas en internet
              </p>
              {article?.sources && article.sources.length > 0 ? (
                <ul className="vac-source-list">
                  {article.sources.map((src) => {
                    const safeUrl = sanitizeExternalUrl(src.url);
                    if (!safeUrl) return null;
                    return (
                      <li key={safeUrl} className="vac-source-item">
                        <a
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="vac-source-link"
                        >
                          <span className="vac-source-title">{src.title}</span>
                          <span className="vac-source-host">{src.publisher} ↗</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="vac-muted-copy" style={{ fontSize: '0.84rem' }}>
                  {loadingArticle
                    ? 'Recopilando enlaces de medios verificados...'
                    : 'Búsqueda contrastada en tiempo real con Google Search y datos oficiales de TMDB.'}
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default NoticiaArticulo;
