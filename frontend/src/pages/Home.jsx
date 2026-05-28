import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { MapPin, ArrowRight, Target, Zap, Shield, Activity, ChevronRight } from "lucide-react";
import platformConfig, { activeSportIds } from "../config/platformConfig";
import HowItWorks from "../components/HowItWorks";
import VenLaxHero from "../components/VenLaxHero";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SPORT_ICONS = { tennis: Target, pickleball: Zap, cricket: Shield };

const ALL_SPORT_CONFIG = {
  tennis: {
    accent: "#10B981",
    textOnAccent: "#ffffff",
    label: "Tennis",
    icon: "🎾",
    tagline: "Singles. Doubles. Mixed.",
    desc: "Skill-matched leagues with best-of-3 set formats, ELO ratings, and playoff brackets.",
    image: "https://images.unsplash.com/photo-1696661115319-a9b6801e2571?w=900&q=80",
    stats: ["Best-of-3 Sets", "Skill Rating", "2.0–5.0+"],
    num: "01",
    badge: "sport-badge-tennis",
  },
  cricket: {
    accent: "#2563EB",
    textOnAccent: "#ffffff",
    label: "Cricket",
    icon: "🏏",
    tagline: "T10. T20. Beyond.",
    desc: "Corporate and amateur cricket with NRR tracking, powerplay rules, and live scoring.",
    image: "https://images.pexels.com/photos/3602833/pexels-photo-3602833.jpeg?w=900",
    stats: ["T10 & T20", "NRR Tracking", "Corporate Leagues"],
    num: "02",
    badge: "sport-badge-cricket",
  },
  pickleball: {
    accent: "#F97316",
    textOnAccent: "#ffffff",
    label: "Pickleball",
    icon: "🏓",
    tagline: "Singles. Doubles. Mixed.",
    desc: "Rally scoring, win-by-2 rules, and skill-based ratings across top facilities.",
    image: "https://images.unsplash.com/photo-1777382141965-68d47862eaf9?w=900&q=80",
    stats: ["Rally Scoring", "Win-by-2", "DUPR Rating"],
    num: "03",
    badge: "sport-badge-pickleball",
  },
};

const SPORT_CONFIG = Object.fromEntries(
  activeSportIds.map((id) => [id, ALL_SPORT_CONFIG[id]]).filter(([, v]) => v)
);

// ── Color tokens ──────────────────────────────────────────────────
const PAGE_BG    = "#FFFFFF";
const SECTION_ALT = "#F9FAFB";
const ORANGE     = "#C9572A";
const ORANGE_DARK = "#B04823";
const ORANGE_PALE = "#FEF2EE";
const GREEN      = "#0B6E4F";
const BORDER     = "#E5E7EB";
const BORDER_LIGHT = "#F3F4F6";

const TEXT_PRIMARY = "#111827";
const TEXT_SECONDARY = "#374151";
const TEXT_MUTED = "#6B7280";
const TEXT_SUBTLE = "#9CA3AF";

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function Home() {
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [activeSport, setActiveSport] = useState(platformConfig.defaultSport);
  const [loading, setLoading] = useState(true);
  const [foundingStats, setFoundingStats] = useState({ count: 0, limit: 200, spots_left: 200 });

  useEffect(() => {
    const fetchLeagues = async () => {
      try { const { data } = await axios.get(`${API}/leagues?limit=6`); setLeagues(data); }
      catch (e) { console.error(e); } finally { setLoading(false); }
    };
    const fetchFoundingStats = async () => {
      try { const { data } = await axios.get(`${API}/founding-members`); setFoundingStats(data); }
      catch { /* non-critical */ }
    };
    fetchLeagues();
    fetchFoundingStats();
  }, []);

  const filteredLeagues = leagues.filter((l) => l.sport === activeSport).slice(0, 3);
  const sportEntries = Object.entries(SPORT_CONFIG);

  return (
    <div style={{ background: PAGE_BG }} data-testid="home-page">

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <div data-testid="hero-section">
        <VenLaxHero foundingStats={foundingStats} />
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <HowItWorks />

      {/* ── SPORT CARDS ──────────────────────────────────────────── */}
      <section className="py-20" style={{ background: SECTION_ALT }} data-testid="sport-cards-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="mb-14">
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em] mb-4"
              style={{ color: GREEN }}
            >
              Choose Your Sport
            </p>
            <h2
              className="font-heading font-black leading-[0.9] tracking-tight uppercase"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", color: TEXT_PRIMARY }}
            >
              Why Choose<br /><span style={{ color: ORANGE }}>VENLAX?</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {sportEntries.map(([sport, config]) => (
              <div
                key={sport}
                onClick={() => navigate(`/sport/${sport}`)}
                className="group rounded-2xl p-8 cursor-pointer transition-all duration-200 bg-white"
                style={{ border: `1px solid ${BORDER}` }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = config.accent;
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = `0 12px 40px ${config.accent}25`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = BORDER;
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                data-testid={`sport-card-${sport}`}
              >
                <div className="mb-5 flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: `${config.accent}15` }}
                  >
                    {config.icon}
                  </div>
                  <span
                    className="text-xs font-bold uppercase tracking-[0.14em]"
                    style={{ color: config.accent }}
                  >
                    Sport {ALL_SPORT_CONFIG[sport].num}
                  </span>
                </div>

                <h3
                  className="font-heading font-black leading-[0.9] tracking-tight mb-3 uppercase"
                  style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: TEXT_PRIMARY }}
                >
                  {config.label}
                </h3>

                <p className="text-sm leading-relaxed mb-6" style={{ color: TEXT_MUTED }}>
                  {config.desc}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {config.stats.map((s) => (
                    <span
                      key={s}
                      className="px-3 py-1 text-xs font-semibold rounded-full"
                      style={{ background: `${config.accent}15`, color: config.accent }}
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div
                  className="flex items-center gap-1.5 text-sm font-bold transition-all duration-200 group-hover:gap-2.5"
                  style={{ color: config.accent }}
                >
                  Explore {config.label} <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED LEAGUES ──────────────────────────────────────── */}
      <section className="py-20" style={{ background: PAGE_BG }} data-testid="featured-leagues-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-4">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ color: GREEN }}
              >
                Season Open
              </p>
              <h2
                className="font-heading font-black leading-[0.92] tracking-tight uppercase"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: TEXT_PRIMARY }}
              >
                Active Leagues
              </h2>
            </div>
            <Link
              to="/leagues"
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              style={{ color: TEXT_SECONDARY, border: `1px solid ${BORDER}` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = ORANGE; e.currentTarget.style.color = ORANGE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SECONDARY; }}
              data-testid="view-all-leagues"
            >
              See All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Sport Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {sportEntries.map(([sport, config]) => {
              const Icon = SPORT_ICONS[sport] || Activity;
              return (
                <button
                  key={sport}
                  onClick={() => setActiveSport(sport)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition cursor-pointer"
                  style={activeSport === sport
                    ? { background: config.accent, color: config.textOnAccent }
                    : { background: "#FFFFFF", color: TEXT_MUTED, border: `1px solid ${BORDER}` }}
                  data-testid={`tab-${sport}`}
                >
                  <Icon className="w-4 h-4" />
                  {config.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-2xl animate-pulse"
                  style={{ background: SECTION_ALT }}
                />
              ))}
            </div>
          ) : filteredLeagues.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-5">
              {filteredLeagues.map((league) => (
                <LeagueCard key={league.id} league={league} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="font-heading font-bold text-lg" style={{ color: TEXT_PRIMARY }}>
                No {SPORT_CONFIG[activeSport]?.label} leagues yet
              </p>
              <p className="text-sm mt-1" style={{ color: TEXT_MUTED }}>
                Check back soon or browse all leagues
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── CITIES ────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: SECTION_ALT }} data-testid="cities-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em] mb-3"
                style={{ color: GREEN }}
              >
                Your City. Your Circuit.
              </p>
              <h2
                className="font-heading font-black leading-[0.92] tracking-tight uppercase"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: TEXT_PRIMARY }}
              >
                {platformConfig.citySectionTitle}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                {platformConfig.citySectionDesc}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformConfig.featuredCities.map((city) => (
              <div
                key={city.name}
                onClick={() => navigate(`/leagues?city=${encodeURIComponent(city.name)}`)}
                className="rounded-2xl p-5 cursor-pointer group transition-all duration-200 flex items-start gap-4 bg-white"
                style={{ border: `1px solid ${BORDER}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = GREEN; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.transform = "translateY(0)"; }}
                data-testid={`city-card-${city.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${GREEN}15` }}
                >
                  <MapPin className="w-5 h-5" style={{ color: GREEN }} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold mb-1" style={{ color: TEXT_PRIMARY }}>{city.name}</h3>
                  <p className="text-xs mb-2 leading-relaxed" style={{ color: TEXT_MUTED }}>{city.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {city.sports.map((s) => (
                      <span
                        key={s}
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: `${ORANGE}12`, color: ORANGE }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <button
              onClick={() => navigate("/leagues")}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg transition-all cursor-pointer"
              style={{ border: `1px solid ${BORDER}`, color: TEXT_SECONDARY }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = ORANGE; e.currentTarget.style.color = ORANGE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SECONDARY; }}
              data-testid="all-cities-leagues-btn"
            >
              View All Leagues <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden" style={{ background: GREEN }} data-testid="cta-section">
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: ORANGE }} />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          {foundingStats.spots_left > 0 && (
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 text-xs font-semibold"
              style={{
                background: "rgba(201,87,42,0.15)",
                border: "1px solid rgba(201,87,42,0.3)",
                color: "#F9A47E",
              }}
              data-testid="founding-member-counter"
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#F9A47E" }} />
              {foundingStats.count}/{foundingStats.limit} Founding Member spots claimed
            </div>
          )}
          <h2
            className="font-heading font-black leading-[0.88] tracking-tight mb-6 uppercase text-white"
            style={{ fontSize: "clamp(3rem, 8vw, 6.5rem)" }}
          >
            YOUR SEASON<br /><span style={{ color: "#F9A47E" }}>STARTS HERE.</span>
          </h2>
          <p
            className="mb-4 leading-relaxed max-w-xl mx-auto"
            style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.65)" }}
          >
            {platformConfig.footerTagline}
          </p>
          {foundingStats.spots_left > 0 && (
            <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>
              First {foundingStats.limit} members earn the{" "}
              <strong style={{ color: "rgba(255,255,255,0.85)" }}>Founding Member</strong> badge forever. Use code{" "}
              <code
                className="px-1.5 py-0.5 rounded font-mono font-bold text-xs"
                style={{ background: "rgba(255,255,255,0.12)", color: "#ffffff" }}
              >
                PLAY1FREE
              </code>{" "}
              for your first league free.
            </p>
          )}
          <button
            onClick={() => navigate("/auth?mode=register")}
            className="px-12 py-4 font-bold rounded-lg text-base transition-colors cursor-pointer text-white"
            style={{ background: ORANGE }}
            onMouseEnter={e => e.currentTarget.style.background = ORANGE_DARK}
            onMouseLeave={e => e.currentTarget.style.background = ORANGE}
            data-testid="cta-signup-btn"
          >
            Enter the Season
          </button>
        </div>
      </section>

    </div>
  );
}

/* ── LeagueCard ──────────────────────────────────────────────────── */
function LeagueCard({ league }) {
  const navigate = useNavigate();
  const config = SPORT_CONFIG[league.sport] || {};
  const Icon = SPORT_ICONS[league.sport] || Activity;
  const spotsLeft = league.max_players - (league.current_players || 0);

  return (
    <div
      onClick={() => navigate(`/leagues/${league.id}`)}
      className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 bg-white"
      style={{ border: `1px solid ${BORDER}` }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = config.accent || ORANGE;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = BORDER;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
      data-testid={`league-card-${league.id}`}
    >
      <div className="h-[3px]" style={{ background: config.accent || ORANGE }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full"
            style={{
              background: `${config.accent || ORANGE}15`,
              color: config.accent || ORANGE,
            }}
          >
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
          {spotsLeft <= 5 && spotsLeft > 0 && (
            <span
              className="text-xs font-semibold rounded-full px-2 py-0.5"
              style={{ background: `${ORANGE}15`, color: ORANGE }}
            >
              {spotsLeft} spots left
            </span>
          )}
        </div>
        <h3
          className="font-heading font-bold mb-1 leading-tight"
          style={{ fontSize: "1.125rem", color: TEXT_PRIMARY }}
        >
          {league.name}
        </h3>
        <p className="text-xs mb-3" style={{ color: TEXT_MUTED }}>
          {league.city} &middot; {league.format}
        </p>
        <div
          className="flex items-center justify-between mt-4 pt-4"
          style={{ borderTop: `1px solid ${BORDER_LIGHT}` }}
        >
          <span className="text-xs" style={{ color: TEXT_MUTED }}>
            {league.current_players || 0}/{league.max_players} joined
          </span>
          {league.start_date && (
            <span className="text-xs" style={{ color: TEXT_MUTED }}>
              {fmtDate(league.start_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
