import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Users, Calendar } from "lucide-react";
import { AuthContext } from "../contexts/AuthContext";
import RRScheduleView from "../components/RRScheduleView";
import RRBracketView from "../components/RRBracketView";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TABS = ["Overview", "Schedule", "Standings", "Playoffs"];

export default function RoundRobinDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [league, setLeague] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [standings, setStandings] = useState([]);
  const [playoffMatches, setPlayoffMatches] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [lgRes, schedRes, standRes] = await Promise.all([
        axios.get(`${API}/round-robin/${id}`),
        axios.get(`${API}/round-robin/${id}/schedule`),
        axios.get(`${API}/round-robin/${id}/standings`),
      ]);
      setLeague(lgRes.data);
      setSchedule(schedRes.data);
      setStandings(standRes.data);

      const matchRes = await axios.get(`${API}/round-robin/${id}/matches`);
      setPlayoffMatches(matchRes.data.filter(m => m.is_playoff));
    } catch {
      setError("Failed to load league.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) { navigate("/auth"); return; }
    setJoining(true);
    try {
      const res = await axios.post(`${API}/round-robin/${id}/join`, {}, { withCredentials: true });
      if (res.data.redirect) {
        window.location.href = res.data.checkout_url;
      } else {
        await fetchAll();
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to join league.");
    } finally {
      setJoining(false);
    }
  };

  const handleInvitePartner = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      await axios.post(
        `${API}/round-robin/${id}/invite-partner`,
        { partner_email: inviteEmail },
        { withCredentials: true }
      );
      setInviteSent(true);
      setShowInviteModal(false);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to send invite.");
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!league) return <div className="min-h-screen flex items-center justify-center text-gray-400">{error || "League not found."}</div>;

  const rr = league.rr_config || {};
  const isDoubles = rr.division_type === "doubles";
  const isFull = league.current_players >= (rr.max_players || league.max_players);
  const isStarted = rr.schedule_generated;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs border border-emerald-500 text-emerald-600 rounded px-1.5 py-0.5 font-medium">Round Robin</span>
                <span className="text-xs text-gray-500">{league.sport?.toUpperCase()}</span>
              </div>
              <h1 className="text-2xl font-black text-gray-900">{league.name}</h1>
              <p className="text-gray-500 mt-1">{league.city} · {isDoubles ? "Doubles" : "Singles"}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                <span className="flex items-center gap-1"><Users size={14} /> {league.current_players}/{rr.max_players || league.max_players} players</span>
                <span className="flex items-center gap-1"><Calendar size={14} /> Starts {league.start_date}</span>
                <span className="font-semibold text-black">{league.entry_fee > 0 ? `$${league.entry_fee}` : "Free"}</span>
              </div>
            </div>
            {!isStarted && !isFull && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 min-w-[200px]">
                {inviteSent ? (
                  <p className="text-emerald-600 text-sm font-medium">Invite sent! Waiting for partner.</p>
                ) : isDoubles ? (
                  <>
                    <button
                      data-testid="btn-register-team"
                      onClick={() => setShowInviteModal(true)}
                      className="w-full bg-black text-white rounded-md py-2 text-sm font-bold hover:bg-gray-800 transition"
                    >
                      Register as Team
                    </button>
                    <p className="text-xs text-gray-400 mt-2 text-center">Enter partner email to send invite</p>
                  </>
                ) : (
                  <button
                    data-testid="btn-join-league"
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full bg-black text-white rounded-md py-2 text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    {joining ? "Joining..." : "Join League"}
                  </button>
                )}
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              </div>
            )}
            {isStarted && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 text-sm text-emerald-700 font-medium">
                League Active — {rr.playoff_generated ? "Playoffs Underway" : "Round Robin in progress"}
              </div>
            )}
            {isFull && !isStarted && (
              <div className="bg-gray-100 border border-gray-200 rounded-xl px-5 py-3 text-sm text-gray-500">League Full</div>
            )}
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-6 border-b border-gray-200">
            {TABS.map(tab => (
              <button
                key={tab}
                data-testid={`tab-${tab.toLowerCase()}`}
                onClick={() => setActiveTab(tab)}
                className={`py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab ? "border-black text-black" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === "Overview" && (
          <div className="space-y-6">
            {league.description && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="font-bold text-gray-900 mb-2">About</h2>
                <p className="text-gray-600 text-sm leading-relaxed">{league.description}</p>
              </div>
            )}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-bold text-gray-900 mb-3">Format</h2>
              <ul className="text-sm text-gray-600 space-y-2">
                <li><strong>Scoring:</strong> {rr.scoring_format || (league.sport === "tennis" ? "Fast-4" : "Games to 11")}</li>
                <li><strong>Division:</strong> {isDoubles ? "Fixed-Partner Doubles" : "Singles"}</li>
                <li><strong>Playoff qualifiers:</strong> Top {rr.playoff_threshold || 4}</li>
                <li><strong>Schedule:</strong> Auto-generated when minimum players ({rr.min_players}) register</li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="font-bold text-amber-900 mb-2 text-sm">Scheduling</h2>
              <p className="text-amber-800 text-sm leading-relaxed">
                Players are responsible for coordinating match times within each week window.
                Offer at least 3 time slots; respond within 48 hours. The league does not assign courts.
                One reschedule credit per season.
              </p>
            </div>
          </div>
        )}

        {activeTab === "Schedule" && (
          <RRScheduleView rounds={schedule?.rounds || []} currentUserId={user?.id} />
        )}

        {activeTab === "Standings" && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Rank", "Player", "W", "L", "Pts", "Game Diff"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {standings.map((s, i) => {
                  const isQualifier = i < (rr.playoff_threshold || 4) && isStarted;
                  return (
                    <tr key={s.id} className={isQualifier ? "bg-emerald-50" : ""}>
                      <td className="px-4 py-3 font-bold text-gray-900">{s.rank}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.player_name}</td>
                      <td className="px-4 py-3 text-gray-700">{s.wins}</td>
                      <td className="px-4 py-3 text-gray-700">{s.losses}</td>
                      <td className="px-4 py-3 text-gray-700">{s.points?.toFixed(1)}</td>
                      <td className="px-4 py-3 text-gray-700">{(s.games_won || 0) - (s.games_lost || 0)}</td>
                    </tr>
                  );
                })}
                {standings.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No standings yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Playoffs" && (
          <RRBracketView matches={playoffMatches} generated={rr.playoff_generated || false} />
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h2 className="font-bold text-gray-900 text-lg mb-4">Invite your partner</h2>
            <p className="text-sm text-gray-500 mb-4">Enter your partner's email. They'll receive an invite link to join as your fixed doubles partner.</p>
            <input
              data-testid="input-partner-email"
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="partner@email.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-black"
            />
            <div className="flex gap-3">
              <button
                data-testid="btn-send-invite"
                onClick={handleInvitePartner}
                disabled={inviteLoading || !inviteEmail}
                className="flex-1 bg-black text-white rounded-md py-2 text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50"
              >
                {inviteLoading ? "Sending..." : "Send Invite"}
              </button>
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 border border-gray-300 rounded-md py-2 text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
