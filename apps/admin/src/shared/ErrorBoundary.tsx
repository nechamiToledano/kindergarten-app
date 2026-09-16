import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Last-resort net for a crash React can't render past. Without this a bug in
 * a screen leaves the admin with a blank page or a dev overlay instead of a
 * message they can act on.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; onError?: (error: Error, info: ErrorInfo) => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pad" style={{ textAlign: 'center' }}>
        <h1>משהו השתבש</h1>
        <p className="muted">
          אירעה שגיאה בלתי צפויה. רעננו את הדף כדי להמשיך.
        </p>
        <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>
          רענון הדף
        </button>
      </div>
    );
  }
}
