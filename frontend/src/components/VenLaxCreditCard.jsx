import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Wallet } from "lucide-react";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const money = (n) => `$${Math.abs(Number(n)).toFixed(2)}`;
const day = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

/** Dashboard card: VenLax Credit balance and history, plus any refund waiting for the player's choice. */
export default function VenLaxCreditCard() {
  const [credit, setCredit] = useState(null);     // { balance, history }
  const [refunds, setRefunds] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    axios.get(`${API}/payments/credit`, { withCredentials: true }).then(({ data }) => setCredit(data)).catch(() => {});
    axios.get(`${API}/doubles-invite/refund-choices`, { withCredentials: true }).then(({ data }) => setRefunds(data.refunds || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const choose = async (token, method) => {
    setBusy(`${token}-${method}`);
    setError("");
    try {
      await axios.post(`${API}/doubles-invite/${token}/refund`, { method }, { withCredentials: true });
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not complete that. Try again.");
    } finally {
      setBusy("");
    }
  };

  const history = credit?.history || [];
  if (!credit || (!refunds.length && !history.length && !credit.balance)) return null;
  const rows = showAll ? history : history.slice(0, 3);

  return (
    <div className="bg-white p-4 mb-6" style={{ border: "1px solid #E5E7EB" }} data-testid="venlax-credit-card">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="flex items-center gap-3">
          <Wallet className="w-5 h-5" style={{ color: "#008F70" }} aria-hidden="true" />
          <span>
            <span className="block font-heading font-bold text-sm" style={{ color: "#1D1D1D" }}>VenLax Credit</span>
            <span className="block text-xs" style={{ color: "#4C4C4C" }}>Never expires. Used first when you register for any league.</span>
          </span>
        </span>
        <span className="text-2xl font-bold" style={{ color: "#1D1D1D", fontFamily: "'IBM Plex Mono', monospace" }} data-testid="venlax-credit-balance">{money(credit.balance)}</span>
      </div>

      {refunds.map((r) => (
        <div key={r.token} className="mt-4 p-3" style={{ background: "#FFF6E0", border: "1px solid #F2A922" }} data-testid={`refund-choice-${r.token}`}>
          <p className="text-sm font-bold" style={{ color: "#1D1D1D" }}>{money(r.amount)} back from {r.league_name}</p>
          <p className="text-xs mt-1" style={{ color: "#4C4C4C" }}>We could not find you a partner before the league started. Choose how to get your money back. If you do not choose within 7 days, we add it as VenLax Credit.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => choose(r.token, "credit")}
              disabled={!!busy}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-60"
              style={{ background: "#008F70", color: "#fff" }}
              data-testid={`refund-credit-${r.token}`}
            >
              {busy === `${r.token}-credit` ? "Adding..." : "VenLax Credit - instant"}
            </button>
            {r.card_possible && (
              <button
                onClick={() => choose(r.token, "card")}
                disabled={!!busy}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-60"
                style={{ background: "#F2A922", color: "#1D1D1D" }}
                data-testid={`refund-card-${r.token}`}
              >
                {busy === `${r.token}-card` ? "Refunding..." : "Back to my card"}
              </button>
            )}
          </div>
          <p className="text-[11px] mt-2" style={{ color: "#4C4C4C" }}>
            Credit is added right away. A card refund goes back through Stripe and follows your bank's refund timeline (usually a few business days).
          </p>
        </div>
      ))}
      {error && <p className="text-xs text-red-600 mt-2" role="alert">{error}</p>}

      {history.length > 0 && (
        <div className="mt-4" data-testid="venlax-credit-history">
          <ul className="divide-y" style={{ borderColor: "#E5E7EB" }}>
            {rows.map((h) => (
              <li key={h.ref} className="py-2 flex items-center justify-between gap-3 text-xs">
                <span style={{ color: "#4C4C4C" }}>{h.reason} <span style={{ color: "#6B7280" }}>· {day(h.created_at)}</span></span>
                <span className="font-semibold" style={{ color: h.amount > 0 ? "#008F70" : "#1D1D1D", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {h.amount > 0 ? "+" : "-"}{money(h.amount)}
                </span>
              </li>
            ))}
          </ul>
          {history.length > 3 && (
            <button onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold mt-1" style={{ color: "#008F70" }} data-testid="venlax-credit-history-toggle">
              {showAll ? "Show fewer" : `Show all ${history.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
