import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  MapPin, Users, Calendar, ArrowRight,
  Target, Zap, Shield, Activity,
} from "lucide-react";
import platformConfig, { activeSportIds } from "../config/platformConfig";
import HowItWorks from "../components/HowItWorks";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_ICONS = { tennis: Target, pickleball: Zap, cricket: Shield };

const ALL_SPORT_CONFIG = {
  tennis: {
    color: "text-tennis", bg: "bg-tennis-bg", badge: "sport-badge-tennis", border: "border-tennis",
    accent: "#10B981", label: "Tennis",
    tagline: "Singles. Doubles. Mixed.",
    image: "https://images.unsplash.com/photo-1696661115319-a9b6801e2571?w=800&q=80",
    stats: ["Best-of-3 Sets", "Skill Rating", "2.0 – 5.0+"],
    num: "01",
  },
  cricket: {
    color: "text-cricket", bg: "bg-cricket-bg", badge: "sport-badge-cricket", border: "border-cricket",
    accent: "#2563EB", label: "Cricket",
    tagline: "T10. T20. Beyond.",
    image: "https://images.pexels.com/photos/3602833/pexels-photo-3602833.jpeg?w=800",
    stats: ["T10 & T20 Formats", "NRR Tracking", "Corporate Leagues"],
    num: "02",
  },
  pickleball: {
    color: "text-pickleball", bg: "bg-pickleball-bg", badge: "sport-badge-pickleball", border: "border-pickleball",
    accent: "#F97316", label: "Pickleball",
    tagline: "Singles. Doubles. Mixed.",
    image: "https://images.unsplash.com/photo-1777382141965-68d47862eaf9?w=800&q=80",
    stats: ["Rally Scoring", "Win-by-2", "DUPR Rating"],
    num: "03",
  },
};

const SPORT_CONFIG = Object.fromEntries(
  activeSportIds.map((id) => [id, ALL_SPORT_CONFIG[id]]).filter(([, v]) => v)
);

const STATS = [
  { value: "1,200+", label: "Players Ranked" },
  { value: "80+", label: "Active Leagues" },
  { value: platformConfig.statsRegion, label: "US Cities" },
  { value: String(activeSportIds.length), label: "Sports" },
];

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
    <div className="bg-white" data-testid="home-page">

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="hero-dark relative overflow-hidden" data-testid="hero-section">
        {/* Subtle dot texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 55% 65% at 90% 40%, rgba(16,185,129,0.11) 0%, transparent 60%), radial-gradient(ellipse 30% 40% at 5% 90%, rgba(16,185,129,0.05) 0%, transparent 50%)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Split: text left, images right */}
          <div className="grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_480px] gap-8 xl:gap-14 items-center">

            {/* ── Left: text ── */}
            <div className="py-16 lg:py-24">
              <div className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/[0.12] rounded-full px-4 py-1.5 text-sm font-medium text-gray-300 mb-10 animate-fade-in">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                {platformConfig.heroBadge}
              </div>

              {/* Stacked headline */}
              <div className="mb-8 animate-fade-in delay-100">
                {["COMPETE.", "RISE.", "DOMINATE."].map((word, i) => (
                  <p
                    key={word}
                    className={`font-heading font-black leading-[0.88] tracking-tight block ${
                      i === 1 ? "text-emerald-400" : "text-white"
                    }`}
                    style={{ fontSize: "clamp(3rem, 7.5vw, 5.75rem)" }}
                  >
                    {word}
                  </p>
                ))}
              </div>

              <p className="text-gray-400 text-base lg:text-lg leading-relaxed max-w-md mb-10 animate-fade-in delay-200">
                {platformConfig.heroSubtitle}
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-10 animate-fade-in delay-300">
                <button
                  onClick={() => navigate("/leagues")}
                  className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-md transition-colors text-base cursor-pointer"
                  data-testid="hero-browse-btn"
                >
                  Find My League
                </button>
                <button
                  onClick={() => navigate("/auth?mode=register")}
                  className="px-8 py-4 border border-white/20 hover:border-white/40 text-white font-semibold rounded-md transition-colors text-base cursor-pointer"
                  data-testid="hero-signup-btn"
                >
                  Join Free
                </button>
              </div>

              {/* Sport pills */}
              <div className="flex gap-3 flex-wrap animate-fade-in delay-400">
                {sportEntries.map(([sport, config]) => {
                  const Icon = SPORT_ICONS[sport] || Activity;
                  return (
                    <button
                      key={sport}
                      onClick={() => navigate(`/sport/${sport}`)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] hover:border-white/30 text-gray-400 hover:text-white text-sm font-medium transition cursor-pointer"
                      data-testid={`hero-sport-pill-${sport}`}
                    >
                      <Icon className="w-4 h-4" style={{ color: config.accent }} />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Right: image stack ── */}
            <div className="py-10 lg:py-20 flex flex-col gap-3">
              {sportEntries.map(([sport, config], idx) => {
                const Icon = SPORT_ICONS[sport] || Activity;
                const isFirst = idx === 0;
                return (
                  <div
                    key={sport}
                    onClick={() => navigate(`/sport/${sport}`)}
                    className={`relative rounded-2xl overflow-hidden cursor-pointer group ${
                      isFirst ? "h-60 sm:h-72" : "h-40 sm:h-44"
                    }`}
                    data-testid={`hero-sport-image-${sport}`}
                  >
                    <img
                      src={config.image}
                      alt={config.label}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    {/* Faint sport number */}
                    <div className="absolute top-3 right-4 select-none pointer-events-none">
                      <span className="font-heading font-black text-white/10 leading-none" style={{ fontSize: "4rem" }}>
                        {config.num}
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: config.accent }}
                        >
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-heading font-bold text-white">{config.label}</span>
                      </div>
                      <span className="text-gray-300 text-xs font-medium opacity-80">{config.tagline}</span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100" data-testid="stats-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="px-6 lg:px-10 py-10 text-center"
                data-testid={`stat-${s.label.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <p
                  className="stat-counter text-gray-900 mb-1.5"
                  style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)" }}
                >
                  {s.value}
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────── */}
      <HowItWorks />

      {/* ── Sport Cards ─────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50" data-testid="sport-cards-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 mb-3">Choose Your Sport</p>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-gray-900">
              {activeSportIds.length === 1 ? "One Sport, One Platform" : `${activeSportIds.length} Sports, One Platform`}
            </h2>
          </div>

          {/* Full-width horizontal cards, alternating image side */}
          <div className="flex flex-col gap-5">
            {sportEntries.map(([sport, config], idx) => {
              const Icon = SPORT_ICONS[sport] || Activity;
              const imageRight = idx % 2 !== 0;
              return (
                <div
                  key={sport}
                  onClick={() => navigate(`/sport/${sport}`)}
                  className={`bg-white border border-gray-200 rounded-2xl overflow-hidden cursor-pointer group hover:shadow-lg transition-shadow card-glow-${sport}`}
                  data-testid={`sport-card-${sport}`}
                >
                  <div className={`flex flex-col ${imageRight ? "md:flex-row-reverse" : "md:flex-row"}`}>
                    {/* Image panel */}
                    <div className="relative w-full md:w-[42%] h-52 md:h-60 flex-shrink-0 overflow-hidden">
                      <img
                        src={config.image}
                        alt={config.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      {/* Large faint number over image */}
                      <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
                        <span
                          className="font-heading font-black text-white/[0.08] leading-none"
                          style={{ fontSize: "clamp(5rem, 10vw, 9rem)" }}
                        >
                          {config.num}
                        </span>
                      </div>
                      {/* Sport badge bottom-left */}
                      <div className="absolute bottom-4 left-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: config.accent }}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Content panel */}
                    <div className="flex-1 p-7 md:p-10 flex flex-col justify-center">
                      <h3 className={`font-heading font-black text-2xl sm:text-3xl ${config.color} mb-2`}>
                        {config.label}
                      </h3>
                      <p className="text-gray-500 text-sm mb-6">{config.tagline}</p>
                      <div className="flex flex-wrap gap-2 mb-7">
                        {config.stats.map((stat) => (
                          <span key={stat} className={`px-3 py-1.5 text-xs font-semibold rounded-full ${config.badge}`}>
                            {stat}
                          </span>
                        ))}
                      </div>
                      <div className={`inline-flex items-center gap-1.5 text-sm font-bold ${config.color}`}>
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

      {/* ── Featured Leagues ────────────────────────────────────────── */}
      <section className="py-20 bg-white" data-testid="featured-leagues-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 mb-2">Season Open</p>
              <h2 className="font-heading font-bold text-3xl text-gray-900">Active Leagues</h2>
            </div>
            <Link
              to="/leagues"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 border border-gray-200 px-4 py-2 rounded-md hover:border-gray-900 transition-colors cursor-pointer"
              data-testid="view-all-leagues"
            >
              See All Leagues <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Sport Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
            {sportEntries.map(([sport, config]) => {
              const Icon = SPORT_ICONS[sport] || Activity;
              return (
                <button
                  key={sport}
                  onClick={() => setActiveSport(sport)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
                    activeSport === sport
                      ? "text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  style={activeSport === sport ? { backgroundColor: config.accent } : {}}
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
                <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredLeagues.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-5">
              {filteredLeagues.map((league) => (
                <LeagueCard key={league.id} league={league} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg font-medium">No {SPORT_CONFIG[activeSport]?.label} leagues yet</p>
              <p className="text-sm mt-1">Check back soon or browse all leagues</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Featured Cities ──────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50" data-testid="cities-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 mb-3">Your City. Your Circuit.</p>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-gray-900">{platformConfig.citySectionTitle}</h2>
              <p className="text-gray-500 mt-3 max-w-xl text-sm leading-relaxed">{platformConfig.citySectionDesc}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformConfig.featuredCities.map((city) => (
              <div
                key={city.name}
                onClick={() => navigate(`/leagues?city=${encodeURIComponent(city.name)}`)}
                className="bg-white border border-gray-200 rounded-2xl p-5 league-card-hover cursor-pointer group flex items-start gap-4"
                data-testid={`city-card-${city.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold text-gray-900 mb-1">{city.name}</h3>
                  <p className="text-xs text-gray-500 mb-2 leading-relaxed">{city.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {city.sports.map((s) => (
                      <span key={s} className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
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
              className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-sm font-semibold rounded-md hover:border-gray-900 hover:text-gray-900 transition-colors cursor-pointer"
              data-testid="all-cities-leagues-btn"
            >
              View All Leagues <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-28 bg-emerald-500 relative overflow-hidden text-center" data-testid="cta-section">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-400/25 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-emerald-600/20 pointer-events-none" />
        <div className="relative max-w-2xl mx-auto px-4">
          {/* Founding member counter */}
          {foundingStats.spots_left > 0 && (
            <div className="inline-flex items-center gap-2 bg-white/15 border border-white/30 rounded-full px-4 py-1.5 mb-6" data-testid="founding-member-counter">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white text-xs font-semibold">
                {foundingStats.count}/{foundingStats.limit} Founding Member spots taken
              </span>
            </div>
          )}
          <p className="text-emerald-200 text-xs font-bold uppercase tracking-[0.2em] mb-4">Get Started Today</p>
          <h2
            className="font-heading font-black text-white mb-5 leading-tight"
            style={{ fontSize: "clamp(2.25rem, 5.5vw, 3.75rem)" }}
          >
            Your season starts here.
          </h2>
          <p className="text-emerald-100 mb-4 text-lg leading-relaxed">{platformConfig.footerTagline}</p>
          {foundingStats.spots_left > 0 && (
            <p className="text-emerald-200 text-sm mb-8">
              Sign up now — first {foundingStats.limit} members earn the <strong className="text-white">Founding Member</strong> badge forever.
              Use code <code className="bg-white/20 px-1.5 py-0.5 rounded font-mono font-bold text-white">PLAY1FREE</code> for your first league free.
            </p>
          )}
          <button
            onClick={() => navigate("/auth?mode=register")}
            className="px-10 py-4 bg-white text-emerald-700 font-bold rounded-md text-base hover:bg-emerald-50 transition-colors cursor-pointer shadow-xl shadow-emerald-700/20"
            data-testid="cta-signup-btn"
          >
            Enter the Season
          </button>
        </div>
      </section>

    </div>
  );
}

function LeagueCard({ league }) {
  const navigate = useNavigate();
  const config = SPORT_CONFIG[league.sport] || {};
  const Icon = SPORT_ICONS[league.sport] || Activity;
  const spotsLeft = league.max_players - (league.current_players || 0);

  return (
    <div
      onClick={() => navigate(`/leagues/${league.id}`)}
      className="bg-white border border-gray-200 rounded-2xl p-5 league-card-hover cursor-pointer relative overflow-hidden"
      data-testid={`league-card-${league.id}`}
    >
      {/* Sport accent left border */}
      <div
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
        style={{ backgroundColor: config.accent }}
      />
      <div className="flex items-start justify-between mb-3">
        <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${config.badge}`}>
          <Icon className="w-3 h-3" />
          {config.label}
        </span>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            league.status === "registration" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
          }`}
        >
          {league.status?.charAt(0).toUpperCase() + league.status?.slice(1)}
        </span>
      </div>
      <h3 className="font-heading font-bold text-gray-900 mb-1 line-clamp-2">{league.name}</h3>
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
        <MapPin className="w-3 h-3" /> {league.city}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {spotsLeft} spots left</span>
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {league.start_date}</span>
      </div>
    </div>
  );
}
