import { useState } from "react";
import axios from "axios";
import { X, Mail, CheckCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ForgotPasswordModal({ open, onClose, prefillEmail = "" }) {
  const [email, setEmail] = useState(prefillEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not send reset email. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setEmail(prefillEmail);
    setError("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
      data-testid="forgot-password-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-pwd-title"
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 relative overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          data-testid="forgot-close-btn"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {sent ? (
          <div className="text-center py-4" data-testid="forgot-sent">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 id="forgot-pwd-title" className="font-heading font-black text-xl text-gray-900 mb-2">Check your inbox</h2>
            <p className="text-sm text-gray-500">
              If an account exists for <span className="font-semibold text-gray-700">{email}</span>,
              we've sent a password reset link. The link expires in 30 minutes.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 text-sm font-semibold text-black hover:underline"
            >
              Back to login
            </button>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center mb-4">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <h2 id="forgot-pwd-title" className="font-heading font-black text-xl text-gray-900 mb-2">Reset your password</h2>
            <p className="text-sm text-gray-500 mb-5">
              Enter your email and we'll send you a link to choose a new password.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4" data-testid="forgot-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                data-testid="forgot-email-input"
                autoComplete="email"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60 text-sm"
                data-testid="forgot-submit-btn"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
