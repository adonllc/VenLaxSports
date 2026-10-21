import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Calendar, MapPin, Mail, CheckCircle, Clock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { buildScoreSummary } from "../utils/scoreSummary";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const GREEN = "#008F70";
const AMBER = "#F2A922";
const INK = "#3D3D3D";
const MUTED = "#5C5C5C";

// "2026-11-08" is a calendar date, not a moment in UTC: parse it as local so it never shows a day early
const parseDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso));
const fmtDate = (iso) => (iso ? parseDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][(n % 100 >> 3) ^ 1 && n % 10 < 4 ? n % 10 : 0]}`;

// Group order follows the product spec; Playoffs (when they exist) lead.
const GROUPS = [
  { key: "playoffs", title: "Playoffs" },
  { key: "not_scheduled", title: "Not Scheduled" },
  { key: "awaiting_confirmation", title: "Awaiting Opponent Confirmation" },
  { key: "scheduled", title: "Scheduled" },
  { key: "in_progress", title: "In Progress" },
  { key: "awaiting_result", title: "Awaiting Result" },
  { key: "completed", title: "Completed" },
  { key: "problem", title: "Disputed or Cancelled" },
];
const groupOf = (m) => (m.is_playoff ? "playoffs" : m.state === "disputed" || m.state === "cancelled" ? "problem" : m.state);

function chipFor(m) {
  switch (m.state) {
    case "not_scheduled": return { label: "Needs scheduling", bg: AMBER, color: INK };
    case "awaiting_confirmation": return m.role === "away" ? { label: "Reply needed", bg: AMBER, color: INK } : { label: "Awaiting confirmation", bg: "#F1F1F1", color: INK };
    case "scheduled": return { label: "Scheduled", bg: GREEN, color: "#fff" };
    case "in_progress": return { label: "Match day", bg: GREEN, color: "#fff" };
    case "awaiting_result": return { label: "Awaiting result", bg: AMBER, color: INK };
    case "completed": return { label: m.result === "won" ? "Won" : m.result === "lost" ? "Lost" : "Completed", bg: m.result === "won" ? GREEN : "#F1F1F1", color: m.result === "won" ? "#fff" : INK };
    case "disputed": return { label: "Disputed", bg: "#B42318", color: "#fff" };
    default: return { label: "Cancelled", bg: "#F1F1F1", color: INK };
  }
}

function Avatar({ person, size = 48 }) {
  const initials = (person?.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const style = { width: size, height: size, borderRadius: "50%", flexShrink: 0 };
  return person?.avatar ? (
    <img src={person.avatar} alt="" style={{ ...style, objectFit: "cover" }} data-testid="opponent-avatar" />
  ) : (
    <div aria-hidden="true" className="flex items-center justify-center font-bold text-sm" style={{ ...style, background: "#F1F1F1", color: INK }} data-testid="opponent-initials">{initials}</div>
  );
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
  const chip = chipFor(m);
  const isHome = m.role === "home";
  const opp = m.opponent;
  const first = opp.members?.[0] || { name: opp.name };
  const scored = m.state === "completed" ? buildScoreSummary(m.sport, m.score_data || {}, m.player1_name, m.player2_name) : null;
  const confirmedTime = ["scheduled", "in_progress", "awaiting_result", "completed"].includes(m.state);

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
  const rating = [opp.rating != null ? `Rating ${opp.rating}` : null, opp.skill_level].filter(Boolean).join(" · ");

  return (
    <article className="bg-white p-5 sm:p-6" style={{ border: "1px solid #E5E7EB" }} data-testid={`match-card-${m.id}`}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }} data-testid={`match-number-${m.id}`}>
          {m.is_playoff ? "Playoff match" : `Match ${m.match_number || m.round}`}
        </span>
        {!m.is_playoff && (
          <span
            className="text-xs font-bold uppercase tracking-wider px-2.5 py-1"
            style={isHome ? { background: GREEN, color: "#fff" } : { border: `1px solid ${INK}`, color: INK }}
            data-testid={`match-role-${m.id}`}
          >
            {isHome ? "Home" : "Away"}
          </span>
        )}
        <span className="ml-auto text-xs font-bold px-2.5 py-1" style={{ background: chip.bg, color: chip.color }} data-testid={`match-status-${m.id}`}>
          {chip.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Avatar person={first} />
        <div className="min-w-0">
          <h3 className="text-xl font-bold leading-tight" style={{ color: INK }}>{m.partner_name ? `${m.partner_name} vs ${opp.name}` : `vs ${opp.name}`}</h3>
          {rating && <p className="text-xs mt-0.5" style={{ color: MUTED }} data-testid={`opponent-rating-${m.id}`}>{rating}</p>}
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 text-sm" style={{ color: MUTED }}>
        {opp.email && (
          <li className="flex items-center gap-2">
            <Mail className="w-4 h-4 shrink-0" style={{ color: GREEN }} />
            <a href={`mailto:${opp.email}`} className="underline" style={{ color: GREEN }}>{opp.email}</a>
          </li>
        )}
        {confirmedTime ? (
          <li className="flex items-center gap-2"><Calendar className="w-4 h-4 shrink-0" style={{ color: GREEN }} />{fmtDateTime(m.scheduled_date)}</li>
        ) : m.deadline ? (
          <li className="flex items-center gap-2"><Clock className="w-4 h-4 shrink-0" style={{ color: GREEN }} />Play by {fmtDate(m.deadline)}</li>
        ) : null}
        {m.venue && confirmedTime && (
          <li className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" style={{ color: GREEN }} />{m.venue}</li>
        )}
      </ul>

      {m.state === "completed" && (
        <p className="mt-3 text-sm font-semibold" style={{ color: INK }} data-testid={`match-result-${m.id}`}>
          {m.result === "won" ? "You won" : m.result === "lost" ? "You lost" : "Result submitted"}
          {scored?.scoreStr ? ` · ${scored.scoreStr}` : ""}
        </p>
      )}

      {/* Not scheduled: Home proposes, Away waits */}
      {m.state === "not_scheduled" && isHome && (
        <div className="mt-4">
          {m.last_decline && (
            <p className="text-sm mb-3 p-3" style={{ background: "#F1F1F1", color: INK }} data-testid={`match-declined-${m.id}`}>
              {opp.name} could not make that time{m.last_decline.message ? `: "${m.last_decline.message}"` : "."} Please propose another.
            </p>
          )}
          {!open && (
            <button onClick={() => setOpen(true)} className="px-5 py-2.5 text-sm font-bold uppercase tracking-wider" style={{ background: AMBER, color: INK }} data-testid={`schedule-match-${m.id}`}>
              Schedule match
            </button>
          )}
        </div>
      )}
      {m.state === "not_scheduled" && !isHome && (
        <p className="mt-4 text-sm p-3" style={{ background: "#F1F1F1", color: INK }}>
          {opp.name} is Home and will propose a date, time and court. You will get an email to confirm.
        </p>
      )}

      {/* Awaiting confirmation */}
      {m.state === "awaiting_confirmation" && isHome && m.proposal && (
        <div className="mt-4 p-3 text-sm" style={{ background: "#F1F1F1", color: INK }}>
          You proposed <strong>{fmtDateTime(m.proposal.date)}</strong> at <strong>{m.proposal.venue}</strong>. Waiting for {opp.name} to confirm.
          <button onClick={() => setOpen(true)} className="ml-3 underline font-semibold" style={{ color: GREEN }}>Change</button>
        </div>
      )}
      {m.state === "awaiting_confirmation" && !isHome && m.proposal && (
        <div className="mt-4 p-4" style={{ border: `1px solid ${GREEN}` }}>
          <p className="text-sm font-bold mb-1" style={{ color: INK }}>{opp.name} proposed:</p>
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
              <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: MUTED }} htmlFor={`msg-${m.id}`}>Message to {opp.name} (optional)</label>
              <textarea id={`msg-${m.id}`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} rows={2} className="w-full px-3 py-2 text-sm" style={inputStyle} placeholder="e.g. I can play weekday evenings after 6pm" data-testid={`decline-message-${m.id}`} />
              <div className="mt-2 flex gap-2">
                <button disabled={busy} onClick={() => call("respond", { action: "decline", message })} className="px-5 py-2.5 text-sm font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: AMBER, color: INK }} data-testid={`send-decline-${m.id}`}>Send</button>
                <button onClick={() => setDeclining(false)} className="px-4 py-2.5 text-sm underline" style={{ color: MUTED }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scheduled: Home may reschedule */}
      {m.state === "scheduled" && isHome && !m.is_playoff && !open && m.schedule_status === "scheduled" && (
        <button onClick={() => setOpen(true)} className="mt-4 text-sm underline font-semibold" style={{ color: GREEN }} data-testid={`reschedule-${m.id}`}>Reschedule</button>
      )}

      {/* Match day or past: report the score */}
      {(m.state === "in_progress" || m.state === "awaiting_result") && (
        <div className="mt-4">
          <Link to={`/matches/${m.id}/score`} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white" style={{ background: GREEN }} data-testid={`report-score-${m.id}`}>
            <CheckCircle className="w-4 h-4" /> Report score
          </Link>
        </div>
      )}

      {m.state === "disputed" && <p className="mt-4 text-sm p-3" style={{ background: "#F1F1F1", color: INK }}>A dispute is open on this match. The league organizer is reviewing it.</p>}
      {m.state === "cancelled" && <p className="mt-4 text-sm p-3" style={{ background: "#F1F1F1", color: INK }}>This match was cancelled or ended as a walkover.</p>}

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

function playoffLine(p) {
  switch (p?.status) {
    case "in_position": return `In a qualifying position (the top ${p.top_n} advance)`;
    case "outside": return `Outside the top ${p.top_n} for now`;
    case "qualified": return "Qualified for the playoffs";
    case "not_qualified": return "Did not qualify for the playoffs";
    default: return "Play a match to get ranked";
  }
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
      const status = e.response?.status;
      setError(status === 401 ? "Please log in to see your matches." : status === 403 ? "You are not registered in this league." : "Could not load your matches.");
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, user, load]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-lg font-bold mb-4" style={{ color: INK }}>{error}</p>
        <Link to={error.startsWith("Please log in") ? "/auth" : "/dashboard"} className="inline-block px-6 py-3 text-sm font-bold uppercase tracking-wider" style={{ background: AMBER, color: INK }}>
          {error.startsWith("Please log in") ? "Log in" : "Back to dashboard"}
        </Link>
      </div>
    );
  }
  if (!data) return <div className="min-h-[50vh] flex items-center justify-center text-sm" style={{ color: MUTED }}>Loading your matches...</div>;

  const { league, matches, summary } = data;
  const grouped = GROUPS.map((g) => ({ ...g, items: matches.filter((m) => groupOf(m) === g.key) })).filter((g) => g.items.length);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" data-testid="league-matches-page">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium mb-5" style={{ color: MUTED }}>
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "#B7791F" }}>My matches</p>
      <h1 className="text-3xl sm:text-4xl font-bold italic" style={{ color: INK }}>{league.name}</h1>
      <p className="mt-2 text-sm" style={{ color: MUTED }}>
        {fmtDate(league.start_date)} – {fmtDate(league.end_date)} ·{" "}
        <Link to={`/leagues/${league.id}/standings`} className="underline" style={{ color: GREEN }}>Standings</Link>
      </p>

      <section aria-label="Your progress" className="mt-6" style={{ background: GREEN, color: "#fff" }} data-testid="match-progress">
        <div className="grid grid-cols-4 text-center">
          {[["Required", summary.total], ["Scheduled", summary.scheduled], ["Completed", summary.completed], ["Remaining", summary.remaining]].map(([label, n]) => (
            <div key={label} className="py-4">
              <div className="text-3xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{n}</div>
              <div className="text-[11px] uppercase tracking-wider opacity-90">{label}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px text-center text-sm" style={{ background: "rgba(255,255,255,0.25)" }}>
          <div className="py-3 px-2" style={{ background: GREEN }} data-testid="summary-record">
            <span className="font-bold">{summary.wins}–{summary.losses}</span> <span className="opacity-90">wins–losses</span>
          </div>
          <div className="py-3 px-2" style={{ background: GREEN }} data-testid="summary-standing">
            {summary.rank ? <><span className="font-bold">{ordinal(summary.rank)}</span> <span className="opacity-90">in the standings · {summary.points} pts</span></> : <span className="opacity-90">Not ranked yet</span>}
          </div>
          <div className="py-3 px-2" style={{ background: GREEN }} data-testid="summary-playoff">{playoffLine(summary.playoff)}</div>
        </div>
      </section>

      <p className="mt-5 text-sm p-4" style={{ background: "#F1F1F1", color: INK }}>
        <strong>Home</strong> proposes the date, time and court. <strong>Away</strong> confirms or suggests another time. Contact your opponent within 48 hours, then report each score after you play.
      </p>

      {matches.length === 0 ? (
        <p className="mt-8 text-center text-sm" style={{ color: MUTED }}>No matches assigned to you in this league yet.</p>
      ) : (
        grouped.map((g) => (
          <section key={g.key} className="mt-8" aria-labelledby={`group-${g.key}`} data-testid={`group-${g.key}`}>
            <h2 id={`group-${g.key}`} className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: INK }}>
              {g.title} <span style={{ color: MUTED }}>({g.items.length})</span>
            </h2>
            <div className="space-y-4">
              {g.items.map((m) => <MatchCard key={m.id} m={m} onChanged={load} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
