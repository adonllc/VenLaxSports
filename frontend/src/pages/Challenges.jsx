import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Search, Swords } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { COURT_SIDE_NEUTRAL, STYLE_OPTIONS } from "../config/playProfile";
import { SPORTS, STATUS, apiError, fmtWhen, matchup, sportLabel } from "../utils/challengeUi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const TABS = [
  { id: "find", label: "Find a player" },
  { id: "received", label: "Received" },
  { id: "sent", label: "Sent" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];
const LEVELS = ["", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5"];
const box = { border: "1px solid #E5E7EB" };
const muted = { color: "#6B7280" };
const input = "px-3 py-2 text-sm bg-white w-full";
const EMPTY = {
  received: "No challenges waiting for you.",
  sent: "No pending challenges.",
  active: "No active matches.",
  completed: "No completed matches yet.",
};

function Stat({ label, value, testid }) {
  return (
    <div className="bg-white p-4" style={box} data-testid={testid}>
      <p className="font-mono font-bold text-2xl" style={{ color: "#1D1D1D" }}>{value}</p>
      <p className="text-xs mt-1" style={muted}>{label}</p>
    </div>
  );
}

function Chip({ status }) {
  const s = STATUS[status] || STATUS.sent;
  return <span className="px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

function ChallengeRow({ c }) {
  return (
    <Link to={`/challenges/${c.id}`} className="block bg-white p-4 hover:shadow-sm" style={box} data-testid={`challenge-row-${c.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-sm" style={{ color: "#1D1D1D" }}>{matchup(c)}</p>
          <p className="text-xs mt-0.5" style={muted}>
            {sportLabel(c)}
            {c.scheduled_at ? ` · ${fmtWhen(c.scheduled_at)}${c.venue ? ` · ${c.venue}` : ""}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {c.needs_my_action && <span className="px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: "#008F70" }}>Your move</span>}
          <Chip status={c.phase} />
        </div>
      </div>
    </Link>
  );
}

/** One player card: level, city, challenge record and your head-to-head against them. */
function PlayerCard({ p, sport, onChallenge }) {
  const h = p.head_to_head;
  // play_style is stored per sport ({ tennis, pickleball }); show the one for the sport being searched
  const styleValue = p.play_style && typeof p.play_style === "object" ? p.play_style[sport] : p.play_style;
  const styleLabel = STYLE_OPTIONS[sport]?.find((o) => o.value === styleValue)?.label || null;
  const sideLabel = COURT_SIDE_NEUTRAL[p.court_side] || null;
  return (
    <div className="bg-white p-4 flex flex-col gap-3" style={box} data-testid={`player-card-${p.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/players/${p.id}`} className="font-heading font-bold text-base hover:underline" style={{ color: "#1D1D1D" }} data-testid={`player-profile-link-${p.id}`}>{p.name}</Link>
          <p className="text-xs mt-0.5" style={muted}>{p.city || "No city set"}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono font-bold text-lg" style={{ color: "#008F70" }}>{p.level.toFixed(1)}</p>
          <p className="text-[11px]" style={muted}>level</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sideLabel && <span className="px-2 py-0.5 text-[11px]" style={{ background: "#F1F1F1", color: "#374151" }}>{sideLabel}</span>}
        {styleLabel && <span className="px-2 py-0.5 text-[11px]" style={{ background: "#F1F1F1", color: "#374151" }}>{styleLabel}</span>}
        <span className="px-2 py-0.5 text-[11px]" style={{ background: "#F1F1F1", color: "#374151" }}>
          {p.completed ? `${p.wins}W ${p.losses}L in challenges` : "No challenge matches yet"}
        </span>
        {h.matches > 0 && <span className="px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#FFF6E0", color: "#8A5A00" }}>You vs them: {h.wins}-{h.losses}</span>}
      </div>
      <button onClick={() => onChallenge(p)} className="mt-auto px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-[#1D1D1D] hover:text-white transition-colors" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid={`challenge-btn-${p.id}`}>
        Challenge
      </button>
    </div>
  );
}

function ChallengeModal({ target, sport, format, onClose, onSent }) {
  const [message, setMessage] = useState("");
  const [partner, setPartner] = useState(null);
  const [partnerQ, setPartnerQ] = useState("");
  const [partnerHits, setPartnerHits] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (format !== "doubles" || partnerQ.trim().length < 2) { setPartnerHits([]); return undefined; }
    const t = setTimeout(() => {
      axios.get(`${API}/challenges/players`, { params: { q: partnerQ.trim(), sport, limit: 6 }, withCredentials: true })
        .then((r) => setPartnerHits(r.data.filter((x) => x.id !== target.id))).catch(() => setPartnerHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [partnerQ, format, sport, target.id]);

  const send = async () => {
    setBusy(true);
    setErr("");
    try {
      const { data } = await axios.post(`${API}/challenges`, {
        opponent_id: target.id, sport, format, partner_id: format === "doubles" ? partner?.id : undefined, message: message.trim() || undefined,
      }, { withCredentials: true });
      onSent(data);
    } catch (e) {
      setErr(apiError(e, "Could not send the challenge."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(29,29,29,0.5)" }} role="dialog" aria-modal="true" data-testid="challenge-modal">
      <div className="bg-white w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-heading font-bold text-xl" style={{ color: "#1D1D1D" }}>Challenge {target.name}</h2>
        <p className="text-sm mt-1" style={muted}>{sport[0].toUpperCase() + sport.slice(1)} {format}. They have 3 days to answer. A friendly match does not change any ladder rank.</p>
        {format === "doubles" && (
          <div className="mt-4">
            <label className="text-xs font-semibold" style={{ color: "#374151" }}>Your partner</label>
            {partner ? (
              <div className="flex items-center justify-between mt-1 px-3 py-2" style={box}>
                <span className="text-sm">{partner.name}</span>
                <button onClick={() => setPartner(null)} className="text-xs font-semibold" style={{ color: "#008F70" }} data-testid="challenge-partner-clear">Change</button>
              </div>
            ) : (
              <>
                <input value={partnerQ} onChange={(e) => setPartnerQ(e.target.value)} placeholder="Search a player by name" className={`${input} mt-1`} style={box} data-testid="challenge-partner-search" />
                {partnerHits.length > 0 && (
                  <ul className="mt-1" style={box}>
                    {partnerHits.map((h) => (
                      <li key={h.id}><button onClick={() => { setPartner(h); setPartnerHits([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" data-testid={`challenge-partner-${h.id}`}>{h.name} <span className="text-xs" style={muted}>{h.city}</span></button></li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
        <label className="block text-xs font-semibold mt-4" style={{ color: "#374151" }} htmlFor="challenge-message">Message (optional)</label>
        <textarea id="challenge-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3} placeholder="Free this weekend?" className={`${input} mt-1`} style={box} data-testid="challenge-message" />
        {err && <p className="text-sm mt-3" style={{ color: "#B42318" }} role="alert" data-testid="challenge-error">{err}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={send} disabled={busy || (format === "doubles" && !partner)} className="flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: "#008F70", color: "#fff" }} data-testid="challenge-send">
            {busy ? "Sending..." : "Send challenge"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider" style={box} data-testid="challenge-cancel">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function FindPlayers({ onSent }) {
  const [filters, setFilters] = useState({ q: "", sport: "tennis", format: "singles", city: "", min_level: "", max_level: "" });
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState("");
  const [target, setTarget] = useState(null);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  // Nobody sees a list of every player: results appear only after a search with a name, a city or a level range.
  const search = async (e) => {
    e?.preventDefault();
    setError("");
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ""));
    params.q = (params.q || "").trim();
    if (!params.q && !params.city?.trim() && !params.min_level && !params.max_level) {
      setPlayers(null);
      setError("Enter a name, a city or a level range to search.");
      return;
    }
    if (params.q && params.q.length < 2) { setError("Type at least 2 letters of the name."); return; }
    try {
      const { data } = await axios.get(`${API}/challenges/players`, { params, withCredentials: true });
      setPlayers(data);
    } catch (err) {
      setError(apiError(err, "Could not search players."));
    }
  };

  return (
    <div>
      <form onSubmit={search} className="bg-white p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" style={box} role="search" aria-label="Find a player">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={muted} />
          <input value={filters.q} onChange={set("q")} placeholder="Search by name" className={`${input} pl-9`} style={box} aria-label="Search by name" data-testid="player-search-q" />
        </div>
        <select value={filters.sport} onChange={set("sport")} className={input} style={box} aria-label="Sport" data-testid="player-search-sport">
          {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filters.format} onChange={set("format")} className={input} style={box} aria-label="Singles or doubles" data-testid="player-search-format">
          <option value="singles">Singles</option>
          <option value="doubles">Doubles</option>
        </select>
        <input value={filters.city} onChange={set("city")} placeholder="City" className={input} style={box} aria-label="City" data-testid="player-search-city" />
        <div className="flex gap-2">
          <select value={filters.min_level} onChange={set("min_level")} className={input} style={box} aria-label="Minimum level" data-testid="player-search-min">
            {LEVELS.map((l) => <option key={l} value={l}>{l ? `From ${l}` : "Min level"}</option>)}
          </select>
          <select value={filters.max_level} onChange={set("max_level")} className={input} style={box} aria-label="Maximum level" data-testid="player-search-max">
            {LEVELS.map((l) => <option key={l} value={l}>{l ? `To ${l}` : "Max level"}</option>)}
          </select>
        </div>
        <button type="submit" className="px-4 py-2 text-xs font-bold uppercase tracking-wider lg:col-span-6 sm:justify-self-start" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="player-search-submit">Search players</button>
      </form>
      {error && <p className="text-sm mt-4" style={{ color: "#B42318" }} role="alert" data-testid="player-search-error">{error}</p>}
      {players === null && !error && <p className="text-sm mt-6" style={muted} data-testid="player-search-hint">Search by name, city or level range to find someone to challenge.</p>}
      {players && players.length === 0 && <p className="text-sm mt-6" style={muted} data-testid="player-search-empty">No players match. Try a wider level range or another city.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4" data-testid="player-results">
        {(players || []).map((p) => <PlayerCard key={p.id} p={p} sport={filters.sport} onChallenge={setTarget} />)}
      </div>
      {target && <ChallengeModal target={target} sport={filters.sport} format={filters.format} onClose={() => setTarget(null)} onSent={(c) => { setTarget(null); onSent(c); }} />}
    </div>
  );
}

export default function Challenges() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "find";
  const [groups, setGroups] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  useDocumentMeta({ title: "Challenge a Player | VENLAX Sports", description: "Challenge any VENLAX player to a match.", noindex: true });

  const load = useCallback(async () => {
    try {
      const [g, s] = await Promise.all([
        axios.get(`${API}/challenges`, { withCredentials: true }),
        axios.get(`${API}/challenges/stats/me`, { withCredentials: true }),
      ]);
      setGroups(g.data);
      setStats(s.data);
    } catch (e) {
      setError(apiError(e, "Could not load your challenges."));
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    load();
  }, [user, loading, navigate, load]);

  const goto = (id) => setParams(id === "find" ? {} : { tab: id });
  const list = groups && tab !== "find" ? groups[tab] : [];

  return (
    <div className="min-h-screen" style={{ background: "#F9FAFB" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/play" className="text-xs font-semibold" style={{ color: "#008F70" }}>Play & Compete</Link>
        <h1 className="font-heading font-bold text-3xl mt-1 flex items-center gap-3" style={{ color: "#1D1D1D" }}><Swords className="w-7 h-7" style={{ color: "#008F70" }} />Challenge a player</h1>
        <p className="text-sm mt-1" style={muted}>Friendly matches count toward your challenge record only. They never move a ladder rank.</p>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6" data-testid="challenge-stats">
            <Stat label="Challenges" value={stats.total_challenges} testid="stat-total" />
            <Stat label="Accepted" value={stats.accepted} testid="stat-accepted" />
            <Stat label="Matches played" value={stats.completed} testid="stat-completed" />
            <Stat label="Record" value={`${stats.wins}-${stats.losses}`} testid="stat-record" />
            <Stat label="Win rate" value={stats.win_pct == null ? "-" : `${stats.win_pct}%`} testid="stat-winpct" />
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto mt-8 mb-5" role="tablist" style={{ borderBottom: "1px solid #E5E7EB" }}>
          {TABS.map((t) => {
            const n = t.id === "find" || !groups ? 0 : groups[t.id].length;
            return (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => goto(t.id)} className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap" style={tab === t.id ? { color: "#008F70", borderBottom: "2px solid #008F70" } : { color: "#4C4C4C" }} data-testid={`challenge-tab-${t.id}`}>
                {t.label}{n > 0 ? ` (${n})` : ""}
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm mb-4" style={{ color: "#B42318" }} role="alert">{error}</p>}
        {tab === "find" ? (
          <FindPlayers onSent={(c) => { load(); navigate(`/challenges/${c.id}`); }} />
        ) : list.length === 0 ? (
          <p className="text-sm py-8 text-center" style={muted} data-testid={`challenge-empty-${tab}`}>{EMPTY[tab]}</p>
        ) : (
          <div className="space-y-3" data-testid={`challenge-list-${tab}`}>{list.map((c) => <ChallengeRow key={c.id} c={c} />)}</div>
        )}
      </div>
    </div>
  );
}
