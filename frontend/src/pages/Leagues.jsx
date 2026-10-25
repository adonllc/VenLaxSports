import { useState, useEffect } from "react";
import PageHero from "../components/PageHero";
import { GALLERY, PHOTOS } from "../config/photos";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Search, MapPin, Trophy } from "lucide-react";
import platformConfig, { activeSports } from "../config/platformConfig";
import { useSiteSettings } from "../contexts/SiteSettingsContext";
import NotifyMeModal from "../components/NotifyMeModal";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";

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
  const [error, setError] = useState(null);
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
    setError(null);
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
      setError("Unable to load leagues. Please try again.");
      setLeagues([]);
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

  // Real ItemList of the leagues actually rendered below — only emitted once
  // they've loaded, so we never ship a schema block with made-up entries.
  const leaguesJsonLd = !loading && filteredLeagues.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": filteredLeagues.map((l, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "SportsEvent",
        "name": l.name,
        "sport": l.sport,
        "image": [`https://venlaxsports.com${PHOTOS[l.sport] || PHOTOS.hero}`],
        "startDate": l.start_date,
        "endDate": l.end_date,
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": l.city,
          "address": { "@type": "PostalAddress", "addressLocality": l.city, "addressCountry": "US" },
        },
        "organizer": { "@type": "SportsOrganization", "name": "VENLAX Sports", "url": "https://venlaxsports.com" },
        "offers": {
          "@type": "Offer",
          "price": l.entry_fee || 0,
          "priceCurrency": "USD",
          "availability": (l.max_players - (l.current_players || 0)) > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
          "url": `https://venlaxsports.com/leagues/${l.id}`,
        },
      },
    })),
  } : undefined;

  useDocumentMeta({
    title: "Browse Tennis & Pickleball Leagues Near You | VENLAX Sports",
    description: "Find ranked Tennis and Pickleball leagues by city, skill level, and format. Singles, doubles, and mixed doubles — new seasons open year-round.",
    canonicalPath: "/leagues",
    jsonLd: leaguesJsonLd,
  });

  return (
    <div className="min-h-screen bg-white" data-testid="leagues-page">
      <PageHero compact src={GALLERY.tennis[2]} alt="Tennis court at dusk" eyebrow="Leagues" title="Browse Leagues" subtitle="A VENLAX league is a ranked season of Tennis or Pickleball matches against players at your level. Find one in your city." />
      <h2 className="sr-only">Available leagues</h2>

      {/* Promo Banner */}
      <div className="sticky top-0 z-10 border-b" style={{ background: "#F2A922", borderColor: "#F2A922" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <p className="text-sm font-semibold text-[#3D3D3D]" style={{ fontFamily: "Rubik, sans-serif" }}>
            First league free! Use code <code className="bg-[#3D3D3D] px-2 py-0.5 font-mono text-white text-xs">PLAY1FREE</code>
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
              style={{ borderColor: "#E5E7EB", color: "#3D3D3D", fontFamily: "Rubik, sans-serif" }}
              data-testid="filter-search"
            />
          </div>

          {/* Sport Filter */}
          <select
            value={filters.sport}
            onChange={(e) => updateFilter("sport", e.target.value)}
            className="px-4 py-3 rounded-lg text-sm bg-white border focus:outline-none"
            style={{ borderColor: "#E5E7EB", color: "#3D3D3D", fontFamily: "Rubik, sans-serif", minWidth: "160px" }}
            data-testid="filter-sport"
            aria-label="Filter leagues by sport"
          >
            <option value="">All Sports</option>
            {activeSports.map((s) => (
              <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
            ))}
          </select>
        </div>

        {/* Secondary Filters — Division + Format toggles */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B7280", fontFamily: "Rubik, sans-serif" }}>Skill Level</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {["", "Beginner", "Intermediate", "Advanced", "Competitive"].map((div) => (
              <button
                key={div || "all"}
                data-testid={`division-filter-${div || "all"}`}
                onClick={() => setFilters((f) => ({ ...f, division: div }))}
                className="px-4 py-2 rounded-md text-sm font-medium border transition-all duration-200"
                style={filters.division === div
                  ? { background: "#008F70", borderColor: "#008F70", color: "white" }
                  : { background: "white", borderColor: "#E5E7EB", color: "#6B7280" }}
                aria-label={`Filter by skill level: ${div || "All"}`}
                aria-pressed={filters.division === div}
              >
                {div || "All Levels"}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B7280", fontFamily: "Rubik, sans-serif" }}>Match Type</p>
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
                  ? { background: "#F2A922", borderColor: "#F2A922", color: "white" }
                  : { background: "white", borderColor: "#E5E7EB", color: "#6B7280" }}
                aria-label={`Filter by match type: ${label}`}
                aria-pressed={filters.format === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count + Clear */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-medium" style={{ color: "#6B7280", fontFamily: "Rubik, sans-serif" }} data-testid="leagues-count">
            {loading ? "Loading..." : `${filteredLeagues.length} league${filteredLeagues.length !== 1 ? "s" : ""} found`}
          </p>
          {(filters.sport || filters.city || filters.status || filters.division || filters.format || filters.search) && (
            <button
              onClick={() => { setFilters({ sport: "", country: "", city: "", status: "", season_id: "", division: "", format: "", search: "" }); setSearchParams({}); }}
              className="text-sm font-medium text-gray-600 hover:text-[#3D3D3D] underline"
              data-testid="clear-filters"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="px-4 py-4 rounded-lg text-sm" style={{ background: "#FEE2E2", border: "1px solid #FECACA", color: "#DC2626" }} role="alert" data-testid="leagues-error">
            ⚠ {error}
          </div>
        )}

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
            <h3 className="font-bold text-2xl mb-3 text-[#3D3D3D]" style={{ fontFamily: "Rubik, system-ui, sans-serif" }}>No leagues found</h3>
            <p className="text-base mb-6" style={{ color: "#6B7280", fontFamily: "Rubik, sans-serif", maxWidth: "400px", margin: "0 auto" }}>No leagues match your current filters. Try clearing them to see all open leagues.</p>
            <button
              onClick={() => { setFilters({ sport: "", country: "", city: "", status: "", season_id: "", division: "", format: "", search: "" }); setSearchParams({}); }}
              className="px-6 py-3 rounded-lg font-semibold transition-all"
              style={{ background: "#008F70", color: "white", fontFamily: "Rubik, sans-serif" }}
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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const config = SPORT_CONFIG[league.sport] || { badge: "bg-gray-100", icon: "🏆", label: league.sport };
  const spotsLeft = league.max_players - (league.current_players || 0);
  const fillPct = Math.round(((league.current_players || 0) / league.max_players) * 100);
  const isEnded = league.status === "completed" || league.status === "cancelled";
  const isFull = league.status === "registration" && spotsLeft <= 0;
  // Leagues outside the launch city are visible but cannot be joined yet; offer Notify Me instead.
  const { isCityOpen } = useSiteSettings();
  const opensSoon = league.status === "registration" && !isCityOpen(league.city);
  const [notifyOpen, setNotifyOpen] = useState(false);

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
            league.sport === "tennis" ? "#008F70" : league.sport === "cricket" ? "#2563EB" : "#F2A922",
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
              color: league.sport === "tennis" ? "#00765C" : league.sport === "cricket" ? "#1E40AF" : "#92400E",
              fontFamily: "Rubik, sans-serif",
            }}
          >
            {config.icon} {config.label}
          </span>
          {opensSoon && (
            <span
              className="text-xs font-semibold px-2 py-1 rounded-md"
              style={{ background: "#F1F1F1", color: "#3D3D3D", fontFamily: "Rubik, sans-serif" }}
              data-testid={`league-opens-soon-${league.id}`}
            >
              Opens soon
            </span>
          )}
          {isEnded && (
            <span
              className="text-xs font-semibold px-2 py-1 rounded-md"
              style={{ background: "#F3F4F6", color: "#6B7280", fontFamily: "Rubik, sans-serif" }}
            >
              Ended
            </span>
          )}
        </div>

        {/* League name */}
        <h3
          className="font-bold text-xl mb-3 line-clamp-2 leading-snug text-[#3D3D3D]"
          style={{ fontFamily: "Rubik, system-ui, sans-serif" }}
        >
          {league.name}
        </h3>

        {/* City + Format */}
        <div className="flex items-center gap-3 mb-4 text-sm" style={{ color: "#6B7280", fontFamily: "Rubik, sans-serif" }}>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: "#008F70" }} />
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
          <div className="flex justify-between text-xs mb-2" style={{ color: "#6B7280", fontFamily: "Rubik, sans-serif" }}>
            {isAdmin ? <span>{league.current_players || 0}/{league.max_players} players</span> : <span />}
            <span style={{ fontWeight: 600, color: isFull ? "#DC2626" : "#6B7280" }}>
              {isFull ? "League Full" : isAdmin ? `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left` : ""}
            </span>
          </div>
          {isAdmin && (
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${fillPct}%`,
                backgroundColor: isFull ? "#DC2626" : league.sport === "tennis" ? "#008F70" : league.sport === "cricket" ? "#2563EB" : "#F2A922",
              }}
            />
          </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer: Entry fee + Join button */}
        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "#F3F4F6" }}>
          <span className="text-sm font-bold" style={{ color: league.entry_fee && league.entry_fee > 0 ? "#F2A922" : "#008F70", fontFamily: "Rubik, system-ui, sans-serif" }}>
            {league.entry_fee && league.entry_fee > 0 ? `$${league.entry_fee}` : "Free"}
          </span>
          {opensSoon ? (
            <button
              onClick={(ev) => { ev.stopPropagation(); setNotifyOpen(true); }}
              className="text-sm font-bold px-4 py-2 transition-colors hover:bg-[#3D3D3D] hover:text-white"
              style={{ background: "#F2A922", color: "#3D3D3D", fontFamily: "Rubik, sans-serif" }}
              data-testid={`league-notify-${league.id}`}
            >
              Notify me
            </button>
          ) : (
            <button
              onClick={onClick}
              className="text-sm font-bold px-4 py-2 rounded-md transition-all duration-200 disabled:opacity-50 hover:scale-110"
              style={{
                background: isFull ? "#E5E7EB" : "#008F70",
                color: isFull ? "#6B7280" : "white",
                fontFamily: "Rubik, sans-serif",
              }}
              disabled={isFull}
              data-testid={`league-join-${league.id}`}
            >
              {isFull ? "Full" : "Join"}
            </button>
          )}
        </div>
      </div>
      <NotifyMeModal isOpen={notifyOpen} onClose={() => setNotifyOpen(false)} city={league.city} sport={league.sport} />
    </div>
  );
}
