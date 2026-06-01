import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Users, Calendar } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import RRScheduleView from "../components/RRScheduleView";
import RRBracketView from "../components/RRBracketView";
import PartnerSearch from "../components/PartnerSearch";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const TABS = ["Overview", "Schedule", "Standings", "Playoffs"];

export default function RoundRobinDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [league, setLeague] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [standings, setStandings] = useState([]);
  const [playoffMatches, setPlayoffMatches] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRRPartner, setSelectedRRPartner] = useState(null);
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
    if (!selectedRRPartner && !inviteEmail) return;
    setInviteLoading(true);
    setError("");
    try {
      const body = selectedRRPartner
        ? { partner_id: selectedRRPartner.id }
        : { partner_email: inviteEmail };
      const res = await axios.post(
        `${API}/round-robin/${id}/invite-partner`,
        body,
        { withCredentials: true }
      );
      if (res.data.redirect) {
        window.location.href = res.data.checkout_url;
        return;
      }
      setInviteSent(true);
      setShowInviteModal(false);
      if (res.data.registered) await fetchAll();
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                      className="w-full bg-[#1B2B4B] text-white rounded-md py-2 text-sm font-bold hover:bg-[#142040] transition"
                    >
                      Register as Team
                    </button>
                    <p className="text-xs text-gray-400 mt-2 text-center">Search for partner or send email invite</p>
                  </>
                ) : (
                  <button
                    data-testid="btn-join-league"
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full bg-[#1B2B4B] text-white rounded-md py-2 text-sm font-bold hover:bg-[#142040] transition disabled:opacity-50"
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <li><strong>Match pairings:</strong> Platform-generated on {rr.min_players}+ registrations — organizer handles times &amp; venues</li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="font-bold text-amber-900 mb-2 text-sm">Scheduling is Your Organizer's Responsibility</h2>
              <p className="text-amber-800 text-sm leading-relaxed">
                VenLax generates who plays who. Your league organizer handles everything else: match times, court bookings,
                and rescheduling. VenLax platform support does not manage match scheduling. Respond to your organizer
                within 48 hours. One reschedule per season.
              </p>
            </div>
          </div>
        )}

        {activeTab === "Schedule" && (
          <RRScheduleView rounds={schedule?.rounds || []} currentUserId={user?.id} />
        )}

        {activeTab === "Standings" && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
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
          </div>
        )}

        {activeTab === "Playoffs" && (
          <RRBracketView matches={playoffMatches} generated={rr.playoff_generated || false} />
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h2 className="font-bold text-gray-900 text-lg mb-1">Register as Team</h2>
            <p className="text-sm text-gray-500 mb-4">Find your partner by name or email. If they're not on VenLax yet, invite them.</p>
            <div className="mb-4">
              <PartnerSearch
                onPartnerSelect={setSelectedRRPartner}
                onEmailChange={setInviteEmail}
              />
            </div>
            <div className="flex gap-3">
              <button
                data-testid="btn-send-invite"
                onClick={handleInvitePartner}
                disabled={inviteLoading || (!selectedRRPartner && !inviteEmail)}
                className="flex-1 bg-[#1B2B4B] text-white rounded-md py-2 text-sm font-bold hover:bg-[#142040] transition disabled:opacity-50"
              >
                {inviteLoading
                  ? "Processing..."
                  : selectedRRPartner
                    ? `Register with ${selectedRRPartner.name}`
                    : "Send Partner Invite"}
              </button>
              <button
                onClick={() => { setShowInviteModal(false); setSelectedRRPartner(null); setInviteEmail(""); }}
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
