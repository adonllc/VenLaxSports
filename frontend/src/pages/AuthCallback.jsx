import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Trophy } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuthCallback() {
  const navigate = useNavigate();
  const { fetchMe } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Idempotent — only run once (StrictMode-safe)
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : null;

    if (!sessionId) {
      navigate("/auth", { replace: true });
      return;
    }

    (async () => {
      try {
        await axios.post(
          `${API}/auth/google/session`,
          { session_id: sessionId },
          { withCredentials: true }
        );
        await fetchMe();
        // Clear the fragment then go to dashboard
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/dashboard", { replace: true });
      } catch (e) {
        console.error("Google sign-in failed", e);
        navigate("/auth?error=google", { replace: true });
      }
    })();
  }, [navigate, fetchMe]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-white" data-testid="auth-callback">
      <div className="text-center">
        <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-6 h-6 text-white" />
        </div>
        <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-600 font-medium">Signing you in...</p>
      </div>
    </div>
  );
}
