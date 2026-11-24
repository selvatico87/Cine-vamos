import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Buscador() {
  const [showPopover, setShowPopover] = useState(false);
  const navigate = useNavigate();

  const submitHandler = (e) => {
    e.preventDefault();
    const keyword = e.currentTarget.keyword.value.trim();
    if (keyword.length === 0) {
      setShowPopover(true);
    } else {
      setShowPopover(false);
      e.currentTarget.keyword.value = '';
      navigate(`/resultados?keyword=${encodeURIComponent(keyword)}`);
    }
  };

  return (
    <form className="vac-search-form" onSubmit={submitHandler}>
      <label htmlFor="header-movie-search" className="visually-hidden">
        Buscar película
      </label>
      <input
        id="header-movie-search"
        className="vac-search-input"
        type="text"
        placeholder="Buscar película"
        aria-label="Buscar película"
        name="keyword"
      />
      <button className="vac-search-btn" type="submit">
        Buscar
      </button>

      {showPopover && (
        <div
          className="alert alert-warning"
          role="alert"
          style={{
            position: 'fixed',
            top: '68px',
            right: '16px',
            zIndex: 10000,
            fontSize: '0.85rem',
          }}
        >
          Debes ingresar datos para realizar la búsqueda de la película.
        </div>
      )}
    </form>
  );
}

export default Buscador;
