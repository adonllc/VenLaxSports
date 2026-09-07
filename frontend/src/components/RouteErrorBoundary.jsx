import { Component } from "react";

const RELOAD_FLAG = "vl_chunk_reload_attempted";

function isChunkLoadError(error) {
  const msg = String(error?.message || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg);
}

export default class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    }
  }

  render() {
    if (this.state.error) {
      if (isChunkLoadError(this.state.error) && !sessionStorage.getItem(RELOAD_FLAG)) {
        // componentDidCatch is about to reload the page — render nothing in the meantime.
        return null;
      }
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-lg font-semibold text-gray-900">Something went wrong loading this page.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-lg font-semibold text-white"
            style={{ background: "#10B981" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
