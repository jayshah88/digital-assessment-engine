import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays a fallback UI
 * Prevents entire admin UI from crashing due to a single component error
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: 'var(--adap-surface, #fff)',
          borderRadius: '16px',
          border: '2px solid var(--adap-danger, #ef4444)',
          margin: '20px',
        }}>
          <AlertTriangle size={48} color="var(--adap-danger, #ef4444)" style={{ marginBottom: '16px' }} />
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--adap-slate-900, #0f172a)',
            marginBottom: '8px',
          }}>
            Something went wrong
          </h3>
          <p style={{
            fontSize: '0.95rem',
            color: 'var(--adap-slate-600, #475569)',
            marginBottom: '24px',
            maxWidth: '400px',
            margin: '0 auto 24px',
          }}>
            {this.props.fallbackMessage || 'An error occurred while rendering this component. Please try again or contact support if the problem persists.'}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'var(--adap-primary, #4f46e5)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--adap-primary-dark, #4338ca)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'var(--adap-primary, #4f46e5)';
            }}
          >
            <RefreshCw size={16} />
            Try Again
          </button>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: '24px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--adap-slate-500)', fontSize: '0.85rem' }}>
                Error Details (Development Only)
              </summary>
              <pre style={{
                marginTop: '12px',
                padding: '16px',
                background: 'var(--adap-slate-50, #f8fafc)',
                borderRadius: '8px',
                fontSize: '0.75rem',
                overflow: 'auto',
                maxHeight: '200px',
                color: 'var(--adap-slate-700)',
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
