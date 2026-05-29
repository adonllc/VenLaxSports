import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const CONSENT_KEY = "venlax_analytics_consent";

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
    if (window.posthog) {
      window.posthog.startSessionRecording();
    }
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 py-4 sm:px-6"
      style={{ background: "rgba(17,24,39,0.97)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
      data-testid="consent-banner"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-gray-300 flex-1 leading-relaxed">
          We use analytics to improve this platform. Session recording is only enabled with your consent.{" "}
          <Link to="/privacy" className="underline text-gray-200 hover:text-white">
            Privacy Policy
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            data-testid="consent-decline"
            className="px-4 py-2 text-sm font-medium text-gray-400 rounded-md border border-gray-600 hover:border-gray-400 hover:text-gray-200 transition"
          >
            Decline
          </button>
          <button
            onClick={accept}
            data-testid="consent-accept"
            className="px-4 py-2 text-sm font-bold text-white rounded-md transition"
            style={{ background: "#1B2B4B" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#142040")}
            onMouseLeave={e => (e.currentTarget.style.background = "#1B2B4B")}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
