import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/admin/players`;
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const INK = "#1D1D1D";
const input = "px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400";
const when = (iso) => (iso ? new Date(iso).toLocaleString() : "");
const STATUS_STYLE = { active: ["#DCFCE7", "#166534"], suspended: ["#FEF3C7", "#92400E"], deactivated: ["#F3F4F6", "#4C4C4C"] };

function Block({ title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>{title}</h3>
      {children}
    </section>
  );
}

export default function PlayerProfilePanel({ playerId, onClose, onChanged }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState("");
  const [tag, setTag] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/${playerId}`, { withCredentials: true });
      setP(data);
    } catch (e) {
      setError(e.response?.data?.detail || "Could not load this player");
    }
  }, [playerId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.response?.data?.detail || "That did not work");
    } finally {
      setBusy(false);
    }
  };
  const call = (method, path, body) => axios({ method, url: `${API}/${playerId}${path}`, data: body, withCredentials: true });

  const changeTags = (add, remove) => run(() => call("put", "/tags", { add, remove }));
  const addTag = (e) => { e.preventDefault(); if (tag.trim()) { changeTags([tag], []); setTag(""); } };
  const addNote = (e) => { e.preventDefault(); if (note.trim()) run(async () => { await call("post", "/notes", { text: note }); setNote(""); }); };
  const status = (action) => {
    const needsReason = action !== "reactivate";
    const verb = { suspend: "Suspend", deactivate: "Deactivate", reactivate: "Reactivate" }[action];
    const reason = needsReason ? window.prompt(`${verb} ${p.name}? They ${action === "suspend" ? "cannot sign in until you reactivate them" : "will be hidden and cannot sign in"}.\n\nReason (recorded in the audit log):`) : "";
    if (needsReason && reason === null) return;
    if (!needsReason && !window.confirm(`Reactivate ${p.name}?`)) return;
    run(() => call("post", `/${action}`, { reason }));
  };

  const [bg, fg] = STATUS_STYLE[p?.status] || STATUS_STYLE.active;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose} data-testid="player-profile">
      <aside className="w-full max-w-xl h-full overflow-y-auto bg-white p-6 space-y-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Player profile">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-2xl" style={{ color: INK }}>{p?.name || "Player"}</h2>
            {p && <p className="text-sm" style={{ color: MUTED }}>{p.email}{p.phone ? ` · ${p.phone}` : ""}{p.city ? ` · ${p.city}` : ""}</p>}
          </div>
          <button onClick={onClose} className="px-3 py-1.5 text-sm bg-white text-gray-900" style={{ border: `1px solid ${BORDER}` }} data-testid="profile-close">Close</button>
        </div>

        {error && <div className="px-4 py-3 text-sm" style={{ background: "#FEE2E2", color: "#B91C1C" }} role="alert">{error}</div>}
        {!p && !error && <p className="text-sm" style={{ color: MUTED }}>Loading…</p>}

        {p && (
          <>
            <Block title="Account">
              <p className="text-sm flex flex-wrap items-center gap-2">
                <span className="px-2 py-1 text-xs font-semibold" style={{ background: bg, color: fg }} data-testid="profile-status">{p.status}</span>
                <span>Joined {p.created_at?.slice(0, 10)}</span>
                <span>· Email {p.email_verified ? "verified" : "not verified"}</span>
                <span>· Profile {p.profile_complete ? "complete" : "incomplete"}</span>
              </p>
              {p.suspended_reason && <p className="text-sm" style={{ color: "#92400E" }}>Suspended {p.suspended_at?.slice(0, 10)}: {p.suspended_reason}</p>}
              <p className="text-xs" style={{ color: MUTED }}>
                Source: {p.attribution?.first?.source || "direct"}{p.attribution?.first?.campaign ? ` / ${p.attribution.first.campaign}` : ""}
                {" · "}Ratings: tennis {p.ratings.tennis ?? "-"}, pickleball {p.ratings.pickleball ?? "-"}
                {" · "}Marketing email: {p.marketing.email_notifications && !p.marketing.unsubscribed_at ? "allowed" : "opted out"}
              </p>
              {p.can.suspend && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {p.status === "active" && <button disabled={busy} onClick={() => status("suspend")} className="px-3 py-1.5 text-sm text-white disabled:opacity-50" style={{ background: "#B45309" }} data-testid="profile-suspend">Suspend</button>}
                  {p.status !== "deactivated" && <button disabled={busy} onClick={() => status("deactivate")} className="px-3 py-1.5 text-sm bg-white text-gray-900 disabled:opacity-50" style={{ border: `1px solid ${BORDER}` }} data-testid="profile-deactivate">Deactivate</button>}
                  {p.status !== "active" && <button disabled={busy} onClick={() => status("reactivate")} className="px-3 py-1.5 text-sm text-white disabled:opacity-50" style={{ background: "#008F70" }} data-testid="profile-reactivate">Reactivate</button>}
                </div>
              )}
            </Block>

            <Block title="Tags">
              <div className="flex flex-wrap gap-2">
                {p.tags.length === 0 && <span className="text-sm" style={{ color: MUTED }}>No tags</span>}
                {p.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 inline-flex items-center gap-1" style={{ background: "#F1F1F1", color: INK }}>
                    {t}{p.can.tag && <button aria-label={`Remove tag ${t}`} onClick={() => changeTags([], [t])} className="font-bold">×</button>}
                  </span>
                ))}
              </div>
              {p.can.tag && (
                <form onSubmit={addTag} className="flex gap-2">
                  <input className={`${input} flex-1`} style={{ border: `1px solid ${BORDER}` }} placeholder="Add a tag, e.g. club-member" value={tag} onChange={(e) => setTag(e.target.value)} data-testid="profile-tag-input" />
                  <button className="px-3 py-2 text-sm text-white" style={{ background: "#008F70" }} disabled={busy} data-testid="profile-tag-add">Add</button>
                </form>
              )}
            </Block>

            <Block title="Leagues">
              {p.leagues.length === 0 ? <p className="text-sm" style={{ color: MUTED }}>Not in any league.</p> : p.leagues.map((l) => (
                <p key={l.league_id} className="text-sm">{l.name} <span className="text-xs" style={{ color: MUTED }}>· {l.payment_status} · joined {l.joined_at?.slice(0, 10) || "date unknown"}{l.partner ? ` · with ${l.partner}` : ""}</span></p>
              ))}
            </Block>

            <Block title="Recent matches">
              {p.matches.length === 0 ? <p className="text-sm" style={{ color: MUTED }}>No matches yet.</p> : p.matches.map((m) => (
                <p key={m.id} className="text-sm">{m.date?.slice(0, 10) || "unscheduled"} vs {m.opponent || "?"} <span className="text-xs" style={{ color: MUTED }}>· {m.status}{m.result ? ` · ${m.result}` : ""}</span></p>
              ))}
            </Block>

            <Block title="Referrals">
              <p className="text-sm">Code {p.referral.code || "none yet"} · referred {p.referral.players_referred} {p.referral.players_referred === 1 ? "player" : "players"}
                {p.referral.referred_by_code ? ` · joined with code ${p.referral.referred_by_code}` : ""}</p>
            </Block>

            <Block title="Emails sent to this player">
              {p.communications.length === 0 ? <p className="text-sm" style={{ color: MUTED }}>None yet.</p> : p.communications.map((c, i) => (
                <p key={i} className="text-sm">{c.campaign} <span className="text-xs" style={{ color: MUTED }}>· {when(c.sent_at)}</span></p>
              ))}
            </Block>

            {p.notes !== null && (
              <Block title="Private notes (admins only, never shown to the player)">
                {p.can.note && (
                  <form onSubmit={addNote} className="space-y-2">
                    <textarea className={`${input} w-full`} style={{ border: `1px solid ${BORDER}` }} rows={3} maxLength={2000} placeholder="Add a note" value={note} onChange={(e) => setNote(e.target.value)} data-testid="profile-note-input" />
                    <button className="px-3 py-2 text-sm text-white" style={{ background: "#008F70" }} disabled={busy || !note.trim()} data-testid="profile-note-add">Save note</button>
                  </form>
                )}
                {p.notes.length === 0 && <p className="text-sm" style={{ color: MUTED }}>No notes.</p>}
                {p.notes.map((n) => (
                  <div key={n.id} className="text-sm p-3" style={{ background: "#F9FAFB", border: `1px solid ${BORDER}` }}>
                    <p className="whitespace-pre-wrap break-words">{n.text}</p>
                    <p className="text-xs mt-1" style={{ color: MUTED }}>{n.by} · {when(n.at)}</p>
                  </div>
                ))}
              </Block>
            )}

            {p.history && (
              <Block title="Admin actions on this account">
                {p.history.length === 0 ? <p className="text-sm" style={{ color: MUTED }}>None recorded.</p> : p.history.map((h, i) => (
                  <p key={i} className="text-sm">{h.action} <span className="text-xs" style={{ color: MUTED }}>· {h.by} · {when(h.at)}</span></p>
                ))}
              </Block>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
