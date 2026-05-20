import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { MapPin, Users, Calendar, Trophy, ArrowLeft, CheckCircle, AlertCircle, Clock, TrendingUp } from "lucide-react";
import PaymentMethodModal from "../components/PaymentMethodModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_CONFIG = {
  tennis: { badge: "sport-badge-tennis", color: "text-tennis", accent: "#10B981", icon: "🎾", label: "Tennis" },
  cricket: { badge: "sport-badge-cricket", color: "text-cricket", accent: "#2563EB", icon: "🏏", label: "Cricket" },
  pickleball: { badge: "sport-badge-pickleball", color: "text-pickleball", accent: "#F97316", icon: "🏓", label: "Pickleball" },
};

export default function LeagueDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [league, setLeague] = useState(null);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  // Check for payment session return
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    fetchLeague();
  }, [id]);

  useEffect(() => {
    if (sessionId && user) {
      pollPaymentStatus(sessionId);
    }
  }, [sessionId, user]);

  useEffect(() => {
    if (tab === "players") fetchPlayers();
    if (tab === "matches") fetchMatches();
    if (tab === "standings") fetchStandings();
  }, [tab]);

  // Check if user is already registered when league data loads
  useEffect(() => {
    if (user && league && !isRegistered) {
      checkRegistration();
    }
  }, [user, league]);

  const fetchLeague = async () => {
    try {
      const { data } = await axios.get(`${API}/leagues/${id}`);
      setLeague(data);
    } catch {
      navigate("/leagues");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const { data } = await axios.get(`${API}/leagues/${id}/players`);
      setPlayers(data);
    } catch (e) { console.error(e); }
  };

  const checkRegistration = async () => {
    try {
      const { data } = await axios.get(`${API}/leagues/${id}/players`);
      setPlayers(data);
      const userId = user?.id || user?._id;
      setIsRegistered(data.some((p) => p.player_id === userId));
    } catch (e) { console.error(e); }
  };

  const fetchMatches = async () => {
    try {
      const { data } = await axios.get(`${API}/leagues/${id}/matches`);
      setMatches(data);
    } catch (e) { console.error(e); }
  };

  const fetchStandings = async () => {
    try {
      const { data } = await axios.get(`${API}/leagues/${id}/standings`);
      setStandings(data);
    } catch (e) { console.error(e); }
  };

  const pollPaymentStatus = async (sid, attempts = 0) => {
    if (attempts >= 6) {
      setPaymentStatus({ status: "timeout" });
      return;
    }
    try {
      const { data } = await axios.get(`${API}/payments/status/${sid}`, { withCredentials: true });
      setPaymentStatus(data);
      if (data.payment_status === "paid") {
        setIsRegistered(true);
        setJoinMsg("Payment successful! You have joined the league.");
        fetchLeague();
        return;
      }
      if (data.status === "expired") return;
      setTimeout(() => pollPaymentStatus(sid, attempts + 1), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleJoin = async () => {
    if (!user) { navigate("/auth"); return; }
    setJoining(true);
    setJoinMsg("");
    try {
      const { data } = await axios.post(`${API}/leagues/${id}/join`, { waiver_accepted: waiverAccepted }, { withCredentials: true });
      if (data.requires_payment) {
        // Open payment-method picker (Stripe / Apple Pay / Google Pay / Zelle)
        setPaymentModalOpen(true);
      } else {
        setJoinMsg(data.message || "Joined successfully!");
        setIsRegistered(true);
        fetchLeague();
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setJoinMsg(typeof detail === "string" ? detail : "Failed to join league");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  if (!league) return null;

  const config = SPORT_CONFIG[league.sport] || {};
  const isFree = !league.entry_fee || league.entry_fee === 0;
  const spotsLeft = league.max_players - (league.current_players || 0);
  const fillPct = Math.round(((league.current_players || 0) / league.max_players) * 100);

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "players", label: "Players" },
    { id: "matches", label: "Matches" },
    { id: "standings", label: "Standings" },
  ];

  return (
    <div className="min-h-screen bg-gray-50" data-testid="league-detail-page">
      {/* Header Banner */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button onClick={() => navigate("/leagues")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-5 transition-colors" data-testid="back-to-leagues">
            <ArrowLeft className="w-4 h-4" /> Back to Leagues
          </button>

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${config.badge}`}>
                  {config.icon} {config.label}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${league.status === "registration" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                  {league.status?.charAt(0).toUpperCase() + league.status?.slice(1)}
                </span>
              </div>
              <h1 className="font-heading font-black text-3xl text-gray-900 mb-2">{league.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {league.city}</span>
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {league.start_date} — {league.end_date}</span>
                <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {league.current_players || 0}/{league.max_players} players</span>
              </div>
            </div>

            {/* Join Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 w-full lg:w-auto lg:min-w-[240px]">
              {(league.status === "completed" || league.status === "cancelled") ? (
                <div className="text-center py-4">
                  <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="font-semibold text-gray-600 text-sm">Season Ended</p>
                  <p className="text-xs text-gray-400 mt-1">This league is no longer active.</p>
                </div>
              ) : (
                <>
                  {/* Spots bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{spotsLeft} spots remaining</span>
                      <span>{fillPct}% filled</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-black transition-all" style={{ width: `${fillPct}%` }} />
                    </div>
                  </div>

                  {/* Payment/join status */}
                  {sessionId && !paymentStatus && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 mb-3 justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                      Checking payment...
                    </div>
                  )}

                  {paymentStatus?.payment_status === "paid" && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" /> Payment confirmed!
                    </div>
                  )}

                  {joinMsg && (
                    <div className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2 mb-3 ${joinMsg.includes("success") || joinMsg.includes("joined") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`} data-testid="join-message">
                      {joinMsg.includes("success") || joinMsg.includes("joined") ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {joinMsg}
                    </div>
                  )}

                  {!isRegistered && league.status === "registration" && (
                    <>
                      {/* Waiver checkbox — required for all leagues, free or paid */}
                      <label className="flex items-start gap-2.5 cursor-pointer mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-3" data-testid="waiver-checkbox-label">
                        <input
                          type="checkbox"
                          checked={waiverAccepted}
                          onChange={(e) => setWaiverAccepted(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-black flex-shrink-0"
                          data-testid="waiver-checkbox"
                        />
                        <span className="text-[11px] text-amber-900 leading-relaxed">
                          I have read and agree to the{" "}
                          <a href="/terms#waiver" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-amber-700">
                            Liability Waiver & Assumption of Risk
                          </a>
                          . I understand that matches are unsupervised, courts are player-selected, and I participate at my own risk.
                        </span>
                      </label>
                      <button
                        onClick={handleJoin}
                        disabled={joining || spotsLeft <= 0 || !waiverAccepted}
                        className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60 text-sm"
                        data-testid="join-league-btn"
                      >
                        {joining ? "Processing..." : spotsLeft <= 0 ? "League Full" : isFree ? "Join Free" : "Register Now"}
                      </button>
                    </>
                  )}

                  {isRegistered && (
                    <div className="text-center text-sm font-semibold text-emerald-700">
                      <CheckCircle className="w-5 h-5 mx-auto mb-1" />
                      You're registered!
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-5 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? "border-black text-black" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                data-testid={`tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tab === "overview" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-lg mb-4">League Details</h3>
              <dl className="space-y-3">
                {[
                  ["Sport", `${config.icon} ${config.label}`],
                  ["Format", league.format?.charAt(0).toUpperCase() + league.format?.slice(1)],
                  ["Season", league.season],
                  ["Venue", league.venue || "TBD"],
                  ["City", league.city],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-sm text-gray-500">{k}</dt>
                    <dd className="text-sm font-medium text-gray-900 text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-lg mb-4">About This League</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{league.description || "No description provided."}</p>
              {league.rules && (
                <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Rules</p>
                  <p className="text-sm text-gray-600">{league.rules}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "players" && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-heading font-bold text-lg">Registered Players</h3>
            </div>
            <div className="text-center py-16 px-6">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700 mb-1">Player roster is private</p>
              <p className="text-sm text-gray-500">Roster is not publicly visible.</p>
            </div>
          </div>
        )}

        {tab === "matches" && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-heading font-bold text-lg">Matches ({matches.length})</h3>
              {user && (
                <Link to="/dashboard" className="text-sm font-semibold text-black border border-black px-3 py-1.5 rounded-lg hover:bg-black hover:text-white transition-colors" data-testid="schedule-match-link">
                  Schedule Match
                </Link>
              )}
            </div>
            {matches.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No matches scheduled yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {matches.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.player1_name} vs {m.player2_name}</p>
                      <p className="text-xs text-gray-500">{m.scheduled_date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.status === "completed" && m.winner_name && (
                        <span className="text-xs text-emerald-700 font-medium">{m.winner_name} won</span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${m.status === "completed" ? "bg-gray-100 text-gray-600" : m.status === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                        {m.status}
                      </span>
                      {user && m.status === "scheduled" && (user._id === m.player1_id || user.id === m.player1_id || user._id === m.player2_id || user.id === m.player2_id) && (
                        <Link to={`/matches/${m.id}/score`} className="text-xs font-semibold text-black bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg transition-colors" data-testid={`report-score-${m.id}`}>
                          Report Score
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "standings" && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-heading font-bold text-lg">Standings</h3>
            </div>
            {standings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No standings yet — matches haven't been played</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Player</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">W</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">L</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">MP</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {standings.map((s, i) => (
                      <tr key={i} className={i === 0 ? "bg-yellow-50" : ""}>
                        <td className="px-5 py-3 font-heading font-bold text-gray-400">{i + 1}</td>
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {i === 0 && <Trophy className="inline w-3.5 h-3.5 text-yellow-500 mr-1" />}
                          {s.player_name}
                        </td>
                        <td className="px-3 py-3 text-center text-emerald-700 font-semibold">{s.wins}</td>
                        <td className="px-3 py-3 text-center text-red-600">{s.losses}</td>
                        <td className="px-3 py-3 text-center text-gray-500">{s.matches_played}</td>
                        <td className="px-3 py-3 text-center font-heading font-bold text-gray-900">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <PaymentMethodModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        league={league}
        onSuccess={() => { setIsRegistered(true); fetchLeague(); setJoinMsg("Registration complete!"); }}
      />
    </div>
  );
}
