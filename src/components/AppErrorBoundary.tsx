import React from 'react';

interface State {
  hasError: boolean;
  retryCount: number;
}

/**
 * Global Error Boundary — catches React 18 concurrent mode DOM reconciliation
 * errors (e.g. "removeChild: node is not a child of this node") caused by
 * third-party libraries (embla-carousel, driver.js, Radix UI portals) that
 * directly mutate the DOM outside of React's fiber tree.
 *
 * On error it auto-recovers by triggering a re-render of its children.
 * After 3 retries it shows a minimal fallback UI to avoid an infinite loop.
 */
export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const isDomReconciliationError =
      error.message?.includes('removeChild') ||
      error.message?.includes('insertBefore') ||
      error.message?.includes('not a child of this node');

    if (isDomReconciliationError && this.state.retryCount < 3) {
      // Auto-recover: reset error state after a tick to allow React to re-render
      setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          retryCount: prev.retryCount + 1,
        }));
      }, 0);
    } else {
      console.error('[AppErrorBoundary] Unrecoverable error:', error, info);
    }
  }

  render() {
    if (this.state.hasError && this.state.retryCount >= 3) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-8 text-center">
          <div className="space-y-4">
            <h1 className="text-2xl font-black">Algo salió mal</h1>
            <p className="text-muted-foreground">
              Ocurrió un error inesperado. Por favor recarga la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-400 transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
