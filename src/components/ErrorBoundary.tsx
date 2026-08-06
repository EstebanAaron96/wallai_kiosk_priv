import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from '../App.module.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const AUTO_RETRY_MS = 15_000;

/**
 * Red de seguridad para un kiosco desatendido 24/7: si algo lanza durante el
 * render (dato inesperado, fallo de librería, etc.) se muestra una pantalla
 * de recuperación en vez de dejar la app en blanco, y se reintenta solo.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Error no controlado en el kiosco:', error, info.componentStack);
    this.retryTimeoutId = setTimeout(() => this.setState({ error: null }), AUTO_RETRY_MS);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.centerScreen}>
          <div className={styles.spinner} />
          <div className={styles.errorTitle}>Reconectando…</div>
          <div className={styles.errorDetail}>
            Se ha producido un error inesperado. La pantalla se recuperará automáticamente en unos
            segundos.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
