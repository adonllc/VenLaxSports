import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { MapPin, ArrowRight, Users, Zap, Trophy, Target, CheckCircle, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import platformConfig, { activeSports, activeSportIds } from "../config/platformConfig";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const SPORT_CONFIG = {
  tennis: { accent: "#10B981", label: "Tennis", icon: "🎾", color: "#10B981" },
  cricket: { accent: "#2563EB", label: "Cricket", icon: "🏏", color: "#2563EB" },
  pickleball: { accent: "#F97316", label: "Pickleball", icon: "🏓", color: "#F97316" },
};

const ACTIVE_SPORTS = activeSportIds.map(id => SPORT_CONFIG[id]).filter(Boolean);

// Design System Colors (from DESIGN.md)
const PRIMARY = "#10B981";
const ACCENT = "#F97316";
const DARK = "#1F2937";
const LIGHT = "#F9FAFB";
const GRAY_100 = "#F3F4F6";
const GRAY_300 = "#D1D5DB";
const GRAY_600 = "#4B5563";
const TEXT_PRIMARY = DARK;
const TEXT_SECONDARY = GRAY_600;
const TEXT_MUTED = "#9CA3AF";
const BORDER = GRAY_300;
const PAGE_BG = LIGHT;
const SECTION_ALT = GRAY_100;

// Animation variants for reusable patterns
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay, ease: "easeOut" },
  }),
};

const slideInLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: (delay = 0) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, delay, ease: "easeOut" },
  }),
};

const slideInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: (delay = 0) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, delay, ease: "easeOut" },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (delay = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, delay, ease: "easeOut" },
  }),
};

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

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
      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <motion.div
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-20 sm:pt-32 sm:pb-28"
        style={{
          background: "linear-gradient(135deg, #FFFEF9 0%, #FAF8F3 100%)",
        }}
        data-testid="hero-section"
      >
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-20 right-10 w-40 h-40 rounded-full blur-3xl opacity-5"
          style={{ background: ACCENT }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-20 left-10 w-32 h-32 rounded-full blur-3xl opacity-5"
          style={{ background: PRIMARY }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
        />

        <motion.div
          className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
          initial="hidden"
          animate={heroInView ? "visible" : "hidden"}
          variants={fadeInUp}
        >
          {/* Badge with pulse */}
          <motion.div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
            style={{
              background: `${PRIMARY}12`,
              border: `1px solid ${PRIMARY}25`,
            }}
            initial="hidden"
            animate={heroInView ? "visible" : "hidden"}
            variants={slideInLeft}
            custom={0.1}
          >
            <motion.span
              className="w-2 h-2 rounded-full"
              style={{ background: PRIMARY }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: PRIMARY }}>
              SPRING SEASON NOW LIVE
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="font-heading font-black leading-[1.1] tracking-tight mb-6"
            style={{
              fontSize: "clamp(2.5rem, 8vw, 5.5rem)",
              color: TEXT_PRIMARY,
            }}
            initial="hidden"
            animate={heroInView ? "visible" : "hidden"}
            variants={fadeInUp}
            custom={0.15}
          >
            Find Your Competition.<br />
            <span
              style={{
                background: `linear-gradient(90deg, ${ACCENT} 0%, ${PRIMARY} 100%)`,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Win Your League.
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{
              fontSize: "1.125rem",
              color: TEXT_SECONDARY,
            }}
            initial="hidden"
            animate={heroInView ? "visible" : "hidden"}
            variants={fadeInUp}
            custom={0.25}
          >
            Ranked matches against skill-matched opponents. Track your rating. Climb the leaderboard. This is competitive tennis and pickleball for real players.
          </motion.p>

          {/* CTA with hover effect */}
          <motion.button
            onClick={() => navigate("/leagues")}
            className="inline-flex items-center gap-2 px-8 py-4 font-bold rounded-lg text-white transition-all hover:shadow-2xl active:scale-95"
            style={{ background: PRIMARY }}
            initial="hidden"
            animate={heroInView ? "visible" : "hidden"}
            variants={fadeInUp}
            custom={0.3}
            whileHover={{ y: -4 }}
            data-testid="hero-cta"
          >
            Find Your League <ArrowRight className="w-5 h-5" />
          </motion.button>

        </motion.div>

        {/* Stat Card (Personal Rating) - DESIGN.md style */}
        <motion.div
          className="relative max-w-md mx-auto px-4 sm:px-6 lg:px-8 rounded-xl border p-8"
          style={{
            background: "white",
            borderColor: BORDER,
            marginTop: "60px",
            marginBottom: "60px",
          }}
          initial="hidden"
          animate={heroInView ? "visible" : "hidden"}
          variants={fadeInUp}
          custom={0.3}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", letterSpacing: "2px", color: TEXT_SECONDARY, marginBottom: "12px", textTransform: "uppercase", fontWeight: 600 }}>
              Your Rating
            </div>
            <div style={{ fontSize: "48px", fontWeight: 700, color: PRIMARY, marginBottom: "8px", fontFamily: "DM Sans, monospace" }}>
              1,847
            </div>
            <div style={{ fontSize: "14px", color: TEXT_SECONDARY, marginBottom: "20px" }}>
              You're in the top 12% of players in your region
            </div>
            <motion.button
              onClick={() => navigate("/leagues")}
              className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 font-bold rounded-lg text-white transition-all"
              style={{ background: ACCENT }}
              whileHover={{ scale: 1.02 }}
              data-testid="hero-cta-secondary"
            >
              Schedule Your Next Match <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* ── VALUE PILLARS ────────────────────────────────────────────── */}
      <motion.section
        ref={pillarsRef}
        className="py-20 sm:py-28"
        style={{ background: PAGE_BG }}
        data-testid="pillars-section"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            animate={pillarsInView ? "visible" : "hidden"}
            variants={fadeInUp}
          >
            <h2
              className="font-heading font-black leading-[0.95] tracking-tight uppercase"
              style={{ fontSize: "clamp(2rem, 6vw, 4rem)", color: TEXT_PRIMARY }}
            >
              Built on Three Pillars
            </h2>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-8"
            initial="hidden"
            animate={pillarsInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            {[
              { icon: "🏆", word: "Victory", desc: "Every match, league, and season built around helping players win, improve, and rise." },
              { icon: "⚡", word: "Energy", desc: "The heartbeat of sports — fast, dynamic, community-driven across every city." },
              { icon: "🎮", word: "eXperience", desc: "A seamless digital + physical sports journey, mobile-first, end-to-end." },
            ].map(({ icon, word, desc }) => (
              <motion.div
                key={word}
                className="text-center p-6 rounded-2xl transition-all cursor-default"
                style={{ background: SECTION_ALT }}
                variants={scaleIn}
                whileHover={{ y: -8, boxShadow: "0 12px 24px rgba(0,0,0,0.1)" }}
              >
                <motion.div
                  className="text-5xl mb-4"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {icon}
                </motion.div>
                <h3 className="font-heading font-bold text-2xl mb-3 uppercase" style={{ color: TEXT_PRIMARY }}>
                  {word}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                  {desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
      <motion.section
        ref={stepsRef}
        className="py-20 sm:py-28"
        style={{ background: SECTION_ALT }}
        data-testid="how-it-works-section"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            animate={stepsInView ? "visible" : "hidden"}
            variants={fadeInUp}
          >
            <h2
              className="font-heading font-black leading-[0.95] tracking-tight uppercase"
              style={{ fontSize: "clamp(2rem, 6vw, 4rem)", color: TEXT_PRIMARY }}
            >
              How It Works
            </h2>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-4 gap-8"
            initial="hidden"
            animate={stepsInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            {[
              { num: "1", step: "Sign Up", desc: "Create your account in seconds. Choose your sport and skill level." },
              { num: "2", step: "Join a League", desc: "Browse ranked leagues in your city. Pick one that matches your schedule." },
              { num: "3", step: "Play & Compete", desc: "Schedule matches with skill-matched opponents. Track your rating." },
              { num: "4", step: "Rise the Ranks", desc: "Win matches, earn points, and climb the seasonal rankings." },
            ].map(({ num, step, desc }, i) => (
              <motion.div key={num} className="relative" variants={fadeInUp} custom={i * 0.1}>
                <motion.div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg mb-4 text-white shadow-lg"
                  style={{ background: ACCENT }}
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 10 }}
                >
                  {num}
                </motion.div>
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
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ── ACTIVE LEAGUES ────────────────────────────────────────────── */}
      <motion.section
        ref={leaguesRef}
        className="py-20 sm:py-28"
        style={{ background: PAGE_BG }}
        data-testid="featured-leagues-section"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 gap-4"
            initial="hidden"
            animate={leaguesInView ? "visible" : "hidden"}
            variants={fadeInUp}
          >
            <div>
              <h2
                className="font-heading font-black leading-[0.95] tracking-tight uppercase"
                style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", color: TEXT_PRIMARY }}
              >
                Active Leagues
              </h2>
            </div>
            <motion.div whileHover={{ gap: "0.75rem" }}>
              <Link
                to="/leagues"
                className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg transition-all"
                style={{ color: TEXT_SECONDARY, border: `1px solid ${BORDER}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SECONDARY; }}
                data-testid="view-all-leagues"
              >
                See All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          </motion.div>

          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {ACTIVE_SPORTS.map(sport => (
              <motion.button
                key={sport.label}
                onClick={() => setActiveSport(sport.label.toLowerCase())}
                className="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all cursor-pointer"
                style={activeSport === sport.label.toLowerCase()
                  ? { background: sport.accent, color: "white", boxShadow: `0 4px 12px ${sport.accent}40` }
                  : { background: SECTION_ALT, color: TEXT_SECONDARY, border: `1px solid ${BORDER}` }}
                whileHover={{ scale: 1.05 }}
                data-testid={`tab-${sport.label.toLowerCase()}`}
              >
                {sport.icon} {sport.label}
              </motion.button>
            ))}
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <motion.div key={i} className="h-48 rounded-2xl" style={{ background: SECTION_ALT }} animate={{ opacity: [0.5, 1] }} transition={{ duration: 1, repeat: Infinity }} />
              ))}
            </div>
          ) : filteredLeagues.length > 0 ? (
            <motion.div
              className="grid md:grid-cols-3 gap-6"
              initial="hidden"
              animate={leaguesInView ? "visible" : "hidden"}
              variants={containerVariants}
            >
              {filteredLeagues.map((league) => (
                <motion.div key={league.id} variants={scaleIn}>
                  <LeagueCard league={league} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-20">
              <p className="font-heading font-bold text-lg" style={{ color: TEXT_PRIMARY }}>
                No leagues yet in this sport
              </p>
            </div>
          )}
        </div>
      </motion.section>

      {/* ── CITIES ────────────────────────────────────────────────────── */}
      <motion.section
        ref={citiesRef}
        className="py-20 sm:py-28"
        style={{ background: SECTION_ALT }}
        data-testid="cities-section"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mb-12"
            initial="hidden"
            animate={citiesInView ? "visible" : "hidden"}
            variants={fadeInUp}
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
          </motion.div>

          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            animate={citiesInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            {platformConfig.featuredCities.map((city) => (
              <motion.button
                key={city.name}
                onClick={() => navigate(`/leagues?city=${encodeURIComponent(city.name)}`)}
                className="rounded-2xl p-5 text-left transition-all cursor-pointer group"
                style={{
                  background: PAGE_BG,
                  border: `1px solid ${BORDER}`,
                }}
                variants={slideInLeft}
                whileHover={{ y: -4, boxShadow: "0 8px 16px rgba(0,0,0,0.1)" }}
                data-testid={`city-card-${city.name.toLowerCase().replace(/\s/g, "-")}`}
              >
                <div className="flex items-start gap-3">
                  <motion.div whileHover={{ scale: 1.1 }}>
                    <MapPin
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                      style={{ color: PRIMARY }}
                    />
                  </motion.div>
                  <div className="min-w-0">
                    <h3 className="font-heading font-bold" style={{ color: TEXT_PRIMARY }}>
                      {city.name}
                    </h3>
                    <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>
                      {city.sports.join(" • ")}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <motion.section
        className="py-20 sm:py-28 relative overflow-hidden"
        style={{ background: ACCENT }}
        data-testid="cta-section"
      >
        <motion.div
          className="absolute inset-0 opacity-10"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 5, repeat: Infinity }}
        >
          <div
            className="absolute top-10 right-20 w-32 h-32 rounded-full blur-3xl"
            style={{ background: ACCENT_DARK }}
          />
        </motion.div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            className="font-heading font-black leading-[0.95] tracking-tight mb-6 text-white uppercase"
            style={{ fontSize: "clamp(2.5rem, 7vw, 4.5rem)" }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Ready to Rise?
          </motion.h2>
          <motion.p
            className="text-lg text-white/85 mb-10 max-w-xl mx-auto"
            style={{ fontSize: "1.125rem" }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            Join thousands of players competing in ranked leagues across your favorite sports.
          </motion.p>
          <motion.button
            onClick={() => navigate("/auth?mode=register")}
            className="inline-flex items-center gap-2 px-8 py-4 font-bold rounded-lg text-lg"
            style={{ background: "white", color: ACCENT }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            data-testid="final-cta-btn"
          >
            Get Started Free <ArrowRight className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.section>
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
      <div className="h-1 transition-all" style={{ background: config.accent || ACCENT }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: config.accent || ACCENT }}>
            {config.label || league.sport}
          </span>
          {spotsLeft <= 5 && spotsLeft > 0 && (
            <span className="text-xs font-bold animate-pulse" style={{ color: ACCENT }}>
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
            style={{ color: league.entry_fee && league.entry_fee > 0 ? ACCENT : PRIMARY }}
          >
            {league.entry_fee && league.entry_fee > 0 ? `$${league.entry_fee}` : "Free"}
          </span>
        </div>
      </div>
    </div>
  );
}
