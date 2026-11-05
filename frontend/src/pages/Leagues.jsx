import { useState, useEffect } from "react";
import PageHero from "../components/PageHero";
import { GALLERY, PHOTOS } from "../config/photos";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Search, MapPin, ArrowRight, CalendarDays } from "lucide-react";
import platformConfig, { activeSports } from "../config/platformConfig";
import { useSiteSettings } from "../contexts/SiteSettingsContext";
import NotifyMeModal from "../components/NotifyMeModal";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";
import Slant from "../components/Slant";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const ALL_SPORT_CONFIG = {
  tennis: { badge: "sport-badge-tennis", color: "text-tennis", icon: "🎾", label: "Tennis" },
  cricket: { badge: "sport-badge-cricket", color: "text-cricket", icon: "🏏", label: "Cricket" },
  pickleball: { badge: "sport-badge-pickleball", color: "text-pickleball", icon: "🏓", label: "Pickleball" },
};

// "all" shows every active sport; it is the default for a player who opted into more than one
const ALL_SPORTS = "all";

const SPORT_CONFIG = Object.fromEntries(
  activeSports.map((s) => [s.id, ALL_SPORT_CONFIG[s.id]]).filter(([, v]) => v)
);

export default function Leagues() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isCityOpen } = useSiteSettings();
  const [waitlisted, setWaitlisted] = useState([]);
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
    const preferred = (user.sport_preferences || []).filter((id) => activeSports.some((s) => s.id === id));
    const byPrefs = preferred.length > 1 ? ALL_SPORTS : preferred[0];
    setFilters(prev => ({
      ...prev,
      sport: prev.sport || byPrefs || platformConfig.defaultSport || "",
      city:  prev.city  || user.city || "",
    }));
  }, [user?.id]);

  useEffect(() => {
    if (!user) { setWaitlisted([]); return; }
    axios.get(`${API}/league-waitlist/my`, { withCredentials: true })
      .then((r) => setWaitlisted(r.data.league_ids || []))
      .catch(() => {});
  }, [user?.id]);

  const joinWaitlist = async (league) => {
    if (!user) { navigate("/auth"); return; }
    try {
      await axios.post(`${API}/league-waitlist/${league.id}`, {}, { withCredentials: true });
      setWaitlisted((w) => (w.includes(league.id) ? w : [...w, league.id]));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not join the waitlist. Please try again.");
    }
  };
  const waitlist = { ids: waitlisted, join: joinWaitlist };

  // Sport and city are applied in the browser so the sport cards can show counts for every sport
  useEffect(() => {
    fetchLeagues();
  }, [filters.country, filters.status, filters.season_id, filters.division]);

  const fetchLeagues = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.country) params.set("country", filters.country);
      if (filters.status) params.set("status", filters.status);
      if (filters.season_id) params.set("season_id", filters.season_id);
      if (filters.division) params.set("division", filters.division);
      params.set("limit", "200");
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

  const spotsOf = (l) => l.max_players - (l.current_players || 0);
  const isClosed = (l) => l.status !== "registration" || spotsOf(l) <= 0;
  const isOpenNow = (l) => !isClosed(l) && isCityOpen(l.city);
  const isOpensSoon = (l) => !isClosed(l) && !isCityOpen(l.city);

  const sportLeagues = leagues.filter((l) => !filters.sport || filters.sport === ALL_SPORTS || l.sport === filters.sport);
  const cityOptions = [...new Set(sportLeagues.filter((l) => !isClosed(l)).map((l) => l.city))].sort();
  const cityActive = filters.city && cityOptions.includes(filters.city) ? filters.city : "";
  const cityMissing = filters.city && !cityOptions.includes(filters.city);

  const filteredLeagues = sportLeagues.filter((l) => {
    if (cityActive && l.city !== cityActive) return false;
    if (filters.search && !l.name.toLowerCase().includes(filters.search.toLowerCase()) && !l.city.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.format && l.format !== filters.format) return false;
    return true;
  });
  const openNow = filteredLeagues.filter(isOpenNow);
  const opensSoon = filteredLeagues.filter(isOpensSoon);
  const running = filteredLeagues.filter((l) => l.status === "active");
  const closed = filteredLeagues.filter((l) => isClosed(l) && l.status !== "active");

  const sportCard = (s) => {
    const open = leagues.filter((l) => l.sport === s.id && isOpenNow(l));
    const mine = user?.city ? open.filter((l) => l.city === user.city).length : 0;
    return { open: open.length, mine };
  };

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
        {!filters.sport ? (
          /* Step 1: pick a sport */
          <div data-testid="sport-picker">
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "#008F70" }}>Step 1</p>
            <h2 className="font-bold text-3xl md:text-4xl mb-8" style={{ color: "#3D3D3D", fontFamily: "Rubik, system-ui, sans-serif" }}>What do you want to play?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {activeSports.map((s) => {
                const c = sportCard(s);
                return (
                  <button key={s.id} onClick={() => updateFilter("sport", s.id)} className="group text-left" data-testid={`sport-card-${s.id}`}>
                    <Slant src={PHOTOS[s.id]} alt={`${s.label} league play`} dir="right" className="aspect-[16/10] transition-transform group-hover:scale-[1.02]" />
                    <p className="mt-4 font-bold text-2xl flex items-center gap-2" style={{ color: "#3D3D3D", fontFamily: "Rubik, system-ui, sans-serif" }}>
                      {s.label} <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </p>
                    <p className="text-sm" style={{ color: "#5C5C5C" }}>
                      {loading ? "Loading..." : `${c.open} open league${c.open !== 1 ? "s" : ""}${c.mine ? ` · ${c.mine} in ${user.city}` : ""}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Sport tabs + city */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
              <div className="flex gap-2" role="tablist" aria-label="Sport">
                {activeSports.length > 1 && (
                  <button
                    role="tab"
                    aria-selected={filters.sport === ALL_SPORTS}
                    onClick={() => updateFilter("sport", ALL_SPORTS)}
                    className="px-5 py-2.5 text-sm font-bold border transition-colors"
                    style={filters.sport === ALL_SPORTS
                      ? { background: "#1D1D1D", borderColor: "#1D1D1D", color: "white" }
                      : { background: "white", borderColor: "#E5E7EB", color: "#3D3D3D" }}
                    data-testid="sport-tab-all"
                  >
                    All sports
                  </button>
                )}
                {activeSports.map((s) => (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={filters.sport === s.id}
                    onClick={() => updateFilter("sport", s.id)}
                    className="px-5 py-2.5 text-sm font-bold border transition-colors"
                    style={filters.sport === s.id
                      ? { background: "#008F70", borderColor: "#008F70", color: "white" }
                      : { background: "white", borderColor: "#E5E7EB", color: "#3D3D3D" }}
                    data-testid={`sport-tab-${s.id}`}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <MapPin className="w-4 h-4" style={{ color: "#008F70" }} aria-hidden="true" />
                <label htmlFor="city-select" className="text-sm font-medium" style={{ color: "#5C5C5C" }}>City</label>
                <select
                  id="city-select"
                  value={cityActive}
                  onChange={(e) => updateFilter("city", e.target.value)}
                  className="px-3 py-2.5 text-sm bg-white border focus:outline-none"
                  style={{ borderColor: "#E5E7EB", color: "#3D3D3D", minWidth: "160px" }}
                  data-testid="filter-city"
                >
                  <option value="">All cities</option>
                  {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {cityMissing && (
              <p className="mb-6 text-sm px-4 py-3" style={{ background: "#F1F1F1", color: "#3D3D3D" }} data-testid="city-missing-note">
                No open {filters.sport === ALL_SPORTS ? "" : `${SPORT_CONFIG[filters.sport]?.label || filters.sport} `}leagues in {filters.city} yet, so we are showing every city.
              </p>
            )}

            <div className="relative mb-8">
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

            {error && (
              <div className="px-4 py-4 rounded-lg text-sm mb-6" style={{ background: "#FEE2E2", border: "1px solid #FECACA", color: "#DC2626" }} role="alert" data-testid="leagues-error">
                ⚠ {error}
              </div>
            )}

            {loading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-64 bg-white rounded-lg animate-pulse border" style={{ borderColor: "#E5E7EB" }} />
                ))}
              </div>
            ) : (
              <>
                <LeagueGroup title="Open now" hint="Registration is open. Join any of these." leagues={openNow} testId="group-open-now" navigate={navigate} waitlist={waitlist} empty="No open leagues match these filters." />
                {opensSoon.length > 0 && (
                  <LeagueGroup title="Opens soon" hint="Not open in these cities yet. Tap Notify me and we will tell you first." leagues={opensSoon} testId="group-opens-soon" navigate={navigate} waitlist={waitlist} />
                )}
                {running.length > 0 && (
                  <LeagueGroup title="Running now" hint="These leagues have started. Join the waitlist and we place you if a spot opens." leagues={running} testId="group-running" navigate={navigate} waitlist={waitlist} />
                )}
                {closed.length > 0 && (
                  <details className="mt-12" data-testid="group-closed">
                    <summary className="cursor-pointer font-bold text-lg" style={{ color: "#5C5C5C", fontFamily: "Rubik, system-ui, sans-serif" }}>
                      Full or finished ({closed.length})
                    </summary>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                      {closed.map((league) => (
                        <LeagueCard key={league.id} league={league} onClick={() => navigate(`/leagues/${league.id}`)} waitlist={waitlist} />
                      ))}
                    </div>
                  </details>
                )}
                {(cityActive || filters.format || filters.division || filters.search) && (
                  <button
                    onClick={() => { setFilters((f) => ({ ...f, city: "", division: "", format: "", search: "" })); const np = new URLSearchParams(searchParams); ["city", "division", "format"].forEach((k) => np.delete(k)); setSearchParams(np); }}
                    className="mt-10 text-sm font-medium text-gray-600 hover:text-[#3D3D3D] underline"
                    data-testid="clear-filters"
                  >
                    Clear filters
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LeagueGroup({ title, hint, leagues, testId, navigate, waitlist, empty }) {
  if (leagues.length === 0 && !empty) return null;
  return (
    <section className="mt-10 first:mt-0" data-testid={testId}>
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="font-bold text-2xl" style={{ color: "#3D3D3D", fontFamily: "Rubik, system-ui, sans-serif" }}>{title}</h2>
        <span className="text-sm font-medium" style={{ color: "#6B7280" }} data-testid={`${testId}-count`}>{leagues.length}</span>
      </div>
      <p className="text-sm mb-5" style={{ color: "#5C5C5C" }}>{hint}</p>
      {leagues.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leagues.map((league) => (
            <LeagueCard key={league.id} league={league} onClick={() => navigate(`/leagues/${league.id}`)} waitlist={waitlist} />
          ))}
        </div>
      ) : (
        <p className="text-sm py-6" style={{ color: "#6B7280" }}>{empty}</p>
      )}
    </section>
  );
}

// Each sport gets its own look: tennis is green on white, pickleball is amber on warm cream
const SPORT_THEME = {
  tennis: { accent: "#008F70", dark: "#00765C", onAccent: "#FFFFFF", tint: "#FFFFFF", chip: "#E6F4F0" },
  pickleball: { accent: "#F2A922", dark: "#8A5F00", onAccent: "#1D1D1D", tint: "#FFF8E8", chip: "#FCEBC2" },
};
const FALLBACK_THEME = SPORT_THEME.tennis;

const FORMAT_LABEL = { singles: "Singles", doubles: "Doubles", mixed_doubles: "Mixed doubles" };

function shortDate(iso, withYear = false) {
  const d = new Date(`${String(iso || "").slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}

// A stable pick from the sport's photos so neighbouring cards do not all show the same shot
function cardPhoto(league) {
  const set = GALLERY[league.sport];
  if (!set?.length) return PHOTOS[league.sport] || PHOTOS.hero;
  const n = String(league.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return set[n % set.length];
}

function LeagueCard({ league, onClick, waitlist }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const config = SPORT_CONFIG[league.sport] || { icon: "🏆", label: league.sport };
  const theme = SPORT_THEME[league.sport] || FALLBACK_THEME;
  const spotsLeft = league.max_players - (league.current_players || 0);
  const fillPct = Math.round(((league.current_players || 0) / league.max_players) * 100);
  const isEnded = league.status === "completed" || league.status === "cancelled";
  const isFull = league.status === "registration" && spotsLeft <= 0;
  // Leagues outside the launch city are visible but cannot be joined yet; offer Notify Me instead.
  const { isCityOpen } = useSiteSettings();
  const opensSoon = league.status === "registration" && !isCityOpen(league.city);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const isRunning = league.status === "active";
  const onWaitlist = !!waitlist?.ids.includes(league.id);
  const perUnit = league.format === "singles" ? "per player" : "per team";
  const startIso = String(league.start_date || "").slice(0, 10);
  const started = startIso && startIso <= new Date().toISOString().slice(0, 10);
  // Open leagues say when they start; running ones say when they began and end; finished ones show the whole span
  const dateText = isEnded
    ? [shortDate(league.start_date, true), shortDate(league.end_date, true)].filter(Boolean).join(" to ")
    : started
      ? `Started ${shortDate(league.start_date)}${league.end_date ? ` · Ends ${shortDate(league.end_date)}` : ""}`
      : shortDate(league.start_date) && `Starts ${shortDate(league.start_date)}`;

  return (
    <div
      className="group bg-white border cursor-pointer overflow-hidden flex flex-col transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
      style={{ borderColor: "#E4E4E4", background: theme.tint }}
      onClick={onClick}
      data-testid={`league-card-${league.id}`}
      data-sport={league.sport}
    >
      {/* Photo with a slanted lower edge */}
      <div className="relative h-44 overflow-hidden" style={{ clipPath: "polygon(0 0, 100% 0, 100% 90%, 0 100%)" }}>
        <img src={cardPhoto(league)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(29,29,29,0.82), rgba(29,29,29,0.05) 65%)" }} />
        <span
          className="absolute top-0 left-0 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em]"
          style={{ background: theme.accent, color: theme.onAccent }}
        >
          {config.label}
        </span>
        {(opensSoon || isEnded || isFull) && (
          <span
            className="absolute top-3 right-3 px-2.5 py-1 text-xs font-bold bg-white"
            style={{ color: "#1D1D1D" }}
            data-testid={opensSoon ? `league-opens-soon-${league.id}` : undefined}
          >
            {opensSoon ? "Opens soon" : isEnded ? "Ended" : "Full"}
          </span>
        )}
        <div className="absolute bottom-5 left-4 right-4 flex items-end justify-between gap-3 text-white">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" /> {league.city}
          </span>
          {league.format && (
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-1" style={{ background: "rgba(255,255,255,0.16)", backdropFilter: "blur(4px)" }}>
              {FORMAT_LABEL[league.format] || league.format}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 pt-3 flex-1 flex flex-col">
        <h3 className="font-bold text-xl leading-snug line-clamp-2 text-[#1D1D1D]" style={{ fontFamily: "Rubik, system-ui, sans-serif" }}>
          {league.name}
        </h3>
        {dateText && (
          <p className="mt-2 flex items-center gap-1.5 text-sm" style={{ color: "#4C4C4C", fontFamily: "'IBM Plex Mono', monospace" }} data-testid={`league-dates-${league.id}`}>
            <CalendarDays className="w-4 h-4 shrink-0" style={{ color: theme.dark }} aria-hidden="true" /> {dateText}
          </p>
        )}

        {isRunning && (
          <p className="mt-2 text-xs" style={{ color: "#4C4C4C" }} data-testid={`league-waitlist-note-${league.id}`}>
            Running now. Join the waitlist and we place you if a spot opens.
          </p>
        )}

        {isAdmin && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: "#6B7280" }}>
              <span>{league.current_players || 0}/{league.max_players} players</span>
              <span style={{ fontWeight: 600, color: isFull ? "#DC2626" : "#6B7280" }}>{isFull ? "League Full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}</span>
            </div>
            <div className="h-1.5 overflow-hidden" style={{ background: "#E4E4E4" }}>
              <div className="h-full transition-[width] duration-300" style={{ width: `${fillPct}%`, backgroundColor: isFull ? "#DC2626" : theme.accent }} />
            </div>
          </div>
        )}

        <div className="flex-1" />

        <div className="mt-5 pt-4 flex items-center justify-between border-t" style={{ borderColor: "rgba(29,29,29,0.1)" }}>
          <div>
            <span className="text-2xl font-bold leading-none" style={{ color: "#1D1D1D", fontFamily: "'IBM Plex Mono', monospace" }}>
              {league.entry_fee > 0 ? `$${league.entry_fee}` : "Free"}
            </span>
            {league.entry_fee > 0 && <span className="ml-1.5 text-xs" style={{ color: "#6B7280" }}>{perUnit}</span>}
          </div>
          {isEnded ? (
            <span className="text-sm font-bold uppercase tracking-wider" style={{ color: "#6B7280" }} data-testid={`league-ended-${league.id}`}>Season ended</span>
          ) : isRunning ? (
            <button
              onClick={(ev) => { ev.stopPropagation(); if (!onWaitlist) waitlist?.join(league); }}
              disabled={onWaitlist}
              className="text-sm font-bold uppercase tracking-wider px-5 py-2.5 transition-colors disabled:opacity-70 hover:brightness-90"
              style={{ background: onWaitlist ? "#E4E4E4" : theme.accent, color: onWaitlist ? "#4C4C4C" : theme.onAccent }}
              data-testid={`league-waitlist-${league.id}`}
            >
              {onWaitlist ? "On the waitlist" : "Join waitlist"}
            </button>
          ) : opensSoon ? (
            <button
              onClick={(ev) => { ev.stopPropagation(); setNotifyOpen(true); }}
              className="text-sm font-bold uppercase tracking-wider px-5 py-2.5 transition-colors hover:bg-[#1D1D1D] hover:text-white"
              style={{ background: "#F2A922", color: "#1D1D1D" }}
              data-testid={`league-notify-${league.id}`}
            >
              Notify me
            </button>
          ) : (
            <button
              onClick={(ev) => { ev.stopPropagation(); onClick(); }}
              className="text-sm font-bold uppercase tracking-wider px-5 py-2.5 transition-colors disabled:opacity-60 hover:brightness-90"
              style={{ background: isFull ? "#E4E4E4" : theme.accent, color: isFull ? "#6B7280" : theme.onAccent }}
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
