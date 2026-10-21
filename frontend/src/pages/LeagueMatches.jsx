import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Calendar, MapPin, Mail, CheckCircle, Clock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const GREEN = "#008F70";
const AMBER = "#F2A922";
const INK = "#3D3D3D";
const MUTED = "#5C5C5C";

// "2026-11-08" is a calendar date, not a moment in UTC: parse it as local so it never shows a day early
const parseDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso));
const fmtDate = (iso) => (iso ? parseDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

function statusOf(m) {
  if (m.status === "completed") return { key: "played", label: m.result === "won" ? "Won" : m.result === "lost" ? "Lost" : "Played", color: INK, bg: "#F1F1F1" };
  if (m.schedule_status === "scheduled") return { key: "scheduled", label: "Confirmed", color: "#fff", bg: GREEN };
  if (m.schedule_status === "proposed") return m.role === "away"
    ? { key: "proposed", label: "Reply needed", color: INK, bg: AMBER }
    : { key: "proposed", label: "Awaiting confirmation", color: INK, bg: "#F1F1F1" };
  return { key: "unscheduled", label: "Needs scheduling", color: INK, bg: AMBER };
}

function MatchCard({ m, onChanged }) {
  const [open, setOpen] = useState(false);       // Home: proposal form
  const [declining, setDeclining] = useState(false); // Away: suggest another time
  const [when, setWhen] = useState("");
  const [venue, setVenue] = useState(m.venue || "");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const st = statusOf(m);
  const isHome = m.role === "home";
  const played = m.status === "completed";

  const call = async (path, body) => {
    setBusy(true);
    setError("");
    try {
      await axios.post(`${API}/matches/${m.id}/${path}`, body, { withCredentials: true });
      setOpen(false);
      setDeclining(false);
      await onChanged();
    } catch (e) {
      const d = e.response?.data?.detail;
      setError(typeof d === "string" ? d : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const propose = (e) => {
    e.preventDefault();
    if (!when) return setError("Pick a date and time.");
    call("propose", { date: new Date(when).toISOString(), venue, note });
  };

  const inputStyle = { border: "1px solid #D9D9D9", color: INK, fontFamily: "Rubik, sans-serif" };

  return (
    <article className="bg-white p-5 sm:p-6" style={{ border: "1px solid #E5E7EB" }} data-testid={`match-card-${m.id}`}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }}>Match {m.round}</span>
        <span
          className="text-xs font-bold uppercase tracking-wider px-2.5 py-1"
          style={isHome ? { background: GREEN, color: "#fff" } : { border: `1px solid ${INK}`, color: INK }}
          data-testid={`match-role-${m.id}`}
        >
          {isHome ? "Home" : "Away"}
        </span>
        <span className="ml-auto text-xs font-bold px-2.5 py-1" style={{ background: st.bg, color: st.color }} data-testid={`match-status-${m.id}`}>
          {st.label}
        </span>
      </div>

      <h3 className="text-xl font-bold" style={{ color: INK }}>{m.partner_name ? `${m.partner_name} vs ${m.opponent.name}` : `vs ${m.opponent.name}`}</h3>

      <ul className="mt-3 space-y-1.5 text-sm" style={{ color: MUTED }}>
        {m.opponent.email && (
          <li className="flex items-center gap-2">
            <Mail className="w-4 h-4 shrink-0" style={{ color: GREEN }} />
            <a href={`mailto:${m.opponent.email}`} className="underline" style={{ color: GREEN }}>{m.opponent.email}</a>
          </li>
        )}
        {m.schedule_status === "scheduled" || played ? (
          <li className="flex items-center gap-2"><Calendar className="w-4 h-4 shrink-0" style={{ color: GREEN }} />{fmtDateTime(m.scheduled_date)}</li>
        ) : (
          <li className="flex items-center gap-2"><Clock className="w-4 h-4 shrink-0" style={{ color: GREEN }} />Play by {fmtDate(m.deadline)}</li>
        )}
        {m.venue && (m.schedule_status === "scheduled" || played) && (
          <li className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" style={{ color: GREEN }} />{m.venue}</li>
        )}
      </ul>

      {/* Home: needs to propose a time */}
      {!played && isHome && m.schedule_status === "unscheduled" && (
        <div className="mt-4">
          {m.last_decline && (
            <p className="text-sm mb-3 p-3" style={{ background: "#F1F1F1", color: INK }} data-testid={`match-declined-${m.id}`}>
              {m.opponent.name} could not make that time{m.last_decline.message ? `: "${m.last_decline.message}"` : "."} Please propose another.
            </p>
          )}
          {!open ? (
            <button onClick={() => setOpen(true)} className="px-5 py-2.5 text-sm font-bold uppercase tracking-wider" style={{ background: AMBER, color: INK }} data-testid={`schedule-match-${m.id}`}>
              Schedule match
            </button>
          ) : null}
        </div>
      )}

      {/* Home: waiting for Away */}
      {!played && isHome && m.schedule_status === "proposed" && m.proposal && (
        <div className="mt-4 p-3 text-sm" style={{ background: "#F1F1F1", color: INK }}>
          You proposed <strong>{fmtDateTime(m.proposal.date)}</strong> at <strong>{m.proposal.venue}</strong>. Waiting for {m.opponent.name} to confirm.
          <button onClick={() => setOpen(true)} className="ml-3 underline font-semibold" style={{ color: GREEN }}>Change</button>
        </div>
      )}

      {/* Away: confirm or suggest another time */}
      {!played && !isHome && m.schedule_status === "proposed" && m.proposal && (
        <div className="mt-4 p-4" style={{ border: `1px solid ${GREEN}` }}>
          <p className="text-sm font-bold mb-1" style={{ color: INK }}>{m.opponent.name} proposed:</p>
          <p className="text-sm" style={{ color: INK }}>{fmtDateTime(m.proposal.date)} · {m.proposal.venue}</p>
          {m.proposal.note && <p className="text-sm mt-1" style={{ color: MUTED }}>"{m.proposal.note}"</p>}
          {!declining ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => call("respond", { action: "confirm" })} className="px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50" style={{ background: GREEN }} data-testid={`confirm-match-${m.id}`}>
                Confirm
              </button>
              <button disabled={busy} onClick={() => setDeclining(true)} className="px-5 py-2.5 text-sm font-bold uppercase tracking-wider disabled:opacity-50" style={{ border: `1px solid ${INK}`, color: INK }} data-testid={`suggest-time-${m.id}`}>
                Suggest another time
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: MUTED }} htmlFor={`msg-${m.id}`}>Message to {m.opponent.name} (optional)</label>
              <textarea id={`msg-${m.id}`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} rows={2} className="w-full px-3 py-2 text-sm" style={inputStyle} placeholder="e.g. I can play weekday evenings after 6pm" data-testid={`decline-message-${m.id}`} />
              <div className="mt-2 flex gap-2">
                <button disabled={busy} onClick={() => call("respond", { action: "decline", message })} className="px-5 py-2.5 text-sm font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: AMBER, color: INK }} data-testid={`send-decline-${m.id}`}>Send</button>
                <button onClick={() => setDeclining(false)} className="px-4 py-2.5 text-sm underline" style={{ color: MUTED }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Away: waiting for Home to propose */}
      {!played && !isHome && m.schedule_status === "unscheduled" && (
        <p className="mt-4 text-sm p-3" style={{ background: "#F1F1F1", color: INK }}>
          {m.opponent.name} is Home and will propose a date, time and court. You will get an email to confirm.
        </p>
      )}

      {/* Confirmed: report the score */}
      {!played && m.schedule_status === "scheduled" && (
        <div className="mt-4">
          <Link to={`/matches/${m.id}/score`} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white" style={{ background: GREEN }} data-testid={`report-score-${m.id}`}>
            <CheckCircle className="w-4 h-4" /> Report score
          </Link>
        </div>
      )}

      {/* Home: proposal form */}
      {open && (
        <form onSubmit={propose} className="mt-4 p-4 space-y-3" style={{ border: "1px solid #E5E7EB" }} data-testid={`propose-form-${m.id}`}>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: MUTED }} htmlFor={`when-${m.id}`}>Date and time</label>
            <input id={`when-${m.id}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required className="w-full px-3 py-2 text-sm" style={inputStyle} data-testid={`propose-when-${m.id}`} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: MUTED }} htmlFor={`venue-${m.id}`}>Court or venue</label>
            <input id={`venue-${m.id}`} type="text" value={venue} onChange={(e) => setVenue(e.target.value)} required maxLength={120} className="w-full px-3 py-2 text-sm" style={inputStyle} placeholder="e.g. Piedmont Park, Court 3" data-testid={`propose-venue-${m.id}`} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: MUTED }} htmlFor={`note-${m.id}`}>Note (optional)</label>
            <input id={`note-${m.id}`} type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="w-full px-3 py-2 text-sm" style={inputStyle} data-testid={`propose-note-${m.id}`} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="px-5 py-2.5 text-sm font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: AMBER, color: INK }} data-testid={`send-proposal-${m.id}`}>
              {busy ? "Sending..." : "Send to opponent"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2.5 text-sm underline" style={{ color: MUTED }}>Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-sm" style={{ color: "#B42318" }} role="alert" data-testid={`match-error-${m.id}`}>{error}</p>}
    </article>
  );
}

export default function LeagueMatches() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useDocumentMeta({ title: "My matches | VENLAX Sports", description: "Your opponents and schedule for this league." });

  const load = useCallback(async () => {
    try {
      const { data: d } = await axios.get(`${API}/matches/league/${id}/mine`, { withCredentials: true });
      setData(d);
      setError("");
    } catch (e) {
      setError(e.response?.status === 401 ? "Please log in to see your matches." : "Could not load your matches.");
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, user, load]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-lg font-bold mb-4" style={{ color: INK }}>{error}</p>
        <Link to="/auth" className="inline-block px-6 py-3 text-sm font-bold uppercase tracking-wider" style={{ background: AMBER, color: INK }}>Log in</Link>
      </div>
    );
  }
  if (!data) return <div className="min-h-[50vh] flex items-center justify-center text-sm" style={{ color: MUTED }}>Loading your matches...</div>;

  const { league, matches } = data;
  const played = matches.filter((m) => m.status === "completed").length;
  const confirmed = matches.filter((m) => m.status !== "completed" && m.schedule_status === "scheduled").length;
  const todo = matches.length - played - confirmed;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" data-testid="league-matches-page">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium mb-5" style={{ color: MUTED }}>
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "#B7791F" }}>Open to Play</p>
      <h1 className="text-3xl sm:text-4xl font-bold italic" style={{ color: INK }}>{league.name}</h1>
      <p className="mt-2 text-sm" style={{ color: MUTED }}>
        {fmtDate(league.start_date)} – {fmtDate(league.end_date)} · {matches.length} match{matches.length === 1 ? "" : "es"} this season ·{" "}
        <Link to={`/leagues/${league.id}/standings`} className="underline" style={{ color: GREEN }}>Standings</Link>
      </p>

      <div className="mt-6 grid grid-cols-3 text-center" style={{ background: GREEN, color: "#fff" }} data-testid="match-progress">
        {[["To schedule", todo], ["Confirmed", confirmed], ["Played", played]].map(([label, n]) => (
          <div key={label} className="py-4">
            <div className="text-3xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{n}</div>
            <div className="text-xs uppercase tracking-wider opacity-90">{label}</div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-sm p-4" style={{ background: "#F1F1F1", color: INK }}>
        <strong>Home</strong> proposes the date, time and court. <strong>Away</strong> confirms or suggests another time. Contact your opponent within 48 hours, then report each score after you play.
      </p>

      {matches.length === 0 ? (
        <p className="mt-8 text-center text-sm" style={{ color: MUTED }}>No matches assigned to you in this league yet.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {matches.map((m) => <MatchCard key={m.id} m={m} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}
