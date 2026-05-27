import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowRight, MapPin, CheckCircle, Bell } from "lucide-react";
import { isSportActive } from "../config/platformConfig";
import NotifyMeBanner from "../components/NotifyMeBanner";
import NotifyMeModal from "../components/NotifyMeModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NAVY      = "#1B2A4A";
const LIME      = "#C5D600";
const LIME_PALE = "#F3F7D0";
const LIME_TEXT = "#5A6600";
const TEAL      = "#00B4A4";
const ORANGE    = "#E86010";
const PAGE_BG   = "#F5F6F0";
const BORDER    = "#CDD5E4";
const TEXT_PRI  = "#0F1D38";
const TEXT_BODY = "#2A3C58";
const TEXT_MUTED= "#6B7A96";

const SPORT_META = {
  tennis: {
    label: "Tennis", icon: "🎾",
    color: LIME, textOnColor: NAVY,
    palePill: LIME_PALE, pillText: LIME_TEXT,
    tagline: "Competitive singles & doubles leagues for all skill levels",
    description: "Compete in structured tennis leagues with skill-level divisions, best-of-3 set formats, and professional scorekeeping across top courts.",
    formats: ["Singles", "Doubles", "Mixed Doubles"],
    scoring: "Best-of-3 sets with match tiebreak at 6-6",
    rating: "Skill Rating (2.0 – 7.0 scale)",
    image: "https://images.unsplash.com/photo-1696661115319-a9b6801e2571?w=1200&q=80",
    features: ["Skill Rating Tracking", "Best-of-3 Sets", "Match Tiebreak Rules", "Weekly Scheduling", "Online Score Reporting", "Live Standings"],
  },
  cricket: {
    label: "Cricket", icon: "🏏",
    color: ORANGE, textOnColor: "#ffffff",
    palePill: "#FEE8D5", pillText: "#C04A00",
    tagline: "T10, T20 & competitive cricket leagues",
    description: "Join structured corporate and amateur cricket leagues with professional umpires, NRR tracking, powerplay rules, and top-class facilities.",
    formats: ["T10", "T20", "8-a-side", "11-a-side"],
    scoring: "Run-rate based with NRR for tiebreakers",
    rating: "Custom Team Rating & NRR",
    image: "https://images.pexels.com/photos/3602833/pexels-photo-3602833.jpeg?w=1200",
    features: ["NRR Tracking", "Powerplay Rules", "Team Dashboard", "Umpire Assignment", "Live Scoring", "Corporate Packages"],
  },
  pickleball: {
    label: "Pickleball", icon: "🏓",
    color: TEAL, textOnColor: "#ffffff",
    palePill: "#E0F5F3", pillText: "#007B70",
    tagline: "The fastest-growing racquet sport, now in organized leagues",
    description: "Ride the pickleball wave with organized singles and doubles leagues. Rally scoring, win-by-2 rules, and skill-based ratings across top facilities.",
    formats: ["Singles", "Doubles", "Mixed Doubles"],
    scoring: "Rally scoring to 11, win by 2",
    rating: "Skill Rating System (1.0 – 7.0)",
    image: "https://images.unsplash.com/photo-1777382141965-68d47862eaf9?w=1200&q=80",
    features: ["Rally Scoring", "Win-by-2 Rules", "Skill Ratings", "Flexible Scheduling", "Beginner Friendly", "Growing Community"],
  },
};

export default function SportLanding() {
  const { sport } = useParams();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);

  const meta = SPORT_META[sport];

  useEffect(() => {
    if (!meta || !isSportActive(sport)) { navigate("/leagues"); return; }
    fetchLeagues();
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
    <div style={{ background: PAGE_BG, minHeight: "100vh" }} data-testid={`sport-landing-${sport}`}>

      {/* Hero */}
      <section className="relative min-h-[55vh] overflow-hidden flex items-center">
        <img src={meta.image} alt={meta.label} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,29,56,0.90) 0%, rgba(15,29,56,0.55) 50%, rgba(15,29,56,0.25) 100%)" }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-white w-full py-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: meta.color }}>
              <span className="text-xl leading-none">{meta.icon}</span>
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.6)" }}>VENLAX Sports</span>
          </div>
          <h1 className="font-heading font-black leading-[0.9] tracking-tight mb-4"
              style={{ fontSize: "clamp(3rem, 8vw, 4.5rem)", color: "#ffffff" }}>
            {meta.label}
          </h1>
          <p className="text-lg max-w-lg mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            {meta.tagline}
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <button
              onClick={() => navigate(`/leagues?sport=${sport}`)}
              className="px-6 py-3 font-bold rounded-md transition-colors text-sm"
              style={{ background: LIME, color: NAVY }}
              onMouseEnter={e => e.currentTarget.style.background = "#AEBE00"}
              onMouseLeave={e => e.currentTarget.style.background = LIME}
              data-testid="view-leagues-btn"
            >
              View All {meta.label} Leagues
            </button>
            <button
              onClick={() => navigate("/auth?mode=register")}
              className="px-6 py-3 font-semibold rounded-md transition-colors text-sm"
              style={{ border: "1px solid rgba(255,255,255,0.35)", color: "#ffffff" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.7)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"}
              data-testid="join-now-btn"
            >
              Join Now
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Info Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="rounded-2xl p-6" style={{ background: meta.palePill, border: `1px solid ${BORDER}` }}>
            <h3 className="font-heading font-bold text-sm uppercase tracking-wide mb-3" style={{ color: meta.color === LIME ? LIME_TEXT : meta.color }}>
              Formats
            </h3>
            <div className="space-y-1.5">
              {meta.formats.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm" style={{ color: TEXT_BODY }}>
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: meta.color }} /> {f}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-6" style={{ background: "#ffffff", border: `1px solid ${BORDER}` }}>
            <h3 className="font-heading font-bold text-sm uppercase tracking-wide mb-3" style={{ color: meta.color === LIME ? LIME_TEXT : meta.color }}>
              Scoring
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: TEXT_BODY }}>{meta.scoring}</p>
          </div>
          <div className="rounded-2xl p-6" style={{ background: "#ffffff", border: `1px solid ${BORDER}` }}>
            <h3 className="font-heading font-bold text-sm uppercase tracking-wide mb-3" style={{ color: meta.color === LIME ? LIME_TEXT : meta.color }}>
              Rating System
            </h3>
            <p className="text-sm" style={{ color: TEXT_BODY }}>{meta.rating}</p>
          </div>
        </div>

        {/* Description */}
        <div className="mb-12">
          <h2 className="font-heading font-bold text-2xl mb-3" style={{ color: TEXT_PRI }}>
            About {meta.label} on VENLAX
          </h2>
          <p className="leading-relaxed" style={{ color: TEXT_BODY }}>{meta.description}</p>
        </div>

        {/* Features */}
        <div className="mb-12">
          <h2 className="font-heading font-bold text-2xl mb-6" style={{ color: TEXT_PRI }}>What You Get</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {meta.features.map((f) => (
              <div key={f} className="flex items-center gap-3 rounded-xl p-4"
                   style={{ background: "#ffffff", border: `1px solid ${BORDER}` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ backgroundColor: meta.color + "20" }}>
                  <CheckCircle className="w-4 h-4" style={{ color: meta.color }} />
                </div>
                <span className="text-sm font-medium" style={{ color: TEXT_PRI }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leagues */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading font-bold text-2xl" style={{ color: TEXT_PRI }}>
              Open {meta.label} Leagues
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBellOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ color: TEXT_MUTED, border: `1px solid ${BORDER}`, background: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.color = TEAL; e.currentTarget.style.background = "#E0F5F3"; }}
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
                style={{ color: meta.color === LIME ? LIME_TEXT : meta.color }}
                data-testid="all-leagues-link"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "#E5EAF0" }} />
              ))}
            </div>
          ) : leagues.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-4">
              {leagues.map((l) => (
                <div
                  key={l.id}
                  onClick={() => navigate(`/leagues/${l.id}`)}
                  className="rounded-2xl p-5 cursor-pointer transition-all duration-200"
                  style={{ background: "#ffffff", border: `1px solid ${BORDER}` }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(27,42,74,0.10)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                  data-testid={`sport-league-${l.id}`}
                >
                  <div className="flex justify-between mb-3">
                    <span className="text-xs px-2 py-1 rounded-full font-semibold"
                          style={{ background: meta.palePill, color: meta.pillText }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full"
                          style={l.status === "registration"
                            ? { background: LIME_PALE, color: LIME_TEXT }
                            : { background: "#F0F0F0", color: TEXT_MUTED }}>
                      {l.status === "registration" ? "Open" : l.status === "active" ? "Active" : "Ended"}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1 line-clamp-2" style={{ color: TEXT_PRI }}>{l.name}</h3>
                  <p className="text-xs flex items-center gap-1" style={{ color: TEXT_MUTED }}>
                    <MapPin className="w-3 h-3" style={{ color: TEAL }} />{l.city}
                  </p>
                  <div className="flex justify-between mt-3 text-xs" style={{ color: TEXT_MUTED }}>
                    <span>{l.max_players - (l.current_players || 0)} spots left</span>
                    <span>{l.format}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 py-2">
              <NotifyMeBanner city="" sport={sport} />
            </div>
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
