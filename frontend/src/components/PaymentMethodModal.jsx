import { useEffect, useState } from "react";
import axios from "axios";
import { CreditCard, X, Wallet, CheckCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const METHOD_VISUALS = {
  stripe: { icon: <CreditCard className="w-4 h-4" />, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  apple_pay: { icon: <span className="font-bold"></span>, color: "bg-black text-white border-black" },
  google_pay: { icon: <span className="font-bold">G</span>, color: "bg-white text-gray-900 border-gray-300" },
  zelle: { icon: <span className="font-black">Z</span>, color: "bg-purple-50 text-purple-700 border-purple-200" },
};

/**
 * Payment-method picker for league registration.
 * Stripe → existing checkout flow. Apple/Google Pay → wallet POST. Zelle → 2-step (intent + reference).
 */
export default function PaymentMethodModal({ open, onClose, league, onSuccess }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeMethod, setActiveMethod] = useState(null);
  const [zelleIntent, setZelleIntent] = useState(null);
  const [zelleRef, setZelleRef] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(""); setSuccess(""); setActiveMethod(null); setZelleIntent(null); setZelleRef("");
    axios.get(`${API}/payments/methods`)
      .then(({ data }) => setMethods(data.methods || []))
      .catch(() => setMethods([]));
  }, [open]);

  if (!open || !league) return null;
  const fee = Number(league.entry_fee || 0).toFixed(2);
  const currencySymbol = league.currency === "INR" ? "₹" : "$";

  const handleStripe = async () => {
    setLoading(true); setError("");
    try {
      const origin = window.location.origin;
      const { data } = await axios.post(`${API}/payments/checkout`, {
        league_id: league.id, origin_url: origin,
      }, { withCredentials: true });
      window.location.href = data.url;
    } catch (err) {
      setError(err.response?.data?.detail || "Stripe checkout failed");
      setLoading(false);
    }
  };

  const handleWallet = async (method) => {
    setLoading(true); setError(""); setSuccess("");
    try {
      // Placeholder token — real Apple/GPay flows return a wallet payment token via JS SDK
      const token = `placeholder_${method}_${Date.now()}`;
      await axios.post(`${API}/payments/wallet`, {
        league_id: league.id, method, token,
      }, { withCredentials: true });
      setSuccess(`Paid via ${method.replace("_", " ").replace(/\b\w/g, (m) => m.toUpperCase())}`);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || "Wallet payment failed");
    } finally {
      setLoading(false);
    }
  };

  const handleZelleStart = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await axios.post(`${API}/payments/zelle/intent`, {
        league_id: league.id,
      }, { withCredentials: true });
      setZelleIntent(data);
      setActiveMethod("zelle");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not generate Zelle instructions");
    } finally {
      setLoading(false);
    }
  };

  const handleZelleConfirm = async () => {
    if (zelleRef.length < 4) { setError("Confirmation number is too short"); return; }
    setLoading(true); setError("");
    try {
      await axios.post(`${API}/payments/zelle/confirm`, {
        league_id: league.id, reference_number: zelleRef,
      }, { withCredentials: true });
      setSuccess("Zelle confirmation recorded");
      setTimeout(() => { onSuccess?.(); onClose(); }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not confirm Zelle payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="payment-method-modal"
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          data-testid="payment-modal-close"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Pay to join</p>
          <h2 className="font-heading font-black text-xl text-gray-900 mt-1 truncate">{league.name}</h2>
          <p className="text-3xl font-heading font-black mt-2">
            {currencySymbol}{fee}
            <span className="text-sm font-medium text-gray-500 ml-2">/ {league.format}</span>
          </p>
        </div>

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2" data-testid="payment-success">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4" data-testid="payment-error">
            {error}
          </div>
        )}

        {!activeMethod && !zelleIntent && (
          <div className="space-y-2">
            {methods.map((m) => {
              const v = METHOD_VISUALS[m.id] || METHOD_VISUALS.stripe;
              const onClick =
                m.id === "stripe" ? handleStripe :
                m.id === "zelle" ? handleZelleStart :
                () => handleWallet(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={onClick}
                  disabled={loading}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 border rounded-xl text-sm font-semibold transition-colors hover:scale-[1.01] disabled:opacity-60 ${v.color}`}
                  data-testid={`pay-method-${m.id}`}
                >
                  <span className="w-7 h-7 rounded-md flex items-center justify-center bg-white/50">
                    {v.icon}
                  </span>
                  <span className="flex-1 text-left">{m.label}</span>
                  {m.config?.placeholder && (
                    <span className="text-[10px] uppercase tracking-wider opacity-60">Placeholder</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Zelle two-step flow */}
        {activeMethod === "zelle" && zelleIntent && (
          <div className="space-y-4" data-testid="zelle-instructions">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-900">
              <p className="font-semibold mb-2">Send a Zelle payment</p>
              <ul className="space-y-1.5">
                <li><span className="text-purple-600">To:</span> <strong>{zelleIntent.handle}</strong></li>
                <li><span className="text-purple-600">Amount:</span> <strong>${zelleIntent.amount.toFixed(2)}</strong></li>
                <li><span className="text-purple-600">Memo:</span> <strong>{zelleIntent.memo}</strong></li>
              </ul>
              <p className="mt-3 text-xs text-purple-700">
                Once sent, paste your bank's Zelle confirmation number below to claim your spot.
              </p>
            </div>
            <input
              type="text"
              value={zelleRef}
              onChange={(e) => setZelleRef(e.target.value)}
              placeholder="Zelle confirmation #"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
              data-testid="zelle-reference-input"
            />
            <button
              type="button"
              onClick={handleZelleConfirm}
              disabled={loading || zelleRef.length < 4}
              className="w-full py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60"
              data-testid="zelle-confirm-btn"
            >
              {loading ? "Submitting..." : "Confirm payment"}
            </button>
            <button
              type="button"
              onClick={() => { setActiveMethod(null); setZelleIntent(null); }}
              className="w-full text-xs text-gray-500 hover:text-gray-700"
            >
              ← Choose a different method
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
