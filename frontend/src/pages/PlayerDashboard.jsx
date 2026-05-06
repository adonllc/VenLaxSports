import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Trophy, Calendar, Users, TrendingUp, Award, MapPin, Clock, Plus } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_COLORS = {
  tennis: { badge: "sport-badge-tennis", color: "text-tennis", icon: "🎾" },
  cricket: { badge: "sport-badge-cricket", color: "text-cricket", icon: "🏏" },
  pickleball: { badge: "sport-badge-pickleball", color: "text-pickleball", icon: "🏓" },
};

export default function PlayerDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [matches, setMatches] = useState([]);
  const [scheduleLeagueId, setScheduleLeagueId] = useState("");
  const [opponent, setOpponent] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [schedMsg, setSchedMsg] = useState("");
  const [leaguePlayers, setLeaguePlayers] = useState([]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    fetchData();
  }, [user, loading]);

  const fetchData = async () => {
    try {
      const [lRes, mRes] = await Promise.all([
        axios.get(`${API}/leagues/my`, { withCredentials: true }),
        axios.get(`${API}/matches/my`, { withCredentials: true }),
      ]);
      setLeagues(lRes.data);
      setMatches(mRes.data);
    } catch (e) { console.error(e); }
  };

  const fetchLeaguePlayers = async (lid) => {
    try {
      const { data } = await axios.get(`${API}/leagues/${lid}/players`);
      setLeaguePlayers(data.filter((p) => p.player_id !== (user?.id || user?._id)));
    } catch (e) { console.error(e); }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setScheduling(true);
    setSchedMsg("");
    try {
      await axios.post(`${API}/matches`, {
        league_id: scheduleLeagueId,
        player2_id: opponent,
        scheduled_date: schedDate,
      }, { withCredentials: true });
      setSchedMsg("Match scheduled successfully!");
      setOpponent(""); setSchedDate(""); setScheduleLeagueId("");
      fetchData();
    } catch (err) {
      const d = err.response?.data?.detail;
      setSchedMsg(typeof d === "string" ? d : "Failed to schedule match");
    } finally {
      setScheduling(false);
    }
  };

  if (!user) return null;

  const wins = matches.filter((m) => m.status === "completed" && (m.winner_id === user.id || m.winner_id === user._id)).length;
  const losses = matches.filter((m) => m.status === "completed" && m.winner_id && m.winner_id !== user.id && m.winner_id !== user._id).length;
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const recent = matches.filter((m) => m.status === "completed").slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50" data-testid="player-dashboard">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-heading font-black text-white">{user.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1">
            <h1 className="font-heading font-black text-2xl text-gray-900">{user.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
              <span>{user.email}</span>
              {user.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{user.city}</span>}
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${user.country === "India" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                {user.country === "USA" ? "🇺🇸 USA" : "🇮🇳 India"}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-center">
              <p className="font-heading font-black text-2xl text-emerald-600">{user.tennis_rating || 3.0}</p>
              <p className="text-xs text-gray-500">Tennis</p>
            </div>
            <div className="text-center">
              <p className="font-heading font-black text-2xl text-blue-600">{user.cricket_rating || 50}</p>
              <p className="text-xs text-gray-500">Cricket</p>
            </div>
            <div className="text-center">
              <p className="font-heading font-black text-2xl text-orange-600">{user.pickleball_rating || 3.0}</p>
              <p className="text-xs text-gray-500">Pickleball</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Leagues", value: leagues.length, icon: Trophy, color: "text-black" },
            { label: "Wins", value: wins, icon: Award, color: "text-emerald-600" },
            { label: "Losses", value: losses, icon: TrendingUp, color: "text-red-500" },
            { label: "Total Matches", value: matches.length, icon: Calendar, color: "text-blue-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-5" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <s.icon className={`w-5 h-5 ${s.color} mb-3`} />
              <p className={`font-heading font-black text-3xl ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* My Leagues */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-heading font-bold text-lg">My Leagues</h2>
              <Link to="/leagues" className="text-xs font-semibold text-gray-500 hover:text-black">Browse More</Link>
            </div>
            {leagues.length === 0 ? (
              <div className="text-center py-10">
                <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-3">Not in any leagues yet</p>
                <Link to="/leagues" className="text-sm font-semibold text-black border border-black px-4 py-2 rounded-xl" data-testid="browse-leagues-btn">
                  Browse Leagues
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {leagues.map((l) => {
                  const sc = SPORT_COLORS[l.sport] || {};
                  return (
                    <div key={l.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className="text-lg">{sc.icon || "🏆"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{l.name}</p>
                        <p className="text-xs text-gray-500">{l.city} • {l.format}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === "registration" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                        {l.status}
                      </span>
                      <Link to={`/leagues/${l.id}/standings`} className="text-xs font-medium text-gray-400 hover:text-black">
                        Standings
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Schedule a Match */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-heading font-bold text-lg">Schedule a Match</h2>
            </div>
            <div className="p-5">
              {leagues.length === 0 ? (
                <p className="text-sm text-gray-500">Join a league first to schedule matches.</p>
              ) : (
                <form onSubmit={handleSchedule} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Select League</label>
                    <select
                      value={scheduleLeagueId}
                      onChange={(e) => { setScheduleLeagueId(e.target.value); fetchLeaguePlayers(e.target.value); }}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
                      required
                      data-testid="schedule-league-select"
                    >
                      <option value="">Choose a league...</option>
                      {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Opponent Player ID</label>
                    <input
                      type="text"
                      value={opponent}
                      onChange={(e) => setOpponent(e.target.value)}
                      placeholder="Enter opponent's user ID"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      required
                      data-testid="schedule-opponent-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Match Date & Time</label>
                    <input
                      type="datetime-local"
                      value={schedDate}
                      onChange={(e) => setSchedDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      required
                      data-testid="schedule-date-input"
                    />
                  </div>
                  {schedMsg && (
                    <p className={`text-sm px-3 py-2 rounded-xl ${schedMsg.includes("success") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`} data-testid="schedule-message">
                      {schedMsg}
                    </p>
                  )}
                  <button type="submit" disabled={scheduling} className="w-full py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60" data-testid="schedule-submit-btn">
                    {scheduling ? "Scheduling..." : "Schedule Match"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Upcoming Matches */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-heading font-bold text-lg">Upcoming Matches ({upcoming.length})</h2>
            </div>
            {upcoming.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">No upcoming matches</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {upcoming.slice(0, 5).map((m) => (
                  <div key={m.id} className="px-5 py-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{m.player1_name} vs {m.player2_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(m.scheduled_date).toLocaleString()}
                        </p>
                      </div>
                      <Link
                        to={`/matches/${m.id}/score`}
                        className="text-xs font-semibold bg-black text-white px-2.5 py-1 rounded-lg hover:bg-gray-800 transition-colors"
                        data-testid={`report-score-btn-${m.id}`}
                      >
                        Report
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Results */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-heading font-bold text-lg">Recent Results ({recent.length})</h2>
            </div>
            {recent.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">No completed matches yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recent.map((m) => {
                  const isWin = m.winner_id === user.id || m.winner_id === user._id;
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isWin ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                        {isWin ? "W" : "L"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.player1_name} vs {m.player2_name}</p>
                        {m.winner_name && <p className="text-xs text-gray-500">{m.winner_name} won</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
