import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Trophy, Eye, EyeOff } from "lucide-react";
import platformConfig, { activeSports, activeCountry } from "../config/platformConfig";
import BRAND from "../config/brandConfig";
import Logo from "../components/Logo";
import ForgotPasswordModal from "../components/ForgotPasswordModal";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// PHASE-DRIVEN: only the active country is offered during registration.
// PHASE 3 introduces "India" via REACT_APP_PHASE=3.
const COUNTRIES = [activeCountry];

export default function Auth() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "register" ? "register" : "login");
  const [form, setForm] = useState({ email: "", password: "", name: "", country: platformConfig.country, city: "", skill_level: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [emailExists, setEmailExists] = useState(null);
  const { login, register, user, formatError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  // Debounced duplicate-email check (register mode only)
  useEffect(() => {
    if (mode !== "register" || !form.email.includes("@")) {
      setEmailExists(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.post(`${API}/auth/check-email`, { email: form.email });
        setEmailExists(data.exists);
      } catch {
        setEmailExists(null);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [form.email, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        navigate("/dashboard");
      } else {
        if (!form.name.trim()) { setError("Name is required"); setLoading(false); return; }
        await register(form);
        navigate("/verify-email");
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/auth/google/url`);
      sessionStorage.setItem("_oauth_state", data.state);
      window.location.href = data.url;
    } catch (err) {
      setError(formatError(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex" data-testid="auth-page">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-black items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 30% 50%, #10B981 0%, transparent 60%), radial-gradient(circle at 70% 30%, #2563EB 0%, transparent 60%), radial-gradient(circle at 50% 80%, #F97316 0%, transparent 50%)"
        }} />
        <div className="relative z-10 text-center text-white">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
              <Trophy className="w-7 h-7 text-black" />
            </div>
            <Logo size="hero" variant="hero" testId="auth-hero-logo" />
          </div>
          <h2 className="font-heading font-black text-4xl leading-tight mb-3">Your rank.<br />Your record.<br /><span className="text-emerald-400">Your league.</span></h2>
          <p className="text-gray-400 text-base max-w-xs mx-auto">{BRAND.story_short}</p>
          <div className="flex justify-center gap-6 mt-10">
            {activeSports.map((s) => (
              <div key={s.id} className="text-sm text-gray-300 font-medium">{s.icon} {s.label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mode Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
            <button
              onClick={() => { setMode("login"); setError(""); setEmailExists(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition ${mode === "login" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
              data-testid="login-tab"
            >
              Log In
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); setEmailExists(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition ${mode === "register" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
              data-testid="register-tab"
            >
              Sign Up
            </button>
          </div>

          <h1 className="font-heading font-black text-3xl text-gray-900 mb-2">
            {mode === "login" ? "Welcome back." : "Enter the circuit."}
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            {mode === "login" ? `Log in to your ${BRAND.name} account.` : "Set up your account to join a league."}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6" data-testid="auth-error">
              {error}
            </div>
          )}

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-60 mb-5"
            data-testid="google-login-btn"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={update("name")}
                  placeholder="John Smith"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  data-testid="input-name"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => { update("email")(e); setEmailExists(null); }}
                placeholder="you@example.com"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent ${mode === "register" && emailExists ? "border-amber-400 bg-amber-50" : "border-gray-300"}`}
                data-testid="input-email"
                autoComplete="email"
                required
              />
              {mode === "register" && emailExists === true && (
                <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" data-testid="email-exists-warning">
                  <p className="text-xs text-amber-800 font-medium">Account already exists with this email.</p>
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setError(""); setEmailExists(null); }}
                    className="text-xs font-semibold text-black underline ml-3 whitespace-nowrap"
                    data-testid="email-exists-login-btn"
                  >
                    Log in instead →
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={update("password")}
                  placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  data-testid="input-password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "register" && (
                <p className="text-xs text-gray-400 mt-1.5">Minimum 6 characters.</p>
              )}
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs text-gray-500 hover:text-black font-medium mt-2"
                  data-testid="forgot-password-link"
                >
                  Forgot password?
                </button>
              )}
            </div>

            {mode === "register" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Country</label>
                  <select
                    value={form.country}
                    onChange={update("country")}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    data-testid="input-country"
                  >
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">City (optional)</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={update("city")}
                    placeholder="Your city (e.g. Austin, Boise, Buffalo — anywhere in the USA)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    data-testid="input-city"
                    autoComplete="address-level2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Skill Level (optional)</label>
                  <select
                    value={form.skill_level}
                    onChange={update("skill_level")}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    data-testid="input-skill-level"
                  >
                    <option value="">Select your USTA/USAPA level</option>
                    <option value="2.0">2.0 — Beginner</option>
                    <option value="2.5">2.5 — Beginner+</option>
                    <option value="3.0">3.0 — Intermediate</option>
                    <option value="3.5">3.5 — Intermediate+</option>
                    <option value="4.0">4.0 — Advanced Intermediate</option>
                    <option value="4.5">4.5 — Advanced</option>
                    <option value="5.0">5.0 — Expert</option>
                    <option value="5.5">5.5 — Expert+</option>
                    <option value="6.0+">6.0+ — Open / Pro</option>
                  </select>
                </div>
              </>
            )}

            {mode === "register" && (
              <p className="text-xs text-gray-400 text-center">
                Match results are public by default.{" "}
                <span className="text-gray-500">You can set your profile to private from your dashboard.</span>
              </p>
            )}

            <button
              type="submit"
              disabled={loading || (mode === "register" && emailExists === true)}
              className="w-full py-3.5 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60 text-sm mt-2"
              data-testid="auth-submit-btn"
            >
              {loading ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button onClick={() => setMode("register")} className="font-semibold text-black hover:underline" data-testid="switch-to-register">Sign up free</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => setMode("login")} className="font-semibold text-black hover:underline" data-testid="switch-to-login">Log in</button>
              </>
            )}
          </p>
        </div>
      </div>

      <ForgotPasswordModal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        prefillEmail={form.email}
      />
    </div>
  );
}
