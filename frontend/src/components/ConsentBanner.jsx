import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { initGoogleAnalytics, trackPageView } from "../utils/googleAnalytics";

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
    // Start Google first: a problem in one analytics tool must not stop another from starting.
    if (initGoogleAnalytics()) trackPageView(window.location.pathname + window.location.search);
    try {
      window.posthog?.startSessionRecording();
    } catch (err) {
      console.warn("PostHog session recording did not start:", err);
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
      style={{ background: "rgba(255,255,255,0.98)", borderTop: "1px solid #D1D5DB", boxShadow: "0 -4px 16px rgba(0,0,0,0.06)" }}
      data-testid="consent-banner"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-gray-700 flex-1 leading-relaxed">
          We use analytics (including Google Analytics, which loads only if you accept) to improve this platform. Session recording is only enabled with your consent.{" "}
          <Link to="/privacy" className="underline text-[#3D3D3D] hover:text-[#008F70]">
            Privacy Policy
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            data-testid="consent-decline"
            className="px-4 py-2 text-sm font-medium text-gray-700 rounded-md border border-gray-300 hover:border-gray-500 hover:text-[#3D3D3D] transition"
          >
            Decline
          </button>
          <button
            onClick={accept}
            data-testid="consent-accept"
            className="px-4 py-2 text-sm font-bold text-white rounded-md transition"
            style={{ background: "#008F70" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#00765C")}
            onMouseLeave={e => (e.currentTarget.style.background = "#008F70")}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
