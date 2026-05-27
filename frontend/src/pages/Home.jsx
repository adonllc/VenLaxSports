import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { MapPin, ArrowRight, Target, Zap, Shield, Activity, ChevronRight } from "lucide-react";
import platformConfig, { activeSportIds } from "../config/platformConfig";
import HowItWorks from "../components/HowItWorks";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SPORT_ICONS = { tennis: Target, pickleball: Zap, cricket: Shield };

const ALL_SPORT_CONFIG = {
  tennis: {
    accent: "#C5D600", textOnAccent: "#0F1D38", label: "Tennis", icon: "🎾",
    tagline: "Singles. Doubles. Mixed.",
    desc: "Skill-matched leagues with best-of-3 set formats, ELO ratings, and playoff brackets.",
    image: "https://images.unsplash.com/photo-1696661115319-a9b6801e2571?w=900&q=80",
    stats: ["Best-of-3 Sets", "Skill Rating", "2.0–5.0+"], num: "01",
    badge: "sport-badge-tennis",
  },
  cricket: {
    accent: "#E86010", textOnAccent: "#ffffff", label: "Cricket", icon: "🏏",
    tagline: "T10. T20. Beyond.",
    desc: "Corporate and amateur cricket with NRR tracking, powerplay rules, and live scoring.",
    image: "https://images.pexels.com/photos/3602833/pexels-photo-3602833.jpeg?w=900",
    stats: ["T10 & T20", "NRR Tracking", "Corporate Leagues"], num: "02",
    badge: "sport-badge-cricket",
  },
  pickleball: {
    accent: "#00B4A4", textOnAccent: "#ffffff", label: "Pickleball", icon: "🏓",
    tagline: "Singles. Doubles. Mixed.",
    desc: "Rally scoring, win-by-2 rules, and skill-based ratings across top facilities.",
    image: "https://images.unsplash.com/photo-1777382141965-68d47862eaf9?w=900&q=80",
    stats: ["Rally Scoring", "Win-by-2", "DUPR Rating"], num: "03",
    badge: "sport-badge-pickleball",
  },
};

const SPORT_CONFIG = Object.fromEntries(
  activeSportIds.map((id) => [id, ALL_SPORT_CONFIG[id]]).filter(([, v]) => v)
);

// ── Color tokens ──────────────────────────────────────────────────
const PAGE_BG    = "#1F0A03";
const SECTION_2  = "#2C0E04";
const CARD_DARK  = "#3D1A09";
const LIME       = "#C5D600";
const LIME_HOVER = "#AEBE00";
const LIME_PALE  = "#F3F7D0";
const LIME_TEXT  = "#5A6600";
const NAVY       = "#1F0A03";
const TEAL       = "#00B4A4";
const ORANGE     = "#E86010";
const BORDER_L   = "#D4B896";
const BORDER_D   = "rgba(255,255,255,0.12)";

// Dark-bg text (warm linen)
const D_HEAD  = "#FAF0E6";
const D_BODY  = "rgba(250,240,230,0.75)";
const D_MUTED = "rgba(250,240,230,0.45)";

// White-card text (earthy)
const C_HEAD  = "#2C1206";
const C_BODY  = "#5C3014";
const C_MUTED = "#8B5E3C";

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
      <section className="relative overflow-hidden" style={{ minHeight: "100vh" }} data-testid="hero-section">
        {/* Lime top rail */}
        <div className="absolute top-0 left-0 right-0 h-[3px] z-10" style={{ background: LIME }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="grid md:grid-cols-[1fr_400px] lg:grid-cols-[1fr_460px] xl:grid-cols-[1fr_520px] gap-8 lg:gap-12 items-center min-h-screen">

            {/* Left: copy */}
            <div className="py-24 sm:py-28 lg:py-32">
              {/* Eyebrow */}
              <p className="flex items-center gap-2.5 text-xs font-bold tracking-[0.18em] uppercase mb-10"
                 style={{ color: TEAL }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: LIME }} />
                {platformConfig.heroBadge}
              </p>

              {/* Headline */}
              <div className="mb-8">
                <h1 className="font-heading font-black leading-[0.88] tracking-tight uppercase"
                    style={{ fontSize: "clamp(3.5rem, 9vw, 7.5rem)", color: D_HEAD }}>
                  <span className="block">ONE</span>
                  <span className="block">PASSION.</span>
                  <span className="block" style={{ color: LIME }}>THREE</span>
                  <span className="block" style={{ color: LIME }}>SPORTS.</span>
                </h1>
              </div>

              <p className="leading-relaxed mb-10"
                 style={{ fontSize: "clamp(1rem, 1.4vw, 1.125rem)", maxWidth: "46ch", color: D_BODY }}>
                Experience the best of tennis, pickleball and cricket all in one place.
                Ranked leagues. Real competition. Your city.
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
                  Start Now
                </button>
                <button
                  onClick={() => navigate("/auth?mode=register")}
                  className="px-8 py-4 font-body font-semibold rounded-md text-base transition-colors cursor-pointer focus-visible:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.30)", color: D_HEAD }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.70)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.30)"; e.currentTarget.style.background = "transparent"; }}
                  data-testid="hero-signup-btn"
                >
                  Learn More
                </button>
              </div>

              {/* Sport chips */}
              <div className="flex gap-2.5 flex-wrap">
                {sportEntries.map(([sport, config]) => (
                  <button
                    key={sport}
                    onClick={() => navigate(`/sport/${sport}`)}
                    className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-full font-body text-sm font-medium transition-all cursor-pointer focus-visible:outline-none"
                    style={{ border: `1px solid ${BORDER_D}`, color: D_MUTED }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = config.accent; e.currentTarget.style.color = config.accent; e.currentTarget.style.background = `${config.accent}18`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER_D; e.currentTarget.style.color = D_MUTED; e.currentTarget.style.background = "transparent"; }}
                    data-testid={`hero-sport-pill-${sport}`}
                  >
                    <span>{config.icon}</span>
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: sport image stack */}
            <div className="hidden md:flex flex-col gap-3 py-24 lg:py-28">
              {sportEntries.map(([sport, config], idx) => (
                <div
                  key={sport}
                  onClick={() => navigate(`/sport/${sport}`)}
                  className={`relative rounded-2xl overflow-hidden cursor-pointer group ${idx === 0 ? "h-72" : "h-44"}`}
                  data-testid={`hero-sport-image-${sport}`}
                >
                  <img
                    src={config.image}
                    alt={config.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 motion-reduce:transition-none"
                    loading={idx === 0 ? "eager" : "lazy"}
                  />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(31,10,3,0.92) 0%, rgba(31,10,3,0.30) 55%, transparent 100%)" }} />
                  {/* Accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: config.accent }} />
                  <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl leading-none">{config.icon}</span>
                      <span className="font-heading font-bold text-white text-lg">{config.label}</span>
                    </div>
                    <span className="font-body text-xs" style={{ color: D_MUTED }}>{config.tagline}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-b" style={{ borderColor: BORDER_D, background: "rgba(255,255,255,0.03)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-center gap-4 sm:gap-8 flex-wrap">
              {[
                { v: "1,200+", l: "ranked players" },
                { v: "80+",    l: "active leagues" },
                { v: platformConfig.statsRegion, l: null },
                { v: `${activeSportIds.length}`,  l: "sports" },
              ].map((s, i) => (
                <span key={i} className="flex items-center gap-2 font-body text-sm">
                  <span className="font-bold" style={{ color: LIME }}>{s.v}</span>
                  {s.l && <span style={{ color: D_MUTED }}>{s.l}</span>}
                  {i < 3 && <span className="hidden sm:inline ml-4 sm:ml-6" style={{ color: BORDER_D }}>·</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <HowItWorks />

      {/* ── WHY CHOOSE VENLAX ──────────────────────────────────────── */}
      <section className="py-20" style={{ background: SECTION_2 }} data-testid="sport-cards-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="mb-14">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] mb-4" style={{ color: TEAL }}>
              Choose Your Sport
            </p>
            <h2 className="font-heading font-black leading-[0.9] tracking-tight uppercase" style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", color: D_HEAD }}>
              Why Choose<br /><span style={{ color: LIME }}>VENLAX?</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {sportEntries.map(([sport, config]) => (
              <div
                key={sport}
                onClick={() => navigate(`/sport/${sport}`)}
                className="group rounded-2xl p-8 cursor-pointer transition-all duration-200"
                style={{ background: "#ffffff", border: `1px solid ${BORDER_L}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = config.accent; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 12px 40px ${config.accent}25`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER_L; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                data-testid={`sport-card-${sport}`}
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: `${config.accent}18` }}>
                    {config.icon}
                  </div>
                  <span className="font-body text-xs font-bold uppercase tracking-[0.14em]"
                        style={{ color: config.accent === LIME ? LIME_TEXT : config.accent }}>
                    Sport {ALL_SPORT_CONFIG[sport].num}
                  </span>
                </div>

                <h3 className="font-heading font-black leading-[0.9] tracking-tight mb-3 uppercase"
                    style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: C_HEAD }}>
                  {config.label}
                </h3>

                <p className="font-body text-sm leading-relaxed mb-6" style={{ color: C_MUTED }}>
                  {config.desc}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {config.stats.map((s) => (
                    <span key={s} className="px-3 py-1 text-xs font-semibold rounded-full"
                          style={{ background: `${config.accent}15`, color: config.accent === LIME ? LIME_TEXT : config.accent }}>
                      {s}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 text-sm font-bold transition-all duration-200 group-hover:gap-2.5"
                     style={{ color: config.accent === LIME ? LIME_TEXT : config.accent }}>
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
              <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: TEAL }}>
                Season Open
              </p>
              <h2 className="font-heading font-black leading-[0.92] tracking-tight uppercase"
                  style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: D_HEAD }}>
                Active Leagues
              </h2>
            </div>
            <Link
              to="/leagues"
              className="inline-flex items-center gap-1.5 font-body text-sm font-semibold px-4 py-2 rounded-md transition-all"
              style={{ color: D_BODY, border: `1px solid ${BORDER_D}` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = LIME; e.currentTarget.style.color = LIME; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER_D; e.currentTarget.style.color = D_BODY; }}
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
                  className="flex items-center gap-2 px-4 py-2 rounded-full font-body text-sm font-semibold whitespace-nowrap transition cursor-pointer"
                  style={activeSport === sport
                    ? { background: config.accent, color: config.textOnAccent }
                    : { background: CARD_DARK, color: D_MUTED, border: `1px solid ${BORDER_D}` }}
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
                <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ background: CARD_DARK }} />
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
              <p className="font-heading font-bold text-lg" style={{ color: D_HEAD }}>
                No {SPORT_CONFIG[activeSport]?.label} leagues yet
              </p>
              <p className="font-body text-sm mt-1" style={{ color: D_MUTED }}>Check back soon or browse all leagues</p>
            </div>
          )}
        </div>
      </section>

      {/* ── CITIES ────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: SECTION_2 }} data-testid="cities-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] mb-3" style={{ color: TEAL }}>
                Your City. Your Circuit.
              </p>
              <h2 className="font-heading font-black leading-[0.92] tracking-tight uppercase"
                  style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: D_HEAD }}>
                {platformConfig.citySectionTitle}
              </h2>
              <p className="font-body mt-3 max-w-xl text-sm leading-relaxed" style={{ color: D_BODY }}>
                {platformConfig.citySectionDesc}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformConfig.featuredCities.map((city) => (
              <div
                key={city.name}
                onClick={() => navigate(`/leagues?city=${encodeURIComponent(city.name)}`)}
                className="rounded-2xl p-5 cursor-pointer group transition-all duration-200 flex items-start gap-4"
                style={{ background: CARD_DARK, border: `1px solid ${BORDER_D}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = TEAL; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER_D; e.currentTarget.style.transform = "translateY(0)"; }}
                data-testid={`city-card-${city.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: "rgba(0,180,164,0.15)" }}>
                  <MapPin className="w-5 h-5" style={{ color: TEAL }} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold mb-1" style={{ color: D_HEAD }}>{city.name}</h3>
                  <p className="font-body text-xs mb-2 leading-relaxed" style={{ color: D_MUTED }}>{city.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {city.sports.map((s) => (
                      <span key={s} className="font-body text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(197,214,0,0.12)", color: LIME }}>
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
              className="inline-flex items-center gap-2 px-6 py-3 font-body text-sm font-semibold rounded-md transition-all cursor-pointer"
              style={{ border: `1px solid ${BORDER_D}`, color: D_BODY }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = LIME; e.currentTarget.style.color = LIME; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER_D; e.currentTarget.style.color = D_BODY; }}
              data-testid="all-cities-leagues-btn"
            >
              View All Leagues <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden" style={{ background: "#C24A1D" }} data-testid="cta-section">
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: LIME }} />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          {foundingStats.spots_left > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 font-body text-xs font-semibold"
                 style={{ background: "rgba(197,214,0,0.12)", border: "1px solid rgba(197,214,0,0.25)", color: LIME }}
                 data-testid="founding-member-counter">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: LIME }} />
              {foundingStats.count}/{foundingStats.limit} Founding Member spots claimed
            </div>
          )}
          <h2 className="font-heading font-black leading-[0.88] tracking-tight mb-6 uppercase"
              style={{ fontSize: "clamp(3rem, 8vw, 6.5rem)", color: D_HEAD }}>
            YOUR SEASON<br /><span style={{ color: LIME }}>STARTS HERE.</span>
          </h2>
          <p className="font-body mb-4 leading-relaxed max-w-xl mx-auto"
             style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.55)" }}>
            {platformConfig.footerTagline}
          </p>
          {foundingStats.spots_left > 0 && (
            <p className="font-body text-sm mb-10" style={{ color: "rgba(255,255,255,0.45)" }}>
              First {foundingStats.limit} members earn the{" "}
              <strong style={{ color: "rgba(255,255,255,0.8)" }}>Founding Member</strong> badge forever. Use code{" "}
              <code className="px-1.5 py-0.5 rounded font-mono font-bold text-xs"
                    style={{ background: "rgba(255,255,255,0.1)", color: "#ffffff" }}>PLAY1FREE</code> for your first league free.
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
function LeagueCard({ league }) {
  const navigate = useNavigate();
  const config = SPORT_CONFIG[league.sport] || {};
  const Icon = SPORT_ICONS[league.sport] || Activity;
  const spotsLeft = league.max_players - (league.current_players || 0);

  return (
    <div
      onClick={() => navigate(`/leagues/${league.id}`)}
      className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-200"
      style={{ background: CARD_DARK, border: `1px solid ${BORDER_D}` }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = config.accent || LIME; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER_D; e.currentTarget.style.transform = "translateY(0)"; }}
      data-testid={`league-card-${league.id}`}
    >
      <div className="h-[3px]" style={{ background: config.accent || LIME }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="flex items-center gap-1.5 px-2.5 py-1 font-body text-xs font-semibold rounded-full"
                style={{ background: `${config.accent || LIME}18`, color: config.accent === LIME ? LIME_TEXT : (config.accent || LIME) }}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
          {spotsLeft <= 5 && spotsLeft > 0 && (
            <span className="font-body text-xs font-semibold rounded-full px-2 py-0.5"
                  style={{ background: "rgba(230,96,16,0.15)", color: ORANGE }}>
              {spotsLeft} spots left
            </span>
          )}
        </div>
        <h3 className="font-heading font-bold mb-1 leading-tight" style={{ fontSize: "1.125rem", color: D_HEAD }}>
          {league.name}
        </h3>
        <p className="font-body text-xs mb-3" style={{ color: D_MUTED }}>{league.city} · {league.format}</p>
        <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER_D}` }}>
          <span className="font-body text-xs" style={{ color: D_MUTED }}>
            {league.current_players || 0}/{league.max_players} joined
          </span>
          {league.start_date && (
            <span className="font-body text-xs" style={{ color: D_MUTED }}>{fmtDate(league.start_date)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
