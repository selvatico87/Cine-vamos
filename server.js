const path = require('path');
const express = require('express');
const { handleRecommendations } = require('./server/recommendationsRouter');
const { handleCinemasSearch } = require('./server/cinemasRouter');
const { handleNewsArticle, handleMovieNews } = require('./server/newsRouter');

const app = express();
const PORT = process.env.PORT || 3000;

app.post('/api/recommendations', handleRecommendations);
app.post('/api/cinemas', handleCinemasSearch);
app.post('/api/news-article', handleNewsArticle);
app.post('/api/movie-news', handleMovieNews);

const buildDir = path.join(__dirname, 'build');
app.use(express.static(buildDir));

app.get('*', (_req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Vamos Al Cine server listening on http://0.0.0.0:${PORT}`);
});
