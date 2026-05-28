import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { Search, MapPin, Users, Calendar, Trophy } from "lucide-react";
import platformConfig, { activeSports } from "../config/platformConfig";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

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
  registration: "bg-green-50 text-green-700",
  active: "bg-blue-50 text-blue-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
};

const FORMAT_COLORS = {
  singles: "bg-gray-100 text-gray-600",
  doubles: "bg-blue-50 text-blue-700",
  mixed_doubles: "bg-gray-100 text-gray-600",
};

// DUPR → division mapping for pickleball league join pre-selection.
// When the join flow gains a division selection step (modal or page),
// use this to pre-select the matching division based on user.dupr_rating:
//
//   const suggestedDivision = league.sport === "pickleball" && user?.dupr_rating
//     ? DUPR_TO_DIVISION[user.dupr_rating]
//     : null;
//
// Then pass `suggestedDivision` as the default value for the division picker.
const DUPR_TO_DIVISION = {
  "2.0-3.0": "Beginner",
  "3.0-3.5": "Intermediate",
  "3.5-4.5": "Advanced",
  "4.5+": "Competitive",
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
    division: searchParams.get("division") || "",
    format: searchParams.get("format") || "",
    search: "",
  });

  useEffect(() => {
    fetchLeagues();
  }, [filters.sport, filters.country, filters.city, filters.status, filters.season_id, filters.division, filters.format]);

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
    <div className="min-h-screen" style={{ background: "#FFFFFF" }} data-testid="leagues-page">
      {/* Header */}
      <div className="border-b" style={{ background: "white", borderColor: "#E5E7EB" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "#C24A1D" }}>All Leagues</p>
          <h1 className="font-heading font-black text-4xl sm:text-5xl mb-2" style={{ color: "#111827" }}>Browse Leagues</h1>
          <p className="max-w-lg" style={{ color: "#6B7280" }}>Find and join competitive leagues across all sports and cities</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="rounded-2xl p-4 mb-8 flex flex-wrap gap-3" style={{ background: "white", border: "1px solid #E5E7EB" }}>
          {/* Search */}
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search leagues..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-transparent" style={{ border: "1px solid #E5E7EB", color: "#111827" }}
              data-testid="filter-search"
            />
          </div>

          {/* Sport Filter */}
          <select
            value={filters.sport}
            onChange={(e) => updateFilter("sport", e.target.value)}
            className="px-4 py-2.5 rounded-xl text-sm bg-white focus:outline-none" style={{ border: "1px solid #E5E7EB", color: "#111827" }}
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
              className="px-4 py-2.5 rounded-xl text-sm bg-white focus:outline-none" style={{ border: "1px solid #E5E7EB", color: "#111827" }}
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
            placeholder="Filter by city"
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
            className="px-4 py-2.5 rounded-xl text-sm bg-white focus:outline-none" style={{ border: "1px solid #E5E7EB", color: "#111827" }}
            data-testid="filter-status"
          >
            <option value="">Any Status</option>
            <option value="registration">Open Registration</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>

          {(filters.sport || filters.city || filters.status || filters.division || filters.format) && (
            <button
              onClick={() => { setFilters({ sport: "", country: "", city: "", status: "", season_id: "", division: "", format: "", search: "" }); setSearchParams({}); }}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-black border border-gray-200 rounded-xl"
              data-testid="clear-filters"
            >
              Clear Filters
            </button>)}

          {/* Division filter */}
          <div className="w-full flex flex-wrap gap-2 mt-1">
            {["", "Beginner", "Intermediate", "Advanced", "Competitive"].map((div) => (
              <button
                key={div || "all"}
                data-testid={`division-filter-${div || "all"}`}
                onClick={() => setFilters((f) => ({ ...f, division: div }))}
                className="px-3 py-1 rounded-full text-sm font-medium border transition-colors"
                style={filters.division === div
                  ? { background: "#111827", borderColor: "#111827", color: "white" }
                  : { background: "white", borderColor: "#E5E7EB", color: "#374151" }}
              >
                {div || "All Levels"}
              </button>
            ))}
          </div>

          {/* Format filter */}
          <div className="w-full flex flex-wrap gap-2">
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
                className="px-3 py-1 rounded-full text-sm font-medium border transition-colors"
                style={filters.format === value
                  ? { background: "#C24A1D", borderColor: "#C24A1D", color: "white" }
                  : { background: "white", borderColor: "#E5E7EB", color: "#374151" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm" style={{ color: "#6B7280" }} data-testid="leagues-count">
            {loading ? "Loading..." : `${filteredLeagues.length} league${filteredLeagues.length !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {/* League Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 bg-white rounded-2xl animate-pulse" style={{ border: "1px solid #E5E7EB" }} />
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
            <Trophy className="w-12 h-12 mx-auto mb-4" style={{ color: "#E5E7EB" }} />
            <h3 className="font-heading font-bold text-xl mb-2" style={{ color: "#111827" }}>No leagues found</h3>
            <p className="text-sm mb-4" style={{ color: "#6B7280" }}>No leagues match your current filters. Clear them to see all open leagues.</p>
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
      className={`bg-white rounded-2xl overflow-hidden cursor-pointer ${isEnded ? "opacity-60" : "league-card-hover"}`}
      style={{ border: `1px solid ${isAlmostFull ? "#C9572A" : "#E5E7EB"}` }}
      data-testid={`league-card-${league.id}`}
    >
      <div className={`h-1.5 ${league.sport === "tennis" ? "bg-tennis" : league.sport === "cricket" ? "bg-cricket" : "bg-pickleball"}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${config.badge}`}>
            {config.icon} {config.label}
          </span>
          {isEnded ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#F3F4F6", color: "#6B7280" }}>
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

        <h3 className="font-heading font-bold mb-1 line-clamp-2 leading-tight" style={{ color: "#111827" }}>{league.name}</h3>

        <div className="flex items-center gap-1 text-xs mb-1" style={{ color: "#6B7280" }}>
          <MapPin className="w-3 h-3 flex-shrink-0" /> {league.city}
        </div>

        <div className="flex items-center gap-3 text-xs mb-3">
          <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: "#F3F4F6", color: "#374151" }}>
            {league.format === "mixed_doubles" ? "Mixed Doubles" : league.format ? league.format.charAt(0).toUpperCase() + league.format.slice(1) : ""}
          </span>
          <span style={{ color: "#E5E7EB" }}>•</span>
          <span className="flex items-center gap-1" style={{ color: "#6B7280" }}><Calendar className="w-3 h-3" /> {fmtDate(league.start_date)}</span>
        </div>

        {/* Division badge */}
        <div className="mb-4">
          {league.division_label ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: "#F3F4F6", color: "#C24A1D", border: "1px solid #E5E7EB" }}>
              {league.division_label}
              {league.division_ntrp_min && (
                <span className="ml-1" style={{ color: "#6B7280" }}>
                  ({league.division_ntrp_min}–{league.division_ntrp_max || "+"}{" "}
                  {league.sport === "pickleball" ? "DUPR" : "NTRP"})
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: "#FFFFFF", color: "#6B7280", border: "1px solid #E5E7EB" }}>
              Open Division
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span style={{ color: "#6B7280" }}>{league.current_players || 0} joined</span>
            <span style={{ color: isAlmostFull ? "#C9572A" : isFull ? "#DC2626" : "#6B7280", fontWeight: (isAlmostFull || isFull) ? 600 : 400 }}>
              {isFull ? "League full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
            <div
              className={`h-full rounded-full transition-[width] ${isFull ? "bg-red-500" : isAlmostFull ? "bg-orange-400" : league.sport === "tennis" ? "bg-tennis" : league.sport === "cricket" ? "bg-cricket" : "bg-pickleball"}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[league.status] || "bg-gray-50 text-gray-500"}`}>
            {league.status?.charAt(0).toUpperCase() + league.status?.slice(1)}
          </span>
          <span className="text-xs" style={{ color: "#E5E7EB" }}>{league.season}</span>
        </div>
      </div>
    </div>
  );
}
