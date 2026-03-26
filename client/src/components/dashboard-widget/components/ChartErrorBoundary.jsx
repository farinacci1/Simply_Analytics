import React from 'react';

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Chart render error:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="widget-render-error">
          <div className="render-error-icon">⚠️</div>
          <div className="render-error-title">Unable to render chart</div>
          <div className="render-error-message">
            {this.state.error?.message || 'An unexpected error occurred while rendering this visualization.'}
          </div>
          <button
            className="render-error-retry"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ChartErrorBoundary;
