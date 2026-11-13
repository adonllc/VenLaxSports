import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { STATUS, apiError, fmtWhen, scoreText, sideNames, sportLabel } from "../utils/challengeUi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const box = { border: "1px solid #E5E7EB" };
const muted = { color: "#6B7280" };
const field = "px-3 py-2 text-sm bg-white w-full";
const primary = { background: "#008F70", color: "#fff" };
const amber = { background: "#F2A922", color: "#1D1D1D" };
const btn = "px-4 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50";

function Card({ title, children, testid }) {
  return (
    <section className="bg-white p-5 mt-5" style={box} data-testid={testid}>
      {title && <h2 className="font-heading font-bold text-base mb-3" style={{ color: "#1D1D1D" }}>{title}</h2>}
      {children}
    </section>
  );
}

function PartnerPicker({ sport, exclude, value, onChange }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return undefined; }
    const t = setTimeout(() => {
      axios.get(`${API}/challenges/players`, { params: { q: q.trim(), sport, limit: 6 }, withCredentials: true })
        .then((r) => setHits(r.data.filter((p) => !exclude.includes(p.id)))).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, sport, exclude.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (value) {
    return (
      <div className="flex items-center justify-between px-3 py-2" style={box}>
        <span className="text-sm">{value.name}</span>
        <button onClick={() => onChange(null)} className="text-xs font-semibold" style={{ color: "#008F70" }} data-testid="accept-partner-clear">Change</button>
      </div>
    );
  }
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your partner by name" className={field} style={box} aria-label="Search your partner" data-testid="accept-partner-search" />
      {hits.length > 0 && (
        <ul className="mt-1" style={box}>
          {hits.map((h) => <li key={h.id}><button onClick={() => { onChange(h); setHits([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" data-testid={`accept-partner-${h.id}`}>{h.name} <span className="text-xs" style={muted}>{h.city}</span></button></li>)}
        </ul>
      )}
    </div>
  );
}

function ProposeForm({ onPropose, busy }) {
  const [when, setWhen] = useState("");
  const [venue, setVenue] = useState("");
  const [note, setNote] = useState("");
  const submit = () => onPropose({ when: new Date(when).toISOString(), venue, note: note || undefined }).then((ok) => { if (ok) { setWhen(""); setVenue(""); setNote(""); } });
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="propose-form">
      <div>
        <label className="text-xs font-semibold" htmlFor="propose-when">Date and time</label>
        <input id="propose-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${field} mt-1`} style={box} data-testid="propose-when" />
      </div>
      <div>
        <label className="text-xs font-semibold" htmlFor="propose-venue">Court or venue</label>
        <input id="propose-venue" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={200} placeholder="Piedmont Park, court 4" className={`${field} mt-1`} style={box} data-testid="propose-venue" />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-semibold" htmlFor="propose-note">Note (optional)</label>
        <input id="propose-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={`${field} mt-1`} style={box} data-testid="propose-note" />
      </div>
      <div className="sm:col-span-2">
        <button onClick={submit} disabled={busy || !when || !venue.trim()} className={btn} style={primary} data-testid="propose-submit">Propose this time</button>
      </div>
    </div>
  );
}

function ScoreForm({ c, onSubmit, busy }) {
  const [sets, setSets] = useState([{ a: "", b: "" }, { a: "", b: "" }]);
  const [first, second] = c.sides.map(sideNames);
  const mineFirst = c.my_side !== 2;                 // show my side's score first, store from the challenger's view
  const setVal = (i, key, v) => setSets((s) => s.map((row, j) => (j === i ? { ...row, [key]: v.replace(/\D/g, "").slice(0, 2) } : row)));
  const ready = sets.some((s) => s.a !== "" && s.b !== "");
  const send = () => {
    const filled = sets.filter((s) => s.a !== "" && s.b !== "");
    onSubmit(filled.map((s) => ({ a: Number(mineFirst ? s.a : s.b), b: Number(mineFirst ? s.b : s.a) })));
  };
  return (
    <div data-testid="score-form">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 items-center text-sm">
        <span className="text-xs font-semibold" style={muted}>Set</span>
        <span className="text-xs font-semibold w-16 text-center truncate" style={muted}>{mineFirst ? "You" : sideNames(c.sides[1])}</span>
        <span className="text-xs font-semibold w-16 text-center truncate" style={muted}>{mineFirst ? "Them" : sideNames(c.sides[0])}</span>
        {sets.map((s, i) => (
          <div key={i} className="contents">
            <span>Set {i + 1}</span>
            <input inputMode="numeric" aria-label={`Set ${i + 1} your games`} value={s.a} onChange={(e) => setVal(i, "a", e.target.value)} className="w-16 px-2 py-2 text-center font-mono" style={box} data-testid={`score-${i}-a`} />
            <input inputMode="numeric" aria-label={`Set ${i + 1} their games`} value={s.b} onChange={(e) => setVal(i, "b", e.target.value)} className="w-16 px-2 py-2 text-center font-mono" style={box} data-testid={`score-${i}-b`} />
          </div>
        ))}
      </div>
      <p className="text-xs mt-2" style={muted}>{first} vs {second}. Enter games won in each set. Pickleball: one row per game.</p>
      <div className="flex gap-3 mt-3">
        {sets.length < 5 && <button onClick={() => setSets((s) => [...s, { a: "", b: "" }])} className={btn} style={box} data-testid="score-add-set">Add set</button>}
        <button onClick={send} disabled={busy || !ready} className={btn} style={primary} data-testid="score-submit">Submit score</button>
      </div>
    </div>
  );
}

export default function ChallengeDetail() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [c, setC] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [partner, setPartner] = useState(null);
  const [reason, setReason] = useState("");
  const [disputing, setDisputing] = useState(false);
  useDocumentMeta({ title: "Challenge | VENLAX Sports", description: "Your VENLAX challenge match.", noindex: true });

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/challenges/${id}`, { withCredentials: true });
      setC(data);
    } catch (e) {
      setError(apiError(e, "Could not load this challenge."));
    }
  }, [id]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    load();
  }, [user, loading, navigate, load]);

  const act = async (path, body = {}) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/challenges/${id}/${path}`, body, { withCredentials: true });
      setC(data);
      return true;
    } catch (e) {
      setError(apiError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!c) {
    return <div className="min-h-[60vh] flex items-center justify-center px-4"><p className="text-sm" style={error ? { color: "#B42318" } : muted} role={error ? "alert" : undefined}>{error || "Loading..."}</p></div>;
  }

  const s = STATUS[c.phase] || STATUS.sent;
  const names = c.sides.map(sideNames);
  const me = c.my_side;
  const winnerNames = c.result ? names[c.result.winner_side - 1] : "";
  const pending = c.pending_proposal;
  const inChallenge = c.sides.flat().map((p) => p.id);

  return (
    <div className="min-h-screen" style={{ background: "#F9FAFB" }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/challenges" className="text-xs font-semibold" style={{ color: "#008F70" }} data-testid="challenge-back">All challenges</Link>
        <div className="flex items-start justify-between gap-3 flex-wrap mt-2">
          <h1 className="font-heading font-bold text-2xl sm:text-3xl" style={{ color: "#1D1D1D" }}>{names[0]} <span style={muted}>vs</span> {names[1]}</h1>
          <span className="px-2.5 py-1 text-xs font-semibold" style={{ background: s.bg, color: s.fg }} data-testid="challenge-status">{s.label}</span>
        </div>
        {c.ladder_id ? (
          <p className="text-sm mt-1" style={muted} data-testid="challenge-ladder-note">{sportLabel(c)}. A ladder match in <Link to={`/community-ladders/${c.ladder_id}`} className="font-semibold underline" style={{ color: "#008F70" }}>{c.ladder_name}</Link>: once both sides confirm the score, the standings update automatically.</p>
        ) : (
          <p className="text-sm mt-1" style={muted}>{sportLabel(c)}. A friendly match: it never changes a ladder rank.</p>
        )}
        {c.message && <p className="text-sm mt-3 px-4 py-3 bg-white" style={box}>"{c.message}"</p>}
        {error && <p className="text-sm mt-4" style={{ color: "#B42318" }} role="alert" data-testid="challenge-detail-error">{error}</p>}

        {c.status === "sent" && (
          <Card title={c.can.accept ? "Your answer" : "Waiting for an answer"} testid="answer-card">
            <p className="text-sm" style={muted}>Expires {fmtWhen(c.expires_at)}.</p>
            {c.can.accept && c.format === "doubles" && (
              <div className="mt-3"><p className="text-xs font-semibold mb-1">Your partner</p><PartnerPicker sport={c.sport} exclude={inChallenge} value={partner} onChange={setPartner} /></div>
            )}
            <div className="flex gap-3 mt-4">
              {c.can.accept && <button onClick={() => act("accept", { partner_id: partner?.id })} disabled={busy || (c.format === "doubles" && !partner)} className={btn} style={primary} data-testid="challenge-accept">Accept</button>}
              {c.can.decline && <button onClick={() => act("decline")} disabled={busy} className={btn} style={box} data-testid="challenge-decline">Decline</button>}
              {c.can.cancel && <button onClick={() => act("cancel")} disabled={busy} className={btn} style={box} data-testid="challenge-withdraw">Withdraw challenge</button>}
            </div>
          </Card>
        )}

        {(c.status === "scheduling" || c.status === "scheduled") && (
          <Card title="When and where" testid="schedule-card">
            {c.scheduled_at ? (
              <p className="text-sm" data-testid="scheduled-when"><strong className="font-mono">{fmtWhen(c.scheduled_at)}</strong> at {c.venue}</p>
            ) : (
              <p className="text-sm" style={muted}>Nothing booked yet. Propose a time; the other side accepts or suggests another.</p>
            )}
            {pending && (
              <div className="mt-4 p-4" style={{ background: "#FFF6E0", border: "1px solid #F2A922" }} data-testid="pending-proposal">
                <p className="text-sm font-semibold">{pending.side === me ? "You proposed" : `${c.sides.flat().find((p) => p.id === pending.by)?.name || "They"} proposed`}: <span className="font-mono">{fmtWhen(pending.when)}</span> at {pending.venue}</p>
                {pending.note && <p className="text-xs mt-1" style={muted}>{pending.note}</p>}
                {c.can.respond ? (
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => act(`proposals/${pending.id}/respond`, { action: "accept" })} disabled={busy} className={btn} style={primary} data-testid="proposal-accept">Accept this time</button>
                    <button onClick={() => act(`proposals/${pending.id}/respond`, { action: "decline" })} disabled={busy} className={btn} style={box} data-testid="proposal-decline">Can't make it</button>
                  </div>
                ) : <p className="text-xs mt-2" style={muted}>Waiting for the other side.</p>}
              </div>
            )}
            {c.can.propose && (
              <div className="mt-4">
                <p className="text-xs font-semibold mb-2">{pending ? "Or suggest another time" : c.scheduled_at ? "Ask to change the time" : "Propose a time"}</p>
                <ProposeForm busy={busy} onPropose={(b) => act("propose", b)} />
              </div>
            )}
            {c.can.cancel && <button onClick={() => window.confirm("Cancel this challenge?") && act("cancel")} disabled={busy} className="mt-4 text-xs font-semibold underline" style={{ color: "#B42318" }} data-testid="challenge-cancel-match">Cancel this match</button>}
          </Card>
        )}

        {(c.can.submit_score || c.status === "result_submitted" || c.status === "disputed" || c.status === "confirmed") && (
          <Card title="Result" testid="result-card">
            {c.result && (
              <p className="text-sm" data-testid="result-line">
                <span className="font-mono font-bold">{scoreText(c.result, me)}</span>
                {" "}({c.result.winner_side === me ? "you won" : me ? "you lost" : `${winnerNames} won`}){c.status === "confirmed" ? "" : ", not yet confirmed"}
              </p>
            )}
            {c.status === "disputed" && c.dispute && <p className="text-sm mt-2" style={{ color: "#B42318" }} data-testid="dispute-note">Disputed: {c.dispute.reason}. An admin will review it.</p>}
            {c.can.confirm && (
              <div className="mt-3">
                <div className="flex gap-3">
                  <button onClick={() => act("confirm")} disabled={busy} className={btn} style={primary} data-testid="score-confirm">Confirm this score</button>
                  <button onClick={() => setDisputing(!disputing)} className={btn} style={box} data-testid="score-dispute-toggle">It is wrong</button>
                </div>
                {disputing && (
                  <div className="mt-3">
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={3} placeholder="What is wrong with the score?" className={field} style={box} aria-label="Dispute reason" data-testid="dispute-reason" />
                    <button onClick={() => act("dispute", { reason })} disabled={busy || reason.trim().length < 5} className={`${btn} mt-2`} style={amber} data-testid="dispute-submit">Send dispute</button>
                  </div>
                )}
              </div>
            )}
            {c.status === "result_submitted" && !c.can.confirm && <p className="text-xs mt-2" style={muted}>Waiting for the other side to confirm.</p>}
            {c.can.submit_score && (
              <div className="mt-3">
                {c.status === "result_submitted" && <p className="text-xs mb-2" style={muted}>Wrong score? Enter the correct one before it is confirmed.</p>}
                <ScoreForm c={c} busy={busy} onSubmit={(sets) => act("score", { sets })} />
              </div>
            )}
          </Card>
        )}

        <Card title="History" testid="history-card">
          <ul className="space-y-1.5 text-xs" style={muted}>
            {[...c.history].reverse().map((h, i) => (
              <li key={i}><span className="font-mono">{fmtWhen(h.at)}</span> · {h.by} · {h.action.replace(/_/g, " ")}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
