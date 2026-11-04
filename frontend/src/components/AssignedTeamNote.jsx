import { useState } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/**
 * Shows the partner VenLax assigned and lets either player ask for a different one until the league starts.
 * `team` comes from GET /leagues/my: { invite_token, partner_name, change_request, can_request_change }.
 */
export default function AssignedTeamNote({ team, onChanged }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!team) return null;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await axios.post(`${API}/doubles-invite/${team.invite_token}/change-request`, { reason: reason.trim() || null }, { withCredentials: true });
      setOpen(false);
      onChanged?.();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not send your request. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 ml-8 text-sm" style={{ color: "#374151" }} data-testid={`assigned-team-${team.invite_token}`}>
      <p>
        Partner: <strong>{team.partner_name}</strong>
        <span className="ml-2 text-xs px-2 py-0.5" style={{ background: "#F1F1F1", color: "#5C5C5C" }}>assigned by VenLax</span>
      </p>
      {team.change_request === "pending" && (
        <p className="text-xs mt-1" style={{ color: "#B7791F" }} data-testid="change-request-pending">Change requested. We will review it soon.</p>
      )}
      {team.change_request === "declined" && (
        <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Your change request was reviewed and the team stays as it is.</p>
      )}
      {team.can_request_change && !open && (
        <button onClick={() => setOpen(true)} className="mt-1 text-xs font-semibold" style={{ color: "#008F70" }} data-testid="request-change-btn">
          Request a different partner
        </button>
      )}
      {team.can_request_change && open && (
        <div className="mt-2 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Why would you like a different partner? (optional)"
            className="w-full px-3 py-2 text-sm"
            style={{ border: "1px solid #E5E7EB" }}
            data-testid="change-request-reason"
          />
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={busy} className="px-3 py-1.5 text-xs font-bold disabled:opacity-60" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="change-request-submit">
              {busy ? "Sending..." : "Send request"}
            </button>
            <button onClick={() => setOpen(false)} className="text-xs font-semibold" style={{ color: "#6B7280" }} data-testid="change-request-cancel">Cancel</button>
          </div>
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        </div>
      )}
      {!team.can_request_change && !team.change_request && (
        <p className="text-xs mt-1" style={{ color: "#6B7280" }} data-testid="team-locked">Teams are locked now that the league has started.</p>
      )}
    </div>
  );
}
