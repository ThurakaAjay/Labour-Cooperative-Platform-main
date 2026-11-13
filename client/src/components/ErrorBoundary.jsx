import React from 'react';

/**
 * Top-level crash guard: contains a render error to the current screen
 * instead of white-screening the whole SPA.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[WorkHive] Unhandled render error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'inherit'
        }}>
          <h1 style={{ fontSize: '20px', margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: '14px', color: '#666', maxWidth: '360px', margin: 0 }}>
            This screen hit an unexpected error. Your session hasn't been lost — you can head back to the homepage and try again.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              marginTop: '8px',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#111',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Back to Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
