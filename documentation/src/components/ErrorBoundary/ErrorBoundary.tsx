import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // Render fallback UI or the provided fallback component
      return (
        this.props.fallback || (
          <div
            style={{
              padding: '20px',
              margin: '10px',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              backgroundColor: '#f8d7da',
              color: '#721c24'
            }}
          >
            <h3>Something went wrong</h3>
            <p>
              This component encountered an error and has been safely contained.
            </p>
            {typeof window !== 'undefined' &&
              window.location.hostname === 'localhost' && (
                <details style={{ marginTop: '10px' }}>
                  <summary>Error details (development only)</summary>
                  <pre style={{ fontSize: '12px', marginTop: '5px' }}>
                    {this.state.error?.message}
                  </pre>
                </details>
              )}
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
