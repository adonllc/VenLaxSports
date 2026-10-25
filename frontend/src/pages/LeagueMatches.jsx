import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, CheckCircle } from "lucide-react";
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
// Match times are shown in the league city's time zone so both players read the same clock time
const fmtDateTime = (iso, tz) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "");
const hoursLeft = (iso) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3600000));
const ACTION_TEXT = {
  proposed: "proposed a time", countered: "suggested another time", change_requested: "asked to change the time",
  confirmed: "confirmed", declined: "declined", time_cancelled: "cancelled the time", expired: "proposal expired", organizer_set: "set the time", forfeited: "match awarded to Away (no time proposed)",
};
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

const GREEN_D = "#00765C"; // darker green for small text and filled labels (passes contrast)
const GREEN_TINT = "#E6F3F0";
const AMBER_TINT = "#FDF0D0";
const GREY = "#F1F1F1";
const MONO = "'IBM Plex Mono', monospace";

function Avatar({ person, size = 52, bg, side }) {
  const initials = (person?.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const clip = side === "right" ? "polygon(14% 0, 100% 0, 100% 100%, 0 100%)" : "polygon(0 0, 100% 0, 86% 100%, 0 100%)";
  const style = { width: size, height: size, flexShrink: 0, clipPath: clip };
  return person?.avatar ? (
    <img src={person.avatar} alt="" style={{ ...style, objectFit: "cover" }} data-testid="opponent-avatar" />
  ) : (
    <div aria-hidden="true" className="flex items-center justify-center font-bold text-base" style={{ ...style, background: bg, color: "#fff" }} data-testid="opponent-initials">{initials}</div>
  );
}

function RoleTag({ role }) {
  const home = role === "home";
  return (
    <span className="text-[11px] font-bold uppercase tracking-widest px-2 py-0.5"
          style={home ? { background: GREEN_D, color: "#fff" } : { border: `1.5px solid ${INK}`, color: INK }}>
      {home ? "Home" : "Away"}
    </span>
  );
}

// One side of the scoreboard. "You" is green and left, "Opponent" is grey and mirrored on wide screens.
function PlayerPanel({ person, role, label, you, testId }) {
  const lead = person?.members?.[0] || { name: person?.name };
  const level = person?.skill_level ? String(person.skill_level) : null;
  const mirror = !you;
  return (
    <div className={`p-4 sm:p-[18px] flex gap-3.5 items-start min-w-0 ${mirror ? "sm:flex-row-reverse sm:text-right" : ""}`}
         style={{ background: you ? GREEN_TINT : GREY }} data-testid={testId}>
      <Avatar person={lead} size={52} bg={you ? GREEN_D : MUTED} side={mirror ? "right" : "left"} />
      <div className="min-w-0 flex-1">
        <div className={`flex flex-wrap items-center gap-2 ${mirror ? "sm:justify-end" : ""}`}>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: you ? GREEN_D : MUTED }}>{label}</span>
          {role && <RoleTag role={role} />}
        </div>
        <h3 className="text-xl font-bold leading-tight mt-1 break-words" style={{ color: INK }}>{person?.name || "You"}</h3>
        {person?.email && (
          you
            ? <p className="text-xs mt-0.5 break-all" style={{ color: MUTED }} data-testid={`${testId}-email`}>{person.email}</p>
            : <a href={`mailto:${person.email}`} className="block text-xs mt-0.5 underline break-all" style={{ color: GREEN_D }} data-testid={`${testId}-email`}>{person.email}</a>
        )}
        <div className={`mt-2.5 flex items-baseline gap-2 ${mirror ? "sm:flex-row-reverse" : ""}`}>
          <span className="text-2xl font-semibold leading-none" style={{ fontFamily: MONO, color: INK }}>{person?.rating != null ? person.rating : "—"}</span>
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: MUTED }}>
            {person?.rating != null ? "Rating" : "Rating hidden"}{level ? ` · ${level}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

const STEPS = ["Propose time", "Confirm time", "Play and report"];
// 1-based step the match is on; steps before it are done
const stepOf = (m) => (m.state === "not_scheduled" ? 1 : m.state === "awaiting_confirmation" ? 2 : ["scheduled", "in_progress", "awaiting_result"].includes(m.state) ? 3 : 0);

function Stepper({ step }) {
  return (
    <div className="px-5 sm:px-6 pt-4" data-testid="match-stepper">
      <div className="hidden sm:flex items-center">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={label} className={`flex items-center ${n < 3 ? "flex-1" : ""}`}>
              <div className="w-[22px] h-[22px] flex items-center justify-center text-xs font-bold shrink-0"
                   style={done ? { background: GREEN_D, color: "#fff" } : active ? { background: AMBER, color: INK } : { border: "1.5px solid #B5B5B5", color: "#6B6B6B" }}>
                {done ? <CheckCircle className="w-3 h-3" aria-hidden="true" /> : n}
              </div>
              <span className={`mx-2 text-xs whitespace-nowrap ${active ? "font-bold" : ""}`} style={{ color: active ? INK : MUTED }}>{label}</span>
              {n < 3 && <div className="flex-1 h-0.5" style={{ background: done ? GREEN_D : "#D9D9D9" }} />}
            </div>
          );
        })}
      </div>
      <div className="sm:hidden">
        <div className="flex gap-1">
          {STEPS.map((l, i) => <div key={l} className="flex-1 h-1" style={{ background: i + 1 < step ? GREEN_D : i + 1 === step ? AMBER : "#D9D9D9" }} />)}
        </div>
        <p className="text-xs mt-1.5" style={{ color: MUTED }}><strong style={{ color: INK }}>Step {step} of 3</strong> · {STEPS[step - 1]}</p>
      </div>
    </div>
  );
}

// "YOUR MOVE", "WAITING", "CONFIRMED": the one thing this match needs from you right now
function NextBar({ tone, label, children, testId }) {
  const bg = tone === "move" ? AMBER_TINT : tone === "ok" ? GREEN_TINT : tone === "win" ? GREEN_D : GREY;
  const color = tone === "win" ? "#fff" : INK;
  return (
    <div className="mx-5 sm:mx-6 mt-4 p-4" style={{ background: bg, color }} data-testid={testId}>
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: tone === "ok" ? GREEN_D : color }}>{label}</p>
      {children}
    </div>
  );
}

function DetailRow({ label, value, testId }) {
  return (
    <div className="flex sm:block justify-between gap-3" data-testid={testId}>
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>{label}</p>
      <p className="text-sm sm:text-[15px] font-medium sm:mt-0.5 text-right sm:text-left" style={{ color: INK }}>{value}</p>
    </div>
  );
}

function MatchCard({ m, tz, tzAbbr, onChanged, leagueOpen = true, closedReason = "" }) {
  const [form, setForm] = useState(null);   // null | "propose" | "decline"
  const [when, setWhen] = useState("");
  const [venue, setVenue] = useState(m.venue || "");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chip = chipFor(m);
  const isHome = m.role === "home";
  const opp = m.opponent;
  const scored = m.state === "completed" ? buildScoreSummary(m.sport, m.score_data || {}, m.player1_name, m.player2_name) : null;
  const booked = m.schedule_status === "scheduled";
  const confirmedTime = ["scheduled", "in_progress", "awaiting_result", "completed"].includes(m.state);
  const prop = m.proposal;
  const schedulable = m.status === "scheduled" && !m.is_playoff && m.schedule_status; // a generated match
  const open = schedulable && leagueOpen; // nobody can propose or confirm a time until the league has officially opened

  const call = async (path, body) => {
    setBusy(true);
    setError("");
    try {
      await axios.post(`${API}/matches/${m.id}/${path}`, body, { withCredentials: true });
      setForm(null);
      await onChanged();
    } catch (e) {
      const d = e.response?.data?.detail;
      setError(typeof d === "string" ? d : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitProposal = (e) => {
    e.preventDefault();
    if (!when) return setError("Pick a date and time.");
    call("propose", { date: when, venue, note }); // wall-clock time: the server reads it in the league time zone
  };
  const cancelTime = () => {
    if (window.confirm("Cancel this confirmed time? The match goes back to Not Scheduled and your opponent is told. It is not a forfeit.")) call("cancel-time", {});
  };

  const inputStyle = { border: "1px solid #B5B5B5", color: INK, background: "#fff", fontFamily: "Rubik, sans-serif" };
  const me = m.me || {};
  const buttonBase = "px-5 py-2.5 text-sm font-bold uppercase tracking-wider disabled:opacity-50";
  const proposeLabel = !open ? "" : booked ? "Reschedule" : prop && !prop.by_me ? "Suggest another time" : "Schedule match";

  const step = open || m.state === "completed" ? stepOf(m) : 0;
  const myRole = m.is_playoff ? null : m.role;
  const oppRole = m.is_playoff ? null : isHome ? "away" : "home";
  const bigBtn = "inline-block text-center text-[13px] font-bold uppercase tracking-wider px-5 py-3 disabled:opacity-50";
  const lostOrWon = m.result === "won" ? "YOU WON" : m.result === "lost" ? "YOU LOST" : "RESULT SUBMITTED";

  return (
    <article className="bg-white pb-5" style={{ border: "1px solid #D9D9D9" }} data-testid={`match-card-${m.id}`}>
      <div className="flex items-center gap-2 px-5 sm:px-6 py-3.5" style={{ borderBottom: "1px solid #E5E5E5" }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }} data-testid={`match-number-${m.id}`}>
          {m.is_playoff ? "Playoff match" : `Match ${m.match_number || m.round}`}
        </span>
        <span className="ml-auto text-xs font-bold pl-3.5 pr-5 py-1.5" style={{ background: chip.bg, color: chip.color, clipPath: "polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }} data-testid={`match-status-${m.id}`}>
          {chip.label}
        </span>
      </div>

      {step > 0 && <Stepper step={step} />}

      <div className="px-5 sm:px-6 pt-4" data-testid={`match-title-${m.id}`}>
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)] items-stretch">
          <PlayerPanel person={me} role={myRole} label="You" you testId={`match-me-${m.id}`} />
          <div className="flex items-center gap-3 sm:justify-center py-2 sm:py-0" aria-hidden="true">
            <div className="h-px flex-1 sm:hidden" style={{ background: "#D9D9D9" }} />
            <div className="w-10 h-10 flex items-center justify-center text-[13px] font-bold tracking-wide" style={{ background: AMBER, color: INK }}>VS</div>
            <div className="h-px flex-1 sm:hidden" style={{ background: "#D9D9D9" }} />
          </div>
          <PlayerPanel person={opp} role={oppRole} label="Opponent" testId={`match-opponent-${m.id}`} />
        </div>
      </div>

      {m.needs_help && open && !booked && (
        <p className="mx-5 sm:mx-6 mt-4 text-sm p-3" style={{ background: AMBER, color: INK }} data-testid={`needs-help-${m.id}`}>
          This match is due soon and has no confirmed time. The league organizer has been alerted and can help.
        </p>
      )}

      {/* ---- the next step, in one bar ---- */}
      {m.state === "not_scheduled" && isHome && open && (
        <NextBar tone="move" label="Your move · You are Home" testId={`next-${m.id}`}>
          <p className="text-sm mt-1">Propose a date, time and court before <strong>{fmtDate(m.deadline)}</strong>. {opp.name} will confirm or suggest another time.</p>
          {m.last_decline && (
            <p className="text-sm mt-2" data-testid={`match-declined-${m.id}`}>
              {m.last_decline.message ? `Last proposal was declined: "${m.last_decline.message}".` : "The last proposal was declined or expired."} Please propose another time.
            </p>
          )}
          {form !== "propose" && (
            <button onClick={() => setForm("propose")} className={`${bigBtn} mt-3 w-full sm:w-auto`} style={{ background: AMBER, color: INK }} data-testid={`schedule-match-${m.id}`}>Schedule match</button>
          )}
        </NextBar>
      )}
      {m.state === "not_scheduled" && schedulable && !leagueOpen && (
        <NextBar tone="wait" label="Not open yet" testId={`league-not-open-${m.id}`}>
          <p className="text-sm mt-1">{closedReason || "This league is not open to play yet."}</p>
        </NextBar>
      )}
      {m.state === "not_scheduled" && !isHome && leagueOpen && (
        <NextBar tone="wait" label="Waiting · Home goes first" testId={`next-${m.id}`}>
          <p className="text-sm mt-1">{opp.name} is Home and proposes the date, time and court before <strong>{fmtDate(m.deadline)}</strong>. You will get an email to confirm.</p>
          {m.last_decline && (
            <p className="text-sm mt-2" data-testid={`match-declined-${m.id}`}>
              {m.last_decline.message ? `Last proposal was declined: "${m.last_decline.message}".` : "The last proposal was declined or expired."}
            </p>
          )}
        </NextBar>
      )}

      {/* A proposal is waiting. It is never shown as a booking. */}
      {prop && (
        <NextBar tone={prop.can_respond ? "move" : "wait"}
                 label={prop.can_respond ? `Your move · ${prop.kind === "reschedule" ? `${opp.name} asked to change the time` : prop.kind === "counter" ? `${opp.name} suggested another time` : "Home proposed a time"}` : "Waiting · You proposed"}
                 testId={`proposal-${m.id}`}>
          <p className="text-lg font-bold mt-1">{fmtDateTime(prop.date, tz)}</p>
          <p className="text-sm">{prop.venue}</p>
          {prop.note && <p className="text-sm mt-1" style={{ color: MUTED }}>"{prop.note}"</p>}
          <p className="text-xs mt-1" style={{ color: MUTED }}>
            {prop.by_me ? `Waiting for ${opp.name} to answer.` : "Reply needed."} Expires in {hoursLeft(prop.expires_at)}h.
            {booked ? " Your current booking stays until this is accepted." : ""}
          </p>
          {prop.can_respond && form !== "decline" && (
            <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap gap-2">
              <button disabled={busy} onClick={() => call("respond", { action: "confirm" })} className={bigBtn} style={{ background: GREEN_D, color: "#fff" }} data-testid={`confirm-match-${m.id}`}>Confirm</button>
              <button disabled={busy} onClick={() => { setForm("propose"); setVenue(prop.venue); }} className={bigBtn} style={{ background: AMBER, color: INK }} data-testid={`suggest-time-${m.id}`}>Suggest another time</button>
              <button disabled={busy} onClick={() => setForm("decline")} className={bigBtn} style={{ border: `1.5px solid ${INK}`, color: INK, padding: "10.5px 18px" }} data-testid={`decline-${m.id}`}>Decline</button>
            </div>
          )}
          {prop.can_respond && form === "decline" && (
            <div className="mt-3">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: MUTED }} htmlFor={`msg-${m.id}`}>Message to {opp.name} (optional)</label>
              <textarea id={`msg-${m.id}`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} rows={2} className="w-full px-3 py-2 text-sm bg-white" style={inputStyle} placeholder="e.g. I can play weekday evenings after 6pm" data-testid={`decline-message-${m.id}`} />
              <div className="mt-2 flex gap-2">
                <button disabled={busy} onClick={() => call("respond", { action: "decline", message })} className={bigBtn} style={{ background: AMBER, color: INK }} data-testid={`send-decline-${m.id}`}>Send</button>
                <button onClick={() => setForm(null)} className="px-4 py-2.5 text-sm underline" style={{ color: MUTED }}>Cancel</button>
              </div>
            </div>
          )}
          {prop.by_me && form !== "propose" && (
            <button onClick={() => setForm("propose")} className="mt-2 text-sm underline font-semibold" style={{ color: GREEN_D }} data-testid={`change-proposal-${m.id}`}>Change my proposal</button>
          )}
        </NextBar>
      )}

      {/* Confirmed */}
      {booked && !prop && m.state === "scheduled" && (
        <NextBar tone="ok" label={`Confirmed · ${fmtDateTime(m.scheduled_date, tz).split(",").slice(0, 2).join(",")}`} testId={`next-${m.id}`}>
          <p className="text-xl font-bold mt-0.5">{new Date(m.scheduled_date).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</p>
          {m.venue && <p className="text-sm">{m.venue}</p>}
        </NextBar>
      )}

      {/* Match day or past: report the score */}
      {(m.state === "in_progress" || m.state === "awaiting_result") && (
        <NextBar tone="move" label={m.state === "in_progress" ? "Match day" : "Awaiting result · Report the score"} testId={`next-${m.id}`}>
          <p className="text-lg font-bold mt-1">{fmtDateTime(m.scheduled_date, tz)}</p>
          {m.venue && <p className="text-sm">{m.venue}</p>}
          <Link to={`/matches/${m.id}/score`} className={`${bigBtn} mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2`} style={{ background: AMBER, color: INK }} data-testid={`report-score-${m.id}`}>
            <CheckCircle className="w-4 h-4" /> Report score
          </Link>
        </NextBar>
      )}

      {m.state === "completed" && (
        <NextBar tone={m.result === "won" ? "win" : "wait"} label={`Result · ${lostOrWon}`} testId={`match-result-${m.id}`}>
          {m.forfeit ? (
            <p className="text-sm mt-1">{m.result === "won" ? "Awarded to you: no time was proposed by the play-by date." : "Awarded to your opponent: no time was proposed by the play-by date."}</p>
          ) : scored?.scoreStr ? (
            <p className="text-xl font-semibold mt-1" style={{ fontFamily: MONO }}>{scored.scoreStr}</p>
          ) : null}
        </NextBar>
      )}

      {m.state === "disputed" && <p className="mx-5 sm:mx-6 mt-4 text-sm p-3" style={{ background: GREY, color: INK }}>A dispute is open on this match. The league organizer is reviewing it.</p>}
      {m.state === "cancelled" && <p className="mx-5 sm:mx-6 mt-4 text-sm p-3" style={{ background: GREY, color: INK }}>This match was cancelled or ended as a walkover.</p>}

      {/* Change or cancel a confirmed time (either player, until 24 hours before) */}
      {open && booked && !prop && (
        <div className="mx-5 sm:mx-6 mt-3 flex flex-wrap items-center gap-4">
          {m.can_change ? (
            <>
              <span className="text-xs" style={{ color: MUTED }}>Need to change it? You can until 24 hours before.</span>
              <button onClick={() => setForm("propose")} className="text-sm underline font-bold" style={{ color: GREEN_D }} data-testid={`reschedule-${m.id}`}>Reschedule</button>
              <button onClick={cancelTime} disabled={busy} className="text-sm underline font-bold disabled:opacity-50" style={{ color: INK }} data-testid={`cancel-time-${m.id}`}>Cancel time</button>
            </>
          ) : (
            <p className="text-xs" style={{ color: MUTED }}>Within 24 hours of the match only the organizer can change the time. Email feedback@venlaxsports.com.</p>
          )}
        </div>
      )}

      {/* date, venue, deadline: always the same three labels */}
      {m.state !== "completed" && !m.is_playoff && (
        <div className="mx-5 sm:mx-6 mt-4 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4" style={{ borderTop: "1px solid #E5E5E5" }}>
          <DetailRow label="Match date" value={confirmedTime ? fmtDateTime(m.scheduled_date, tz) : prop ? "Not confirmed yet" : "Not scheduled"} testId={`match-when-${m.id}`} />
          <DetailRow label="Venue / Court" value={m.venue && confirmedTime ? m.venue : "To be confirmed"} />
          <DetailRow label="Play by" value={m.deadline ? fmtDate(m.deadline) : "—"} />
        </div>
      )}
      {(m.state === "completed" || m.is_playoff) && (
        <div className="mx-5 sm:mx-6 mt-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4" style={{ borderTop: "1px solid #E5E5E5" }}>
          <DetailRow label="Match date" value={confirmedTime ? fmtDateTime(m.scheduled_date, tz) : "Not scheduled"} testId={`match-when-${m.id}`} />
          <DetailRow label="Venue / Court" value={m.venue && confirmedTime ? m.venue : "To be confirmed"} />
        </div>
      )}

      {/* Proposal form: first proposal, counter-proposal or change request */}
      {form === "propose" && (
        <form onSubmit={submitProposal} className="mx-5 sm:mx-6 mt-4 p-4 space-y-3" style={{ border: "1px solid #E5E7EB" }} data-testid={`propose-form-${m.id}`}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: INK }}>{proposeLabel || "Propose a time"}</p>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: MUTED }} htmlFor={`when-${m.id}`}>Date and time ({tzAbbr})</label>
            <input id={`when-${m.id}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required className="w-full px-3 py-2 text-sm" style={inputStyle} data-testid={`propose-when-${m.id}`} />
            <p className="text-xs mt-1" style={{ color: MUTED }}>Times are in {tzAbbr} (the league's time zone) for both players.</p>
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
            <button type="submit" disabled={busy} className={buttonBase} style={{ background: AMBER, color: INK }} data-testid={`send-proposal-${m.id}`}>
              {busy ? "Sending..." : "Send to opponent"}
            </button>
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2.5 text-sm underline" style={{ color: MUTED }}>Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="mx-5 sm:mx-6 mt-3 text-sm" style={{ color: "#B42318" }} role="alert" data-testid={`match-error-${m.id}`}>{error}</p>}

      {m.history?.length > 0 && (
        <div className="mx-5 sm:mx-6 mt-4 pt-3" style={{ borderTop: "1px solid #F1F1F1" }}>
          <button onClick={() => setShowHistory((v) => !v)} className="text-xs underline" style={{ color: MUTED }} aria-expanded={showHistory} data-testid={`history-toggle-${m.id}`}>
            {showHistory ? "Hide" : "Show"} scheduling history ({m.history.length})
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1 text-xs" style={{ color: MUTED }} data-testid={`history-${m.id}`}>
              {m.history.map((h, i) => (
                <li key={i}>
                  {fmtDateTime(h.at, tz)} · {h.by_name || "System"} {ACTION_TEXT[h.action] || h.action}
                  {h.date ? ` (${fmtDateTime(h.date, tz)}${h.venue ? `, ${h.venue}` : ""})` : ""}
                  {h.message ? ` — "${h.message}"` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

function playoffLine(p) {
  switch (p?.status) {
    case "in_position": return `In a qualifying position (the top ${p.top_n} advance)`;
    case "outside": return `Outside the top ${p.top_n} for now`;
    case "needs_more_matches": return "Play more matches to be eligible";
    case "qualified": return "Qualified for the playoffs";
    case "not_qualified": return "Did not qualify for the playoffs";
    default: return "Play a match to get ranked";
  }
}

const STATUS_STYLE = {
  in_position: { title: "In a qualifying position", bg: GREEN_TINT, color: GREEN_D },
  outside: { title: "Outside the cut-off for now", bg: AMBER_TINT, color: INK },
  needs_more_matches: { title: "Not eligible yet", bg: AMBER_TINT, color: INK },
  qualified: { title: "Qualified for the playoffs", bg: GREEN_D, color: "#fff" },
  not_qualified: { title: "Did not qualify for the playoffs", bg: GREY, color: INK },
  unranked: { title: "Not ranked yet", bg: GREY, color: INK },
};

function Stat({ label, value, sub, testId }) {
  return (
    <div className="p-3" style={{ background: GREY }} data-testid={testId}>
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>{label}</p>
      <p className="text-2xl font-semibold leading-tight mt-1" style={{ fontFamily: MONO, color: INK }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: MUTED }}>{sub}</p>}
    </div>
  );
}

function gapLine(po) {
  if (!po.gap) return null;
  const amt = po.gap.amount;
  return po.gap.direction === "ahead"
    ? `${amt} ${po.gap.unit} ahead of the cut-off.`
    : `${amt} ${po.gap.unit} behind the cut-off.`;
}

function nextText(po, summary) {
  if (po.status === "needs_more_matches") {
    const bits = [];
    if (po.min_matches) bits.push(`at least ${po.min_matches} matches played`);
    if (po.min_win_pct) bits.push(`a win percentage of at least ${po.min_win_pct}%`);
    return `To be eligible you need ${bits.join(" and ")}.`;
  }
  if (po.status === "qualified" || po.status === "not_qualified") return null;
  if (summary.season_complete) return "Your league matches are done. Playoff places are confirmed when the organizer creates the bracket.";
  return null;
}

function BracketView({ bracket }) {
  return (
    <div className="mt-4 overflow-x-auto" data-testid="playoff-bracket">
      <div className="flex gap-4 min-w-max">
        {bracket.rounds.map((r) => (
          <div key={r.round} className="w-52">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: MUTED }}>{r.label}</p>
            <div className="space-y-2">
              {r.matches.map((m) => (
                <div key={m.id} className="p-2.5 text-sm" style={{ border: `1px solid ${m.mine ? GREEN_D : "#D9D9D9"}`, background: m.mine ? GREEN_TINT : "#fff" }}>
                  {[[m.player1_name, "p1"], [m.player2_name, "p2"]].map(([nm]) => (
                    <p key={nm} className={m.winner_name === nm ? "font-bold" : ""} style={{ color: m.winner_id && m.winner_name !== nm ? MUTED : INK }}>{nm}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayoffPanel({ summary }) {
  const po = summary.playoff || {};
  const st = STATUS_STYLE[po.status] || STATUS_STYLE.unranked;
  const pct = summary.total ? Math.round((100 * summary.completed) / summary.total) : 0;
  const nt = nextText(po, summary);
  const bracket = po.bracket;
  return (
    <section aria-label="Playoff progress" className="mt-5 bg-white" style={{ border: "1px solid #D9D9D9" }} data-testid="playoff-panel">
      <div className="px-5 sm:px-6 pt-5">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>Playoff progress</p>
        <div className="flex items-end justify-between gap-4 mt-2">
          <p className="text-lg font-bold" style={{ color: INK }}>Matches completed <span style={{ fontFamily: MONO }}>{summary.completed} / {summary.total}</span></p>
          <p className="text-xs" style={{ color: MUTED }}>{summary.remaining} remaining</p>
        </div>
        <div className="mt-2 h-2" style={{ background: "#E5E5E5" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Matches completed">
          <div className="h-2" style={{ width: `${pct}%`, background: GREEN_D }} />
        </div>
      </div>

      <div className="px-5 sm:px-6 mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Wins" value={summary.wins} testId="stat-wins" />
        <Stat label="Losses" value={summary.losses} testId="stat-losses" />
        <Stat label="Points" value={summary.points} sub={summary.win_pct != null ? `${summary.win_pct}% wins` : null} testId="stat-points" />
        <Stat label="Rank" value={summary.rank ? ordinal(summary.rank) : "—"} testId="stat-rank" />
        <Stat label="Pending results" value={summary.pending_results} sub={summary.pending_results ? "Played, score not in" : null} testId="stat-pending" />
        <Stat label="Score disputes" value={summary.disputes} sub={summary.disputes ? "Organizer reviewing" : null} testId="stat-disputes" />
      </div>

      <div className="mx-5 sm:mx-6 mt-4 p-4" style={{ background: st.bg, color: st.color }} data-testid="qualification-status">
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: st.color }}>Playoff qualification</p>
        <p className="text-lg font-bold mt-1">{st.title}</p>
        {gapLine(po) && <p className="text-sm mt-0.5">{gapLine(po)}</p>}
        {nt && <p className="text-sm mt-1">{nt}</p>}
        <p className="text-sm mt-2">{po.rule_text}</p>
      </div>

      {bracket && (
        <div className="mx-5 sm:mx-6 mt-4" data-testid="playoff-next">
          {bracket.champion && <p className="p-4 text-lg font-bold" style={{ background: GREEN_D, color: "#fff" }}>You won the playoffs. Congratulations!</p>}
          {bracket.eliminated && <p className="p-4 text-sm" style={{ background: GREY, color: INK }}>You were knocked out of the playoffs. Thanks for playing this season.</p>}
          {bracket.next_match && (
            <div className="p-4" style={{ background: AMBER_TINT, color: INK }}>
              <p className="text-[11px] font-bold uppercase tracking-widest">Your next playoff match · {bracket.next_match.round_label}</p>
              <p className="text-lg font-bold mt-1">vs {bracket.next_match.opponent_name}</p>
              {bracket.next_match.scheduled_date && <p className="text-sm">Play by {fmtDate(bracket.next_match.scheduled_date)}{bracket.next_match.venue ? ` · ${bracket.next_match.venue}` : ""}</p>}
            </div>
          )}
          <BracketView bracket={bracket} />
        </div>
      )}

      <p className="px-5 sm:px-6 py-4 text-xs" style={{ color: MUTED }}>
        Playoff places depend on this league's rules and the final standings. Completing your matches does not qualify you by itself.
      </p>
    </section>
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

      {league.open_to_play === false && (
        <p className="mt-5 p-4 text-sm font-medium" style={{ background: AMBER_TINT, color: INK }} role="status" data-testid="league-not-open-banner">
          {league.not_open_reason || "This league is not open to play yet."} Your opponents are shown below. Times can be proposed once the league opens.
        </p>
      )}

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

      <PlayoffPanel summary={summary} />

      <p className="mt-5 text-sm p-4" style={{ background: "#F1F1F1", color: INK }}>
        <strong>Home</strong> proposes the date, time and court before the play-by date. <strong>Away</strong> confirms or suggests another time. If no time has been proposed by the play-by date, the match may be awarded to Away. Report each score after you play.
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
              {g.items.map((m) => <MatchCard key={m.id} m={m} tz={league.tz} tzAbbr={league.tz_abbr} onChanged={load} leagueOpen={league.open_to_play !== false} closedReason={league.not_open_reason} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
