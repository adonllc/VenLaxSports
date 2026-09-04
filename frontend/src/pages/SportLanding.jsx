import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, CheckCircle, Bell } from "lucide-react";
import { isSportActive } from "../config/platformConfig";
import NotifyMeBanner from "../components/NotifyMeBanner";
import NotifyMeModal from "../components/NotifyMeModal";
import VenLaxHero from "../components/VenLaxHero";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const BORDER    = "#E5E7EB";
const TEXT_PRI  = "#111827";
const TEXT_MUTED= "#6B7280";

const SPORT_META = {
  tennis: {
    label: "Tennis", icon: "🎾",
    color: "#10B981", textOnColor: "#ffffff",
    palePill: "#D1FAE5", pillText: "#065F46",
    tagline: "Competitive singles & doubles leagues for all skill levels",
    description: "Compete in structured tennis leagues with skill-level divisions, best-of-3 set formats, and professional scorekeeping across top courts.",
    formats: ["Singles", "Doubles", "Mixed Doubles"],
    scoring: "Best-of-3 sets with match tiebreak at 6-6",
    rating: "Skill Rating (2.0 – 7.0 scale)",
    image: "https://images.unsplash.com/photo-1696661115319-a9b6801e2571?w=1200&q=80",
    features: ["Skill Rating Tracking", "Best-of-3 Sets", "Match Tiebreak Rules", "Weekly Scheduling", "Online Score Reporting", "Live Standings"],
    rankedPlayers: "1,200+",
    leaguesCount: "95+",
  },
  cricket: {
    label: "Cricket", icon: "🏏",
    color: "#2563EB", textOnColor: "#ffffff",
    palePill: "#DBEAFE", pillText: "#1E40AF",
    tagline: "T10, T20 & competitive cricket leagues",
    description: "Join structured corporate and amateur cricket leagues with professional umpires, NRR tracking, powerplay rules, and top-class facilities.",
    formats: ["T10", "T20", "8-a-side", "11-a-side"],
    scoring: "Run-rate based with NRR for tiebreakers",
    rating: "Custom Team Rating & NRR",
    image: "https://images.pexels.com/photos/3602833/pexels-photo-3602833.jpeg?w=1200",
    features: ["NRR Tracking", "Powerplay Rules", "Team Dashboard", "Umpire Assignment", "Live Scoring", "Corporate Packages"],
    rankedPlayers: "450+",
    leaguesCount: "42+",
  },
  pickleball: {
    label: "Pickleball", icon: "🏓",
    color: "#F97316", textOnColor: "#ffffff",
    palePill: "#FFEDD5", pillText: "#C2410C",
    tagline: "The fastest-growing racquet sport, now in organized leagues",
    description: "Ride the pickleball wave with organized singles and doubles leagues. Rally scoring, win-by-2 rules, and skill-based ratings across top facilities.",
    formats: ["Singles", "Doubles", "Mixed Doubles"],
    scoring: "Rally scoring to 11, win by 2",
    rating: "Skill Rating System (1.0 – 7.0)",
    image: "https://images.unsplash.com/photo-1777382141965-68d47862eaf9?w=1200&q=80",
    features: ["Rally Scoring", "Win-by-2 Rules", "Skill Ratings", "Flexible Scheduling", "Beginner Friendly", "Growing Community"],
    rankedPlayers: "850+",
    leaguesCount: "78+",
  },
};

export default function SportLanding() {
  const { sport } = useParams();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);
  const [foundingStats, setFoundingStats] = useState({ count: 0, limit: 200, spots_left: 200 });

  const meta = SPORT_META[sport];

  useEffect(() => {
    if (!meta || !isSportActive(sport)) { navigate("/leagues"); return; }
    fetchLeagues();
    axios.get(`${API}/founding-members`).then(r => setFoundingStats(r.data)).catch(() => {});
  }, [sport]);

  const fetchLeagues = async () => {
    try {
      const { data } = await axios.get(`${API}/leagues?sport=${sport}&limit=6`);
      setLeagues(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (!meta || !isSportActive(sport)) return null;

  return (
    <div className="bg-white" style={{ minHeight: "100vh" }} data-testid={`sport-landing-${sport}`}>

      {/* Hero */}
      <VenLaxHero
        sportMeta={{ ...meta, id: sport }}
        foundingStats={foundingStats}
        onPrimary={() => navigate(`/leagues?sport=${sport}`)}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Info Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { title: "Formats", content: meta.formats, isPill: true },
            { title: "Scoring", content: meta.scoring, isPill: false },
            { title: "Rating System", content: meta.rating, isPill: false },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="rounded-2xl p-6"
              style={{
                background: item.isPill ? meta.palePill : "#ffffff",
                border: `1px solid ${BORDER}`,
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <h3 className="font-heading font-bold text-sm uppercase tracking-wide mb-3" style={{ color: meta.color }}>
                {item.title}
              </h3>
              {item.isPill ? (
                <div className="space-y-1.5">
                  {item.content.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm" style={{ color: TEXT_PRI }}>
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: meta.color }} /> {f}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>{item.content}</p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Description */}
        <div className="mb-12">
          <h2 className="font-heading font-black text-4xl mb-3" style={{ color: meta.color, fontFamily: "'Sora', system-ui, sans-serif" }}>
            About {meta.label} on VENLAX
          </h2>
          <p className="leading-relaxed" style={{ color: TEXT_MUTED }}>{meta.description}</p>
        </div>

        {/* Features */}
        <div className="mb-12">
          <motion.h2
            className="font-heading font-black text-4xl mb-6"
            style={{ color: meta.color, fontFamily: "'Sora', system-ui, sans-serif" }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
Features
          </motion.h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {meta.features.map((f, i) => (
              <motion.div
                key={f}
                className="flex items-center gap-3 rounded-xl p-4"
                style={{ background: "#ffffff", border: `1px solid ${BORDER}` }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ backgroundColor: meta.color + "20" }}>
                  <CheckCircle className="w-4 h-4" style={{ color: meta.color }} />
                </div>
                <span className="text-sm font-medium" style={{ color: TEXT_PRI }}>{f}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Leagues */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading font-black text-4xl" style={{ color: meta.color, fontFamily: "'Sora', system-ui, sans-serif" }}>
              Open {meta.label} Leagues
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBellOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ color: TEXT_MUTED, border: `1px solid ${BORDER}`, background: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.color = meta.color; e.currentTarget.style.background = meta.palePill; }}
                onMouseLeave={e => { e.currentTarget.style.color = TEXT_MUTED; e.currentTarget.style.background = "transparent"; }}
                data-testid="sport-notify-bell"
                title={`Notify me when a ${meta?.label} league opens`}
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Notify Me</span>
              </button>
              <Link
                to={`/leagues?sport=${sport}`}
                className="text-sm font-semibold flex items-center gap-1 transition-colors"
                style={{ color: meta.color }}
                data-testid="all-leagues-link"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 rounded-2xl animate-pulse bg-gray-100" />
              ))}
            </div>
          ) : leagues.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-4">
              {leagues.map((l, i) => (
                <motion.div
                  key={l.id}
                  onClick={() => navigate(`/leagues/${l.id}`)}
                  className="rounded-2xl p-6 cursor-pointer transition-all duration-200"
                  style={{ background: "#ffffff", border: `1px solid ${BORDER}` }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 40px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.15 }}
                  data-testid={`sport-league-${l.id}`}
                >
                  <div className="flex justify-between mb-3">
                    <span className="text-xs px-2.5 py-1 rounded-md font-semibold" style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: meta.palePill, color: meta.pillText }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: l.status === "registration" ? "#D1FAE5" : "#F3F4F6", color: l.status === "registration" ? "#065F46" : TEXT_MUTED }}>
                      {l.status === "registration" ? "Open" : l.status === "active" ? "Active" : "Ended"}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold mb-2 line-clamp-2 leading-snug text-base tracking-[-0.5px]" style={{ color: "#065F46" }}>{l.name}</h3>
                  <p className="text-xs flex items-center gap-1.5 mb-3" style={{ color: TEXT_MUTED, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#10B981" }} /><span className="font-medium">{l.city}</span>
                  </p>
                  <div className="flex justify-between pt-3 border-t text-xs" style={{ borderColor: "#F3F4F6", color: TEXT_MUTED, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    <span className="font-medium">{l.max_players - (l.current_players || 0)} spots left</span>
                    <span className="font-medium">{l.format}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              className="px-2 py-2"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <NotifyMeBanner city="" sport={sport} />
            </motion.div>
          )}
        </div>
      </div>

      <NotifyMeModal
        isOpen={bellOpen}
        onClose={() => setBellOpen(false)}
        city=""
        sport={sport}
      />
    </div>
  );
}
