const { handleRecommendations } = require('../server/recommendationsRouter');
const { handleCinemasSearch } = require('../server/cinemasRouter');
const { handleNewsArticle, handleMovieNews } = require('../server/newsRouter');

module.exports = function (app) {
  app.post('/api/recommendations', handleRecommendations);
  app.post('/api/cinemas', handleCinemasSearch);
  app.post('/api/news-article', handleNewsArticle);
  app.post('/api/movie-news', handleMovieNews);
};
