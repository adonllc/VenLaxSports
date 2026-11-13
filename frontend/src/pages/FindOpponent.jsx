import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { SPORTS } from "../utils/challengeUi";
import { WINDOWS } from "../utils/openChallengeUi";
import { AcceptDialog, OpenChallengeCard } from "../components/OpenChallengeParts";
import OpenChallengeForm from "../components/OpenChallengeForm";
import { FindPlayers } from "./Challenges";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const EMPTY = { q: "", sport: "", format: "", city: "", zip_code: "", date: "", time_window: "", near: "" };
const sel = { border: "1px solid #E5E7EB" };

function Section({ title, hint, items, empty, children }) {
  return (
    <section className="mt-8" data-testid={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <h2 className="font-heading font-bold text-lg" style={{ color: "#1D1D1D" }}>{title} <span className="text-sm font-normal" style={{ color: "#6B7280" }}>({items.length})</span></h2>
      {hint && <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{hint}</p>}
      {items.length === 0 ? <p className="text-sm mt-3" style={{ color: "#6B7280" }}>{empty}</p> : <div className="grid md:grid-cols-2 gap-4 mt-3">{children}</div>}
    </section>
  );
}

/** PLAY & COMPETE -> FIND AN OPPONENT: browse open challenges, post your own, follow the ones you accepted. */
export default function FindOpponent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("find");
  const [filters, setFilters] = useState(EMPTY);
  const [board, setBoard] = useState(null);
  const [mine, setMine] = useState(null);
  const [posting, setPosting] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [notice, setNotice] = useState("");
  useDocumentMeta({ title: "Find an Opponent | VENLAX Sports", description: "Post a match request or accept one. Tennis and pickleball, any level, no ladder needed.", noindex: true });

  const loadBoard = useCallback(async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    try {
      const { data } = await axios.get(`${API}/open-challenges`, { params, withCredentials: true });
      setBoard(data);
    } catch { setBoard([]); }
  }, [filters]);
  const loadMine = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/open-challenges/mine`, { withCredentials: true });
      setMine(data);
    } catch { setMine({ published: [], accepted: [], completed: [], expired: [], summary: {} }); }
  }, []);

  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [user, loading, navigate]);
  useEffect(() => { if (user) loadBoard(); }, [user, loadBoard]);
  useEffect(() => { if (user) loadMine(); }, [user, loadMine]);

  const setF = (k) => (e) => setFilters((p) => ({ ...p, [k]: e.target.value }));
  const sum = mine?.summary || {};
  const tabs = [
    { id: "find", label: "Open matches" },
    { id: "player", label: "Challenge a player" },
    { id: "open", label: `My open challenges${mine ? ` (${mine.published.length})` : ""}` },
    { id: "accepted", label: `My accepted challenges${mine ? ` (${mine.accepted.length})` : ""}` },
  ];

  if (!user) return null;
  return (
    <div className="min-h-screen" style={{ background: "#F9FAFB" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#008F70" }}>Play & Compete</p>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-1">
          <h1 className="font-heading font-bold text-3xl" style={{ color: "#1D1D1D" }}>Find an opponent</h1>
          <button onClick={() => { setPosting(true); setTab("open"); }} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="post-challenge-btn">Post a challenge</button>
        </div>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: "#4C4C4C" }}>Pick a match someone else posted, or post your own and let players come to you. Friendly matches never change a ladder rank.</p>

        {mine && (
          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6" data-testid="open-summary">
            {[["Active", sum.active], ["Pending replies", sum.pending_responses], ["Upcoming", sum.upcoming], ["Completed", sum.completed], ["Expired", sum.expired]].map(([k, v]) => (
              <div key={k} className="bg-white px-4 py-3" style={{ border: "1px solid #E5E7EB" }}>
                <dt className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>{k}</dt>
                <dd className="font-mono text-2xl" style={{ color: "#1D1D1D" }}>{v ?? 0}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="flex flex-wrap gap-2 mt-6" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="px-4 py-2 text-sm font-semibold" style={tab === t.id ? { background: "#1D1D1D", color: "white" } : { background: "white", border: "1px solid #E5E7EB", color: "#1D1D1D" }} data-testid={`tab-${t.id}`}>{t.label}</button>
          ))}
        </div>

        {notice && <p className="mt-4 px-4 py-3 text-sm" style={{ background: "#E6F4F0", color: "#00765C" }} role="status" data-testid="open-notice">{notice}</p>}

        {tab === "find" && (
          <div className="mt-5" data-testid="board">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4" style={{ border: "1px solid #E5E7EB" }} role="search" aria-label="Filter challenges">
              <input value={filters.q} onChange={setF("q")} placeholder="Player name" className="px-3 py-2 text-sm" style={sel} aria-label="Player name" data-testid="filter-name" />
              <select value={filters.sport} onChange={setF("sport")} className="px-3 py-2 text-sm bg-white" style={sel} aria-label="Sport" data-testid="filter-sport"><option value="">Any sport</option>{SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
              <select value={filters.format} onChange={setF("format")} className="px-3 py-2 text-sm bg-white" style={sel} aria-label="Match type" data-testid="filter-format"><option value="">Singles or doubles</option><option value="singles">Singles</option><option value="doubles">Doubles</option></select>
              <input value={filters.city} onChange={setF("city")} placeholder="City" className="px-3 py-2 text-sm" style={sel} aria-label="City" data-testid="filter-city" />
              <input value={filters.zip_code} onChange={setF("zip_code")} placeholder="ZIP code" inputMode="numeric" className="px-3 py-2 text-sm" style={sel} aria-label="ZIP code" data-testid="filter-zip" />
              <input type="date" value={filters.date} onChange={setF("date")} className="px-3 py-2 text-sm" style={sel} aria-label="Date" data-testid="filter-date" />
              <select value={filters.time_window} onChange={setF("time_window")} className="px-3 py-2 text-sm bg-white" style={sel} aria-label="Time of day" data-testid="filter-window"><option value="">Any time of day</option>{WINDOWS.filter((w) => w.value !== "any").map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}</select>
              <select value={filters.near} onChange={setF("near")} className="px-3 py-2 text-sm bg-white" style={sel} aria-label="Distance" data-testid="filter-near"><option value="">Any distance</option><option value="city">My city</option><option value="zip">My ZIP code</option></select>
              <button onClick={() => setFilters(EMPTY)} className="px-3 py-2 text-sm font-semibold" style={sel} data-testid="filter-clear">Clear filters</button>
            </div>
            <p className="text-xs mt-2" style={{ color: "#6B7280" }}>You only see challenges you are eligible to accept. Nearest ones come first.</p>
            {board === null ? <p className="mt-6 text-sm" style={{ color: "#6B7280" }}>Loading...</p> : board.length === 0 ? (
              <div className="mt-6 bg-white p-8 text-center" style={{ border: "1px solid #E5E7EB" }} data-testid="board-empty">
                <p className="font-semibold" style={{ color: "#1D1D1D" }}>No open challenges match right now.</p>
                <p className="text-sm mt-1" style={{ color: "#4C4C4C" }}>Be the first: post yours and VENLAX will tell nearby players.</p>
                <button onClick={() => { setPosting(true); setTab("open"); }} className="mt-4 px-5 py-2.5 text-xs font-bold uppercase tracking-wider" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="board-empty-post">Post a challenge</button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4 mt-4">{board.map((c) => <OpenChallengeCard key={c.id} c={c} onAccept={setAccepting} />)}</div>
            )}
          </div>
        )}

        {tab === "player" && (
          <div className="mt-5" data-testid="challenge-player-tab">
            <p className="text-sm mb-3" style={{ color: "#4C4C4C" }}>Know who you want to play? Search by name, sport, singles or doubles, city and level, or challenge them by email if they are not on VenLax yet.</p>
            <FindPlayers onSent={(c) => navigate(`/challenges/${c.id}`)} onEmailSent={loadMine} />
          </div>
        )}

        {tab === "open" && (
          <div data-testid="my-open">
            {posting && (
              <div className="mt-5">
                <OpenChallengeForm onCancel={() => setPosting(false)} onSaved={(c) => { setPosting(false); setNotice(c.status === "open" ? "Your challenge is live. We will tell you when someone accepts." : "Saved as a draft. Publish it from My open challenges."); loadMine(); loadBoard(); }} />
              </div>
            )}
            <Section title="Posted by me" hint="Open, paused and draft challenges." items={mine?.published || []} empty="You have nothing posted. Use Post a challenge.">
              {(mine?.published || []).map((c) => <OpenChallengeCard key={c.id} c={c} showOwner={false} />)}
            </Section>
            <Section title="Expired and closed" items={mine?.expired || []} empty="Nothing here.">
              {(mine?.expired || []).map((c) => <OpenChallengeCard key={c.id} c={c} showOwner={false} />)}
            </Section>
          </div>
        )}

        {tab === "accepted" && (
          <div data-testid="my-accepted">
            <Section title="In play" hint="Matches you posted or accepted that are being scheduled or played." items={mine?.accepted || []} empty="No accepted challenges yet. Accept one on the board.">
              {(mine?.accepted || []).map((c) => <OpenChallengeCard key={c.id} c={c} />)}
            </Section>
            <Section title="Completed" items={mine?.completed || []} empty="No completed matches yet.">
              {(mine?.completed || []).map((c) => <OpenChallengeCard key={c.id} c={c} />)}
            </Section>
          </div>
        )}
      </div>

      {accepting && (
        <AcceptDialog challenge={accepting} onClose={() => { setAccepting(null); loadBoard(); }} onDone={(d) => { setAccepting(null); navigate(`/challenges/${d.challenge_id}`); }} />
      )}
    </div>
  );
}
