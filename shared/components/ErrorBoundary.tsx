import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-center">
          <div className="text-red-500 font-bold mb-2">出错了</div>
          <div className="text-xs text-gray-500 mb-3">{this.state.error.message}</div>
          <button
            className="text-xs bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200 transition-colors"
            onClick={() => this.setState({ error: null })}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
