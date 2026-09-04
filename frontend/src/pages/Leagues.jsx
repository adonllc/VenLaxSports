import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Search, MapPin, Trophy } from "lucide-react";
import platformConfig, { activeSports } from "../config/platformConfig";
import { useAuth } from "../contexts/AuthContext";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const ALL_SPORT_CONFIG = {
  tennis: { badge: "sport-badge-tennis", color: "text-tennis", icon: "🎾", label: "Tennis" },
  cricket: { badge: "sport-badge-cricket", color: "text-cricket", icon: "🏏", label: "Cricket" },
  pickleball: { badge: "sport-badge-pickleball", color: "text-pickleball", icon: "🏓", label: "Pickleball" },
};

const SPORT_CONFIG = Object.fromEntries(
  activeSports.map((s) => [s.id, ALL_SPORT_CONFIG[s.id]]).filter(([, v]) => v)
);

export default function Leagues() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    sport: searchParams.get("sport") || "",
    country: searchParams.get("country") || "",
    city: searchParams.get("city") || "",
    status: searchParams.get("status") || "",
    season_id: searchParams.get("season_id") || "",
    division: searchParams.get("division") || "",
    format: searchParams.get("format") || "",
    search: "",
  });

  useEffect(() => {
    if (!user) return;
    setFilters(prev => ({
      ...prev,
      sport: prev.sport || user.sport_preferences?.[0] || platformConfig.defaultSport || "",
      city:  prev.city  || user.city || "",
    }));
  }, [user?.id]);

  useEffect(() => {
    fetchLeagues();
  }, [filters.sport, filters.country, filters.city, filters.status, filters.season_id, filters.division, filters.format]);

  const fetchLeagues = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sport) params.set("sport", filters.sport);
      if (filters.country) params.set("country", filters.country);
      if (filters.city) params.set("city", filters.city);
      if (filters.status) params.set("status", filters.status);
      if (filters.season_id) params.set("season_id", filters.season_id);
      if (filters.division) params.set("division", filters.division);
      if (filters.format) params.set("format", filters.format);
      params.set("limit", "50");
      const { data } = await axios.get(`${API}/leagues?${params}`);
      setLeagues(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
    const newParams = new URLSearchParams(searchParams);
    if (val) newParams.set(key, val); else newParams.delete(key);
    setSearchParams(newParams);
  };

  const filteredLeagues = leagues.filter((l) => {
    if (filters.search && !l.name.toLowerCase().includes(filters.search.toLowerCase()) && !l.city.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.format && l.format !== filters.format) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-white" data-testid="leagues-page">
      {/* Header */}
      <div className="border-b" style={{ borderColor: "#E5E7EB" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="font-black text-6xl sm:text-7xl mb-3 text-gray-900" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Browse Leagues</h1>
          <p className="max-w-2xl text-lg" style={{ color: "#6B7280", fontFamily: "'IBM Plex Sans', sans-serif" }}>Find competitive leagues across all sports and cities</p>
        </div>
      </div>

      {/* Promo Banner */}
      <div className="sticky top-0 z-10 border-b" style={{ background: "#EA580C", borderColor: "#C24A1D" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <p className="text-sm font-semibold text-white" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            First league free! Use code <code className="bg-orange-600 px-2 py-0.5 rounded font-mono text-white text-xs">PLAY1FREE</code>
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Primary Filters — Search + Sport only */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search leagues..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-3 rounded-lg text-sm border"
              style={{ borderColor: "#E5E7EB", color: "#1F2937", fontFamily: "'IBM Plex Sans', sans-serif" }}
              data-testid="filter-search"
            />
          </div>

          {/* Sport Filter */}
          <select
            value={filters.sport}
            onChange={(e) => updateFilter("sport", e.target.value)}
            className="px-4 py-3 rounded-lg text-sm bg-white border focus:outline-none"
            style={{ borderColor: "#E5E7EB", color: "#1F2937", fontFamily: "'IBM Plex Sans', sans-serif", minWidth: "160px" }}
            data-testid="filter-sport"
          >
            <option value="">All Sports</option>
            {activeSports.map((s) => (
              <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
            ))}
          </select>
        </div>

        {/* Secondary Filters — Division + Format toggles */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B7280", fontFamily: "'IBM Plex Sans', sans-serif" }}>Filter by level</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {["", "Beginner", "Intermediate", "Advanced", "Competitive"].map((div) => (
              <button
                key={div || "all"}
                data-testid={`division-filter-${div || "all"}`}
                onClick={() => setFilters((f) => ({ ...f, division: div }))}
                className="px-4 py-2 rounded-md text-sm font-medium border transition-all duration-200"
                style={filters.division === div
                  ? { background: "#10B981", borderColor: "#10B981", color: "white" }
                  : { background: "white", borderColor: "#E5E7EB", color: "#6B7280" }}
              >
                {div || "All Levels"}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B7280", fontFamily: "'IBM Plex Sans', sans-serif" }}>Filter by format</p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "", label: "All Formats", testId: "format-filter-all" },
              { value: "singles", label: "Singles", testId: "format-filter-singles" },
              { value: "doubles", label: "Doubles", testId: "format-filter-doubles" },
              { value: "mixed_doubles", label: "Mixed Doubles", testId: "format-filter-mixed-doubles" },
            ].map(({ value, label, testId }) => (
              <button
                key={value || "all-fmt"}
                data-testid={testId}
                onClick={() => setFilters((f) => ({ ...f, format: f.format === value ? "" : value }))}
                className="px-4 py-2 rounded-md text-sm font-medium border transition-all duration-200"
                style={filters.format === value
                  ? { background: "#F97316", borderColor: "#F97316", color: "white" }
                  : { background: "white", borderColor: "#E5E7EB", color: "#6B7280" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count + Clear */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-medium" style={{ color: "#6B7280", fontFamily: "'IBM Plex Sans', sans-serif" }} data-testid="leagues-count">
            {loading ? "Loading..." : `${filteredLeagues.length} league${filteredLeagues.length !== 1 ? "s" : ""} found`}
          </p>
          {(filters.sport || filters.city || filters.status || filters.division || filters.format || filters.search) && (
            <button
              onClick={() => { setFilters({ sport: "", country: "", city: "", status: "", season_id: "", division: "", format: "", search: "" }); setSearchParams({}); }}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 underline"
              data-testid="clear-filters"
            >
              Clear all
            </button>
          )}
        </div>

        {/* League Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 bg-white rounded-lg animate-pulse border" style={{ borderColor: "#E5E7EB" }} />
            ))}
          </div>
        ) : filteredLeagues.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLeagues.map((league) => (
              <LeagueCard key={league.id} league={league} onClick={() => navigate(`/leagues/${league.id}`)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 mx-auto mb-6 opacity-30" />
            <h3 className="font-black text-2xl mb-3 text-gray-900" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>No leagues found</h3>
            <p className="text-base mb-6" style={{ color: "#6B7280", fontFamily: "'IBM Plex Sans', sans-serif", maxWidth: "400px", margin: "0 auto" }}>No leagues match your current filters. Try clearing them to see all open leagues.</p>
            <button
              onClick={() => { setFilters({ sport: "", country: "", city: "", status: "", season_id: "", division: "", format: "", search: "" }); setSearchParams({}); }}
              className="px-6 py-3 rounded-lg font-semibold transition-all"
              style={{ background: "#10B981", color: "white", fontFamily: "'IBM Plex Sans', sans-serif" }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LeagueCard({ league, onClick }) {
  const config = SPORT_CONFIG[league.sport] || { badge: "bg-gray-100", icon: "🏆", label: league.sport };
  const spotsLeft = league.max_players - (league.current_players || 0);
  const fillPct = Math.round(((league.current_players || 0) / league.max_players) * 100);
  const isEnded = league.status === "completed" || league.status === "cancelled";
  const isFull = league.status === "registration" && spotsLeft <= 0;

  return (
    <div
      className="bg-white rounded-lg border cursor-pointer transition-all duration-300 hover:shadow-2xl overflow-hidden flex flex-col hover:scale-105"
      style={{ borderColor: "#E5E7EB" }}
      data-testid={`league-card-${league.id}`}
    >
      {/* Sport top bar */}
      <div
        className="h-1.5 w-full"
        style={{
          backgroundColor:
            league.sport === "tennis" ? "#10B981" : league.sport === "cricket" ? "#2563EB" : "#F97316",
        }}
      />

      <div className="p-6 flex-1 flex flex-col">
        {/* Sport badge + status */}
        <div className="flex items-start justify-between mb-3">
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{
              background:
                league.sport === "tennis"
                  ? "#D1FAE5"
                  : league.sport === "cricket"
                    ? "#DBEAFE"
                    : "#FED7AA",
              color: league.sport === "tennis" ? "#065F46" : league.sport === "cricket" ? "#1E40AF" : "#92400E",
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            {config.icon} {config.label}
          </span>
          {isEnded && (
            <span
              className="text-xs font-semibold px-2 py-1 rounded-md"
              style={{ background: "#F3F4F6", color: "#6B7280", fontFamily: "'IBM Plex Sans', sans-serif" }}
            >
              Ended
            </span>
          )}
        </div>

        {/* League name */}
        <h3
          className="font-black text-xl mb-3 line-clamp-2 leading-snug text-gray-900"
          style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
        >
          {league.name}
        </h3>

        {/* City + Format */}
        <div className="flex items-center gap-3 mb-4 text-sm" style={{ color: "#6B7280", fontFamily: "'IBM Plex Sans', sans-serif" }}>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: "#10B981" }} />
            <span className="font-medium">{league.city}</span>
          </div>
          {league.format && (
            <>
              <span>•</span>
              <span className="font-medium">{league.format === "mixed_doubles" ? "Mixed" : league.format.charAt(0).toUpperCase() + league.format.slice(1)}</span>
            </>
          )}
        </div>

        {/* Spots available */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-2" style={{ color: "#6B7280", fontFamily: "'IBM Plex Sans', sans-serif" }}>
            <span>{league.current_players || 0} joined</span>
            <span style={{ fontWeight: 600, color: isFull ? "#DC2626" : "#6B7280" }}>
              {isFull ? "Full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${fillPct}%`,
                backgroundColor: isFull ? "#DC2626" : league.sport === "tennis" ? "#10B981" : league.sport === "cricket" ? "#2563EB" : "#F97316",
              }}
            />
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer: Entry fee + Join button */}
        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "#F3F4F6" }}>
          <span className="text-sm font-bold" style={{ color: league.entry_fee && league.entry_fee > 0 ? "#F97316" : "#10B981", fontFamily: "'Sora', system-ui, sans-serif" }}>
            {league.entry_fee && league.entry_fee > 0 ? `$${league.entry_fee}` : "Free"}
          </span>
          <button
            onClick={onClick}
            className="text-sm font-bold px-4 py-2 rounded-md transition-all duration-200 disabled:opacity-50 hover:scale-110"
            style={{
              background: isFull ? "#E5E7EB" : "#047857",
              color: isFull ? "#6B7280" : "white",
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
            disabled={isFull}
            data-testid={`league-join-${league.id}`}
          >
            {isFull ? "Full" : "Join"}
          </button>
        </div>
      </div>
    </div>
  );
}
