import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../img/logolargofondonegro.png';
import '../css/app.css';
import Buscador from './Buscador';
import { useFirebase } from '../context/FirebaseContext';

function Header({ favorites = [] }) {
  const { user, isAuthenticated, signInWithGoogle, logout, authLoading } = useFirebase();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch {
      navigate('/login');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="vac-header">
      <div className="vac-header-inner">
        <Link className="vac-brand" to="/">
          <img src={logo} alt="Logo Vamos al Cine" className="vac-brand-logo" />
        </Link>

        <nav aria-label="Navegación principal">
          <ul className="vac-nav">
            <li>
              <Link className="vac-nav-link" to="/">
                Inicio
              </Link>
            </li>
            <li>
              <Link className="vac-nav-link" to="/listado">
                Top 20
              </Link>
            </li>
            <li>
              <Link className="vac-nav-link" to="/favoritos">
                Favoritos: <strong className="tabular-nums">{favorites.length}</strong>
              </Link>
            </li>
            <li>
              <a className="vac-nav-link" href="/#recomendador-ia">
                IA Cine
              </a>
            </li>
          </ul>
        </nav>

        <div className="vac-header-actions">
          <Buscador />
          {isAuthenticated ? (
            <>
              {user && (
                <span className="vac-user-chip" title={user.email || user.displayName || ''}>
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuario'}
                      className="vac-user-avatar"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span>{user.displayName?.split(' ')[0] || 'Mi cuenta'}</span>
                </span>
              )}
              <button type="button" className="vac-logout-btn" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <button
              type="button"
              className="vac-auth-btn"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
            >
              {authLoading ? 'Conectando...' : 'Entrar con Google'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;