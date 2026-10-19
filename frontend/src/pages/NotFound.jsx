import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-6 py-24" data-testid="not-found-page">
      <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "#047857", fontFamily: "'IBM Plex Mono', monospace" }}>404</p>
      <h1 className="font-bold text-4xl mt-2 mb-3" style={{ fontFamily: "-apple-system, 'SF Pro Display', Inter, system-ui, sans-serif", color: "#1F2937" }}>
        Page not found
      </h1>
      <p className="mb-8" style={{ fontFamily: "-apple-system, 'SF Pro Text', Inter, sans-serif", color: "#6E6E73" }}>
        That page doesn't exist or has moved.
      </p>
      <Link
        to="/leagues"
        className="inline-block px-6 py-3 text-sm font-bold text-white rounded-lg transition-colors hover:bg-[#065F46]"
        style={{ background: "#047857" }}
        data-testid="not-found-leagues-link"
      >
        Browse leagues
      </Link>
    </div>
  );
}
