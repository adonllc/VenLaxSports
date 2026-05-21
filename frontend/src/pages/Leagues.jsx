import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { Search, MapPin, Users, Calendar, Trophy } from "lucide-react";
import platformConfig, { activeSports } from "../config/platformConfig";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// PHASE-DRIVEN: only active sports appear in the filter dropdown.
// PHASE 2 unlocks Cricket automatically via REACT_APP_PHASE=2.
const ALL_SPORT_CONFIG = {
  tennis: { badge: "sport-badge-tennis", color: "text-tennis", icon: "🎾", label: "Tennis" },
  cricket: { badge: "sport-badge-cricket", color: "text-cricket", icon: "🏏", label: "Cricket" },
  pickleball: { badge: "sport-badge-pickleball", color: "text-pickleball", icon: "🏓", label: "Pickleball" },
};

const SPORT_CONFIG = Object.fromEntries(
  activeSports.map((s) => [s.id, ALL_SPORT_CONFIG[s.id]]).filter(([, v]) => v)
);

const STATUS_COLORS = {
  registration: "bg-emerald-100 text-emerald-700",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
};

export default function Leagues() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    sport: searchParams.get("sport") || "",
    country: searchParams.get("country") || "",
    city: searchParams.get("city") || "",
    status: searchParams.get("status") || "",
    season_id: searchParams.get("season_id") || "",
    search: "",
  });

  useEffect(() => {
    fetchLeagues();
  }, [filters.sport, filters.country, filters.city, filters.status, filters.season_id]);

  useEffect(() => {
    // Seasons endpoint requires auth, so degrade gracefully if logged out
    axios.get(`${API}/seasons`, { withCredentials: true })
      .then(({ data }) => setSeasons(data))
      .catch(() => setSeasons([]));
  }, []);

  const fetchLeagues = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sport) params.set("sport", filters.sport);
      if (filters.country) params.set("country", filters.country);
      if (filters.city) params.set("city", filters.city);
      if (filters.status) params.set("status", filters.status);
      if (filters.season_id) params.set("season_id", filters.season_id);
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

  const filteredLeagues = leagues.filter((l) =>
    !filters.search || l.name.toLowerCase().includes(filters.search.toLowerCase()) || l.city.toLowerCase().includes(filters.search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50" data-testid="leagues-page">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 mb-2">All Leagues</p>
          <h1 className="font-heading font-black text-4xl sm:text-5xl text-gray-900 mb-2">Browse Leagues</h1>
          <p className="text-gray-500 max-w-lg">Find and join competitive leagues across all sports and cities</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-8 flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search leagues..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              data-testid="filter-search"
            />
          </div>

          {/* Sport Filter */}
          <select
            value={filters.sport}
            onChange={(e) => updateFilter("sport", e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
            data-testid="filter-sport"
          >
            <option value="">All Sports</option>
            {activeSports.map((s) => (
              <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
            ))}
          </select>

          {seasons.length > 0 && (
            <select
              value={filters.season_id}
              onChange={(e) => updateFilter("season_id", e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
              data-testid="filter-season"
            >
              <option value="">All Seasons</option>
              {seasons
                .filter((s) => !filters.sport || s.sport === filters.sport)
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
          )}

          {/* City Filter — free text, with seeded suggestions */}
          <input
            type="text"
            value={filters.city}
            onChange={(e) => updateFilter("city", e.target.value)}
            placeholder="Any city or 'All Cities'"
            list="leagues-city-list"
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black w-44"
            data-testid="filter-city"
          />
          <datalist id="leagues-city-list">
            <option value="All Cities" />
            {platformConfig.featuredCities.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
            data-testid="filter-status"
          >
            <option value="">All Status</option>
            <option value="registration">Open Registration</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>

          {(filters.sport || filters.city || filters.status) && (
            <button
              onClick={() => { setFilters({ sport: "", country: "", city: "", status: "", search: "" }); setSearchParams({}); }}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-black border border-gray-200 rounded-xl"
              data-testid="clear-filters"
            >
              Clear Filters
            </button>)}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-600" data-testid="leagues-count">
            {loading ? "Loading..." : `${filteredLeagues.length} league${filteredLeagues.length !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {/* League Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 bg-white rounded-2xl border border-gray-200 animate-pulse" />
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
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-heading font-bold text-xl text-gray-700 mb-2">No leagues found</h3>
            <p className="text-gray-500 text-sm">Try adjusting your filters</p>
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
  const isAlmostFull = league.status === "registration" && spotsLeft <= 3 && spotsLeft > 0;
  const isFull = league.status === "registration" && spotsLeft <= 0;

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-2xl overflow-hidden cursor-pointer ${isEnded ? "opacity-60" : "league-card-hover"} ${isAlmostFull ? "border-orange-300" : "border-gray-200"}`}
      data-testid={`league-card-${league.id}`}
    >
      <div className={`h-1.5 ${league.sport === "tennis" ? "bg-tennis" : league.sport === "cricket" ? "bg-cricket" : "bg-pickleball"}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${config.badge}`}>
            {config.icon} {config.label}
          </span>
          {isEnded ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
              Season Ended
            </span>
          ) : isFull ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-600" data-testid="badge-full">
              Full
            </span>
          ) : isAlmostFull ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-600 animate-pulse" data-testid="badge-almost-full">
              🔥 {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
            </span>
          ) : null}
        </div>

        <h3 className="font-heading font-bold text-gray-900 mb-1 line-clamp-2 leading-tight">{league.name}</h3>

        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
          <MapPin className="w-3 h-3 flex-shrink-0" /> {league.city}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
          <span className="capitalize">{league.format}</span>
          <span>•</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {league.start_date}</span>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-500">{league.current_players || 0} joined</span>
            <span className={isAlmostFull ? "text-orange-600 font-semibold" : isFull ? "text-red-600 font-semibold" : "text-gray-500"}>
              {isFull ? "League full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] ${isFull ? "bg-red-500" : isAlmostFull ? "bg-orange-400" : league.sport === "tennis" ? "bg-tennis" : league.sport === "cricket" ? "bg-cricket" : "bg-pickleball"}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[league.status] || "bg-gray-100 text-gray-600"}`}>
            {league.status?.charAt(0).toUpperCase() + league.status?.slice(1)}
          </span>
          <span className="text-xs text-gray-400">{league.season}</span>
        </div>
      </div>
    </div>
  );
}
