import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-rose-50 border border-rose-100 rounded-lg">
          <h2 className="text-lg font-bold text-rose-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-rose-600 mb-4">We're sorry, but there was an error rendering this section.</p>
          <button
            className="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 transition"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return (this.props as any).children;
  }
}
