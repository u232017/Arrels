import { Component, type ReactNode } from "react";

interface State { error: Error | null }

/** Last line of defence: show a readable message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <p role="alert" className="error">S'ha produït un error inesperat: {this.state.error.message}</p>;
    }
    return this.props.children;
  }
}
