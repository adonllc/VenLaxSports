import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AuthContext = createContext(null);

// ── PKCE helpers (Web Crypto API — available on all modern browsers + localhost) ──
function _base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function _codeChallenge(verifier) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return _base64url(buf);
}
function _randomBase64url() {
  return _base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email, password) => {
    const codeVerifier = _randomBase64url();
    const codeChallenge = await _codeChallenge(codeVerifier);
    const state = _randomBase64url();

    sessionStorage.setItem("_pkce_v", codeVerifier);
    sessionStorage.setItem("_pkce_s", state);

    try {
      const { data: auth } = await axios.post(`${API}/auth/authorize`, {
        email,
        password,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
      });

      if (auth.state !== sessionStorage.getItem("_pkce_s")) {
        throw new Error("State mismatch — possible CSRF attack");
      }

      const { data } = await axios.post(`${API}/auth/token`, {
        code: auth.code,
        code_verifier: sessionStorage.getItem("_pkce_v"),
      }, { withCredentials: true });

      setUser(data);
      return data;
    } finally {
      sessionStorage.removeItem("_pkce_v");
      sessionStorage.removeItem("_pkce_s");
    }
  };

  const register = async (formData) => {
    const { data } = await axios.post(`${API}/auth/register`, formData, { withCredentials: true });
    setUser(data);
    return data;
  };

  const logout = async () => {
    await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    setUser(null);
  };

  const formatError = (e) => {
    const detail = e.response?.data?.detail;
    if (!detail) return e.message || "Something went wrong";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
    return JSON.stringify(detail);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, fetchMe, formatError }}>
      {children}
    </AuthContext.Provider>
  );
};
