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
export default function PaymentMethodModal({ open, onClose, league, promoCode, onSuccess }) {
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

  const handleStripe = async () => {
    setLoading(true); setError("");
    try {
      const origin = window.location.origin;
      const payload = { league_id: league.id, origin_url: origin };
      if (promoCode) payload.promo_code = promoCode;
      const { data } = await axios.post(`${API}/payments/checkout`, payload, { withCredentials: true });
      if (data.free) {
        onSuccess?.();
        onClose();
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err.response?.data?.detail || "Stripe checkout failed");
      setLoading(false);
    }
  };

  const WALLET_DISABLED = ["apple_pay", "google_pay"];

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
      setSuccess("Zelle reference recorded — your spot is reserved pending admin verification.");
      setTimeout(() => { onClose(); }, 3000);
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 relative overscroll-contain"
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
          <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Complete registration</p>
          <h2 id="payment-modal-title" className="font-heading font-black text-xl text-gray-900 mt-1 truncate">{league.name}</h2>
          <p className="text-sm text-gray-500 mt-1 capitalize">{league.format} · {league.city}</p>
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
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3 flex items-start gap-2" data-testid="payment-waiver-notice">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              By completing payment you confirm your agreement to the{" "}
              <a href="/terms#waiver" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Liability Waiver & Assumption of Risk</a>,
              including unsupervised play, player-selected courts, and weather hazards.
            </p>
          </div>
        )}

        {!activeMethod && !zelleIntent && (
          <div className="space-y-2">
            {methods.map((m) => {
              const v = METHOD_VISUALS[m.id] || METHOD_VISUALS.stripe;
              const isDisabled = WALLET_DISABLED.includes(m.id);
              const onClick = isDisabled ? undefined :
                m.id === "stripe" ? handleStripe :
                m.id === "zelle" ? handleZelleStart :
                undefined;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={onClick}
                  disabled={loading || isDisabled}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 border rounded-xl text-sm font-semibold transition-colors ${isDisabled ? "opacity-40 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200" : `hover:scale-[1.01] ${v.color}`} disabled:opacity-60`}
                  data-testid={`pay-method-${m.id}`}
                  title={isDisabled ? "Coming soon" : undefined}
                >
                  <span className="w-7 h-7 rounded-md flex items-center justify-center bg-white/50">
                    {v.icon}
                  </span>
                  <span className="flex-1 text-left">{m.label}</span>
                  {isDisabled
                    ? <span className="text-[10px] uppercase tracking-wider opacity-70 bg-gray-200 text-gray-500 rounded px-1.5 py-0.5">Coming soon</span>
                    : m.id === "zelle" && <span className="text-[10px] uppercase tracking-wider opacity-60">Admin verified</span>
                  }
                </button>
              );
            })}
          </div>
        )}

        {!activeMethod && !zelleIntent && (
          <div className="mt-4 space-y-1.5">
            <p className="text-[11px] text-center text-gray-400 flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
              Secured by Stripe — we never store or see your card details.
            </p>
            <p className="text-[11px] text-center text-gray-400">
              Entry fees are <strong>non-refundable</strong> once the league starts.{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Terms</a>
            </p>
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
              aria-label="Zelle confirmation number"
              autoComplete="off"
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
