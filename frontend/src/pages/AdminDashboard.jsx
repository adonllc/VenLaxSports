import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Users, Trophy, Calendar, DollarSign, Plus, Trash2, Edit, BarChart3, Shield, TrendingUp } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORTS = ["tennis", "cricket", "pickleball"];
const FORMATS = {
  tennis: ["singles", "doubles", "mixed"],
  cricket: ["T10", "T20", "8-a-side", "11-a-side"],
  pickleball: ["singles", "doubles", "mixed"],
};
const CURRENCIES = { USA: "USD", India: "INR" };

const DEFAULT_FORM = {
  name: "", sport: "tennis", country: "USA", city: "", format: "singles",
  entry_fee: 0, currency: "USD", max_players: 16, start_date: "", end_date: "",
  description: "", venue: "", season: "Season 1",
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

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    if (user.role !== "admin") { navigate("/dashboard"); return; }
    fetchStats();
    fetchLeagues();
    fetchCities();
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
      await axios.post(`${API}/leagues`, { ...form, entry_fee: Number(form.entry_fee), max_players: Number(form.max_players) }, { withCredentials: true });
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
    { id: "leagues", label: "Manage Leagues" },
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
          <div className="flex gap-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${tab === t.id ? "border-black text-black" : "border-transparent text-gray-500 hover:text-gray-700"}`}
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
                      {(FORMATS[form.sport] || []).map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Country *</label>
                    <select value={form.country} onChange={update("country")} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black" data-testid="create-league-country">
                      <option value="USA">🇺🇸 USA</option>
                      <option value="India">🇮🇳 India</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">City *</label>
                    <input type="text" value={form.city} onChange={update("city")} placeholder="e.g. New York" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" required data-testid="create-league-city" list="cities-list" />
                    <datalist id="cities-list">
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
              <button onClick={() => setTab("create")} className="flex items-center gap-1.5 text-sm font-semibold bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors" data-testid="add-league-btn">
                <Plus className="w-4 h-4" /> Add League
              </button>
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
                        <div className="flex items-center gap-2">
                          <Link to={`/leagues/${l.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                          <button onClick={() => handleDelete(l.id)} className="text-xs text-red-500 hover:text-red-700" data-testid={`delete-league-${l.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
      </div>
    </div>
  );
}
