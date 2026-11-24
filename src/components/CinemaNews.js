import React from 'react';
import { Link } from 'react-router-dom';
import { buildNewsArticlePath } from '../utils/movieHelpers';
import noPoster from '../img/no-poster.png';

function CinemaNews({ news, loading }) {
  if (loading) {
    return (
      <section className="vac-section" aria-label="Noticias de cine">
        <div className="vac-section-header">
          <div>
            <p className="vac-kicker">Actualidad cinematográfica</p>
            <h2 className="vac-section-title">Noticias y estrenos destacados</h2>
          </div>
        </div>
        <p className="vac-muted-copy">Cargando titulares y próximos estrenos desde TMDB...</p>
      </section>
    );
  }

  if (!news || !news.lead) {
    return null;
  }

  const buildArticleLocation = (item) =>
    buildNewsArticlePath(item.movieId, item.category);

  const buildArticleState = (item) => ({
    newsItem: item,
  });

  return (
    <section className="vac-section" aria-label="Noticias de cine">
      <div className="vac-section-header">
        <div>
          <p className="vac-kicker">Actualidad cinematográfica</p>
          <h2 className="vac-section-title">Noticias y estrenos en cartelera</h2>
        </div>
        <p className="vac-muted-copy">
          Pulsa cualquier titular para leer la nota periodística completa investigada en vivo
        </p>
      </div>

      <div className="vac-news-grid">
        <article className="vac-news-lead">
          <div className="vac-news-lead-media">
            <Link
              to={buildArticleLocation(news.lead)}
              state={buildArticleState(news.lead)}
              className="vac-poster-trigger"
              aria-label={`Leer nota completa: ${news.lead.headline}`}
            >
              <img
                src={news.lead.backdropUrl || news.lead.posterUrl || noPoster}
                alt={news.lead.title}
                className="vac-news-lead-img"
                referrerPolicy="no-referrer"
              />
            </Link>
          </div>
          <div className="vac-news-lead-body">
            <div className="vac-meta-line">
              <span>{news.lead.category}</span>
              <span aria-hidden="true">·</span>
              <span>Estreno {news.lead.releaseDate}</span>
              <span aria-hidden="true">·</span>
              <span>Valoración {news.lead.rating}</span>
            </div>
            <h3 className="vac-news-lead-headline">
              <Link
                to={buildArticleLocation(news.lead)}
                state={buildArticleState(news.lead)}
                className="vac-news-headline-link"
              >
                {news.lead.headline}
              </Link>
            </h3>
            <p className="vac-muted-copy" style={{ marginBottom: '1rem' }}>
              {news.lead.summary}
            </p>
            <Link
              to={buildArticleLocation(news.lead)}
              state={buildArticleState(news.lead)}
              className="vac-btn-outline"
            >
              Leer nota completa →
            </Link>
          </div>
        </article>

        <div className="vac-news-stack">
          {news.secondary.map((item) => (
            <article key={item.id} className="vac-news-secondary">
              <Link
                to={buildArticleLocation(item)}
                state={buildArticleState(item)}
                className="vac-poster-trigger"
                aria-label={`Leer nota completa: ${item.headline}`}
              >
                <img
                  src={item.backdropUrl || item.posterUrl || noPoster}
                  alt={item.title}
                  className="vac-news-sec-img"
                  referrerPolicy="no-referrer"
                />
              </Link>
              <div>
                <div className="vac-meta-line">
                  <span>{item.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.releaseDate}</span>
                  <span aria-hidden="true">·</span>
                  <span>★ {item.rating}</span>
                </div>
                <h3 className="vac-news-sec-headline">
                  <Link
                    to={buildArticleLocation(item)}
                    state={buildArticleState(item)}
                    className="vac-news-headline-link"
                  >
                    {item.headline}
                  </Link>
                </h3>
                <p className="vac-muted-copy" style={{ fontSize: '0.84rem', marginBottom: '0.5rem' }}>
                  {item.summary}
                </p>
                <Link
                  to={buildArticleLocation(item)}
                  state={buildArticleState(item)}
                  className="vac-small-link"
                >
                  Leer nota completa →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      {news.briefs.length > 0 && (
        <div className="vac-news-briefs">
          {news.briefs.map((brief) => (
            <article key={brief.id} className="vac-news-brief-card">
              <div className="vac-meta-line">
                <span>{brief.category}</span>
                <span aria-hidden="true">·</span>
                <span>{brief.releaseDate}</span>
              </div>
              <h4 className="vac-news-brief-title">
                <Link
                  to={buildArticleLocation(brief)}
                  state={buildArticleState(brief)}
                  className="vac-news-headline-link"
                >
                  {brief.title}
                </Link>
              </h4>
              <p className="vac-muted-copy" style={{ fontSize: '0.82rem' }}>
                {brief.summary}
              </p>
              <Link
                to={buildArticleLocation(brief)}
                state={buildArticleState(brief)}
                className="vac-small-link"
              >
                Leer nota completa →
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default CinemaNews;
