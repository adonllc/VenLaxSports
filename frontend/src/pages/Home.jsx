import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { MapPin, ArrowRight, Target, Zap, Shield, Activity } from "lucide-react";
import platformConfig, { activeSportIds } from "../config/platformConfig";
import HowItWorks from "../components/HowItWorks";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_ICONS = { tennis: Target, pickleball: Zap, cricket: Shield };

const ALL_SPORT_CONFIG = {
  tennis: {
    color: "text-tennis", bg: "bg-tennis-bg", badge: "sport-badge-tennis", border: "border-tennis",
    accent: "#C5D600", textOnAccent: "#0F1D38", label: "Tennis",
    tagline: "Singles. Doubles. Mixed.",
    image: "https://images.unsplash.com/photo-1696661115319-a9b6801e2571?w=800&q=80",
    stats: ["Best-of-3 Sets", "Skill Rating", "2.0 – 5.0+"],
    num: "01",
  },
  cricket: {
    color: "text-cricket", bg: "bg-cricket-bg", badge: "sport-badge-cricket", border: "border-cricket",
    accent: "#E86010", textOnAccent: "#ffffff", label: "Cricket",
    tagline: "T10. T20. Beyond.",
    image: "https://images.pexels.com/photos/3602833/pexels-photo-3602833.jpeg?w=800",
    stats: ["T10 & T20 Formats", "NRR Tracking", "Corporate Leagues"],
    num: "02",
  },
  pickleball: {
    color: "text-pickleball", bg: "bg-pickleball-bg", badge: "sport-badge-pickleball", border: "border-pickleball",
    accent: "#00B4A4", textOnAccent: "#ffffff", label: "Pickleball",
    tagline: "Singles. Doubles. Mixed.",
    image: "https://images.unsplash.com/photo-1777382141965-68d47862eaf9?w=800&q=80",
    stats: ["Rally Scoring", "Win-by-2", "DUPR Rating"],
    num: "03",
  },
};

const SPORT_CONFIG = Object.fromEntries(
  activeSportIds.map((id) => [id, ALL_SPORT_CONFIG[id]]).filter(([, v]) => v)
);

const LIME = "#C5D600";
const LIME_HOVER = "#AEBE00";
const NAVY = "#1B2A4A";
const NAVY_MID = "#2A3D66";
const TEXT_PRIMARY = "#0F1D38";
const TEXT_BODY = "#2A3C58";
const TEXT_MUTED = "#6B7A96";
const BORDER = "#CDD5E4";
const PAGE_BG = "#C24A1D";
const SECTION_BG = "#EAEEE4";
const EYEBROW = "#007B70";

export default function Home() {
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [activeSport, setActiveSport] = useState(platformConfig.defaultSport);
  const [loading, setLoading] = useState(true);
  const [foundingStats, setFoundingStats] = useState({ count: 0, limit: 200, spots_left: 200 });

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const { data } = await axios.get(`${API}/leagues?limit=6`);
        setLeagues(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    const fetchFoundingStats = async () => {
      try {
        const { data } = await axios.get(`${API}/founding-members`);
        setFoundingStats(data);
      } catch {
        // non-critical
      }
    };
    fetchLeagues();
    fetchFoundingStats();
  }, []);

  const filteredLeagues = leagues.filter((l) => l.sport === activeSport).slice(0, 3);
  const sportEntries = Object.entries(SPORT_CONFIG);

  return (
    <div style={{ background: PAGE_BG }} data-testid="home-page">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: PAGE_BG }}
        data-testid="hero-section"
      >
        {/* Lime top rail */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: LIME }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-[1fr_380px] lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_500px] gap-8 lg:gap-14 items-center">

            {/* Left: typography */}
            <div className="py-16 sm:py-20 lg:py-28">

              {/* Kicker */}
              <p
                className="flex items-center gap-2.5 text-xs font-semibold tracking-[0.14em] uppercase mb-10"
                style={{ color: EYEBROW }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: LIME }} />
                {platformConfig.heroBadge}
              </p>

              {/* Headline */}
              <div className="mb-8">
                <h1
                  className="font-heading font-black leading-[0.88] tracking-tight"
                  style={{ fontSize: "clamp(4.5rem, 11vw, 8.5rem)", color: TEXT_PRIMARY }}
                >
                  <span className="block">YOUR</span>
                  <span className="block" style={{ color: LIME }}>LEAGUE.</span>
                </h1>
                <p
                  className="font-heading font-bold mt-3 tracking-tight"
                  style={{ fontSize: "clamp(1.25rem, 2.8vw, 1.875rem)", color: TEXT_BODY }}
                >
                  Earn your rank.
                </p>
              </div>

              <p
                className="font-body leading-relaxed mb-10"
                style={{ fontSize: "clamp(1rem, 1.5vw, 1.125rem)", maxWidth: "44ch", color: TEXT_MUTED }}
              >
                {platformConfig.heroSubtitle}
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-12">
                <button
                  onClick={() => navigate("/leagues")}
                  className="px-8 py-4 font-body font-bold rounded-md text-base transition-colors cursor-pointer focus-visible:outline-none"
                  style={{ background: LIME, color: NAVY }}
                  onMouseEnter={e => e.currentTarget.style.background = LIME_HOVER}
                  onMouseLeave={e => e.currentTarget.style.background = LIME}
                  data-testid="hero-browse-btn"
                >
                  Find My League
                </button>
                <button
                  onClick={() => navigate("/auth?mode=register")}
                  className="px-8 py-4 font-body font-semibold rounded-md text-base transition-colors cursor-pointer focus-visible:outline-none"
                  style={{ border: `1px solid ${NAVY}`, color: NAVY }}
                  onMouseEnter={e => { e.currentTarget.style.background = NAVY; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = NAVY; }}
                  data-testid="hero-signup-btn"
                >
                  Join Free
                </button>
              </div>

              {/* Sport chips */}
              <div className="flex gap-2.5 flex-wrap">
                {sportEntries.map(([sport, config]) => (
                  <button
                    key={sport}
                    onClick={() => navigate(`/sport/${sport}`)}
                    className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-full font-body text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none"
                    style={{ border: `1px solid ${BORDER}`, color: TEXT_MUTED }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = config.accent; e.currentTarget.style.color = config.accent === LIME ? "#5A6600" : config.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_MUTED; }}
                    data-testid={`hero-sport-pill-${sport}`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: config.accent }} />
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: sport image stack */}
            <div className="hidden md:flex flex-col gap-3 py-16 lg:py-20">
              {sportEntries.map(([sport, config], idx) => {
                const Icon = SPORT_ICONS[sport] || Activity;
                return (
                  <div
                    key={sport}
                    onClick={() => navigate(`/sport/${sport}`)}
                    className={`relative rounded-2xl overflow-hidden cursor-pointer group ${
                      idx === 0 ? "h-72" : "h-44"
                    }`}
                    data-testid={`hero-sport-image-${sport}`}
                  >
                    <img
                      src={config.image}
                      alt={`${config.label} ranked league`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 motion-reduce:transition-none"
                      loading={idx === 0 ? "eager" : "lazy"}
                    />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)" }} />
                    <div className="absolute top-4 right-4">
                      <span
                        className="font-heading font-black leading-none select-none"
                        style={{ fontSize: "5rem", color: "rgba(255,255,255,0.06)" }}
                      >
                        {config.num}
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: config.accent }}
                        >
                          <Icon className="w-4 h-4" style={{ color: config.textOnAccent }} />
                        </div>
                        <span className="font-heading font-bold text-white">{config.label}</span>
                      </div>
                      <span className="font-body text-xs font-medium text-white/60">{config.tagline}</span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* Stats ticker */}
        <div className="border-t" style={{ background: SECTION_BG, borderColor: BORDER }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-center gap-4 sm:gap-8 flex-wrap">
              {[
                { v: "1,200+", l: "ranked players" },
                { v: "80+", l: "active leagues" },
                { v: platformConfig.statsRegion, l: null },
                { v: `${activeSportIds.length}`, l: "sports" },
              ].map((s, i) => (
                <span key={i} className="flex items-center gap-2 font-body text-sm">
                  <span className="font-semibold" style={{ color: TEXT_PRIMARY }}>{s.v}</span>
                  {s.l && <span style={{ color: TEXT_MUTED }}>{s.l}</span>}
                  {i < 3 && (
                    <span className="hidden sm:inline ml-4 sm:ml-6" style={{ color: BORDER }}>·</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <HowItWorks />

      {/* ── Sport Cards ────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: PAGE_BG }} data-testid="sport-cards-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="mb-14">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] mb-4" style={{ color: EYEBROW }}>
              Choose Your Sport
            </p>
            <h2
              className="font-heading font-black leading-[0.9] tracking-tight"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", color: TEXT_PRIMARY }}
            >
              {activeSportIds.length === 1 ? "One Sport." : `${activeSportIds.length} Sports.`}
              <br />One Platform.
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {sportEntries.map(([sport, config], idx) => {
              const Icon = SPORT_ICONS[sport] || Activity;
              return (
                <div
                  key={sport}
                  onClick={() => navigate(`/sport/${sport}`)}
                  className="group cursor-pointer overflow-hidden rounded-2xl transition-transform duration-300 hover:-translate-y-0.5 bg-white hover:shadow-md"
                  style={{ border: `1px solid ${BORDER}` }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = config.accent === LIME ? "#AEBE00" : config.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
                  data-testid={`sport-card-${sport}`}
                >
                  <div className={`flex flex-col ${idx % 2 !== 0 ? "md:flex-row-reverse" : "md:flex-row"}`}>

                    {/* Image */}
                    <div className="relative w-full md:w-[44%] h-56 md:h-64 flex-shrink-0 overflow-hidden">
                      <img
                        src={config.image}
                        alt={config.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                      />
                      <div
                        className="absolute inset-0"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)" }}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: config.accent }}
                        >
                          <Icon className="w-4 h-4" style={{ color: config.textOnAccent }} />
                        </div>
                        <span
                          className="font-body text-xs font-bold uppercase tracking-[0.14em]"
                          style={{ color: config.accent === LIME ? "#5A6600" : config.accent }}
                        >
                          Sport {config.num}
                        </span>
                      </div>

                      <h3
                        className="font-heading font-black leading-[0.88] tracking-tight mb-3"
                        style={{
                          fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {config.label}
                      </h3>

                      <p
                        className="font-body text-sm mb-6 leading-relaxed"
                        style={{ color: TEXT_MUTED }}
                      >
                        {config.tagline}
                      </p>

                      <div className="flex flex-wrap gap-2 mb-8">
                        {config.stats.map((stat) => (
                          <span
                            key={stat}
                            className="px-3 py-1 font-body text-xs font-semibold rounded-full"
                            style={{
                              background: SECTION_BG,
                              color: TEXT_BODY,
                            }}
                          >
                            {stat}
                          </span>
                        ))}
                      </div>

                      <div
                        className="inline-flex items-center gap-2 font-body text-sm font-bold"
                        style={{ color: config.accent === LIME ? "#5A6600" : config.accent }}
                      >
                        Enter the League <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Featured Leagues ───────────────────────────────────────── */}
      <section className="py-20" style={{ background: SECTION_BG }} data-testid="featured-leagues-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-4">
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: EYEBROW }}>
                Season Open
              </p>
              <h2
                className="font-heading font-black leading-[0.92] tracking-tight"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: TEXT_PRIMARY }}
              >
                Active Leagues
              </h2>
            </div>
            <Link
              to="/leagues"
              className="inline-flex items-center gap-1.5 font-body text-sm font-semibold px-4 py-2 rounded-md transition-colors"
              style={{ color: TEXT_PRIMARY, border: `1px solid ${BORDER}` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = NAVY; e.currentTarget.style.color = NAVY; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_PRIMARY; }}
              data-testid="view-all-leagues"
            >
              See All Leagues <ArrowRight className="w-3.5 h-3.5" />
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
                  className="flex items-center gap-2 px-4 py-2 rounded-full font-body text-sm font-semibold whitespace-nowrap transition cursor-pointer"
                  style={
                    activeSport === sport
                      ? { background: config.accent, color: config.textOnAccent }
                      : { background: "#FFFFFF", color: TEXT_MUTED, border: `1px solid ${BORDER}` }
                  }
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
                <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ background: BORDER }} />
              ))}
            </div>
          ) : filteredLeagues.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-5">
              {filteredLeagues.map((league) => (
                <LeagueCard key={league.id} league={league} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16" style={{ color: TEXT_MUTED }}>
              <p className="font-heading font-bold text-lg" style={{ color: TEXT_PRIMARY }}>No {SPORT_CONFIG[activeSport]?.label} leagues yet</p>
              <p className="font-body text-sm mt-1">Check back soon or browse all leagues</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Featured Cities ────────────────────────────────────────── */}
      <section className="py-20" style={{ background: PAGE_BG }} data-testid="cities-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: EYEBROW }}>
                Your City. Your Circuit.
              </p>
              <h2
                className="font-heading font-black leading-[0.92] tracking-tight"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: TEXT_PRIMARY }}
              >
                {platformConfig.citySectionTitle}
              </h2>
              <p className="font-body mt-3 max-w-xl text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
                {platformConfig.citySectionDesc}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformConfig.featuredCities.map((city) => (
              <div
                key={city.name}
                onClick={() => navigate(`/leagues?city=${encodeURIComponent(city.name)}`)}
                className="bg-white rounded-2xl p-5 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex items-start gap-4"
                style={{ border: `1px solid ${BORDER}` }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#00B4A4"}
                onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
                data-testid={`city-card-${city.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(0,180,164,0.1)" }}
                >
                  <MapPin className="w-5 h-5" style={{ color: "#00B4A4" }} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold mb-1" style={{ color: TEXT_PRIMARY }}>{city.name}</h3>
                  <p className="font-body text-xs mb-2 leading-relaxed" style={{ color: TEXT_MUTED }}>{city.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {city.sports.map((s) => (
                      <span key={s} className="font-body text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: SECTION_BG, color: TEXT_BODY }}>
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
              className="inline-flex items-center gap-2 px-6 py-3 font-body text-sm font-semibold rounded-md transition-colors cursor-pointer"
              style={{ border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = NAVY; e.currentTarget.style.color = NAVY; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_PRIMARY; }}
              data-testid="all-cities-leagues-btn"
            >
              View All Leagues <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section
        className="py-28 relative overflow-hidden"
        style={{ background: NAVY }}
        data-testid="cta-section"
      >
        {/* Lime top accent */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: LIME }} />

        <div className="relative max-w-3xl mx-auto px-4 text-center">
          {foundingStats.spots_left > 0 && (
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 font-body text-xs font-semibold"
              style={{ background: "rgba(197,214,0,0.12)", border: `1px solid rgba(197,214,0,0.25)`, color: LIME }}
              data-testid="founding-member-counter"
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: LIME }} />
              {foundingStats.count}/{foundingStats.limit} Founding Member spots claimed
            </div>
          )}

          <h2
            className="font-heading font-black leading-[0.88] tracking-tight mb-6"
            style={{ fontSize: "clamp(3rem, 8vw, 6.5rem)", color: "#ffffff" }}
          >
            YOUR SEASON<br />
            <span style={{ color: LIME }}>STARTS HERE.</span>
          </h2>

          <p className="font-body mb-4 leading-relaxed max-w-xl mx-auto" style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.55)" }}>
            {platformConfig.footerTagline}
          </p>

          {foundingStats.spots_left > 0 && (
            <p className="font-body text-sm mb-10" style={{ color: "rgba(255,255,255,0.45)" }}>
              First {foundingStats.limit} members earn the <strong style={{ color: "rgba(255,255,255,0.8)" }}>Founding Member</strong> badge forever.
              Use code <code
                className="px-1.5 py-0.5 rounded font-mono font-bold text-xs"
                style={{ background: "rgba(255,255,255,0.1)", color: "#ffffff" }}
              >PLAY1FREE</code> for your first league free.
            </p>
          )}

          <button
            onClick={() => navigate("/auth?mode=register")}
            className="px-12 py-4 font-body font-bold rounded-md text-base transition-colors cursor-pointer"
            style={{ background: LIME, color: NAVY }}
            onMouseEnter={e => e.currentTarget.style.background = LIME_HOVER}
            onMouseLeave={e => e.currentTarget.style.background = LIME}
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

const HOME_CARD_SPORT_BAR = {
  tennis:     "bg-tennis",
  pickleball: "bg-pickleball",
  cricket:    "bg-cricket",
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function LeagueCard({ league }) {
  const navigate = useNavigate();
  const config = SPORT_CONFIG[league.sport] || {};
  const Icon = SPORT_ICONS[league.sport] || Activity;
  const spotsLeft = league.max_players - (league.current_players || 0);
  const barClass = HOME_CARD_SPORT_BAR[league.sport] || "bg-gray-300";

  return (
    <div
      onClick={() => navigate(`/leagues/${league.id}`)}
      className="bg-white rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
      style={{ border: `1px solid ${BORDER}` }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#00B4A4"}
      onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
      data-testid={`league-card-${league.id}`}
    >
      <div className={`h-1 ${barClass}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 font-body text-xs font-semibold rounded-full ${config.badge}`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
          {spotsLeft <= 5 && spotsLeft > 0 && (
            <span className="font-body text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {spotsLeft} spots left
            </span>
          )}
        </div>

        <h3 className="font-heading font-bold mb-1 leading-tight" style={{ fontSize: "1.125rem", color: TEXT_PRIMARY }}>
          {league.name}
        </h3>
        <p className="font-body text-xs mb-3" style={{ color: TEXT_MUTED }}>{league.city} · {league.format}</p>

        <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-1 font-body text-xs" style={{ color: TEXT_MUTED }}>
            <span>{league.current_players || 0}/{league.max_players} joined</span>
          </div>
          {league.start_date && (
            <span className="font-body text-xs" style={{ color: TEXT_MUTED }}>{fmtDate(league.start_date)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
