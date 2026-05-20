import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Trophy, Eye, EyeOff } from "lucide-react";
import platformConfig, { activeSports, activeCountry } from "../config/platformConfig";
import BRAND from "../config/brandConfig";
import Logo from "../components/Logo";
import ForgotPasswordModal from "../components/ForgotPasswordModal";

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
  const { login, register, user, formatError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

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
          <h2 className="font-heading font-black text-4xl leading-tight mb-3">Compete.<br />Rise.<br /><span className="text-emerald-400">Dominate.</span></h2>
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
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition ${mode === "login" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
              data-testid="login-tab"
            >
              Log In
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); }}
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
            {mode === "login" ? `Log in to your ${BRAND.name} account` : "Your season starts now."}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6" data-testid="auth-error">
              {error}
            </div>
          )}

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
                onChange={update("email")}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                data-testid="input-email"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={update("password")}
                  placeholder="Min. 6 characters"
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
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
                By registering, your match results will be publicly visible.{" "}
                <span className="text-gray-500">You can make your profile private anytime in Settings.</span>
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60 text-sm mt-2"
              data-testid="auth-submit-btn"
            >
              {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
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
