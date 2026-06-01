import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { fetchMe } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const storedState = sessionStorage.getItem("_oauth_state");

    if (!code || !state) {
      setError("Missing OAuth parameters.");
      return;
    }
    sessionStorage.removeItem("_oauth_state");

    (async () => {
      try {
        await axios.post(`${API}/auth/google/callback`, { code, state }, { withCredentials: true });
        await fetchMe();
        navigate("/dashboard", { replace: true });
      } catch (err) {
        const detail = err.response?.data?.detail || "Google login failed. Please try again.";
        setError(detail);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" data-testid="oauth-callback-error">
        <div className="max-w-sm text-center">
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <a href="/auth" className="text-sm font-semibold text-black underline">
            ← Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" data-testid="oauth-callback-loading">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4" />
        <p className="text-sm text-gray-500">Completing sign-in…</p>
      </div>
    </div>
  );
}
