import { useState, useEffect, Fragment } from "react";
import { useNavigate, Link } from "react-router-dom";
import EmailCampaignsTab from "../components/EmailCampaignsTab";
import AmbassadorsCard from "../components/AmbassadorsCard";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Users, Trophy, Calendar, DollarSign, Plus, Trash2, Edit, BarChart3, Shield, TrendingUp, Zap } from "lucide-react";
import platformConfig, { activeSportIds, activeCountry } from "../config/platformConfig";
import DisputeEscalationPanel from "../components/DisputeEscalationPanel";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

// PHASE-DRIVEN: admin can only create leagues for active sports & country.
// PHASE 2 unlocks Cricket; PHASE 3 unlocks India.
const SPORTS = activeSportIds;
const ALL_FORMATS = {
  tennis: ["singles", "doubles", "mixed", "mixed_doubles"],
  cricket: ["T10", "T20", "8-a-side", "11-a-side"],
  pickleball: ["singles", "doubles", "mixed", "mixed_doubles"],
};
const FORMAT_LABELS = {
  singles: "Singles", doubles: "Doubles", mixed: "Mixed", mixed_doubles: "Mixed Doubles",
  T10: "T10", T20: "T20", "8-a-side": "8-a-side", "11-a-side": "11-a-side",
};
const FORMATS = Object.fromEntries(SPORTS.map((s) => [s, ALL_FORMATS[s]]).filter(([, v]) => v));
const CURRENCIES = { USA: "USD", India: "INR" };

const DIVISION_RANGES = {
  Beginner:     { tennis: [2.5, 3.0], pickleball: [2.0, 3.0] },
  Intermediate: { tennis: [3.5, 4.0], pickleball: [3.0, 3.5] },
  Advanced:     { tennis: [4.0, 4.5], pickleball: [3.5, 4.5] },
  Competitive:  { tennis: [4.5, null], pickleball: [4.5, null] },
};

const DEFAULT_FORM = {
  name: "", sport: SPORTS[0] || "tennis", country: activeCountry, city: "",
  format: (FORMATS[SPORTS[0]] || ["singles"])[0],
  entry_fee: 0, currency: CURRENCIES[activeCountry] || "USD", max_players: 16, min_players_to_start: "",
  start_date: "", end_date: "", description: "", venue: "", season: "Season 1", season_id: "",
  division_label: "", division_ntrp_min: null, division_ntrp_max: null,
  league_type: "flex",
};

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [cities, setCities] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [ladders, setLadders] = useState([]);
  const [ladderForm, setLadderForm] = useState({ city: "", sport: "tennis", division_label: "Intermediate", format: "singles" });
  const [ladderMsg, setLadderMsg] = useState("");
  const [showRRForm, setShowRRForm] = useState(false);
  const [rrFormData, setRRFormData] = useState({
    name: "", sport: "tennis", country: "USA", city: "",
    format: "singles", entry_fee: 0, start_date: "", end_date: "",
    description: "",
    rr_config: { min_players: 6, max_players: 12, division_type: "singles", playoff_threshold: 4 }
  });
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    if (user.role !== "admin") { navigate("/dashboard"); return; }
    fetchStats();
    fetchLeagues();
    fetchCities();
    fetchSeasons();
    fetchLadders();
    fetchUsers();
  }, [user, loading]);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(`${API}/admin/stats`, { withCredentials: true });
      setStats(data);
    } catch (e) { console.error(e); }
  };

  const fetchLeagues = async () => {
    try {
      const { data } = await axios.get(`${API}/admin/leagues`, { withCredentials: true });
      setLeagues(data);
    } catch (e) { console.error(e); }
  };

  const fetchCities = async () => {
    try {
      const { data } = await axios.get(`${API}/cities`);
      setCities(data);
    } catch (e) { console.error(e); }
  };

  const fetchLadders = async () => {
    try {
      const { data } = await axios.get(`${API}/ladders`, { withCredentials: true });
      setLadders(data);
    } catch (e) { console.error(e); }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get(`${API}/admin/users?limit=500`, { withCredentials: true });
      setUsers(data);
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (userId, email) => {
    if (!window.confirm(`Delete user ${email}? This will remove all their data (matches, leagues, ratings).`)) return;
    try {
      await axios.delete(`${API}/admin/users/${userId}`, { withCredentials: true });
      fetchUsers();
      fetchStats();
      alert(`User ${email} deleted successfully`);
    } catch (e) {
      alert(`Failed to delete user: ${e.response?.data?.detail || e.message}`);
    }
  };

  const handleCreateLadder = async () => {
    if (!ladderForm.city || !ladderForm.sport || !ladderForm.division_label) {
      setLadderMsg("City, sport, and division required.");
      return;
    }
    try {
      await axios.post(`${API}/ladders`, ladderForm, { withCredentials: true });
      setLadderMsg("Ladder created.");
      setLadderForm({ city: "", sport: "tennis", division_label: "Intermediate", format: "singles" });
      fetchLadders();
    } catch (err) {
      setLadderMsg(err.response?.data?.detail || "Failed to create ladder");
    }
  };

  const fetchSeasons = async () => {
    try {
      const { data } = await axios.get(`${API}/seasons`, { withCredentials: true });
      setSeasons(data);
    } catch (e) { console.error(e); }
  };

  const update = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => {
      const newF = { ...f, [k]: v };
      if (k === "country") newF.currency = CURRENCIES[v] || "USD";
      if (k === "sport") newF.format = FORMATS[v]?.[0] || "singles";
      return newF;
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMsg("");
    try {
      const payload = {
        ...form,
        entry_fee: Number(form.entry_fee),
        max_players: Number(form.max_players),
        min_players_to_start: form.min_players_to_start ? Number(form.min_players_to_start) : null,
        season_id: form.season_id || null,
      };
      await axios.post(`${API}/leagues`, payload, { withCredentials: true });
      setMsg("League created successfully!");
      setForm(DEFAULT_FORM);
      fetchLeagues();
      fetchStats();
    } catch (err) {
      const d = err.response?.data?.detail;
      setMsg(typeof d === "string" ? d : "Failed to create league");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this league?")) return;
    try {
      await axios.delete(`${API}/admin/leagues/${id}`, { withCredentials: true });
      fetchLeagues();
      fetchStats();
    } catch (e) { alert("Failed to delete league"); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await axios.put(`${API}/admin/leagues/${id}`, { status }, { withCredentials: true });
      fetchLeagues();
    } catch (e) { alert("Failed to update status"); }
  };

  const handleCloseLeague = async (id, name) => {
    if (!window.confirm(`Finalize "${name}"? This awards +2 bonus to players who completed all matches and sets the league to Completed.`)) return;
    try {
      const { data } = await axios.post(`${API}/leagues/${id}/close`, {}, { withCredentials: true });
      alert(`League closed. ${data.players_awarded_bonus} player(s) received the +2 completion bonus.`);
      fetchLeagues();
      fetchStats();
    } catch (e) {
      const d = e.response?.data?.detail;
      alert(typeof d === "string" ? d : "Failed to close league");
    }
  };

  const [adjustLeague, setAdjustLeague] = useState(null);
  const [rulesLeague, setRulesLeague] = useState(null);
  const [startMinLeague, setStartMinLeague] = useState(null);

  const handleOpenToPlay = async (l, regenerate = false) => {
    const call = (body) => axios.post(`${API}/admin/leagues/${l.id}/open-to-play`, { regenerate, ...body }, { withCredentials: true });
    try {
      const { data: pv } = await call({ confirm: false });
      const byes = pv.byes.length ? `\nByes (odd number of players): ${pv.byes.join(", ")}` : "";
      const verb = regenerate ? "Regenerate the schedule for" : "Open to play";
      if (!window.confirm(`${verb} "${l.name}"?\n\n${pv.players} players or teams, ${pv.rounds} matches each, ${pv.matches} matches in total, opponents of a similar rating drawn at random with no repeats, Home and Away balanced.${byes}\n\nEvery player is emailed their opponents. Continue?`)) return;
      const { data } = await call({ confirm: true });
      alert(`${data.created} matches created. Players have been emailed their opponents.`);
      fetchLeagues();
    } catch (e) {
      const d = e.response?.data?.detail;
      alert(typeof d === "string" ? d : "Could not open the league to play");
    }
  };

  const handleAssignBoxes = async (leagueId) => {
    try {
      const { data } = await axios.post(`${API}/box-leagues/${leagueId}/assign-boxes`, {}, { withCredentials: true });
      setMsg(`Boxes assigned: ${data.boxes.map(b => `Box ${b.box_id} (${b.player_count} players)`).join(", ")}`);
      fetchLeagues();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Failed to assign boxes");
    }
  };

  const handleFinalizeSeason = async (leagueId) => {
    if (!window.confirm("Finalize this season? This will set promotion/relegation for all players and send emails.")) return;
    try {
      const { data } = await axios.post(`${API}/box-leagues/${leagueId}/finalize`, {}, { withCredentials: true });
      setMsg(`Season finalized. Promoted: ${data.promoted.length}, Relegated: ${data.relegated.length}`);
      fetchLeagues();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Failed to finalize");
    }
  };

  if (!user || user.role !== "admin") return null;

  const STAT_CARDS = stats ? [
    { label: "Total Users", value: stats.total_users, icon: Users, color: "#374151", bg: "#F3F4F6", border: "#E5E7EB" },
    { label: "Total Leagues", value: stats.total_leagues, icon: Trophy, color: "#B7791F", bg: "#FFEDD5", border: "#E5A885" },
    { label: "Total Matches", value: stats.total_matches, icon: Calendar, color: "#3D3D3D", bg: "#FFFFFF", border: "#E5E7EB" },
    { label: "Revenue (USD)", value: `$${stats.total_revenue?.toFixed(2) || "0.00"}`, icon: DollarSign, color: "#3D3D3D", bg: "#EDF7F3", border: "#0B6E4F" },
  ] : [];

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "create", label: "Create League" },
    { id: "auto", label: "Auto-Generate" },
    { id: "leagues", label: "Manage Leagues" },
    { id: "ladders", label: "Ladders" },
    { id: "seasons", label: "Seasons" },
    { id: "playoffs", label: "Playoffs" },
    { id: "disputes", label: "Disputes" },
    { id: "zelle", label: "Zelle Queue" },
    { id: "referrals", label: "Referrals" },
    { id: "marketing", label: "Marketing" },
    { id: "email", label: "Email" },
    { id: "flags", label: "Feature Flags" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }} data-testid="admin-dashboard">
      <div className="bg-white" style={{ borderBottom: "1px solid #E5E7EB" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#F2A922" }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-2xl" style={{ color: "#3D3D3D" }}>Admin Dashboard</h1>
              <p className="text-sm" style={{ color: "#6B7280" }}>Manage leagues, players, and platform analytics</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-x-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 sm:px-5 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${tab === t.id ? "border-orange-500 text-orange-600" : "border-transparent hover:text-gray-500"}`}
                style={tab === t.id ? { color: "#B7791F", borderColor: "#F2A922" } : { color: "#6B7280" }}
                data-testid={`admin-tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STAT_CARDS.map((s) => (
                <div key={s.label} className="rounded-none p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }} data-testid={`admin-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <s.icon className="w-5 h-5 mb-3" style={{ color: s.color }} />
                  <p className="font-heading font-bold text-3xl" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-1" style={{ color: "#6B7280" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {stats && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-none p-6" style={{ border: "1px solid #E5E7EB" }}>
                  <h3 className="font-heading font-bold text-lg mb-4" style={{ color: "#3D3D3D" }}>Sport Breakdown</h3>
                  {Object.entries(stats.sport_breakdown || {}).map(([sport, count]) => (
                    <div key={sport} className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-medium w-20 capitalize" style={{ color: "#374151" }}>{sport}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                        <div
                          className={`h-full rounded-full ${sport === "tennis" ? "bg-tennis" : sport === "cricket" ? "bg-cricket" : "bg-pickleball"}`}
                          style={{ width: `${Math.min((count / stats.total_leagues) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold w-6" style={{ color: "#3D3D3D" }}>{count}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-none p-6" style={{ border: "1px solid #E5E7EB" }}>
                  <h3 className="font-heading font-bold text-lg mb-4" style={{ color: "#3D3D3D" }}>Country Breakdown</h3>
                  {Object.entries(stats.country_breakdown || {}).map(([country, count]) => (
                    <div key={country} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <span className="text-sm font-medium" style={{ color: "#374151" }}>{country === "USA" ? "🇺🇸 USA" : "🇮🇳 India"}</span>
                      <span className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div>
            <div className="mb-6">
              <div className="rounded-none p-6 bg-white" style={{ border: "1px solid #E5E7EB" }}>
                <h2 className="font-heading font-bold text-2xl mb-2" style={{ color: "#3D3D3D" }}>Registered Users</h2>
                <p className="text-sm" style={{ color: "#6B7280" }}>Total: <span className="font-bold" style={{ color: "#3D3D3D" }}>{users.length}</span></p>
              </div>
            </div>
            {users && users.length > 0 ? (
              <div className="rounded-none overflow-hidden bg-white" style={{ border: "1px solid #E5E7EB" }}>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "#374151" }}>Email</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "#374151" }}>Name</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "#374151" }}>Country</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "#374151" }}>Joined</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "#374151" }}>Role</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: "#374151" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u._id} style={{ borderBottom: i < users.length - 1 ? "1px solid #F3F4F6" : "none" }} data-testid="user-row">
                          <td className="px-6 py-4 text-sm" style={{ color: "#3D3D3D" }}>{u.email}</td>
                          <td className="px-6 py-4 text-sm" style={{ color: "#3D3D3D" }}>{u.full_name || "—"}</td>
                          <td className="px-6 py-4 text-sm" style={{ color: "#3D3D3D" }}>{u.country || "—"}</td>
                          <td className="px-6 py-4 text-sm" style={{ color: "#6B7280" }}>
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-orange-100" : "bg-gray-100"}`} style={{ color: u.role === "admin" ? "#6B21A8" : "#374151" }}>
                              {u.role || "user"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleDeleteUser(u._id || u.id, u.email)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              data-testid={`delete-user-${u.email}`}
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-none p-12 bg-white text-center" style={{ border: "1px solid #E5E7EB" }}>
                <p style={{ color: "#6B7280" }}>No users found</p>
              </div>
            )}
          </div>
        )}

        {/* Create League Tab */}
        {tab === "create" && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-none p-6" style={{ border: "1px solid #E5E7EB" }}>
              <h2 className="font-heading font-bold text-xl mb-6" style={{ color: "#3D3D3D" }}>Create New League</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>League Name *</label>
                    <input type="text" value={form.name} onChange={update("name")} placeholder="e.g. NYC Tennis Open S1" className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} required data-testid="create-league-name" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Sport *</label>
                    <select value={form.sport} onChange={update("sport")} className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} data-testid="create-league-sport">
                      {SPORTS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Format *</label>
                    <select value={form.format} onChange={update("format")} className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} data-testid="create-league-format">
                      {(FORMATS[form.sport] || []).map((f) => <option key={f} value={f}>{FORMAT_LABELS[f] ?? f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Division (optional)</label>
                    <select
                      data-testid="admin-division-select"
                      value={form.division_label}
                      onChange={(e) => {
                        const label = e.target.value;
                        const sport = form.sport;
                        const ranges = label && DIVISION_RANGES[label] ? DIVISION_RANGES[label][sport] || [] : [];
                        setForm((f) => ({
                          ...f,
                          division_label: label,
                          division_ntrp_min: ranges[0] ?? null,
                          division_ntrp_max: ranges[1] ?? null,
                        }));
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
                    >
                      <option value="">Open Division (no skill gate)</option>
                      <option value="Beginner">Beginner (2.5–3.0 NTRP / 2.0–3.0 DUPR)</option>
                      <option value="Intermediate">Intermediate (3.5–4.0 NTRP / 3.0–3.5 DUPR)</option>
                      <option value="Advanced">Advanced (4.0–4.5 NTRP / 3.5–4.5 DUPR)</option>
                      <option value="Competitive">Competitive (4.5+ NTRP / 4.5+ DUPR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">League Type</label>
                    <select
                      data-testid="admin-league-type-select"
                      value={form.league_type || "flex"}
                      onChange={(e) => setForm((f) => ({ ...f, league_type: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="flex">Flex (self-scheduled)</option>
                      <option value="round_robin">Round Robin</option>
                      <option value="box_league">Box League (promotion/relegation)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Country *</label>
                    <select value={form.country} onChange={update("country")} className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} data-testid="create-league-country">
                      {activeCountry === "USA" && <option value="USA">🇺🇸 USA</option>}
                      {activeCountry === "India" && <option value="India">🇮🇳 India</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>City *</label>
                    <input type="text" value={form.city} onChange={update("city")} placeholder="Any city — e.g. Austin, Boise, or All Cities" className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} required data-testid="create-league-city" list="cities-list" />
                    <datalist id="cities-list">
                      <option value="All Cities" />
                      {cities.filter((c) => c.country === form.country).map((c) => <option key={c.name} value={c.name} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Entry Fee ({form.currency})</label>
                    <input type="number" min="0" step="0.01" value={form.entry_fee} onChange={update("entry_fee")} className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} data-testid="create-league-fee" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Max Players</label>
                    <input type="number" min="2" max="100" value={form.max_players} onChange={update("max_players")} className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} data-testid="create-league-max-players" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Minimum to start (optional)</label>
                    <input type="number" min="2" max="100" value={form.min_players_to_start} onChange={update("min_players_to_start")} placeholder="e.g. 8" className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} data-testid="create-league-min-players" />
                    <p className="text-xs mt-1" style={{ color: "#5C5C5C" }}>Players see "Starts when N players have joined" (no counts). Leave empty to show nothing.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Start Date *</label>
                    <input type="date" value={form.start_date} onChange={update("start_date")} className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} required data-testid="create-league-start" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>End Date *</label>
                    <input type="date" value={form.end_date} onChange={update("end_date")} className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} required data-testid="create-league-end" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Season</label>
                    <select value={form.season_id || ""} onChange={update("season_id")} className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} data-testid="create-league-season">
                      <option value="">— None —</option>
                      {seasons.filter((s) => s.sport === form.sport).map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Optional — link this league to a season for grouping.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Venue</label>
                    <input type="text" value={form.venue} onChange={update("venue")} placeholder="e.g. Central Park Tennis Center" className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }} data-testid="create-league-venue" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Description</label>
                    <textarea value={form.description} onChange={update("description")} rows={3} placeholder="Describe the league..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" data-testid="create-league-description" />
                  </div>
                </div>

                {msg && (
                  <div className="px-4 py-3 rounded-xl text-sm" style={msg.includes("success") ? { background: "#FFEDD5", color: "#B7791F", border: "1px solid #E5A885" } : { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }} data-testid="create-league-message">
                    {msg}
                  </div>
                )}

                <button type="submit" disabled={creating} className="w-full py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm" style={{ background: "#008F70" }} data-testid="create-league-submit">
                  {creating ? "Creating..." : "Create League"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Manage Leagues Tab */}
        {tab === "leagues" && <IncompleteTeamsCard />}
        {tab === "leagues" && (
          <div className="bg-white rounded-none overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
            <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <h2 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>All Leagues ({leagues.length})</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <button
                  data-testid="btn-create-rr-league"
                  onClick={() => setShowRRForm(true)}
                  className="px-4 py-2 rounded-md text-sm font-medium transition"
                  style={{ border: "1px solid #E5E7EB", color: "#B7791F" }}
                >
                  + Create Round Robin League
                </button>
                <button onClick={() => setTab("create")} className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors" style={{ background: "#008F70" }} data-testid="add-league-btn">
                  <Plus className="w-4 h-4" /> Add League
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#FFFFFF", borderBottom: "1px solid #F3F4F6" }}>
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>League</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Sport</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>City</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Players</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Fee</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                  {leagues.map((l) => (
                    <tr key={l.id} style={{ background: "white" }} onMouseEnter={e => e.currentTarget.style.background = "#FFFFFF"} onMouseLeave={e => e.currentTarget.style.background = "white"}>
                      <td className="px-5 py-3 font-medium max-w-[200px] truncate" style={{ color: "#3D3D3D" }}>{l.name}</td>
                      <td className="px-5 py-3 capitalize" style={{ color: "#374151" }}>{l.sport}</td>
                      <td className="px-5 py-3" style={{ color: "#374151" }}>{l.city}</td>
                      <td className="px-5 py-3" style={{ color: "#374151" }}>{l.current_players || 0}/{l.max_players}</td>
                      <td className="px-5 py-3" style={{ color: "#374151" }}>{!l.entry_fee ? "Free" : `${l.currency === "INR" ? "₹" : "$"}${l.entry_fee}`}</td>
                      <td className="px-5 py-3">
                        <select
                          value={l.status}
                          onChange={(e) => handleStatusChange(l.id, e.target.value)}
                          className="text-xs px-2 py-1 rounded-lg bg-white focus:outline-none"
                          style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
                          data-testid={`league-status-${l.id}`}
                        >
                          <option value="registration">Registration</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/leagues/${l.id}`} className="text-xs hover:underline" style={{ color: "#B7791F" }}>View</Link>
                          {(l.status === "registration" || (l.status === "active" && !l.matches_per_player)) && (l.league_type || "flex") === "flex" && (
                            <button
                              onClick={() => handleOpenToPlay(l)}
                              className="text-xs font-bold" style={{ color: "#008F70" }}
                              data-testid={`open-to-play-${l.id}`}
                              title="Generate every player's matches and open the league to play"
                            >
                              Open to Play
                            </button>
                          )}
                          {l.status === "active" && l.matches_per_player && (l.league_type || "flex") === "flex" && (
                            <>
                              <button
                                onClick={() => handleOpenToPlay(l, true)}
                                className="text-xs font-bold" style={{ color: "#008F70" }}
                                data-testid={`regenerate-${l.id}`}
                                title="Draw a new schedule (only until a match is scheduled or played)"
                              >
                                Regenerate
                              </button>
                              <button
                                onClick={() => setAdjustLeague(l)}
                                className="text-xs font-bold" style={{ color: "#008F70" }}
                                data-testid={`adjust-${l.id}`}
                                title="Change opponents or Home/Away on individual matches"
                              >
                                Adjust
                              </button>
                            </>
                          )}
                          {l.status !== "completed" && (l.league_type || "flex") === "flex" && (
                            <button
                              onClick={() => setRulesLeague(l)}
                              className="text-xs font-bold" style={{ color: "#008F70" }}
                              data-testid={`playoff-rules-${l.id}`}
                              title="Who qualifies for the playoffs"
                            >
                              Playoff rules
                            </button>
                          )}
                          {l.status === "registration" && (
                            <button
                              onClick={() => setStartMinLeague(l)}
                              className="text-xs font-bold" style={{ color: "#008F70" }}
                              data-testid={`start-min-${l.id}`}
                              title='Shows players "Starts when N players have joined"'
                            >
                              Start minimum{l.min_players_to_start ? ` (${l.min_players_to_start})` : ""}
                            </button>
                          )}
                          {l.status !== "completed" && (
                            <button
                              onClick={() => handleCloseLeague(l.id, l.name)}
                              className="text-xs font-medium" style={{ color: "#3D3D3D" }}
                              data-testid={`close-league-${l.id}`}
                              title="Finalize season — awards +2 completion bonus"
                            >
                              Finalize
                            </button>
                          )}
                          <button onClick={() => handleDelete(l.id)} className="text-xs text-red-500 hover:text-red-700" data-testid={`delete-league-${l.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {l.league_type === "box_league" && (
                          <div className="flex gap-2 mt-2">
                            <button
                              data-testid={`assign-boxes-${l.id}`}
                              onClick={() => handleAssignBoxes(l.id)}
                              className="px-3 py-1.5 text-xs font-medium text-white rounded-md"
                              style={{ background: "#0B6E4F" }}
                            >
                              Assign Boxes
                            </button>
                            <button
                              data-testid={`finalize-season-${l.id}`}
                              onClick={() => handleFinalizeSeason(l.id)}
                              className="px-3 py-1.5 text-xs font-medium text-white rounded-md"
                              style={{ background: "#008F70" }}
                            >
                              Finalize Season
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leagues.length === 0 && (
                <div className="text-center py-12" style={{ color: "#6B7280" }}>No leagues yet. Create one!</div>
              )}
            </div>
          </div>
        )}

        {tab === "ladders" && (
          <div className="space-y-6">
            <div className="bg-white rounded-none p-6" style={{ border: "1px solid #E5E7EB" }}>
              <h3 className="font-heading font-bold text-lg mb-4" style={{ color: "#3D3D3D" }}>Create Challenge Ladder</h3>
              {ladderMsg && (
                <div className="mb-4 text-sm px-3 py-2 rounded-lg" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", color: "#374151" }} data-testid="ladder-msg">{ladderMsg}</div>
              )}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>City</label>
                  <select
                    data-testid="ladder-city-select"
                    value={ladderForm.city}
                    onChange={(e) => setLadderForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full rounded-md px-3 py-2 text-sm bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
                  >
                    <option value="">Select city</option>
                    {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Sport</label>
                  <select
                    data-testid="ladder-sport-select"
                    value={ladderForm.sport}
                    onChange={(e) => setLadderForm((f) => ({ ...f, sport: e.target.value }))}
                    className="w-full rounded-md px-3 py-2 text-sm bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
                  >
                    {SPORTS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Division</label>
                  <select
                    data-testid="ladder-division-select"
                    value={ladderForm.division_label}
                    onChange={(e) => setLadderForm((f) => ({ ...f, division_label: e.target.value }))}
                    className="w-full rounded-md px-3 py-2 text-sm bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
                  >
                    {["Beginner", "Intermediate", "Advanced", "Competitive"].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>Format</label>
                  <select
                    data-testid="ladder-format-select"
                    value={ladderForm.format}
                    onChange={(e) => setLadderForm((f) => ({ ...f, format: e.target.value }))}
                    className="w-full rounded-md px-3 py-2 text-sm bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
                  >
                    <option value="singles">Singles</option>
                    <option value="doubles">Doubles</option>
                  </select>
                </div>
              </div>
              <button
                data-testid="create-ladder-btn"
                onClick={handleCreateLadder}
                className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors"
                style={{ background: "#008F70" }}
              >
                <Plus className="w-4 h-4" /> Create Ladder
              </button>
            </div>

            <div className="bg-white rounded-none overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
              <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <h3 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Existing Ladders</h3>
                <span className="text-sm" style={{ color: "#6B7280" }}>{ladders.length} total</span>
              </div>
              {ladders.length === 0 ? (
                <div className="text-center py-12 text-sm" style={{ color: "#6B7280" }}>No ladders yet — create one above</div>
              ) : (
                <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                  {ladders.map((l) => (
                    <div key={l.id} className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium" style={{ color: "#3D3D3D" }}>{l.city} — {l.division_label} {l.sport.charAt(0).toUpperCase() + l.sport.slice(1)} ({l.format})</p>
                        <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{l.entry_count ?? 0} players</p>
                      </div>
                      <a
                        href={`/ladders/${l.id}`}
                        className="text-xs font-semibold hover:underline"
                        style={{ color: "#B7791F" }}
                        data-testid={`admin-ladder-view-${l.id}`}
                      >
                        View →
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "seasons" && <SeasonsTab />}
        {tab === "playoffs" && <PlayoffsTab leagues={leagues} />}
        {tab === "auto" && <AutoGenerateTab onSuccess={() => { fetchLeagues(); fetchStats(); }} />}
        {tab === "disputes" && (
          <div className="py-8">
            <div className="max-w-5xl">
              <DisputeEscalationPanel isOrganizerView={true} />
            </div>
          </div>
        )}
        {tab === "zelle" && <ZelleQueueTab />}
        {tab === "referrals" && <ReferralsTab />}
        {tab === "flags" && <FlagsTab />}
        {tab === "marketing" && <MarketingTab />}
        {tab === "email" && <EmailCampaignsTab />}
        {adjustLeague && <AdjustScheduleModal league={adjustLeague} onClose={() => setAdjustLeague(null)} />}
        {startMinLeague && <StartMinimumModal league={startMinLeague} onClose={() => setStartMinLeague(null)} onSaved={() => { setStartMinLeague(null); window.location.reload(); }} />}
        {rulesLeague && <PlayoffRulesModal league={rulesLeague} onClose={() => setRulesLeague(null)} onSaved={() => { setRulesLeague(null); window.location.reload(); }} />}
      </div>

      {showRRForm && (
        <div
          className="fixed inset-0 bg-[#3D3D3D]/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rr-modal-title"
        >
          <div className="bg-white rounded-none p-6 max-w-lg w-full my-8 overscroll-contain" style={{ border: "1px solid #E5E7EB" }}>
            <h2 id="rr-modal-title" className="font-bold text-lg mb-4" style={{ color: "#3D3D3D" }}>Create Round Robin League</h2>
            <div className="space-y-4">
              {[
                { label: "Name", field: "name", type: "text" },
                { label: "City", field: "city", type: "text" },
                { label: "Entry Fee ($)", field: "entry_fee", type: "number" },
                { label: "Start Date", field: "start_date", type: "date" },
                { label: "End Date", field: "end_date", type: "date" },
                { label: "Description", field: "description", type: "text" },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>{label}</label>
                  <input
                    data-testid={`rr-form-${field}`}
                    type={type}
                    value={rrFormData[field]}
                    onChange={e => setRRFormData(d => ({ ...d, [field]: e.target.value }))}
                    className="w-full rounded-md px-3 py-2 text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>Sport</label>
                <select
                  data-testid="rr-form-sport"
                  value={rrFormData.sport}
                  onChange={e => setRRFormData(d => ({ ...d, sport: e.target.value }))}
                  className="w-full rounded-md px-3 py-2 text-sm bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
                >
                  <option value="tennis">Tennis</option>
                  <option value="pickleball">Pickleball</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>Division Type</label>
                <select
                  data-testid="rr-form-division"
                  value={rrFormData.rr_config.division_type}
                  onChange={e => setRRFormData(d => ({
                    ...d,
                    format: e.target.value,
                    rr_config: { ...d.rr_config, division_type: e.target.value }
                  }))}
                  className="w-full rounded-md px-3 py-2 text-sm bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
                >
                  <option value="singles">Singles</option>
                  <option value="doubles">Fixed-Partner Doubles</option>
                </select>
              </div>
              {[
                { label: "Min Players", field: "min_players" },
                { label: "Max Players", field: "max_players" },
                { label: "Playoff Qualifiers (top N)", field: "playoff_threshold" },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>{label}</label>
                  <input
                    data-testid={`rr-form-${field}`}
                    type="number"
                    value={rrFormData.rr_config[field]}
                    onChange={e => setRRFormData(d => ({
                      ...d,
                      rr_config: { ...d.rr_config, [field]: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-full rounded-md px-3 py-2 text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                data-testid="btn-submit-rr-league"
                onClick={async () => {
                  try {
                    await axios.post(`${API}/round-robin`, rrFormData, { withCredentials: true });
                    setShowRRForm(false);
                    setRRFormData({
                      name: "", sport: "tennis", country: "USA", city: "",
                      format: "singles", entry_fee: 0, start_date: "", end_date: "",
                      description: "",
                      rr_config: { min_players: 6, max_players: 12, division_type: "singles", playoff_threshold: 4 }
                    });
                  } catch (e) {
                    alert(e.response?.data?.detail || "Failed to create league");
                  }
                }}
                className="flex-1 text-white rounded-md py-2 text-sm font-bold transition" style={{ background: "#008F70" }}
              >
                Create League
              </button>
              <button
                onClick={() => setShowRRForm(false)}
                className="flex-1 rounded-md py-2 text-sm font-medium transition" style={{ border: "1px solid #E5E7EB", color: "#374151" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────── Seasons Tab ───────────
function SeasonsTab() {
  const [seasons, setSeasons] = useState([]);
  const [form, setForm] = useState({ name: "", sport: activeSportIds[0] || "tennis", start_date: "", end_date: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchSeasons = async () => {
    try {
      const { data } = await axios.get(`${API}/seasons`, { withCredentials: true });
      setSeasons(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchSeasons(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await axios.post(`${API}/seasons`, form, { withCredentials: true });
      setMsg("Season created!");
      setForm({ name: "", sport: activeSportIds[0] || "tennis", start_date: "", end_date: "" });
      fetchSeasons();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Failed to create season");
    } finally { setBusy(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/seasons/${id}`, { status }, { withCredentials: true });
      fetchSeasons();
    } catch (e) { console.error(e); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this season?")) return;
    try {
      await axios.delete(`${API}/seasons/${id}`, { withCredentials: true });
      fetchSeasons();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6" data-testid="seasons-tab">
      <div className="bg-white rounded-none p-6" style={{ border: "1px solid #E5E7EB" }}>
        <h3 className="font-heading font-bold text-lg mb-4">Create Season</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            type="text" required value={form.name} placeholder="e.g. Summer 2026"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
            aria-label="Season name"
            data-testid="season-name-input"
          />
          <select
            value={form.sport} onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
            data-testid="season-sport-select"
          >
            {activeSportIds.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date" required value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              className="px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
              aria-label="Season start date"
              data-testid="season-start-input"
            />
            <input
              type="date" required value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              className="px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
              aria-label="Season end date"
              data-testid="season-end-input"
            />
          </div>
          {msg && (
            <div className="text-sm px-3 py-2 rounded-lg" style={msg.includes("!") ? { background: "#FFEDD5", color: "#B7791F" } : { background: "#FEF2F2", color: "#DC2626" }} data-testid="season-message">
              {msg}
            </div>
          )}
          <button type="submit" disabled={busy} className="w-full py-2.5 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60" style={{ background: "#008F70" }} data-testid="season-submit-btn">
            {busy ? "Creating..." : "Create Season"}
          </button>
        </form>
      </div>
      <div className="bg-white rounded-none p-6" style={{ border: "1px solid #E5E7EB" }}>
        <h3 className="font-heading font-bold text-lg mb-4">Seasons ({seasons.length})</h3>
        {seasons.length === 0 ? (
          <p className="text-sm text-gray-500">No seasons yet.</p>
        ) : (
          <div className="space-y-3">
            {seasons.map((s) => (
              <div key={s.id} className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ border: "1px solid #F3F4F6" }} data-testid={`season-row-${s.id}`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-heading-dark truncate">{s.name} <span className="text-xs text-gray-400 font-normal capitalize ml-1">({s.sport})</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.start_date} → {s.end_date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={s.status} onChange={(e) => updateStatus(s.id, e.target.value)}
                    className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white"
                    data-testid={`season-status-${s.id}`}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button onClick={() => remove(s.id)} className="text-xs text-red-500 hover:text-red-700" data-testid={`season-delete-${s.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────── Playoffs Tab ───────────
function PlayoffsTab({ leagues }) {
  const [leagueId, setLeagueId] = useState("");
  const [topN, setTopN] = useState(4);
  const [date, setDate] = useState("");
  const [bracket, setBracket] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const loadBracket = async (lid) => {
    if (!lid) { setBracket(null); return; }
    try {
      const { data } = await axios.get(`${API}/playoffs/${lid}`);
      setBracket(data);
    } catch { setBracket(null); }
  };

  useEffect(() => { loadBracket(leagueId); }, [leagueId]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await axios.post(
        `${API}/playoffs`,
        { league_id: leagueId, top_n: Number(topN), first_round_date: date },
        { withCredentials: true },
      );
      setMsg("Bracket generated!");
      loadBracket(leagueId);
    } catch (err) {
      setMsg(err.response?.data?.detail || "Failed to generate bracket");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6" data-testid="playoffs-tab">
      <div className="bg-white rounded-none p-6" style={{ border: "1px solid #E5E7EB" }}>
        <h3 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-500" /> Generate Playoff Bracket
        </h3>
        <form onSubmit={handleGenerate} className="space-y-3">
          <select
            required value={leagueId} onChange={(e) => setLeagueId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
            data-testid="playoff-league-select"
          >
            <option value="">Choose a league...</option>
            {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select
            value={topN} onChange={(e) => setTopN(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
            data-testid="playoff-top-n"
          >
            <option value={2}>Top 2 — Final only</option>
            <option value={4}>Top 4 — Semis + Final</option>
            <option value={8}>Top 8 — Quarters + Semis + Final</option>
            <option value={16}>Top 16 — Round of 16 onwards</option>
          </select>
          <input
            type="date" required value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none bg-white" style={{ border: "1px solid #E5E7EB", color: "#3D3D3D" }}
            data-testid="playoff-date-input"
          />
          {msg && (
            <div className="text-sm px-3 py-2 rounded-lg" style={msg.includes("!") ? { background: "#FFEDD5", color: "#B7791F" } : { background: "#FEF2F2", color: "#DC2626" }} data-testid="playoff-message">
              {msg}
            </div>
          )}
          <button type="submit" disabled={busy} className="w-full py-2.5 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60" style={{ background: "#008F70" }} data-testid="playoff-submit-btn">
            {busy ? "Generating..." : "Generate Bracket"}
          </button>
          <p className="text-xs text-gray-500">Requires at least N players with recorded match results in the league's standings.</p>
        </form>
      </div>
      <div className="bg-white rounded-none p-6" style={{ border: "1px solid #E5E7EB" }}>
        <h3 className="font-heading font-bold text-lg mb-4">Bracket Preview</h3>
        {!bracket || !bracket.rounds?.length ? (
          <p className="text-sm text-gray-500">Select a league with an existing bracket to preview.</p>
        ) : (
          <div className="space-y-5" data-testid="bracket-preview">
            {bracket.rounds.map((r) => (
              <div key={r.round}>
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2">Round {r.round}</p>
                <div className="space-y-2">
                  {r.matches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ border: "1px solid #F3F4F6" }} data-testid={`bracket-match-${m.id}`}>
                      <span className={m.winner_id === m.player1_id ? "font-semibold text-emerald-600" : "text-gray-700"}>{m.player1_name}</span>
                      <span className="text-xs text-gray-400">vs</span>
                      <span className={m.winner_id === m.player2_id ? "font-semibold text-emerald-600" : "text-gray-700"}>{m.player2_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────── Auto-Generate Leagues Tab ───────────
function AutoGenerateTab({ onSuccess }) {
  const [cadence, setCadence] = useState("all");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const { data } = await axios.post(
        `${API}/admin/auto/leagues`,
        { cadence },
        { withCredentials: true },
      );
      setResult(data);
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.detail || "Auto-generate failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6" data-testid="auto-generate-tab">
      <div className="bg-white rounded-none p-6" style={{ border: "1px solid #E5E7EB" }}>
        <h3 className="font-heading font-bold text-lg mb-2">Auto-Generate Leagues</h3>
        <p className="text-sm text-gray-500 mb-5">
          Spin up the next cycle of leagues for every active sport &amp; format. Each generated
          league is open to players from <strong>any USA city</strong> with standardized pricing
          (<strong>$9.99 singles</strong> / <strong>$19.99 doubles (per team)</strong>). Re-running is safe — duplicates are skipped.
        </p>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#374151" }}>Cadence</label>
        <select
          value={cadence}
          onChange={(e) => setCadence(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black mb-4"
          data-testid="auto-cadence-select"
        >
          <option value="all">All Cadences (Monthly + Quarterly + Half-Yearly + Yearly)</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="half_yearly">Half-Yearly</option>
          <option value="yearly">Yearly</option>
        </select>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy}
          className="w-full py-3 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60" style={{ background: "#008F70" }}
          data-testid="auto-generate-btn"
        >
          {busy ? "Generating..." : "Generate Leagues"}
        </button>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg" data-testid="auto-error">
            {error}
          </div>
        )}
      </div>
      <div className="bg-white rounded-none p-6" style={{ border: "1px solid #E5E7EB" }}>
        <h3 className="font-heading font-bold text-lg mb-4">Last Run</h3>
        {!result ? (
          <p className="text-sm text-gray-500">Run the generator to see what was created.</p>
        ) : (
          <div data-testid="auto-result">
            <p className="text-sm font-medium text-heading-dark mb-3">{result.message}</p>
            {result.created?.length > 0 && (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {result.created.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <span className="font-medium text-emerald-900 truncate">{c.name}</span>
                    <span className="font-mono text-emerald-700 ml-2">${c.fee.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            {result.skipped?.length > 0 && (
              <p className="text-xs text-gray-400 mt-3">{result.skipped.length} already exist (skipped)</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────── Zelle Queue Tab ───────────
function ZelleQueueTab() {
  const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);
  const [msg, setMsg] = useState("");

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/zelle/pending`, { withCredentials: true });
      setQueue(data);
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  const act = async (sessionId, action) => {
    setActioning(sessionId);
    setMsg("");
    try {
      const { data } = await axios.post(`${API}/admin/zelle/${sessionId}/${action}`, {}, { withCredentials: true });
      setMsg(data.message);
      fetchQueue();
    } catch (err) {
      setMsg(err.response?.data?.detail || `${action} failed`);
    } finally {
      setActioning(null);
    }
  };

  if (loading) return <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>;

  return (
    <div className="space-y-4" data-testid="zelle-queue-tab">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-xl">Zelle Approval Queue</h2>
          <p className="text-sm text-gray-500 mt-1">
            Verify each Zelle deposit in your bank app, then approve or reject.
          </p>
        </div>
        <button onClick={fetchQueue} className="text-xs text-gray-500 hover:text-gray-700 underline" data-testid="zelle-refresh-btn">
          Refresh
        </button>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-3 rounded-xl border ${msg.toLowerCase().includes("reject") ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          {msg}
        </div>
      )}

      {queue.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-none p-8 text-center text-sm text-gray-500">
          No pending Zelle payments.
        </div>
      ) : (
        <div className="bg-white rounded-none overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Player", "League", "Amount", "Memo", "Reference #", "Submitted", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {queue.map((txn) => (
                <tr key={txn.session_id} className="hover:bg-gray-50" data-testid={`zelle-row-${txn.session_id}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-heading-dark">{txn.user_email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{txn.league_name}</td>
                  <td className="px-4 py-3 font-semibold text-heading-dark">${Number(txn.amount).toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{txn.memo || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-orange-700 font-semibold">{txn.reference_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{txn.updated_at ? new Date(txn.updated_at).toLocaleDateString() : new Date(txn.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => act(txn.session_id, "approve")}
                        disabled={actioning === txn.session_id}
                        className="px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60" style={{ background: "#F2A922" }}
                        data-testid={`zelle-approve-${txn.session_id}`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => act(txn.session_id, "reject")}
                        disabled={actioning === txn.session_id}
                        className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60"
                        data-testid={`zelle-reject-${txn.session_id}`}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReferralsTab() {
  const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    axios.get(`${API}/admin/referrals`, { withCredentials: true })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>;
  if (!data) return <div className="text-sm text-red-500 py-8 text-center">Failed to load referrals.</div>;

  const filtered = data.entries.filter(
    (e) =>
      !search ||
      e.referrer_email.toLowerCase().includes(search.toLowerCase()) ||
      e.referee_email.toLowerCase().includes(search.toLowerCase()) ||
      (e.referral_code || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="referrals-tab">
      <AmbassadorsCard />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-heading-dark">{data.total_referrals}</div>
          <div className="text-xs text-gray-500 mt-1">Total referrals</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-emerald-700">{data.total_credited}</div>
          <div className="text-xs text-gray-500 mt-1">Credited (both sides earned $5)</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-amber-700">{data.total_bonus_paid || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Tier bonuses paid ($10 each)</div>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-orange-600">${(data.total_credited * 10 + (data.total_bonus_paid || 0) * 10).toFixed(0)}</div>
          <div className="text-xs text-gray-500 mt-1">Total credit paid out</div>
        </div>
      </div>

      {data.top_referrers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-heading-dark mb-3">Top Referrers</h3>
          <div className="flex flex-wrap gap-2">
            {data.top_referrers.map((r) => (
              <span key={r.referrer_id} className="inline-flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
                <span className="font-semibold text-heading-dark">{r.referrer_name}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">{r.referrals} referral{r.referrals !== 1 ? "s" : ""}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <input
        type="text"
        placeholder="Search by email or referral code..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:w-80 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
        data-testid="referrals-search"
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 sm:px-4 py-3 font-semibold text-gray-600">Referrer</th>
                <th className="text-left px-3 sm:px-4 py-3 font-semibold text-gray-600">Referred</th>
                <th className="hidden sm:table-cell text-left px-3 sm:px-4 py-3 font-semibold text-gray-600">Code</th>
                <th className="text-left px-3 sm:px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="hidden md:table-cell text-left px-3 sm:px-4 py-3 font-semibold text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No referrals yet.</td></tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} data-testid={`referral-row-${e.id}`}>
                    <td className="px-3 sm:px-4 py-3">
                      <div className="font-medium text-heading-dark">{e.referrer_name}</div>
                      <div className="text-xs text-gray-400">{e.referrer_email}</div>
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <div className="font-medium text-heading-dark">{e.referee_name}</div>
                      <div className="text-xs text-gray-400">{e.referee_email}</div>
                    </td>
                    <td className="hidden sm:table-cell px-3 sm:px-4 py-3 font-mono text-xs text-gray-500">{e.referral_code}</td>
                    <td className="px-3 sm:px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        e.status === "applied" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-4 py-3 text-gray-400 text-xs">
                      {e.created_at ? new Date(e.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// Frontend build-time env flags — read directly from this bundle's own
// import.meta.env, since that's the exact build currently deployed.
const FRONTEND_ENV_FLAGS = [
  { name: "VITE_PHASE", value: String(import.meta.env.VITE_PHASE ?? "1"), controls: "Active sports/country/pricing shown in the UI" },
  { name: "VITE_CRICKET_ENABLED", value: String(import.meta.env.VITE_CRICKET_ENABLED ?? "false"), controls: "Adds Cricket regardless of phase" },
  { name: "VITE_VAPID_PUBLIC_KEY", value: import.meta.env.VITE_VAPID_PUBLIC_KEY ? "configured" : "not set", controls: "Push notification opt-in UI" },
];

function FlagsTab() {
  const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
  const [jobs, setJobs] = useState([]);
  const [envFlags, setEnvFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const fetchFlags = () => {
    axios.get(`${API}/admin/flags`, { withCredentials: true })
      .then((res) => {
        setJobs(res.data.jobs);
        setEnvFlags(res.data.env_flags);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const toggle = async (job) => {
    setToggling(job.id);
    const next = !job.enabled;
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, enabled: next } : j))); // optimistic
    try {
      await axios.patch(`${API}/admin/flags/${job.id}`, { enabled: next }, { withCredentials: true });
    } catch {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, enabled: job.enabled } : j))); // revert
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6" data-testid="flags-tab">
      <SiteSettingsCard />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-heading-dark">Background Jobs</h3>
          <p className="text-xs text-gray-500 mt-1">Toggle takes effect immediately, no redeploy needed.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between gap-4 px-4 py-4" data-testid={`flag-row-${job.id}`}>
              <div className="min-w-0">
                <div className="font-medium text-heading-dark">{job.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{job.description}</div>
              </div>
              <button
                onClick={() => toggle(job)}
                disabled={toggling === job.id}
                role="switch"
                aria-checked={job.enabled}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                  job.enabled ? "bg-emerald-500" : "bg-gray-300"
                }`}
                data-testid={`flag-toggle-${job.id}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    job.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-heading-dark">Environment Flags</h3>
          <p className="text-xs text-gray-500 mt-1">Build-time config — changing these requires a redeploy, not a toggle here.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {[...envFlags, ...FRONTEND_ENV_FLAGS].map((f) => (
            <div key={f.name} className="flex items-center justify-between gap-4 px-4 py-3" data-testid={`env-flag-${f.name}`}>
              <div className="min-w-0">
                <div className="font-mono text-xs text-gray-700">{f.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{f.controls}</div>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 shrink-0">
                {f.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdjustScheduleModal({ league, onClose }) {
  const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
  const [rows, setRows] = useState(null);
  const [edits, setEdits] = useState({});
  const [msg, setMsg] = useState("");
  const [setting, setSetting] = useState(null); // match id whose time the organizer is setting
  const [when, setWhen] = useState("");
  const [venue, setVenue] = useState("");

  const load = () =>
    axios.get(`${API}/admin/leagues/${league.id}/schedule`, { withCredentials: true })
      .then((r) => setRows(r.data))
      .catch(() => setMsg("Could not load the schedule."));
  useEffect(() => { load(); }, []);

  const people = {};
  (rows || []).forEach((m) => { people[m.home_id] = m.home; people[m.away_id] = m.away; });
  const needHelp = (rows || []).filter((m) => m.needs_help && m.schedule_status !== "scheduled").length;

  const save = async (m) => {
    const e = edits[m.id] || {};
    try {
      await axios.patch(`${API}/admin/matches/${m.id}/adjust`, { home_id: e.home_id || m.home_id, away_id: e.away_id || m.away_id }, { withCredentials: true });
      setEdits((prev) => { const n = { ...prev }; delete n[m.id]; return n; });
      setMsg("Saved. The affected players were emailed their updated schedule.");
      load();
    } catch (err) {
      const d = err.response?.data?.detail;
      setMsg(typeof d === "string" ? d : "Could not save that change.");
    }
  };

  const setTime = async (m) => {
    try {
      await axios.post(`${API}/admin/matches/${m.id}/set-time`, { date: when, venue }, { withCredentials: true });
      setSetting(null); setWhen(""); setVenue("");
      setMsg("Time set. Both players were emailed.");
      load();
    } catch (err) {
      const d = err.response?.data?.detail;
      setMsg(typeof d === "string" ? d : "Could not set that time.");
    }
  };

  const sel = { border: "1px solid #D9D9D9", color: "#3D3D3D", padding: "4px 6px", fontSize: "12px", maxWidth: "150px" };
  const label = (m) => (m.status === "completed" ? "Played" : m.schedule_status === "scheduled" ? "Scheduled" : m.schedule_status === "proposed" ? "Proposed" : "Not scheduled");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(61,61,61,0.55)" }} role="dialog" aria-modal="true" data-testid="adjust-modal">
      <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-auto p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="font-bold text-lg" style={{ color: "#3D3D3D" }}>Matches: {league.name}</h3>
            <p className="text-xs" style={{ color: "#5C5C5C" }}>
              Change Home/Away or opponents until a match is proposed, scheduled or played. For pairs who cannot agree, use Set time: it books the match and emails both players (times are in the league's time zone).
            </p>
          </div>
          <button onClick={onClose} className="text-sm underline" style={{ color: "#5C5C5C" }} data-testid="adjust-close">Close</button>
        </div>
        {needHelp > 0 && (
          <p className="text-sm mb-3 p-2 font-semibold" style={{ background: "#F2A922", color: "#3D3D3D" }} role="alert" data-testid="needs-help-banner">
            {needHelp} match{needHelp === 1 ? " is" : "es are"} close to the play-by date with no confirmed time. Players were alerted. Use Set time to book them.
          </p>
        )}
        {msg && <p className="text-sm mb-3 p-2" style={{ background: "#F1F1F1", color: "#3D3D3D" }} role="status">{msg}</p>}
        {!rows ? <p className="text-sm">Loading...</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase" style={{ color: "#5C5C5C" }}><th className="py-1">Round</th><th>Home</th><th>Away</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((m) => (
                <Fragment key={m.id}>
                  <tr className="border-t" style={{ borderColor: "#E5E7EB" }} data-testid={`adjust-row-${m.id}`}>
                    <td className="py-2">{m.round}</td>
                    {["home_id", "away_id"].map((field) => (
                      <td key={field}>
                        <select disabled={m.locked} style={sel} value={(edits[m.id] || {})[field] || m[field]}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), [field]: e.target.value } }))}
                          data-testid={`adjust-${field}-${m.id}`}>
                          {Object.entries(people).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </select>
                      </td>
                    ))}
                    <td className="text-xs" data-testid={`adjust-status-${m.id}`}>
                      {label(m)}{m.needs_help && m.schedule_status !== "scheduled" ? <span className="ml-1 font-bold" style={{ color: "#B7791F" }}>· needs help</span> : null}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {!m.locked && (
                        <button disabled={!edits[m.id]} onClick={() => save(m)} className="text-xs font-bold disabled:opacity-40 mr-3" style={{ color: "#008F70" }} data-testid={`adjust-save-${m.id}`}>Save</button>
                      )}
                      {m.status !== "completed" && (
                        <button onClick={() => { setSetting(setting === m.id ? null : m.id); setWhen(""); setVenue(m.venue || ""); }} className="text-xs font-bold" style={{ color: "#008F70" }} data-testid={`set-time-${m.id}`}>Set time</button>
                      )}
                    </td>
                  </tr>
                  {setting === m.id && (
                    <tr data-testid={`set-time-form-${m.id}`}>
                      <td colSpan={5} className="pb-3">
                        <div className="flex flex-wrap items-end gap-2 p-2" style={{ background: "#F1F1F1" }}>
                          <label className="text-xs">Date and time
                            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="block mt-1 px-2 py-1 text-xs" style={{ border: "1px solid #D9D9D9" }} data-testid={`set-time-when-${m.id}`} />
                          </label>
                          <label className="text-xs">Court or venue
                            <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={120} className="block mt-1 px-2 py-1 text-xs" style={{ border: "1px solid #D9D9D9" }} data-testid={`set-time-venue-${m.id}`} />
                          </label>
                          <button onClick={() => setTime(m)} disabled={!when || !venue} className="text-xs font-bold px-3 py-1.5 disabled:opacity-40" style={{ background: "#F2A922", color: "#3D3D3D" }} data-testid={`set-time-save-${m.id}`}>Book it</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PlayoffRulesModal({ league, onClose, onSaved }) {
  const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
  const q = league.qualification || {};
  const [mode, setMode] = useState(q.mode || "points");
  const [topN, setTopN] = useState(q.top_n || (league.max_players > 12 || (league.current_players || 0) > 12 ? 8 : 4));
  const [minMatches, setMinMatches] = useState(q.min_matches || 0);
  const [minWinPct, setMinWinPct] = useState(q.min_win_pct || 0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await axios.put(`${API}/admin/leagues/${league.id}`, {
        qualification: { mode, top_n: Number(topN), min_matches: Number(minMatches) || 0, min_win_pct: Number(minWinPct) || 0 },
      }, { withCredentials: true });
      onSaved();
    } catch (err) {
      const d = err.response?.data?.detail;
      setMsg(typeof d === "string" ? d : "Could not save the rule.");
    } finally {
      setBusy(false);
    }
  };

  const field = { border: "1px solid #B5B5B5", color: "#3D3D3D", background: "#fff", padding: "6px 8px", fontSize: "14px", width: "100%" };
  const label = "block text-xs font-bold uppercase tracking-wider mb-1";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(61,61,61,0.55)" }} role="dialog" aria-modal="true" data-testid="playoff-rules-modal">
      <div className="bg-white w-full max-w-md p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="font-bold text-lg" style={{ color: "#3D3D3D" }}>Playoff rules</h3>
            <p className="text-xs" style={{ color: "#5C5C5C" }}>{league.name}. Players see this rule on My Matches. Finishing all matches never qualifies anyone by itself.</p>
          </div>
          <button onClick={onClose} className="text-sm underline" style={{ color: "#5C5C5C" }}>Close</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="pr-mode" style={{ color: "#5C5C5C" }}>Rank players by</label>
            <select id="pr-mode" value={mode} onChange={(e) => setMode(e.target.value)} style={field} data-testid="playoff-rule-mode">
              <option value="points">Points</option>
              <option value="win_pct">Win percentage</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="pr-top" style={{ color: "#5C5C5C" }}>Players who qualify (top N)</label>
            <select id="pr-top" value={topN} onChange={(e) => setTopN(e.target.value)} style={field} data-testid="playoff-rule-topn">
              {[2, 4, 8, 16].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="pr-min" style={{ color: "#5C5C5C" }}>Minimum matches played</label>
              <input id="pr-min" type="number" min="0" max="50" value={minMatches} onChange={(e) => setMinMatches(e.target.value)} style={field} data-testid="playoff-rule-minmatches" />
            </div>
            <div>
              <label className={label} htmlFor="pr-pct" style={{ color: "#5C5C5C" }}>Minimum win % (0 = none)</label>
              <input id="pr-pct" type="number" min="0" max="100" value={minWinPct} onChange={(e) => setMinWinPct(e.target.value)} style={field} data-testid="playoff-rule-minwinpct" />
            </div>
          </div>
          <p className="text-xs" style={{ color: "#5C5C5C" }}>Ties are broken by wins, then head-to-head, then set and game difference.</p>
          {msg && <p className="text-sm p-2" style={{ background: "#F1F1F1", color: "#3D3D3D" }} role="alert">{msg}</p>}
          <button onClick={save} disabled={busy} className="px-5 py-2.5 text-sm font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: "#F2A922", color: "#3D3D3D" }} data-testid="playoff-rule-save">
            {busy ? "Saving..." : "Save rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StartMinimumModal({ league, onClose, onSaved }) {
  const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
  const [value, setValue] = useState(league.min_players_to_start || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 2 || n > league.max_players) {
      setMsg(`Enter a whole number from 2 to ${league.max_players}.`);
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await axios.put(`${API}/admin/leagues/${league.id}`, { min_players_to_start: n }, { withCredentials: true });
      onSaved();
    } catch (err) {
      const d = err.response?.data?.detail;
      setMsg(typeof d === "string" ? d : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(61,61,61,0.55)" }} role="dialog" aria-modal="true" data-testid="start-min-modal">
      <div className="bg-white w-full max-w-md p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="font-bold text-lg" style={{ color: "#3D3D3D" }}>Start minimum</h3>
            <p className="text-xs" style={{ color: "#5C5C5C" }}>{league.name}. Players see "Starts when N players have joined", then "Season confirmed" once N have. They never see how many have joined.</p>
          </div>
          <button onClick={onClose} className="text-sm underline" style={{ color: "#5C5C5C" }}>Close</button>
        </div>
        <label className="block text-xs font-bold uppercase tracking-wider mb-1" htmlFor="start-min-input" style={{ color: "#5C5C5C" }}>Players needed to start (2 to {league.max_players})</label>
        <input id="start-min-input" type="number" min="2" max={league.max_players} value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 8"
          style={{ border: "1px solid #B5B5B5", color: "#3D3D3D", background: "#fff", padding: "6px 8px", fontSize: "14px", width: "100%" }} data-testid="start-min-input" />
        {msg && <p className="text-sm p-2 mt-3" style={{ background: "#F1F1F1", color: "#3D3D3D" }} role="alert">{msg}</p>}
        <button onClick={save} disabled={busy} className="mt-4 px-5 py-2.5 text-sm font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: "#F2A922", color: "#3D3D3D" }} data-testid="start-min-save">
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

// Switches an admin can flip at any time, no deploy: which cities players can join, and Google tracking.
function SiteSettingsCard() {
  const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
  const allCities = platformConfig.featuredCities.map((c) => c.name);
  const [allOpen, setAllOpen] = useState(false);
  const [open, setOpen] = useState([]);
  const [google, setGoogle] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    axios.get(`${API}/admin/site-settings`, { withCredentials: true })
      .then((r) => {
        setAllOpen(!!r.data.all_open);
        setOpen(r.data.open_cities || []);
        setGoogle(r.data.google_analytics !== false);
        setLoaded(true);
      })
      .catch((err) => setMsg(`Could not load the current settings${err.response?.status ? ` (error ${err.response.status})` : ""}. Reload the page; if it keeps happening, check the backend is running the latest version.`));
  }, []);

  // Cities that are open but not in the featured list (added by hand earlier) still show up so they can be closed.
  const cityList = [...allCities, ...open.filter((c) => !allCities.includes(c))];
  const toggleCity = (name) => setOpen((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));

  const save = async () => {
    if (!allOpen && open.length === 0 && !window.confirm("No city is open. Players will not be able to join any league. Save anyway?")) return;
    setBusy(true);
    setMsg("");
    try {
      await axios.put(`${API}/admin/site-settings`, { all_open: allOpen, open_cities: open, google_analytics: google }, { withCredentials: true });
      setMsg("Saved. Visitors see it on their next page load.");
    } catch (err) {
      const d = err.response?.data?.detail;
      setMsg(typeof d === "string" ? d : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-5" data-testid="site-settings-card">
      <h2 className="text-base font-bold text-heading-dark">Site settings</h2>
      <div>
        <h3 className="text-sm font-semibold text-heading-dark">Open cities</h3>
        <p className="text-xs text-gray-500 mt-1">
          Players can join leagues only in open cities. Other cities keep their leagues visible as "Opens soon" with a Notify Me button.
        </p>
      </div>

      {!loaded ? (
        <p className="text-sm text-gray-600" role={msg ? "alert" : undefined}>
          {msg || "Loading..."}
        </p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm font-medium text-heading-dark">
            <input type="checkbox" checked={allOpen} onChange={(e) => setAllOpen(e.target.checked)} data-testid="all-cities-open" />
            Open every city (no restriction)
          </label>
          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${allOpen ? "opacity-40 pointer-events-none" : ""}`} data-testid="city-checkboxes">
            {cityList.map((name) => (
              <label key={name} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={allOpen || open.includes(name)} onChange={() => toggleCity(name)} data-testid={`open-city-${name.toLowerCase().replace(/\s+/g, "-")}`} />
                {name}
              </label>
            ))}
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-heading-dark">Google tracking (Tag Manager and Analytics)</h3>
              <p className="text-xs text-gray-500 mt-1">
                Off: Google's script never loads for anyone. On: it loads only for visitors who accept analytics in the consent banner.
              </p>
            </div>
            <button
              onClick={() => setGoogle((g) => !g)}
              role="switch"
              aria-checked={google}
              aria-label="Google tracking"
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${google ? "bg-emerald-500" : "bg-gray-300"}`}
              data-testid="google-tracking-toggle"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${google ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={save} disabled={busy} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: "#F2A922", color: "#3D3D3D" }} data-testid="site-settings-save">
              {busy ? "Saving..." : "Save settings"}
            </button>
            {msg && <span className="text-sm text-gray-600" role="status">{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}

// Which marketing channel produced registrations: new accounts grouped by where the visitor came from.
function IncompleteTeamsCard() {
  const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
  const [teams, setTeams] = useState(null);
  useEffect(() => {
    axios.get(`${API}/admin/incomplete-teams`, { withCredentials: true })
      .then((r) => setTeams(r.data.teams))
      .catch(() => setTeams([]));
  }, []);
  if (!teams || teams.length === 0) return null;
  return (
    <div className="mb-6 bg-white rounded-none overflow-hidden" style={{ border: "1px solid #E5E7EB" }} data-testid="incomplete-teams">
      <div className="p-5" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <h2 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Doubles teams waiting for a partner ({teams.length})</h2>
        <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Paid teams with no partner by the start date need a refund decision.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase" style={{ color: "#6B7280" }}>
              <th className="px-5 py-2">Player</th><th className="px-5 py-2">League</th><th className="px-5 py-2">Starts</th><th className="px-5 py-2">Paid</th><th className="px-5 py-2">Partner invited</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.token_tail + t.league_id} style={{ borderTop: "1px solid #F3F4F6" }}>
                <td className="px-5 py-2">{t.player_name}<div className="text-xs" style={{ color: "#6B7280" }}>{t.player_email}</div></td>
                <td className="px-5 py-2">{t.league_name}</td>
                <td className="px-5 py-2">{t.league_start}</td>
                <td className="px-5 py-2">{t.paid ? "Yes" : "No"}</td>
                <td className="px-5 py-2">{t.partner_email || "Not yet"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketingTab() {
  const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setError("");
    axios.get(`${API}/admin/marketing-report`, { params: { days }, withCredentials: true })
      .then((r) => setData(r.data))
      .catch(() => setError("Could not load the report."));
  }, [days]);

  const t = data?.totals;
  return (
    <div className="space-y-4" data-testid="marketing-tab">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-heading-dark">Registrations by source</h3>
          <p className="text-xs text-gray-500 mt-1">
            New accounts grouped by the first marketing link, friend code or website that brought the visitor. Tag every link with
            utm_source, utm_medium and utm_campaign (for example utm_source=instagram&amp;utm_medium=social&amp;utm_campaign=atlanta-launch).
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Period">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
              style={days === d ? { background: "#F2A922", color: "#3D3D3D" } : { background: "#F1F1F1", color: "#3D3D3D" }}
              data-testid={`marketing-days-${d}`} aria-pressed={days === d}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-gray-600" role="alert">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">Loading...</p>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[["Signups", t.signups], ["Joined a league", t.joined], ["Played a match", t.played]].map(([label, value]) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-2xl font-bold text-heading-dark" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm" data-testid="marketing-table">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-3">Source</th><th className="px-4 py-3">Medium</th><th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3 text-right">Signups</th><th className="px-4 py-3 text-right">Joined</th>
                  <th className="px-4 py-3 text-right">Played</th><th className="px-4 py-3 text-right">Join rate</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No new accounts in this period.</td></tr>
                )}
                {data.rows.map((r) => (
                  <tr key={`${r.source}|${r.medium}|${r.campaign}`} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-heading-dark">{r.source}</td>
                    <td className="px-4 py-3 text-gray-600">{r.medium}</td>
                    <td className="px-4 py-3 text-gray-600">{r.campaign}</td>
                    <td className="px-4 py-3 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{r.signups}</td>
                    <td className="px-4 py-3 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{r.joined}</td>
                    <td className="px-4 py-3 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{r.played}</td>
                    <td className="px-4 py-3 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{r.join_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.untracked > 0 && (
            <p className="text-xs text-gray-500">
              "(direct)" means no marketing link, friend code or referring site was recorded: typed the address, used a bookmark, or the visit
              happened before source tracking began. {data.untracked} of {t.signups} signups.
            </p>
          )}
        </>
      )}
    </div>
  );
}
