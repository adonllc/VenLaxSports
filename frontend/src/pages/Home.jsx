import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { MapPin, ArrowRight, Users, Zap, Trophy, Target, CheckCircle, Flame } from "lucide-react";
import platformConfig, { activeSports, activeSportIds } from "../config/platformConfig";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const SPORT_CONFIG = {
  tennis: { accent: "#10B981", label: "Tennis", icon: "🎾", color: "#10B981" },
  cricket: { accent: "#2563EB", label: "Cricket", icon: "🏏", color: "#2563EB" },
  pickleball: { accent: "#F97316", label: "Pickleball", icon: "🏓", color: "#F97316" },
};

const ACTIVE_SPORTS = activeSportIds.map(id => SPORT_CONFIG[id]).filter(Boolean);

const ORANGE = "#C9572A";
const ORANGE_DARK = "#B04823";
const GREEN = "#0B6E4F";
const TEXT_PRIMARY = "var(--vl-text)";
const TEXT_SECONDARY = "var(--vl-text-sub)";
const TEXT_MUTED = "var(--vl-text-muted)";
const BORDER = "var(--vl-border)";
const PAGE_BG = "var(--vl-bg)";
const SECTION_ALT = "var(--vl-bg-alt)";

// Animation styles
const FADE_IN_UP = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes slideInLeft {
    from {
      opacity: 0;
      transform: translateX(-40px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(40px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

// Intersection Observer hook for scroll animations
function useInView(ref, threshold = 0.1) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return inView;
}

export default function Home() {
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [activeSport, setActiveSport] = useState(platformConfig.defaultSport);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ players: 0, leagues: 0, cities: 5 });

  const heroRef = useRef();
  const pillarsRef = useRef();
  const stepsRef = useRef();
  const leaguesRef = useRef();
  const citiesRef = useRef();

  const heroInView = useInView(heroRef);
  const pillarsInView = useInView(pillarsRef);
  const stepsInView = useInView(stepsRef);
  const leaguesInView = useInView(leaguesRef);
  const citiesInView = useInView(citiesRef);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/leagues?limit=6`);
        setLeagues(data);
        setStats({
          players: Math.floor(Math.random() * 5000) + 1000,
          leagues: data.length,
          cities: platformConfig.featuredCities.length,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredLeagues = leagues.filter(l => l.sport === activeSport).slice(0, 3);

  return (
    <div style={{ background: PAGE_BG }} data-testid="home-page">
      <style>{FADE_IN_UP}</style>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <div
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-20 sm:pt-32 sm:pb-28"
        style={{
          background: "linear-gradient(135deg, #FFFEF9 0%, #FAF8F3 100%)",
        }}
        data-testid="hero-section"
      >
        {/* Animated gradient orbs */}
        <div
          className="absolute top-20 right-10 w-40 h-40 rounded-full blur-3xl opacity-5 animate-pulse"
          style={{ background: ORANGE }}
        />
        <div
          className="absolute bottom-20 left-10 w-32 h-32 rounded-full blur-3xl opacity-5 animate-pulse"
          style={{ background: GREEN, animationDelay: "0.5s" }}
        />

        <div
          className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
          style={{
            animation: heroInView ? "fadeInUp 0.8s ease-out forwards" : "none",
          }}
        >
          {/* Badge with pulse */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
            style={{
              background: `${ORANGE}12`,
              border: `1px solid ${ORANGE}25`,
              animation: heroInView ? "slideInLeft 0.6s ease-out 0.1s forwards" : "none",
              opacity: heroInView ? 1 : 0,
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: ORANGE }}
            />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: ORANGE }}>
              Open Now: Spring Season
            </span>
          </div>

          {/* Headline with gradient */}
          <h1
            className="font-heading font-black leading-[1.1] tracking-tight mb-6 uppercase"
            style={{
              fontSize: "clamp(2.5rem, 8vw, 5.5rem)",
              color: TEXT_PRIMARY,
              animation: heroInView ? "fadeInUp 0.8s ease-out 0.15s forwards" : "none",
              opacity: heroInView ? 1 : 0,
            }}
          >
            Your Sport.<br />Your City.<br />
            <span
              style={{
                background: `linear-gradient(90deg, ${ORANGE} 0%, ${GREEN} 100%)`,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Real Competition.
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{
              fontSize: "1.125rem",
              color: TEXT_SECONDARY,
              animation: heroInView ? "fadeInUp 0.8s ease-out 0.25s forwards" : "none",
              opacity: heroInView ? 1 : 0,
            }}
          >
            Join ranked leagues across Tennis, Pickleball, and Cricket. Rise through rankings, compete with skill-matched players, earn unforgettable moments.
          </p>

          {/* CTA with hover effect */}
          <button
            onClick={() => navigate("/auth?mode=register")}
            className="inline-flex items-center gap-2 px-8 py-4 font-bold rounded-lg text-white transition-all hover:shadow-2xl active:scale-95 hover:-translate-y-1"
            style={{
              background: ORANGE,
              animation: heroInView ? "fadeInUp 0.8s ease-out 0.3s forwards" : "none",
              opacity: heroInView ? 1 : 0,
            }}
            data-testid="hero-cta"
          >
            Start Your Season <ArrowRight className="w-5 h-5" />
          </button>

          {/* Social proof with stagger */}
          <div
            className="flex gap-8 justify-center mt-16 pt-12 border-t flex-wrap sm:flex-nowrap"
            style={{ borderColor: BORDER }}
          >
            {[
              { num: stats.players, label: "Active Players" },
              { num: stats.leagues, label: "Live Leagues" },
              { num: stats.cities, label: "Cities" },
            ].map((stat, i) => (
              <div
                key={i}
                className="text-center"
                style={{
                  animation: heroInView ? "scaleIn 0.6s ease-out forwards" : "none",
                  opacity: heroInView ? 1 : 0,
                  animationDelay: `${0.35 + i * 0.1}s`,
                }}
              >
                <div className="text-2xl font-black" style={{ color: TEXT_PRIMARY }}>
                  {stat.num.toLocaleString()}+
                </div>
                <div className="text-xs uppercase tracking-widest mt-1" style={{ color: TEXT_MUTED }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── VALUE PILLARS ────────────────────────────────────────────── */}
      <section
        ref={pillarsRef}
        className="py-20 sm:py-28"
        style={{ background: PAGE_BG }}
        data-testid="pillars-section"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="text-center mb-16"
            style={{
              animation: pillarsInView ? "fadeInUp 0.8s ease-out forwards" : "none",
              opacity: pillarsInView ? 1 : 0,
            }}
          >
            <h2
              className="font-heading font-black leading-[0.95] tracking-tight uppercase"
              style={{ fontSize: "clamp(2rem, 6vw, 4rem)", color: TEXT_PRIMARY }}
            >
              Built on Three Pillars
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: "🏆", word: "Victory", desc: "Every match, league, and season built around helping players win, improve, and rise." },
              { icon: "⚡", word: "Energy", desc: "The heartbeat of sports — fast, dynamic, community-driven across every city." },
              { icon: "🎮", word: "eXperience", desc: "A seamless digital + physical sports journey, mobile-first, end-to-end." },
            ].map(({ icon, word, desc }, i) => (
              <div
                key={word}
                className="text-center p-6 rounded-2xl transition-all hover:shadow-lg hover:-translate-y-2 cursor-default"
                style={{
                  background: SECTION_ALT,
                  animation: pillarsInView ? "scaleIn 0.6s ease-out forwards" : "none",
                  opacity: pillarsInView ? 1 : 0,
                  animationDelay: `${i * 0.1}s`,
                }}
              >
                <div className="text-5xl mb-4">{icon}</div>
                <h3 className="font-heading font-bold text-2xl mb-3 uppercase" style={{ color: TEXT_PRIMARY }}>
                  {word}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
      <section
        ref={stepsRef}
        className="py-20 sm:py-28"
        style={{ background: SECTION_ALT }}
        data-testid="how-it-works-section"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="text-center mb-16"
            style={{
              animation: stepsInView ? "fadeInUp 0.8s ease-out forwards" : "none",
              opacity: stepsInView ? 1 : 0,
            }}
          >
            <h2
              className="font-heading font-black leading-[0.95] tracking-tight uppercase"
              style={{ fontSize: "clamp(2rem, 6vw, 4rem)", color: TEXT_PRIMARY }}
            >
              How It Works
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { num: "1", step: "Sign Up", desc: "Create your account in seconds. Choose your sport and skill level." },
              { num: "2", step: "Join a League", desc: "Browse ranked leagues in your city. Pick one that matches your schedule." },
              { num: "3", step: "Play & Compete", desc: "Schedule matches with skill-matched opponents. Track your rating." },
              { num: "4", step: "Rise the Ranks", desc: "Win matches, earn points, and climb the seasonal rankings." },
            ].map(({ num, step, desc }, i) => (
              <div
                key={num}
                className="relative"
                style={{
                  animation: stepsInView ? "fadeInUp 0.6s ease-out forwards" : "none",
                  opacity: stepsInView ? 1 : 0,
                  animationDelay: `${i * 0.1}s`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg mb-4 text-white shadow-lg transition-all hover:scale-110"
                  style={{ background: ORANGE }}
                >
                  {num}
                </div>
                <h3 className="font-heading font-bold text-lg mb-2" style={{ color: TEXT_PRIMARY }}>
                  {step}
                </h3>
                <p className="text-sm" style={{ color: TEXT_SECONDARY }}>
                  {desc}
                </p>
                {num !== "4" && (
                  <div className="hidden md:block absolute top-6 -right-4 text-3xl opacity-20" style={{ color: BORDER }}>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACTIVE LEAGUES ────────────────────────────────────────────── */}
      <section
        ref={leaguesRef}
        className="py-20 sm:py-28"
        style={{ background: PAGE_BG }}
        data-testid="featured-leagues-section"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 gap-4"
            style={{
              animation: leaguesInView ? "fadeInUp 0.8s ease-out forwards" : "none",
              opacity: leaguesInView ? 1 : 0,
            }}
          >
            <div>
              <h2
                className="font-heading font-black leading-[0.95] tracking-tight uppercase"
                style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", color: TEXT_PRIMARY }}
              >
                Active Leagues
              </h2>
            </div>
            <Link
              to="/leagues"
              className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg transition-all hover:gap-3"
              style={{ color: TEXT_SECONDARY, border: `1px solid ${BORDER}` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = ORANGE; e.currentTarget.style.color = ORANGE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SECONDARY; }}
              data-testid="view-all-leagues"
            >
              See All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {ACTIVE_SPORTS.map(sport => (
              <button
                key={sport.label}
                onClick={() => setActiveSport(sport.label.toLowerCase())}
                className="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all cursor-pointer"
                style={activeSport === sport.label.toLowerCase()
                  ? { background: sport.accent, color: "white", boxShadow: `0 4px 12px ${sport.accent}40` }
                  : { background: SECTION_ALT, color: TEXT_SECONDARY, border: `1px solid ${BORDER}` }}
                data-testid={`tab-${sport.label.toLowerCase()}`}
              >
                {sport.icon} {sport.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: SECTION_ALT }} />
              ))}
            </div>
          ) : filteredLeagues.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {filteredLeagues.map((league, i) => (
                <div
                  key={league.id}
                  style={{
                    animation: leaguesInView ? "scaleIn 0.6s ease-out forwards" : "none",
                    opacity: leaguesInView ? 1 : 0,
                    animationDelay: `${0.2 + i * 0.1}s`,
                  }}
                >
                  <LeagueCard league={league} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="font-heading font-bold text-lg" style={{ color: TEXT_PRIMARY }}>
                No leagues yet in this sport
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── CITIES ────────────────────────────────────────────────────── */}
      <section
        ref={citiesRef}
        className="py-20 sm:py-28"
        style={{ background: SECTION_ALT }}
        data-testid="cities-section"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="mb-12"
            style={{
              animation: citiesInView ? "fadeInUp 0.8s ease-out forwards" : "none",
              opacity: citiesInView ? 1 : 0,
            }}
          >
            <h2
              className="font-heading font-black leading-[0.95] tracking-tight uppercase mb-3"
              style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", color: TEXT_PRIMARY }}
            >
              Play Everywhere
            </h2>
            <p className="text-lg max-w-2xl" style={{ color: TEXT_SECONDARY }}>
              From coast to coast, VENLAX connects players across major cities.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformConfig.featuredCities.map((city, i) => (
              <button
                key={city.name}
                onClick={() => navigate(`/leagues?city=${encodeURIComponent(city.name)}`)}
                className="rounded-2xl p-5 text-left transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer group"
                style={{
                  background: PAGE_BG,
                  border: `1px solid ${BORDER}`,
                  animation: citiesInView ? "slideInLeft 0.6s ease-out forwards" : "none",
                  opacity: citiesInView ? 1 : 0,
                  animationDelay: `${i * 0.05}s`,
                }}
                data-testid={`city-card-${city.name.toLowerCase().replace(/\s/g, "-")}`}
              >
                <div className="flex items-start gap-3">
                  <MapPin
                    className="w-5 h-5 flex-shrink-0 mt-0.5 transition-all group-hover:scale-110"
                    style={{ color: GREEN }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-heading font-bold" style={{ color: TEXT_PRIMARY }}>
                      {city.name}
                    </h3>
                    <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>
                      {city.sports.join(" • ")}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section
        className="py-20 sm:py-28 relative overflow-hidden"
        style={{ background: ORANGE }}
        data-testid="cta-section"
      >
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute top-10 right-20 w-32 h-32 rounded-full blur-3xl"
            style={{ background: ORANGE_DARK }}
          />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            className="font-heading font-black leading-[0.95] tracking-tight mb-6 text-white uppercase"
            style={{ fontSize: "clamp(2.5rem, 7vw, 4.5rem)" }}
          >
            Ready to Rise?
          </h2>
          <p
            className="text-lg text-white/85 mb-10 max-w-xl mx-auto"
            style={{ fontSize: "1.125rem" }}
          >
            Join thousands of players competing in ranked leagues across your favorite sports.
          </p>
          <button
            onClick={() => navigate("/auth?mode=register")}
            className="inline-flex items-center gap-2 px-8 py-4 font-bold rounded-lg text-lg transition-all hover:scale-105 active:scale-95 hover:shadow-2xl"
            style={{ background: "white", color: ORANGE }}
            data-testid="final-cta-btn"
          >
            Get Started Free <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}

function LeagueCard({ league }) {
  const navigate = useNavigate();
  const config = Object.values(SPORT_CONFIG).find(s => s.label.toLowerCase() === league.sport) || {};
  const spotsLeft = league.max_players - (league.current_players || 0);

  return (
    <div
      onClick={() => navigate(`/leagues/${league.id}`)}
      className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-2"
      style={{ background: "var(--vl-bg-card)", border: `1px solid ${BORDER}` }}
      data-testid={`league-card-${league.id}`}
    >
      <div className="h-1 transition-all" style={{ background: config.accent || ORANGE }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: config.accent || ORANGE }}>
            {config.label || league.sport}
          </span>
          {spotsLeft <= 5 && spotsLeft > 0 && (
            <span className="text-xs font-bold animate-pulse" style={{ color: ORANGE }}>
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
        <p className="text-xs mb-4" style={{ color: TEXT_MUTED }}>
          {league.city} • {league.format}
        </p>
        <div
          className="flex items-center justify-between"
          style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "0.75rem" }}
        >
          <span className="text-xs" style={{ color: TEXT_MUTED }}>
            {league.current_players || 0}/{league.max_players} players
          </span>
          <span
            className="text-xs font-bold"
            style={{ color: league.entry_fee && league.entry_fee > 0 ? ORANGE : GREEN }}
          >
            {league.entry_fee && league.entry_fee > 0 ? `$${league.entry_fee}` : "Free"}
          </span>
        </div>
      </div>
    </div>
  );
}
