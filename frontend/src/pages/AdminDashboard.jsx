import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Users, Trophy, Calendar, DollarSign, Plus, Trash2, Edit, BarChart3, Shield, TrendingUp, Zap } from "lucide-react";
import { activeSportIds, activeCountry } from "../config/platformConfig";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
  entry_fee: 0, currency: CURRENCIES[activeCountry] || "USD", max_players: 16,
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
  const [showRRForm, setShowRRForm] = useState(false);
  const [rrFormData, setRRFormData] = useState({
    name: "", sport: "tennis", country: "USA", city: "",
    format: "singles", entry_fee: 0, start_date: "", end_date: "",
    description: "",
    rr_config: { min_players: 6, max_players: 12, division_type: "singles", playoff_threshold: 4 }
  });

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    if (user.role !== "admin") { navigate("/dashboard"); return; }
    fetchStats();
    fetchLeagues();
    fetchCities();
    fetchSeasons();
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
    { label: "Total Users", value: stats.total_users, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total Leagues", value: stats.total_leagues, icon: Trophy, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total Matches", value: stats.total_matches, icon: Calendar, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Revenue (USD)", value: `$${stats.total_revenue?.toFixed(2) || "0.00"}`, icon: DollarSign, color: "text-orange-600", bg: "bg-orange-50" },
  ] : [];

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "create", label: "Create League" },
    { id: "auto", label: "Auto-Generate" },
    { id: "leagues", label: "Manage Leagues" },
    { id: "seasons", label: "Seasons" },
    { id: "playoffs", label: "Playoffs" },
    { id: "zelle", label: "Zelle Queue" },
    { id: "waitlist", label: "Waitlist" },
  ];

  return (
    <div className="min-h-screen bg-gray-50" data-testid="admin-dashboard">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-black text-2xl text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500">Manage leagues, players, and platform analytics</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0 overflow-x-auto scrollbar-none">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 sm:px-5 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${tab === t.id ? "border-black text-black" : "border-transparent text-gray-500 hover:text-gray-700"}`}
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
                <div key={s.label} className={`${s.bg} border border-gray-200 rounded-2xl p-5`} data-testid={`admin-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <s.icon className={`w-5 h-5 ${s.color} mb-3`} />
                  <p className={`font-heading font-black text-3xl ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-600 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {stats && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h3 className="font-heading font-bold text-lg mb-4">Sport Breakdown</h3>
                  {Object.entries(stats.sport_breakdown || {}).map(([sport, count]) => (
                    <div key={sport} className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-medium text-gray-700 w-20 capitalize">{sport}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${sport === "tennis" ? "bg-tennis" : sport === "cricket" ? "bg-cricket" : "bg-pickleball"}`}
                          style={{ width: `${Math.min((count / stats.total_leagues) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-900 w-6">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h3 className="font-heading font-bold text-lg mb-4">Country Breakdown</h3>
                  {Object.entries(stats.country_breakdown || {}).map(([country, count]) => (
                    <div key={country} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm font-medium">{country === "USA" ? "🇺🇸 USA" : "🇮🇳 India"}</span>
                      <span className="font-heading font-bold text-lg">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create League Tab */}
        {tab === "create" && (
          <div className="max-w-2xl">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-heading font-bold text-xl mb-6">Create New League</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">League Name *</label>
                    <input type="text" value={form.name} onChange={update("name")} placeholder="e.g. NYC Tennis Open S1" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" required data-testid="create-league-name" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Sport *</label>
                    <select value={form.sport} onChange={update("sport")} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black" data-testid="create-league-sport">
                      {SPORTS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Format *</label>
                    <select value={form.format} onChange={update("format")} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black" data-testid="create-league-format">
                      {(FORMATS[form.sport] || []).map((f) => <option key={f} value={f}>{FORMAT_LABELS[f] ?? f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Division (optional)</label>
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
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
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
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Country *</label>
                    <select value={form.country} onChange={update("country")} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black" data-testid="create-league-country">
                      {activeCountry === "USA" && <option value="USA">🇺🇸 USA</option>}
                      {activeCountry === "India" && <option value="India">🇮🇳 India</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">City *</label>
                    <input type="text" value={form.city} onChange={update("city")} placeholder="Any city — e.g. Austin, Boise, or All Cities" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" required data-testid="create-league-city" list="cities-list" />
                    <datalist id="cities-list">
                      <option value="All Cities" />
                      {cities.filter((c) => c.country === form.country).map((c) => <option key={c.name} value={c.name} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Entry Fee ({form.currency})</label>
                    <input type="number" min="0" step="0.01" value={form.entry_fee} onChange={update("entry_fee")} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" data-testid="create-league-fee" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Max Players</label>
                    <input type="number" min="2" max="100" value={form.max_players} onChange={update("max_players")} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" data-testid="create-league-max-players" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Start Date *</label>
                    <input type="date" value={form.start_date} onChange={update("start_date")} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" required data-testid="create-league-start" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">End Date *</label>
                    <input type="date" value={form.end_date} onChange={update("end_date")} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" required data-testid="create-league-end" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Season</label>
                    <select value={form.season_id || ""} onChange={update("season_id")} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black" data-testid="create-league-season">
                      <option value="">— None —</option>
                      {seasons.filter((s) => s.sport === form.sport).map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Optional — link this league to a season for grouping.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Venue</label>
                    <input type="text" value={form.venue} onChange={update("venue")} placeholder="e.g. Central Park Tennis Center" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" data-testid="create-league-venue" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Description</label>
                    <textarea value={form.description} onChange={update("description")} rows={3} placeholder="Describe the league..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" data-testid="create-league-description" />
                  </div>
                </div>

                {msg && (
                  <div className={`px-4 py-3 rounded-xl text-sm ${msg.includes("success") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`} data-testid="create-league-message">
                    {msg}
                  </div>
                )}

                <button type="submit" disabled={creating} className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60 text-sm" data-testid="create-league-submit">
                  {creating ? "Creating..." : "Create League"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Manage Leagues Tab */}
        {tab === "leagues" && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-heading font-bold text-lg">All Leagues ({leagues.length})</h2>
              <div className="flex items-center gap-2">
                <button
                  data-testid="btn-create-rr-league"
                  onClick={() => setShowRRForm(true)}
                  className="px-4 py-2 border border-emerald-500 text-emerald-600 rounded-md text-sm font-medium hover:bg-emerald-50 transition"
                >
                  + Create Round Robin League
                </button>
                <button onClick={() => setTab("create")} className="flex items-center gap-1.5 text-sm font-semibold bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors" data-testid="add-league-btn">
                  <Plus className="w-4 h-4" /> Add League
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">League</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sport</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">City</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Players</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leagues.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900 max-w-[200px] truncate">{l.name}</td>
                      <td className="px-5 py-3 capitalize text-gray-600">{l.sport}</td>
                      <td className="px-5 py-3 text-gray-600">{l.city}</td>
                      <td className="px-5 py-3 text-gray-600">{l.current_players || 0}/{l.max_players}</td>
                      <td className="px-5 py-3 text-gray-600">{!l.entry_fee ? "Free" : `${l.currency === "INR" ? "₹" : "$"}${l.entry_fee}`}</td>
                      <td className="px-5 py-3">
                        <select
                          value={l.status}
                          onChange={(e) => handleStatusChange(l.id, e.target.value)}
                          className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white focus:outline-none"
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
                          <Link to={`/leagues/${l.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                          {l.status !== "completed" && (
                            <button
                              onClick={() => handleCloseLeague(l.id, l.name)}
                              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
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
                              className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                            >
                              Assign Boxes
                            </button>
                            <button
                              data-testid={`finalize-season-${l.id}`}
                              onClick={() => handleFinalizeSeason(l.id)}
                              className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700"
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
                <div className="text-center py-12 text-gray-500">No leagues yet. Create one!</div>
              )}
            </div>
          </div>
        )}

        {tab === "seasons" && <SeasonsTab />}
        {tab === "playoffs" && <PlayoffsTab leagues={leagues} />}
        {tab === "auto" && <AutoGenerateTab onSuccess={() => { fetchLeagues(); fetchStats(); }} />}
        {tab === "zelle" && <ZelleQueueTab />}
        {tab === "waitlist" && <WaitlistTab />}
      </div>

      {showRRForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rr-modal-title"
        >
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full my-8 overscroll-contain">
            <h2 id="rr-modal-title" className="font-bold text-lg text-gray-900 mb-4">Create Round Robin League</h2>
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    data-testid={`rr-form-${field}`}
                    type={type}
                    value={rrFormData[field]}
                    onChange={e => setRRFormData(d => ({ ...d, [field]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sport</label>
                <select
                  data-testid="rr-form-sport"
                  value={rrFormData.sport}
                  onChange={e => setRRFormData(d => ({ ...d, sport: e.target.value }))}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                >
                  <option value="tennis">Tennis</option>
                  <option value="pickleball">Pickleball</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Division Type</label>
                <select
                  data-testid="rr-form-division"
                  value={rrFormData.rr_config.division_type}
                  onChange={e => setRRFormData(d => ({
                    ...d,
                    format: e.target.value,
                    rr_config: { ...d.rr_config, division_type: e.target.value }
                  }))}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    data-testid={`rr-form-${field}`}
                    type="number"
                    value={rrFormData.rr_config[field]}
                    onChange={e => setRRFormData(d => ({
                      ...d,
                      rr_config: { ...d.rr_config, [field]: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
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
                className="flex-1 bg-black text-white rounded-md py-2 text-sm font-bold hover:bg-gray-800 transition"
              >
                Create League
              </button>
              <button
                onClick={() => setShowRRForm(false)}
                className="flex-1 border border-gray-300 rounded-md py-2 text-sm font-medium hover:bg-gray-50 transition"
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
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-heading font-bold text-lg mb-4">Create Season</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            type="text" required value={form.name} placeholder="e.g. Summer 2026"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
            aria-label="Season name"
            data-testid="season-name-input"
          />
          <select
            value={form.sport} onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
            data-testid="season-sport-select"
          >
            {activeSportIds.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date" required value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
              aria-label="Season start date"
              data-testid="season-start-input"
            />
            <input
              type="date" required value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
              aria-label="Season end date"
              data-testid="season-end-input"
            />
          </div>
          {msg && (
            <div className={`text-sm px-3 py-2 rounded-lg ${msg.includes("!") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`} data-testid="season-message">
              {msg}
            </div>
          )}
          <button type="submit" disabled={busy} className="w-full py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60" data-testid="season-submit-btn">
            {busy ? "Creating..." : "Create Season"}
          </button>
        </form>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-heading font-bold text-lg mb-4">Seasons ({seasons.length})</h3>
        {seasons.length === 0 ? (
          <p className="text-sm text-gray-500">No seasons yet.</p>
        ) : (
          <div className="space-y-3">
            {seasons.map((s) => (
              <div key={s.id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-3" data-testid={`season-row-${s.id}`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.name} <span className="text-xs text-gray-400 font-normal capitalize ml-1">({s.sport})</span></p>
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
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-heading font-bold text-lg mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-500" /> Generate Playoff Bracket
        </h3>
        <form onSubmit={handleGenerate} className="space-y-3">
          <select
            required value={leagueId} onChange={(e) => setLeagueId(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
            data-testid="playoff-league-select"
          >
            <option value="">Choose a league...</option>
            {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select
            value={topN} onChange={(e) => setTopN(Number(e.target.value))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
            data-testid="playoff-top-n"
          >
            <option value={2}>Top 2 — Final only</option>
            <option value={4}>Top 4 — Semis + Final</option>
            <option value={8}>Top 8 — Quarters + Semis + Final</option>
            <option value={16}>Top 16 — Round of 16 onwards</option>
          </select>
          <input
            type="date" required value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
            data-testid="playoff-date-input"
          />
          {msg && (
            <div className={`text-sm px-3 py-2 rounded-lg ${msg.includes("!") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`} data-testid="playoff-message">
              {msg}
            </div>
          )}
          <button type="submit" disabled={busy} className="w-full py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60" data-testid="playoff-submit-btn">
            {busy ? "Generating..." : "Generate Bracket"}
          </button>
          <p className="text-xs text-gray-500">Requires at least N players with recorded match results in the league's standings.</p>
        </form>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
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
                    <div key={m.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2" data-testid={`bracket-match-${m.id}`}>
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
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-heading font-bold text-lg mb-2">Auto-Generate Leagues</h3>
        <p className="text-sm text-gray-500 mb-5">
          Spin up the next cycle of leagues for every active sport &amp; format. Each generated
          league is open to players from <strong>any USA city</strong> with standardized pricing
          (<strong>$9.99 singles</strong> / <strong>$19.99 doubles</strong>). Re-running is safe — duplicates are skipped.
        </p>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Cadence</label>
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
          className="w-full py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60"
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
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-heading font-bold text-lg mb-4">Last Run</h3>
        {!result ? (
          <p className="text-sm text-gray-500">Run the generator to see what was created.</p>
        ) : (
          <div data-testid="auto-result">
            <p className="text-sm font-medium text-gray-900 mb-3">{result.message}</p>
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
  const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
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
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-500">
          No pending Zelle payments.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
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
                    <div className="font-medium text-gray-900">{txn.user_email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{txn.league_name}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">${Number(txn.amount).toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{txn.memo || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-purple-700 font-semibold">{txn.reference_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{txn.updated_at ? new Date(txn.updated_at).toLocaleDateString() : new Date(txn.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => act(txn.session_id, "approve")}
                        disabled={actioning === txn.session_id}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
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

// ─────────── Waitlist Tab ───────────
function WaitlistTab() {
  const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/waitlist/list`, { withCredentials: true });
        setData(res.data);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copyCSV = () => {
    if (!data) return;
    const rows = [["Email", "City", "Sport", "Signed Up"], ...data.entries.map((e) => [e.email, e.city, e.sport, e.created_at])];
    navigator.clipboard.writeText(rows.map((r) => r.join(",")).join("\n"));
  };

  if (loading) return <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>;
  if (!data) return <div className="text-sm text-red-500 py-8 text-center">Failed to load waitlist.</div>;

  const filtered = data.entries.filter(
    (e) => !search || e.email.includes(search.toLowerCase()) || e.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="waitlist-tab">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{data.total}</div>
          <div className="text-xs text-gray-500 mt-1">Total signups</div>
        </div>
        {data.by_sport.tennis !== undefined && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-emerald-700">{data.by_sport.tennis || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Tennis</div>
          </div>
        )}
        {data.by_sport.pickleball !== undefined && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{data.by_sport.pickleball || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Pickleball</div>
          </div>
        )}
        {data.by_sport.both !== undefined && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-gray-700">{data.by_sport.both || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Both sports</div>
          </div>
        )}
      </div>

      {data.by_city.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">By City</p>
          <div className="flex flex-wrap gap-2">
            {data.by_city.map(([city, count]) => (
              <span key={city} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                {city} <span className="font-semibold text-gray-900">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or city..."
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            data-testid="waitlist-search"
          />
          <button
            onClick={copyCSV}
            className="text-xs bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            data-testid="waitlist-copy-csv"
          >
            Copy CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">City</th>
                <th className="px-4 py-3 text-left">Sport</th>
                <th className="px-4 py-3 text-left">Signed Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-xs">No entries found.</td></tr>
              ) : (
                filtered.map((e, i) => (
                  <tr key={e.email} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{e.email}</td>
                    <td className="px-4 py-3 text-gray-600">{e.city}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        e.sport === "tennis" ? "bg-emerald-100 text-emerald-700" :
                        e.sport === "pickleball" ? "bg-orange-100 text-orange-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {e.sport}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
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
