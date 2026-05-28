import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Trophy, Calendar, Users, TrendingUp, Award, MapPin, Clock, Plus, Bell, BellOff } from "lucide-react";
import OpponentSearch from "../components/OpponentSearch";
import RatingHistoryChart from "../components/RatingHistoryChart";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_COLORS = {
  tennis: { badge: "sport-badge-tennis", color: "text-tennis", icon: "🎾" },
  cricket: { badge: "sport-badge-cricket", color: "text-cricket", icon: "🏏" },
  pickleball: { badge: "sport-badge-pickleball", color: "text-pickleball", icon: "🏓" },
};

export default function PlayerDashboard() {
  const { user, loading, fetchMe } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [matches, setMatches] = useState([]);
  const [scheduleLeagueId, setScheduleLeagueId] = useState("");
  const [opponent, setOpponent] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [schedMsg, setSchedMsg] = useState("");
  const [leaguePlayers, setLeaguePlayers] = useState([]);
  const [togglingNotif, setTogglingNotif] = useState(false);
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);
  const [interests, setInterests] = useState([]);
  const [removingInterest, setRemovingInterest] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [boxStatuses, setBoxStatuses] = useState({});
  const [ladderEntries, setLadderEntries] = useState([]);

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
      const myLeagues = lRes.data;
      for (const league of myLeagues.filter(l => l.league_type === "box_league")) {
        try {
          const { data } = await axios.get(`${API}/box-leagues/${league.id}/standings`, { withCredentials: true });
          const myBox = data.boxes?.find(b => b.players.some(p => p.player_id === (user?.id || user?._id)));
          if (myBox) {
            const myEntry = myBox.players.find(p => p.player_id === (user?.id || user?._id));
            setBoxStatuses(prev => ({
              ...prev,
              [league.id]: {
                box_id: myBox.box_id,
                rank: myEntry?.rank,
                total: myBox.players.length,
                promotion_status: myEntry?.promotion_status
              }
            }));
          }
        } catch {}
      }
    } catch (e) { console.error(e); }
    axios.get(`${API}/notifications/interests`, { withCredentials: true })
      .then(r => setInterests(r.data))
      .catch(() => {});
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/doubles-invite/my-invites`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.invites) setPendingInvites(data.invites); })
      .catch(() => {});
    axios.get(`${API}/ladders`, { withCredentials: true })
      .then(r => {
        const uid = user?.id || user?._id;
        const myEntries = [];
        for (const ladder of r.data) {
          const myEntry = (ladder.entries || []).find(e => e.player_id === uid);
          if (myEntry) {
            myEntries.push({
              ladder_id: ladder.id,
              city: ladder.city,
              sport: ladder.sport,
              division_label: ladder.division_label,
              rank: myEntry.rank,
              total: ladder.entry_count,
            });
          }
        }
        setLadderEntries(myEntries);
      })
      .catch(() => {});
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
      setSchedMsg("Match scheduled. Both players will receive a confirmation email.");
      setOpponent(""); setSchedDate(""); setScheduleLeagueId("");
      fetchData();
    } catch (err) {
      const d = err.response?.data?.detail;
      setSchedMsg(typeof d === "string" ? d : "Failed to schedule match");
    } finally {
      setScheduling(false);
    }
  };

  const toggleNotifications = async () => {
    if (togglingNotif) return;
    setTogglingNotif(true);
    try {
      await axios.patch(
        `${API}/auth/preferences`,
        { email_notifications: !user.email_notifications },
        { withCredentials: true },
      );
      await fetchMe();
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingNotif(false);
    }
  };

  const togglePrivacy = async () => {
    if (togglingPrivacy) return;
    setTogglingPrivacy(true);
    try {
      await axios.patch(
        `${API}/auth/preferences`,
        { profile_public: user.profile_public === false },
        { withCredentials: true },
      );
      await fetchMe();
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingPrivacy(false);
    }
  };

  const removeInterest = async (token) => {
    if (removingInterest) return;
    setRemovingInterest(token);
    try {
      await axios.delete(`${API}/notifications/unsubscribe?token=${encodeURIComponent(token)}`);
      setInterests(prev => prev.filter(i => i.unsubscribe_token !== token));
    } catch (e) {
      console.error(e);
    } finally {
      setRemovingInterest(null);
    }
  };

  const handleProfileUpdate = async (fields) => {
    try {
      const { data } = await axios.patch(`${API}/users/me`, fields, { withCredentials: true });
      await fetchMe();
    } catch (err) {
      console.error("Profile update failed", err);
    }
  };

  if (!user) return null;

  const wins = matches.filter((m) => m.status === "completed" && (m.winner_id === user.id || m.winner_id === user._id)).length;
  const losses = matches.filter((m) => m.status === "completed" && m.winner_id && m.winner_id !== user.id && m.winner_id !== user._id).length;
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const recent = matches.filter((m) => m.status === "completed").slice(0, 5);

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }} data-testid="player-dashboard">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: "1px solid #E5E7EB" }}>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#C24A1D" }}>
              <span className="text-2xl font-heading font-black text-white">{user.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading font-black text-2xl" style={{ color: "#111827" }}>{user.name}</h1>
                {user.founding_member && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold rounded-full" data-testid="founding-member-badge">
                    ★ Founding Member
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm" style={{ color: "#6B7280" }}>
                <span className="truncate">{user.email}</span>
                {user.city && <span className="flex items-center gap-1 flex-shrink-0"><MapPin className="w-3 h-3" />{user.city}</span>}
              </div>
              <button
                onClick={toggleNotifications}
                disabled={togglingNotif}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-60"
                style={user.email_notifications
                  ? { background: "#F3F4F6", color: "#C24A1D", border: "1px solid #E5E7EB" }
                  : { background: "#FFFFFF", color: "#6B7280", border: "1px solid #E5E7EB" }}
                data-testid="toggle-email-notifications"
                title="Email updates for match scheduling, scores, and league activity"
              >
                {user.email_notifications ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                Match emails: {user.email_notifications ? "on" : "off"}
              </button>
              <button
                onClick={togglePrivacy}
                disabled={togglingPrivacy}
                className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-60"
                style={user.profile_public !== false
                  ? { background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }
                  : { background: "#FFFFFF", color: "#6B7280", border: "1px solid #E5E7EB" }}
                data-testid="toggle-profile-public"
                title="Control who can see your profile and match history"
              >
                {user.profile_public !== false ? "Profile: public" : "Profile: private"}
              </button>
            </div>
            <div className="flex gap-5 sm:gap-4 flex-wrap sm:flex-nowrap">
              <div className="text-center min-w-[48px]">
                <p className="font-heading font-black text-2xl text-tennis">{user.tennis_rating || 3.0}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-tennis mt-0.5">Tennis</p>
              </div>
              <div className="text-center min-w-[48px]">
                <p className="font-heading font-black text-2xl text-cricket">{user.cricket_rating || 50}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-cricket mt-0.5">Cricket</p>
              </div>
              <div className="text-center min-w-[48px]">
                <p className="font-heading font-black text-2xl text-pickleball">{user.pickleball_rating || 3.0}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-pickleball mt-0.5">Pickleball</p>
              </div>
            </div>
          </div>
        </div>

        {/* DUPR Rating */}
        {(user?.sport_preferences?.includes("pickleball") || true) && (
          <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: "1px solid #E5E7EB" }}>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>
                Pickleball Rating (DUPR)
              </label>
              <div className="flex flex-wrap gap-2">
                {["2.0-3.0", "3.0-3.5", "3.5-4.5", "4.5+"].map((bracket) => (
                  <button
                    key={bracket}
                    data-testid={`dupr-bracket-${bracket}`}
                    onClick={() => handleProfileUpdate({ dupr_rating: bracket })}
                    className="px-3 py-1.5 rounded-md text-sm font-medium border transition-colors"
                    style={user?.dupr_rating === bracket
                      ? { background: "#0B6E4F", color: "white", borderColor: "#0B6E4F" }
                      : { background: "white", color: "#374151", borderColor: "#E5E7EB" }}
                  >
                    {bracket}
                  </button>
                ))}
                <button
                  data-testid="dupr-bracket-unknown"
                  onClick={() => handleProfileUpdate({ dupr_rating: null })}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{ border: "1px solid #E5E7EB", color: "#6B7280", background: "white" }}
                >
                  I don't know
                </button>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: "#6B7280" }}>
                Don't know your DUPR?{" "}
                <a href="https://www.dupr.com" target="_blank" rel="noopener noreferrer" style={{ color: "#0B6E4F" }} className="hover:underline">
                  Find it at dupr.com →
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Leagues",       value: leagues.length, icon: Trophy,   color: "#111827", bg: "#FFFFFF",   border: "#E5E7EB" },
            { label: "Wins",          value: wins,           icon: Award,    color: "#7C2D12", bg: "#FAE0D5",   border: "#E5A885" },
            { label: "Losses",        value: losses,         icon: TrendingUp, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
            { label: "Total Matches", value: matches.length, icon: Calendar, color: "#374151", bg: "#F3F4F6",   border: "#E5E7EB" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }} data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <s.icon className="w-5 h-5 mb-3" style={{ color: s.color }} />
              <p className="font-heading font-black text-3xl" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: "#6B7280" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Find a League CTA */}
        <div className="rounded-2xl p-5 mb-6 flex items-center justify-between gap-4" style={{ background: "#FAE0D5", border: "1px solid #E5A885" }}>
          <div>
            <p className="font-heading font-bold text-sm" style={{ color: "#111827" }}>Find your next league.</p>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>Browse by sport, city, and format. New seasons open year-round.</p>
          </div>
          <Link
            to="/join"
            className="flex-shrink-0 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors"
            style={{ background: "#C24A1D" }}
            data-testid="dashboard-find-league-btn"
          >
            Find a League
          </Link>
        </div>

        {/* Pending Doubles Invites */}
        {pendingInvites.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3" style={{ color: "#111827" }}>Pending Doubles Invites</h2>
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div key={invite.token} className="rounded-md p-4 bg-white flex items-center justify-between" style={{ border: "1px solid #E5E7EB" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#111827" }}>{invite.league_name}</p>
                    <p className="text-xs" style={{ color: "#6B7280" }}>
                      Invited {invite.partner_email} · expires {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Awaiting partner</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/doubles-invite/confirm?token=${invite.token}`)}
                      className="text-xs rounded px-2 py-1 transition-colors" style={{ color: "#C24A1D", border: "1px solid #E5A885" }}
                      data-testid={`copy-invite-${invite.token}`}
                    >
                      Copy link
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm("Cancel this invite?")) return;
                        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/doubles-invite/${invite.token}`, {
                          method: "DELETE", credentials: "include",
                        });
                        setPendingInvites(prev => prev.filter(i => i.token !== invite.token));
                      }}
                      className="text-xs text-red-500 border border-red-200 rounded px-2 py-1 hover:bg-red-50"
                      data-testid={`cancel-invite-${invite.token}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* My Leagues */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
            <div className="p-5 flex justify-between items-center" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <h2 className="font-heading font-bold text-lg" style={{ color: "#111827" }}>My Leagues</h2>
              <Link to="/join" className="text-xs font-semibold" style={{ color: "#C24A1D" }}>Find a League</Link>
            </div>
            {leagues.length === 0 ? (
              <div className="text-center py-10">
                <Trophy className="w-8 h-8 mx-auto mb-3" style={{ color: "#E5E7EB" }} />
                <p className="text-sm font-medium mb-1" style={{ color: "#374151" }}>No leagues yet</p>
                <p className="text-xs mb-3" style={{ color: "#6B7280" }}>Join a league to start tracking matches and your rating.</p>
                <Link to="/leagues" className="text-sm font-semibold px-4 py-2 rounded-xl" style={{ color: "#1B2B4B", border: "1px solid #1B2B4B" }} data-testid="browse-leagues-btn">
                  Browse Open Leagues
                </Link>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                {leagues.map((l) => {
                  const sc = SPORT_COLORS[l.sport] || {};
                  return (
                    <div key={l.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className="text-lg">{sc.icon || "🏆"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>
                          {l.name}
                          {l.division_label && (
                            <span className="ml-2 text-xs font-medium" style={{ color: "#C24A1D" }}>
                              {l.division_label}
                              {l.division_ntrp_min ? ` (${l.division_ntrp_min}–${l.division_ntrp_max || "+"}${l.sport === "pickleball" ? " DUPR" : " NTRP"})` : ""}
                            </span>
                          )}
                        </p>
                        <p className="text-xs" style={{ color: "#6B7280" }}>{l.city} • {l.format}</p>
                        {boxStatuses[l.id] && (
                          <div className="mt-1 text-sm" style={{ color: "#374151" }}>
                            Box {boxStatuses[l.id].box_id} · Rank #{boxStatuses[l.id].rank} of {boxStatuses[l.id].total}
                            {boxStatuses[l.id].promotion_status === "promoted" && (
                              <span className="ml-2 text-xs font-semibold" style={{ color: "#C24A1D" }}>Promoted ↑</span>
                            )}
                            {boxStatuses[l.id].promotion_status === "relegated" && (
                              <span className="ml-2 text-xs font-semibold text-red-600">Relegated ↓</span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={
                        l.status === "registration" ? { background: "#FAE0D5", color: "#7C2D12" }
                        : l.status === "active" ? { background: "#EDF7F3", color: "#065F46" }
                        : { background: "#F3F4F6", color: "#6B7280" }
                      }>
                        {l.status === "registration" ? "Open" : l.status === "active" ? "Active" : l.status === "completed" ? "Ended" : l.status}
                      </span>
                      <Link to={`/leagues/${l.id}/standings`} className="text-xs font-medium" style={{ color: "#6B7280" }}>
                        Standings
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ladder Rankings */}
          {ladderEntries.length > 0 && (
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
              <div className="p-5" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <h2 className="font-heading font-bold text-lg" style={{ color: "#111827" }}>Ladder Rankings</h2>
              </div>
              <div className="p-5 space-y-3">
                {ladderEntries.map((entry) => (
                  <div
                    key={entry.ladder_id}
                    data-testid={`ladder-rank-card-${entry.ladder_id}`}
                    className="flex items-center justify-between px-4 py-3 rounded-xl hover:shadow-sm transition-shadow cursor-pointer"
                    style={{ border: "1px solid #E5E7EB" }}
                    onClick={() => navigate(`/ladders/${entry.ladder_id}`)}
                  >
                    <div>
                      <p className="font-semibold" style={{ color: "#111827" }}>
                        {entry.city} · {entry.division_label} {entry.sport.charAt(0).toUpperCase() + entry.sport.slice(1)}
                      </p>
                      <p className="text-sm" style={{ color: "#6B7280" }}>Rank #{entry.rank} of {entry.total}</p>
                    </div>
                    <span className="text-2xl font-bold" style={{ color: "#C24A1D" }}>#{entry.rank}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rating History */}
          <RatingHistoryChart user={user} />

          {/* Schedule a Match */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
            <div className="p-5" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <h2 className="font-heading font-bold text-lg" style={{ color: "#111827" }}>Schedule a Match</h2>
            </div>
            <div className="p-5">
              {leagues.length === 0 ? (
                <p className="text-sm" style={{ color: "#6B7280" }}>Join a league first to schedule matches.</p>
              ) : (
                <form onSubmit={handleSchedule} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Select League</label>
                    <select
                      value={scheduleLeagueId}
                      onChange={(e) => { setScheduleLeagueId(e.target.value); fetchLeaguePlayers(e.target.value); }}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none"
                      style={{ border: "1px solid #E5E7EB", color: "#111827" }}
                      required
                      data-testid="schedule-league-select"
                    >
                      <option value="">Choose a league...</option>
                      {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Opponent</label>
                    <OpponentSearch
                      leagueId={scheduleLeagueId}
                      value={opponent}
                      onSelect={(u) => setOpponent(u?.id || "")}
                      testId="schedule-opponent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Match Date & Time</label>
                    <input
                      type="datetime-local"
                      value={schedDate}
                      onChange={(e) => setSchedDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                      style={{ border: "1px solid #E5E7EB", color: "#111827" }}
                      required
                      data-testid="schedule-date-input"
                    />
                  </div>
                  {schedMsg && (
                    <p className="text-sm px-3 py-2 rounded-xl" style={schedMsg.includes("success") ? { background: "#FAE0D5", color: "#7C2D12" } : { background: "#FEF2F2", color: "#DC2626" }} data-testid="schedule-message">
                      {schedMsg}
                    </p>
                  )}
                  <button type="submit" disabled={scheduling} className="w-full py-2.5 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60" style={{ background: "#1B2B4B" }} data-testid="schedule-submit-btn">
                    {scheduling ? "Scheduling..." : "Schedule Match"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Upcoming Matches */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
            <div className="p-5" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <h2 className="font-heading font-bold text-lg" style={{ color: "#111827" }}>Upcoming Matches ({upcoming.length})</h2>
            </div>
            {upcoming.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm" style={{ color: "#6B7280" }}>No scheduled matches. Use the form below to schedule one.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                {upcoming.slice(0, 5).map((m) => (
                  <div key={m.id} className="px-5 py-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>{m.player1_name} vs {m.player2_name}</p>
                        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "#6B7280" }}>
                          <Clock className="w-3 h-3" /> {new Date(m.scheduled_date).toLocaleString()}
                        </p>
                      </div>
                      <Link
                        to={`/matches/${m.id}/score`}
                        className="text-xs font-semibold text-white px-2.5 py-1 rounded-lg transition-colors"
                        style={{ background: "#1B2B4B" }}
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
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
            <div className="p-5" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <h2 className="font-heading font-bold text-lg" style={{ color: "#111827" }}>Recent Results ({recent.length})</h2>
            </div>
            {recent.length === 0 ? (
              <div className="text-center py-10 text-sm" style={{ color: "#6B7280" }}>No completed matches yet</div>
            ) : (
              <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                {recent.map((m) => {
                  const isWin = m.winner_id === user.id || m.winner_id === user._id;
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={isWin ? { background: "#FAE0D5", color: "#7C2D12" } : { background: "#FEF2F2", color: "#DC2626" }}>
                        {isWin ? "W" : "L"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: "#111827" }}>{m.player1_name} vs {m.player2_name}</p>
                        {m.winner_name && <p className="text-xs" style={{ color: "#6B7280" }}>{m.winner_name} won</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Notification Subscriptions */}
        {interests.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden mt-6" style={{ border: "1px solid #E5E7EB" }}>
            <div className="p-4" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <h2 className="font-heading font-bold text-sm" style={{ color: "#111827" }}>Notification Subscriptions</h2>
              <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>You'll be notified when these leagues open</p>
            </div>
            <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
              {interests.map((interest) => {
                const sportEmoji = { tennis: "🎾", pickleball: "🏓", cricket: "🏏" }[interest.sport] || "🏆";
                return (
                  <div
                    key={interest.id}
                    className="flex items-center justify-between px-4 py-3"
                    data-testid={`interest-row-${interest.id}`}
                  >
                    <span className="text-sm" style={{ color: "#374151" }}>
                      {sportEmoji} {interest.sport.charAt(0).toUpperCase() + interest.sport.slice(1)}
                      {interest.city ? ` — ${interest.city}` : ""}
                    </span>
                    <button
                      onClick={() => removeInterest(interest.unsubscribe_token)}
                      disabled={removingInterest === interest.unsubscribe_token}
                      className="text-xs text-red-500 font-semibold hover:text-red-700 transition disabled:opacity-50"
                      data-testid={`remove-interest-${interest.id}`}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
