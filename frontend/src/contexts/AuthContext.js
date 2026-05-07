import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AuthContext = createContext(null);

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
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    fetchMe();
  }, [fetchMe]);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
    setUser(data);
    return data;
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
