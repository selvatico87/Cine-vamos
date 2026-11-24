import { Link } from 'react-router-dom';
import '../css/app.css';
import logoGitHub from '../img/github.png';
import logoLinkedin from '../img/linkedin.png';

function Footer() {
  return (
    <footer className="vac-footer">
      <div id="caja-footer">
        <h2 className="vac-footer-title">Vamos al Cine</h2>
        <p className="vac-footer-copy">
          Hecho por <strong>Ignacio González</strong> · Cartelera TMDB, noticias y curaduría con IA
        </p>
      </div>
      <div id="cajita-logos-footer">
        <Link to="https://github.com/selvatico87" aria-label="GitHub de Ignacio González">
          <img src={logoGitHub} alt="Logo Github" className="logos-footer" />
        </Link>
        <Link
          to="https://www.linkedin.com/in/ignacio-andr%C3%A9s-gonz%C3%A1lez-zorrilla/"
          aria-label="LinkedIn de Ignacio González"
        >
          <img src={logoLinkedin} alt="Logo Linkedin" className="logos-footer" />
        </Link>
      </div>
    </footer>
  );
}

export default Footer;