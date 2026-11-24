import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="vac-container py-5">
          <div className="vac-error-panel" role="alert">
            <h2 className="vac-serif-heading">No pudimos completar esta operación</h2>
            <p className="vac-muted-copy">
              Se produjo un problema al conectar con la base de datos o renderizar la vista.
            </p>
            <button type="button" className="vac-btn-primary" onClick={this.handleReset}>
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
