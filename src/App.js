import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { MovieModalProvider } from './context/MovieModalContext';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';
import Listado from './components/Listado';
import Home from './components/Home';
import Header from './components/Header';
import Footer from './components/Footer';
import Resultados from './components/Resultados';
import Favoritos from './components/Favoritos';
import Detalle from './components/Detalle';
import NoticiaArticulo from './components/NoticiaArticulo';
import MovieDetailModal from './components/MovieDetailModal';

import 'bootstrap/dist/css/bootstrap.min.css';
import './css/app.css';

let prevScrollPos = typeof window !== 'undefined' ? window.pageYOffset : 0;

if (typeof window !== 'undefined') {
  window.onscroll = function () {
    const currentScrollPos = window.pageYOffset;
    const header = document.querySelector('header');
    if (header) {
      if (prevScrollPos > currentScrollPos || currentScrollPos < 60) {
        header.classList.remove('hidden');
      } else {
        header.classList.add('hidden');
      }
    }
    prevScrollPos = currentScrollPos;
  };
}

function AppShell() {
  const { favorites, toggleFavorite } = useFirebase();
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const addOrRemoveFav = (e) => {
    const btn = e.currentTarget;
    const parent = btn.parentElement;
    const imgURL =
      btn.dataset.movieImg || parent?.querySelector('img')?.getAttribute('src') || '';
    const title =
      btn.dataset.movieTitle || parent?.querySelector('h5')?.innerText || '';
    const movieId = parseInt(btn.dataset.movieId, 10);

    toggleFavorite({
      id: movieId,
      title,
      imgURL,
    });
  };

  return (
    <Router>
      <Header favorites={favorites} />
      {gmpQuotaExceeded && (
        <div
          className="vac-gmp-quota-banner"
          role="status"
        >
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="vac-gmp-quota-link"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
          <button
            type="button"
            className="vac-gmp-quota-close"
            onClick={() => setGmpQuotaExceeded(false)}
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/listado"
          element={<Listado favorites={favorites} addOrRemoveFav={addOrRemoveFav} />}
        />
        <Route
          path="/detalle"
          element={<Detalle favorites={favorites} addOrRemoveFav={addOrRemoveFav} />}
        />
        <Route path="/noticia/:movieId" element={<NoticiaArticulo />} />
        <Route path="/noticia" element={<NoticiaArticulo />} />
        <Route
          path="/resultados"
          element={<Resultados favorites={favorites} addOrRemoveFav={addOrRemoveFav} />}
        />
        <Route
          path="/favoritos"
          element={<Favoritos favorites={favorites} addOrRemoveFav={addOrRemoveFav} />}
        />
      </Routes>
      <MovieDetailModal />
      <Footer />
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <MovieModalProvider>
          <AppShell />
        </MovieModalProvider>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}

export default App;
