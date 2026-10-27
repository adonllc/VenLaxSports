import { useState } from "react";
import axios from "axios";
import PartnerSearch from "./PartnerSearch";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/**
 * Lets the player who registered a doubles team name the partner afterwards:
 * a VenLax player (team completes at once), an email (partner gets the invite), or the shared link.
 *
 * Props:
 *   token       the team's invite token
 *   paid        false while the entry fee is still unpaid (a player can only be added after payment)
 *   onDone(res) called when a VenLax player completes the team ({ registered }) or an email invite was sent ({ invited })
 */
export default function AddPartnerPanel({ token, paid = true, onDone }) {
  const [partner, setPartner] = useState(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}/doubles-invite/confirm?token=${token}`;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const body = partner ? { partner_id: partner.id } : { partner_email: email.trim().toLowerCase() };
      const { data } = await axios.post(`${API}/doubles-invite/${token}/partner`, body, { withCredentials: true });
      onDone?.(data);
    } catch (e) {
      setError(e.response?.data?.detail || "Could not add your partner. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="space-y-3" data-testid="add-partner-panel">
      <PartnerSearch
        onPartnerSelect={(p) => { setPartner(p); if (p) setEmail(""); }}
        onEmailChange={(e) => { setEmail(e); if (e) setPartner(null); }}
      />
      {!paid && partner && (
        <p className="text-xs" style={{ color: "#B45309" }}>Finish your payment first, then you can add a player from VenLax.</p>
      )}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy || (!partner && !email.trim())}
        className="w-full text-white py-2.5 text-sm font-semibold disabled:opacity-50"
        style={{ background: "#008F70", fontFamily: "Rubik, sans-serif" }}
        data-testid="add-partner-submit"
      >
        {busy ? "Saving…" : partner ? `Add ${partner.name} as my partner` : "Send invite to this email"}
      </button>
      <div className="pt-1">
        <p className="text-xs mb-1" style={{ color: "#6B7280" }}>Or send this link to anyone. The first person to open it and accept becomes your partner:</p>
        <div className="flex gap-2 items-center">
          <input readOnly value={link} className="flex-1 text-xs px-2 py-1 bg-white text-gray-900" style={{ border: "1px solid #E5E7EB" }} data-testid="partner-link" />
          <button type="button" onClick={copy} className="text-xs px-2 py-1" style={{ color: "#B7791F", border: "1px solid #E5A885" }} data-testid="partner-link-copy">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
