import { useState } from "react";
import { X, Bell } from "lucide-react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function NotifyMeModal({ isOpen, onClose, city, sport }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post(`${API}/notifications/subscribe`, {
        email,
        city,
        sport,
        channels: ["email"],
      });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-testid="notify-modal-overlay"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        data-testid="notify-modal"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-600" />
            <h2 className="font-heading font-bold text-gray-900">Notify me</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            data-testid="notify-modal-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-4" data-testid="notify-modal-success">
            <p className="text-2xl mb-2">🎾</p>
            <p className="font-semibold text-gray-900 mb-1">You're on the list!</p>
            <p className="text-sm text-gray-500">
              We'll email you when {city} {sport} opens.
            </p>
            <button
              onClick={onClose}
              className="mt-4 text-sm text-emerald-600 font-semibold hover:underline"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} data-testid="notify-modal-form">
            <p className="text-sm text-gray-500 mb-4">
              When a {city} {sport.charAt(0).toUpperCase() + sport.slice(1)} season opens.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              data-testid="notify-modal-email"
            />
            {error && (
              <p className="text-xs text-red-500 mb-2" data-testid="notify-modal-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-emerald-700 transition disabled:opacity-60"
              data-testid="notify-modal-submit"
            >
              {loading ? "Subscribing..." : "Get Notified"}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              No account needed. Unsubscribe anytime.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
