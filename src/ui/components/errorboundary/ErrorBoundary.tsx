import { Component, type ErrorInfo, type ReactNode } from "react";
import { logErrorToFirestore } from "../../../services/errorlog/errorLog";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const ErrorPage = ({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) => (
  <div className="error-page">
    <div className="error-page__inner">
      <div className="error-page__icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <p className="error-page__code">500</p>
      <h1 className="error-page__title">Something went wrong</h1>
      <p className="error-page__subtitle">
        The app ran into an unexpected error. It's been logged automatically.
      </p>

      <div className="error-page__actions">
        <button className="btn__primary" onClick={onReset}>
          Try again
        </button>
        <button className="btn__wired" onClick={() => (window.location.href = "/")}>
          Go home
        </button>
      </div>

      {error && (
        <details className="error-page__details">
          <summary>Error details</summary>
          <pre>{error.message}</pre>
        </details>
      )}
    </div>
  </div>
);

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const stack =
      (info.componentStack ?? "") + "\n\n" + (error.stack ?? "");
    logErrorToFirestore(error.message, stack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage error={this.state.error} onReset={this.handleReset} />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
