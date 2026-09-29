import { Component, type ReactNode } from 'react';
import { Button } from '../components/ui';

interface State {
  error: Error | null;
}

/** Per-app error boundary rendering a stderr-style block with a retry command. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg p-8">
          <div className="term-window">
            <div className="term-titlebar">
              <span className="term-dot" style={{ background: 'var(--danger)' }} />
              <span className="term-dot" style={{ background: 'var(--warning)' }} />
              <span className="term-dot" style={{ background: 'var(--success)' }} />
              <span className="ml-2">~/error</span>
            </div>
            <div className="p-4 font-mono text-sm">
              <p className="text-danger">bash: fatal: an unexpected error occurred</p>
              <p className="mt-1 break-words text-fg-muted">{this.state.error.message}</p>
              <Button className="mt-4" size="sm" onClick={() => this.setState({ error: null })}>
                $ retry
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
