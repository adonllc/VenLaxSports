import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { apiError, fmtWhen, matchup, sideNames, sportLabel } from "../utils/challengeUi";
import { DIVISIONS, INVITE_STATUS, LADDER_STATUS, METHODS, SIZES, entrantWord, methodLabel } from "../utils/ladderUi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const box = { border: "1px solid #E5E7EB" };
const muted = { color: "#6B7280" };
const field = "px-3 py-2 text-sm bg-white w-full";
const btn = "px-4 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50";
const primary = { background: "#008F70", color: "#fff" };
const amber = { background: "#F2A922", color: "#1D1D1D" };

function Card({ title, children, testid, right }) {
  return (
    <section className="bg-white p-5 mt-5" style={box} data-testid={testid}>
      {(title || right) && <div className="flex items-center justify-between gap-3 mb-3"><h2 className="font-heading font-bold text-base" style={{ color: "#1D1D1D" }}>{title}</h2>{right}</div>}
      {children}
    </section>
  );
}

function PlayerPicker({ sport, onPick, label, testid }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return undefined; }
    const t = setTimeout(() => {
      axios.get(`${API}/challenges/players`, { params: { q: q.trim(), sport, limit: 6 }, withCredentials: true })
        .then((r) => setHits(r.data)).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, sport]);
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={label} aria-label={label} className={field} style={box} data-testid={`${testid}-search`} />
      {hits.length > 0 && (
        <ul className="mt-1" style={box}>
          {hits.map((h) => <li key={h.id}><button onClick={() => { onPick(h); setQ(""); setHits([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" data-testid={`${testid}-${h.id}`}>{h.name} <span className="text-xs" style={muted}>{h.city} · level {h.level.toFixed(1)}</span></button></li>)}
        </ul>
      )}
    </div>
  );
}

function Standings({ L, onChallenge }) {
  const metric = L.ranking_method === "points" ? "Points" : L.ranking_method === "elo" ? "Rating" : null;
  if (L.standings.length === 0) return <p className="text-sm" style={muted}>No one has joined yet.</p>;
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm min-w-[480px]" data-testid="standings-table">
        <thead>
          <tr className="text-left text-xs" style={muted}>
            <th className="py-2 pr-3 w-12">Rank</th><th className="py-2 pr-3">{L.format === "doubles" ? "Team" : "Player"}</th>
            <th className="py-2 pr-3 text-right">W-L</th><th className="py-2 pr-3 text-right">Win %</th>
            {metric && <th className="py-2 pr-3 text-right">{metric}</th>}<th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {L.standings.map((s) => (
            <tr key={s.player_id} style={{ borderTop: "1px solid #F3F4F6", background: s.is_me ? "#F4FBF9" : undefined }} data-testid={`standing-${s.player_id}`}>
              <td className="py-2.5 pr-3 font-mono font-bold">{s.rank ? `#${s.rank}` : <span className="text-xs font-normal" style={muted}>Unranked</span>}</td>
              <td className="py-2.5 pr-3 font-semibold" style={{ color: "#1D1D1D" }}>{s.name}{s.is_me && <span className="ml-2 text-[11px] font-bold" style={{ color: "#008F70" }}>YOU</span>}</td>
              <td className="py-2.5 pr-3 text-right font-mono">{s.wins}-{s.losses}</td>
              <td className="py-2.5 pr-3 text-right font-mono">{s.win_pct == null ? "-" : `${s.win_pct}%`}</td>
              {metric && <td className="py-2.5 pr-3 text-right font-mono">{L.ranking_method === "points" ? s.points : s.elo}</td>}
              <td className="py-2.5 text-right">
                {L.eligible_targets.includes(s.player_id) && <button onClick={() => onChallenge(s)} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider" style={amber} data-testid={`ladder-challenge-${s.player_id}`}>Challenge</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs mt-3" style={muted}>Everyone starts unranked and earns a rank with their first verified match. Only results both sides confirm count.</p>
    </div>
  );
}

function ChallengeModal({ L, target, onClose, onSent }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async () => {
    setBusy(true);
    setErr("");
    try {
      const { data } = await axios.post(`${API}/community-ladders/${L.id}/challenges`, { opponent_id: target.player_id, message: message.trim() || undefined }, { withCredentials: true });
      onSent(data);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: "rgba(29,29,29,0.5)" }} role="dialog" aria-modal="true" data-testid="ladder-challenge-modal">
      <div className="bg-white w-full sm:max-w-md p-6">
        <h2 className="font-heading font-bold text-xl" style={{ color: "#1D1D1D" }}>Challenge {target.name}</h2>
        <p className="text-sm mt-1" style={muted}>A ladder match: once you both confirm the score, the standings update automatically.</p>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3} placeholder="Message (optional)" aria-label="Message" className={`${field} mt-4`} style={box} data-testid="ladder-challenge-message" />
        {err && <p className="text-sm mt-3" style={{ color: "#B42318" }} role="alert" data-testid="ladder-challenge-error">{err}</p>}
        <div className="flex gap-3 mt-4">
          <button onClick={send} disabled={busy} className={`${btn} flex-1`} style={primary} data-testid="ladder-challenge-send">{busy ? "Sending..." : "Send challenge"}</button>
          <button onClick={onClose} className={btn} style={box}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function MatchRow({ c }) {
  return (
    <Link to={`/challenges/${c.id}`} className="block py-3" style={{ borderTop: "1px solid #F3F4F6" }} data-testid={`ladder-match-${c.id}`}>
      <p className="text-sm font-semibold" style={{ color: "#1D1D1D" }}>{matchup(c)} {c.needs_my_action && <span className="ml-2 px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: "#008F70" }}>Your move</span>}</p>
      <p className="text-xs mt-0.5" style={muted}>{c.status === "sent" ? "Waiting for an answer" : c.scheduled_at ? `${fmtWhen(c.scheduled_at)} · ${c.venue}` : "Agree a time"}</p>
    </Link>
  );
}

function Matches({ L, history }) {
  return (
    <>
      <Card title="Pending challenges" testid="ladder-pending">
        {L.pending.length === 0 ? <p className="text-sm" style={muted}>None right now.</p> : L.pending.map((c) => <MatchRow key={c.id} c={c} />)}
      </Card>
      <Card title="Upcoming and in play" testid="ladder-upcoming">
        {L.upcoming.length === 0 ? <p className="text-sm" style={muted}>No matches booked.</p> : L.upcoming.map((c) => <MatchRow key={c.id} c={c} />)}
      </Card>
      <Card title="Recent results" testid="ladder-recent">
        {L.recent.length === 0 ? <p className="text-sm" style={muted}>No verified results yet.</p> : L.recent.map((r) => (
          <div key={r.id} className="py-3 text-sm" style={{ borderTop: "1px solid #F3F4F6" }}>
            <strong>{sideNames(r.sides[r.winner_side - 1])}</strong> beat {sideNames(r.sides[2 - r.winner_side])}
            <span className="ml-2 font-mono">{r.sets.map((s) => (r.winner_side === 1 ? `${s.a}-${s.b}` : `${s.b}-${s.a}`)).join(", ")}</span>
          </div>
        ))}
      </Card>
      {history.length > 0 && (
        <Card title="Ranking changes" testid="ladder-history">
          <ul className="text-xs space-y-1.5" style={muted}>
            {history.slice(0, 10).map((h) => {
              const after = h.after.find((a) => a.player_id === h.winner);
              const before = h.before.find((a) => a.player_id === h.winner);
              return <li key={h.challenge_id}><span className="font-mono">{new Date(h.at).toLocaleDateString()}</span> · {after?.name} {before?.rank ? `#${before.rank} to #${after?.rank}` : `entered at #${after?.rank}`}</li>;
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

function People({ L, act, busy }) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const link = L.invite_link ? `${window.location.origin}${L.invite_link}` : "";
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is shown, so it can be copied by hand */ } };
  return (
    <>
      {L.can.invite && (
        <Card title="Invite players" testid="ladder-invite-card">
          <p className="text-xs font-semibold mb-1">Find a VENLAX player</p>
          <PlayerPicker sport={L.sport} label="Search players by name" testid="ladder-invite-player" onPick={(p) => act("invites", { user_id: p.id })} />
          <p className="text-xs font-semibold mt-4 mb-1">Or invite by email</p>
          <div className="flex gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="friend@example.com" aria-label="Email address" className={field} style={box} data-testid="ladder-invite-email" />
            <button onClick={() => act("invites", { email }).then((ok) => ok && setEmail(""))} disabled={busy || !email.includes("@")} className={btn} style={primary} data-testid="ladder-invite-email-send">Send</button>
          </div>
          <p className="text-xs font-semibold mt-4 mb-1">Or share this link</p>
          <div className="flex gap-2">
            <input readOnly value={link} aria-label="Invitation link" className={`${field} font-mono`} style={box} data-testid="ladder-invite-link" onFocus={(e) => e.target.select()} />
            <button onClick={copy} className={btn} style={box} data-testid="ladder-invite-copy">{copied ? "Copied" : "Copy"}</button>
          </div>
          <button onClick={() => window.confirm("The old link will stop working. Continue?") && act("link/rotate")} className="text-xs font-semibold underline mt-2" style={muted} data-testid="ladder-link-rotate">Make a new link</button>
        </Card>
      )}
      {L.invites.length > 0 && (
        <Card title="Invitations and requests" testid="ladder-invites">
          {L.invites.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm" style={{ borderTop: "1px solid #F3F4F6" }} data-testid={`invite-${i.id}`}>
              <div><span className="font-semibold">{i.player || i.email || "Share link"}</span> <span className="text-xs" style={muted}>{INVITE_STATUS[i.status] || i.status}</span></div>
              <div className="flex gap-2">
                {i.status === "requested" && <>
                  <button onClick={() => act(`requests/${i.id}`, { action: "approve" })} disabled={busy} className="px-3 py-1.5 text-[11px] font-bold uppercase" style={primary} data-testid={`request-approve-${i.id}`}>Approve</button>
                  <button onClick={() => act(`requests/${i.id}`, { action: "decline" })} disabled={busy} className="px-3 py-1.5 text-[11px] font-bold uppercase" style={box} data-testid={`request-decline-${i.id}`}>Decline</button>
                </>}
                {i.status === "invited" && <button onClick={() => act(`invites/${i.id}/revoke`)} disabled={busy} className="px-3 py-1.5 text-[11px] font-bold uppercase" style={box} data-testid={`invite-revoke-${i.id}`}>Withdraw</button>}
              </div>
            </div>
          ))}
        </Card>
      )}
      <Card title="Who is taking part" testid="ladder-activity">
        {L.activity.map((a) => (
          <div key={a.player_id} className="flex items-center justify-between gap-3 py-2.5 text-sm" style={{ borderTop: "1px solid #F3F4F6" }}>
            <div><span className="font-semibold">{a.name}</span><p className="text-xs" style={muted}>Joined {new Date(a.joined_at).toLocaleDateString()} · {a.played} played{a.last_played_at ? ` · last ${new Date(a.last_played_at).toLocaleDateString()}` : ""}</p></div>
            {a.can_remove && <button onClick={() => window.confirm(`Remove ${a.name}?`) && act(`participants/${a.player_id}/remove`, {})} disabled={busy} className="text-xs font-semibold underline" style={{ color: "#B42318" }} data-testid={`remove-${a.player_id}`}>Remove</button>}
          </div>
        ))}
        <p className="text-xs mt-3" style={muted}>You can remove someone who has not played a verified match. Players with results stay on the record; they can leave on their own.</p>
      </Card>
    </>
  );
}

function Settings({ L, act, busy }) {
  const draft = L.status === "draft";
  const [f, setF] = useState({ name: L.name, visibility: L.visibility, join_mode: L.join_mode, max_participants: L.max_participants, description: L.description || "",
    sport: L.sport, format: L.format, division_label: L.division_label, city: L.city, ranking_method: L.ranking_method, duration_days: L.duration_days });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: k === "max_participants" || k === "duration_days" ? Number(e.target.value) : e.target.value }));
  const live = ["name", "visibility", "join_mode", "max_participants", "description"];
  const save = () => act("", Object.fromEntries(Object.entries(f).filter(([k]) => draft || live.includes(k))), "patch");
  return (
    <Card title="Settings" testid="ladder-settings">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="text-xs font-semibold" htmlFor="set-name">Name</label><input id="set-name" value={f.name} onChange={set("name")} maxLength={60} className={`${field} mt-1`} style={box} data-testid="set-name" /></div>
        <div><label className="text-xs font-semibold" htmlFor="set-vis">Who can find it</label><select id="set-vis" value={f.visibility} onChange={set("visibility")} className={`${field} mt-1`} style={box} data-testid="set-visibility"><option value="public">Public</option><option value="private">Private</option></select></div>
        <div><label className="text-xs font-semibold" htmlFor="set-join">How people join (public)</label><select id="set-join" value={f.join_mode} onChange={set("join_mode")} className={`${field} mt-1`} style={box} data-testid="set-joinmode"><option value="open">Open</option><option value="approval">I approve each one</option></select></div>
        <div><label className="text-xs font-semibold" htmlFor="set-max">Maximum {entrantWord(L.format)}</label><select id="set-max" value={f.max_participants} onChange={set("max_participants")} className={`${field} mt-1`} style={box} data-testid="set-max">{SIZES.map((n) => <option key={n} value={n} disabled={n < L.participant_count}>{n}</option>)}</select></div>
        {draft && <>
          <div><label className="text-xs font-semibold" htmlFor="set-skill">Skill level</label><select id="set-skill" value={f.division_label} onChange={set("division_label")} className={`${field} mt-1`} style={box} data-testid="set-skill">{DIVISIONS.map((d) => <option key={d}>{d}</option>)}</select></div>
          <div><label className="text-xs font-semibold" htmlFor="set-method">Ranking method</label><select id="set-method" value={f.ranking_method} onChange={set("ranking_method")} className={`${field} mt-1`} style={box} data-testid="set-method">{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
        </>}
        <div className="sm:col-span-2"><label className="text-xs font-semibold" htmlFor="set-desc">About</label><textarea id="set-desc" value={f.description} onChange={set("description")} maxLength={500} rows={2} className={`${field} mt-1`} style={box} data-testid="set-description" /></div>
      </div>
      {!draft && <p className="text-xs mt-3" style={muted}>Sport, format, skill level, city, ranking method and length are fixed once a ladder is live, so everyone plays by the rules they joined under.</p>}
      <div className="flex flex-wrap gap-3 mt-4">
        <button onClick={save} disabled={busy} className={btn} style={primary} data-testid="set-save">Save changes</button>
        {L.can.pause && <button onClick={() => act("pause")} disabled={busy} className={btn} style={box} data-testid="ladder-pause">Pause</button>}
        {L.can.resume && <button onClick={() => act("resume")} disabled={busy} className={btn} style={amber} data-testid="ladder-resume">Resume</button>}
        {L.can.close && <button onClick={() => window.confirm(draft ? "Discard this draft?" : "Close this ladder? Open challenges are cancelled and the standings are kept.") && act("close", {})} disabled={busy} className={btn} style={{ border: "1px solid #B42318", color: "#B42318" }} data-testid="ladder-close">{draft ? "Discard draft" : "Close ladder"}</button>}
      </div>
    </Card>
  );
}

export default function CommunityLadder() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [L, setL] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("standings");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(null);
  const [partner, setPartner] = useState(null);
  const [notice, setNotice] = useState("");
  useDocumentMeta({ title: L ? `${L.name} | VENLAX Sports` : "Community Ladder | VENLAX Sports", description: "A VENLAX community ladder.", noindex: L ? L.visibility === "private" || L.status === "draft" : true });

  const load = useCallback(async () => {
    try {
      const token = params.get("token") || undefined;
      const { data } = await axios.get(`${API}/community-ladders/${id}`, { params: { token }, withCredentials: true });
      setL(data);
      axios.get(`${API}/community-ladders/${id}/history`, { withCredentials: true }).then((r) => setHistory(r.data)).catch(() => {});
    } catch (e) {
      setError(apiError(e, "Could not load this ladder."));
    }
  }, [id, params]);

  useEffect(() => { if (!loading) load(); }, [loading, load]);

  /** POST (or PATCH) to a ladder action and swap in the fresh dashboard. Returns whether it worked. */
  const act = async (path, body = {}, method = "post") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await axios({ method, url: `${API}/community-ladders/${id}${path ? `/${path}` : ""}`, data: body, withCredentials: true });
      if (data && data.standings) setL(data);
      else if (data?.requested) { setNotice("Request sent. The creator will answer soon."); await load(); }
      else await load();
      return true;
    } catch (e) {
      setError(apiError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!L) {
    return <div className="min-h-[60vh] flex items-center justify-center px-4"><p className="text-sm" style={error ? { color: "#B42318" } : muted} role={error ? "alert" : undefined}>{error || "Loading..."}</p></div>;
  }

  const st = LADDER_STATUS[L.status] || LADDER_STATUS.active;
  const owner = L.is_owner || L.is_admin;
  const tabs = [["standings", "Standings"], ["matches", "Matches"], ...(owner ? [["people", "People"], ["settings", "Settings"]] : [])];
  const doubles = L.format === "doubles";
  const loggedIn = !!user;

  return (
    <div className="min-h-screen" style={{ background: "#F9FAFB" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/ladders" className="text-xs font-semibold" style={{ color: "#008F70" }}>All ladders</Link>
        <div className="flex items-start justify-between gap-3 flex-wrap mt-2">
          <h1 className="font-heading font-bold text-2xl sm:text-3xl" style={{ color: "#1D1D1D" }} data-testid="ladder-title">{L.name}</h1>
          <span className="px-2.5 py-1 text-xs font-semibold" style={{ background: st.bg, color: st.fg }} data-testid="ladder-status">{st.label}</span>
        </div>
        <p className="text-sm mt-1" style={muted} data-testid="ladder-meta">
          {sportLabel(L)} · {L.division_label} · {L.city}{L.zip_code ? ` ${L.zip_code}` : ""} · {methodLabel(L.ranking_method)} · {L.visibility === "private" ? "Private" : "Public"} · run by {L.owner_name}
        </p>
        <p className="text-sm mt-1" style={{ color: "#374151" }} data-testid="ladder-counts">
          <strong className="font-mono">{L.participant_count}</strong> of {L.max_participants} {entrantWord(L.format)} · <strong className="font-mono">{L.matches_played}</strong> matches played{L.ends_at ? ` · ends ${new Date(L.ends_at).toLocaleDateString()}` : ""}
        </p>
        {L.description && <p className="text-sm mt-3 bg-white px-4 py-3" style={box}>{L.description}</p>}
        {L.recommendation && <p className="text-xs mt-3 px-3 py-2" style={{ background: "#FFF6E0", color: "#8A5A00" }} data-testid="ladder-recommendation">{L.recommendation}</p>}
        {error && <p className="text-sm mt-4" style={{ color: "#B42318" }} role="alert" data-testid="ladder-error">{error}</p>}
        {notice && <p className="text-sm mt-4" style={{ color: "#00765C" }} role="status" data-testid="ladder-notice">{notice}</p>}

        {L.status === "draft" && L.can.publish && (
          <Card title="Review and publish" testid="ladder-draft-card">
            <p className="text-sm" style={{ color: "#374151" }}>Nobody can see this ladder yet. Check the details above and the Settings tab. Publishing registers you as the first entrant (unranked, with no head start) and opens invitations and challenges. After that, ranking method, sport, format, skill level and city are locked.</p>
            {doubles && (
              <div className="mt-3"><p className="text-xs font-semibold mb-1">Your doubles partner</p>
                {partner ? <div className="flex items-center justify-between px-3 py-2" style={box}><span className="text-sm">{partner.name}</span><button onClick={() => setPartner(null)} className="text-xs font-semibold" style={{ color: "#008F70" }}>Change</button></div>
                  : <PlayerPicker sport={L.sport} label="Search your partner by name" testid="ladder-publish-partner" onPick={setPartner} />}
              </div>
            )}
            <button onClick={() => act("publish", { partner_id: partner?.id })} disabled={busy || (doubles && !partner)} className={`${btn} mt-4`} style={primary} data-testid="ladder-publish">Publish ladder</button>
          </Card>
        )}

        <div className="flex flex-wrap gap-3 mt-5">
          {L.can.join && loggedIn && !doubles && <button onClick={() => act("join", {})} disabled={busy} className={btn} style={primary} data-testid="ladder-join">{L.join_mode === "approval" ? "Ask to join" : "Join this ladder"}</button>}
          {L.can.join && loggedIn && doubles && (
            <div className="w-full max-w-sm">
              <p className="text-xs font-semibold mb-1">Your doubles partner</p>
              {partner ? <div className="flex items-center justify-between px-3 py-2 bg-white" style={box}><span className="text-sm">{partner.name}</span><button onClick={() => setPartner(null)} className="text-xs font-semibold" style={{ color: "#008F70" }}>Change</button></div>
                : <PlayerPicker sport={L.sport} label="Search your partner by name" testid="ladder-join-partner" onPick={setPartner} />}
              <button onClick={() => act("join", { partner_id: partner?.id })} disabled={busy || !partner} className={`${btn} mt-2`} style={primary} data-testid="ladder-join">{L.join_mode === "approval" ? "Ask to join" : "Join this ladder"}</button>
            </div>
          )}
          {L.can.join && !loggedIn && <button onClick={() => navigate("/auth")} className={btn} style={primary} data-testid="ladder-login-to-join">Log in to join</button>}
          {L.can.withdraw && <button onClick={() => window.confirm("Leave this ladder? Your open challenges are cancelled.") && act("withdraw", {})} disabled={busy} className={btn} style={box} data-testid="ladder-withdraw">Leave ladder</button>}
        </div>

        <div className="flex gap-1 overflow-x-auto mt-6" role="tablist" style={{ borderBottom: "1px solid #E5E7EB" }}>
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap" style={tab === k ? { color: "#008F70", borderBottom: "2px solid #008F70" } : { color: "#4C4C4C" }} data-testid={`ladder-tab-${k}`}>{label}</button>
          ))}
        </div>

        {tab === "standings" && <Card title="Standings" testid="ladder-standings"><Standings L={L} onChallenge={setTarget} /></Card>}
        {tab === "matches" && <Matches L={L} history={history} />}
        {tab === "people" && owner && <People L={L} act={act} busy={busy} />}
        {tab === "settings" && owner && <Settings key={`${L.status}-${L.name}-${L.visibility}-${L.max_participants}`} L={L} act={act} busy={busy} />}
      </div>
      {target && <ChallengeModal L={L} target={target} onClose={() => setTarget(null)} onSent={(c) => { setTarget(null); navigate(`/challenges/${c.id}`); }} />}
    </div>
  );
}
