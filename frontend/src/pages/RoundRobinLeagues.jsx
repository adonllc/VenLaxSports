import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Users, Trophy } from "lucide-react";
import { activeSports } from "../config/platformConfig";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const SPORT_CONFIG = {
  tennis: { label: "Tennis", icon: "🎾", color: "text-tennis" },
  pickleball: { label: "Pickleball", icon: "🏓", color: "text-pickleball" },
};

const STATUS_COLORS = {
  registration: "bg-emerald-100 text-emerald-700",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-gray-100 text-gray-600",
};

export default function RoundRobinLeagues() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ sport: "", division: "", status: "" });

  useEffect(() => {
    fetchLeagues();
  }, [filters]);

  const fetchLeagues = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sport) params.set("sport", filters.sport);
      if (filters.division) params.set("division", filters.division);
      if (filters.status) params.set("status", filters.status);
      const { data } = await axios.get(`${API}/round-robin?${params}`);
      setLeagues(data);
    } catch {
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 mb-2">Structured Format</p>
          <h1 className="font-heading font-black text-4xl sm:text-5xl text-heading-dark mb-2">Round Robin Leagues</h1>
          <p className="text-gray-500 max-w-lg">Auto-scheduled leagues for busy players. Every matchup assigned a week.</p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap gap-3 mb-8">
          <select
            data-testid="filter-sport"
            value={filters.sport}
            onChange={e => setFilters(f => ({ ...f, sport: e.target.value }))}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">All Sports</option>
            {activeSports.map(s => (
              <option key={s.id} value={s.id}>{SPORT_CONFIG[s.id]?.label || s.id}</option>
            ))}
          </select>
          <select
            data-testid="filter-division"
            value={filters.division}
            onChange={e => setFilters(f => ({ ...f, division: e.target.value }))}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">Singles & Doubles</option>
            <option value="singles">Singles</option>
            <option value="doubles">Doubles</option>
          </select>
          <select
            data-testid="filter-status"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="registration">Registration Open</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading leagues...</div>
        ) : leagues.length === 0 ? (
          <div className="text-center text-gray-400 py-20">No Round Robin leagues found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagues.map(lg => {
              const sc = SPORT_CONFIG[lg.sport] || { label: lg.sport, icon: "🏆", color: "text-gray-700" };
              const rr = lg.rr_config || {};
              return (
                <Link
                  key={lg.id}
                  to={`/round-robin/${lg.id}`}
                  data-testid={`rr-league-card-${lg.id}`}
                  className="bg-white border border-gray-300 rounded-2xl p-6 hover:-translate-y-2 hover:shadow-xl transition duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-md font-semibold" style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: "#F3F4F6", color: "#065F46" }}>{sc.icon} {sc.label}</span>
                      <span className="text-xs px-2.5 py-1 rounded-md font-semibold" style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: "#F0F7FF", color: "#065F46", border: "1px solid #DBEAFE" }}>Round Robin</span>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${STATUS_COLORS[lg.status] || "bg-gray-100 text-gray-600"}`} style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      {lg.status?.charAt(0).toUpperCase() + lg.status?.slice(1)}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-base mb-2 line-clamp-2 leading-snug tracking-[-0.5px]" style={{ color: "#065F46" }}>{lg.name}</h3>
                  <p className="text-xs flex items-center gap-1.5 mb-4" style={{ color: "#6B7280", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    <span style={{ color: "#10B981" }}>📍</span>
                    <span className="font-medium">{lg.city}</span>
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t text-xs" style={{ borderColor: "#F3F4F6", color: "#6B7280", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    <span className="flex items-center gap-1 font-medium">
                      <Users size={14} />
                      {lg.current_players}/{rr.max_players || lg.max_players}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Trophy size={14} />
                      {rr.division_type === "doubles" ? "Doubles" : "Singles"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
