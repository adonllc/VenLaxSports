import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowRight, MapPin, Users, Calendar, Trophy, CheckCircle } from "lucide-react";
import { isSportActive } from "../config/platformConfig";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_META = {
  tennis: {
    label: "Tennis", icon: "🎾", color: "#10B981",
    badgeClass: "sport-badge-tennis", colorClass: "text-tennis", bgClass: "bg-tennis-bg",
    tagline: "Competitive singles & doubles leagues for all skill levels",
    description: "Compete in structured tennis leagues with skill-level divisions, best-of-3 set formats, and professional scorekeeping across top courts.",
    formats: ["Singles", "Doubles", "Mixed Doubles"],
    scoring: "Best-of-3 sets with match tiebreak at 6-6",
    rating: "Skill Rating (2.0 – 7.0 scale)",
    image: "https://images.unsplash.com/photo-1696661115319-a9b6801e2571?w=1200&q=80",
    features: ["Skill Rating Tracking", "Best-of-3 Sets", "Match Tiebreak Rules", "Weekly Scheduling", "Online Score Reporting", "Live Standings"],
  },
  cricket: {
    label: "Cricket", icon: "🏏", color: "#2563EB",
    badgeClass: "sport-badge-cricket", colorClass: "text-cricket", bgClass: "bg-cricket-bg",
    tagline: "T10, T20 & competitive cricket leagues",
    description: "Join structured corporate and amateur cricket leagues with professional umpires, NRR tracking, powerplay rules, and top-class facilities.",
    formats: ["T10", "T20", "8-a-side", "11-a-side"],
    scoring: "Run-rate based with NRR for tiebreakers",
    rating: "Custom Team Rating & NRR",
    image: "https://images.pexels.com/photos/3602833/pexels-photo-3602833.jpeg?w=1200",
    features: ["NRR Tracking", "Powerplay Rules", "Team Dashboard", "Umpire Assignment", "Live Scoring", "Corporate Packages"],
  },
  pickleball: {
    label: "Pickleball", icon: "🏓", color: "#F97316",
    badgeClass: "sport-badge-pickleball", colorClass: "text-pickleball", bgClass: "bg-pickleball-bg",
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

  const meta = SPORT_META[sport];

  useEffect(() => {
    // Phase gating — redirect if sport isn't active in the current phase.
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
    <div className="min-h-screen bg-white" data-testid={`sport-landing-${sport}`}>
      {/* Hero */}
      <section className="relative min-h-[55vh] overflow-hidden flex items-center">
        <img src={meta.image} alt={meta.label} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/20" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-white w-full py-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: meta.color }}>
              <span className="text-xl leading-none">{meta.icon}</span>
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-300">VENLAX Sports</span>
          </div>
          <h1 className="font-heading font-black text-5xl sm:text-6xl lg:text-7xl leading-[0.9] tracking-tight mb-4">{meta.label}</h1>
          <p className="text-gray-300 text-lg max-w-lg mb-8 leading-relaxed">{meta.tagline}</p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <button
              onClick={() => navigate(`/leagues?sport=${sport}`)}
              className="px-6 py-3 bg-white text-black font-bold rounded-md hover:bg-gray-100 transition-colors text-sm"
              data-testid="view-leagues-btn"
            >
              View All {meta.label} Leagues
            </button>
            <button
              onClick={() => navigate("/auth?mode=register")}
              className="px-6 py-3 border border-white/30 hover:border-white/60 text-white font-semibold rounded-md transition-colors text-sm"
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
          <div className={`${meta.bgClass} rounded-2xl p-6 border border-gray-200`}>
            <h3 className={`font-heading font-bold text-sm uppercase tracking-wide ${meta.colorClass} mb-3`}>Formats</h3>
            <div className="space-y-1.5">
              {meta.formats.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: meta.color }} /> {f}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className={`font-heading font-bold text-sm uppercase tracking-wide ${meta.colorClass} mb-3`}>Scoring</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{meta.scoring}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className={`font-heading font-bold text-sm uppercase tracking-wide ${meta.colorClass} mb-3`}>Rating System</h3>
            <p className="text-sm text-gray-700">{meta.rating}</p>
          </div>
        </div>

        {/* Description */}
        <div className="mb-12">
          <h2 className="font-heading font-bold text-2xl text-gray-900 mb-3">About {meta.label} on VENLAX</h2>
          <p className="text-gray-600 leading-relaxed">{meta.description}</p>
        </div>

        {/* Features */}
        <div className="mb-12">
          <h2 className="font-heading font-bold text-2xl text-gray-900 mb-6">What You Get</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {meta.features.map((f) => (
              <div key={f} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.color + "20" }}>
                  <CheckCircle className="w-4 h-4" style={{ color: meta.color }} />
                </div>
                <span className="text-sm font-medium text-gray-800">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leagues */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading font-bold text-2xl text-gray-900">Open {meta.label} Leagues</h2>
            <Link
              to={`/leagues?sport=${sport}`}
              className="text-sm font-semibold flex items-center gap-1 transition-colors"
              style={{ color: meta.color }}
              data-testid="all-leagues-link"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : leagues.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-4">
              {leagues.map((l) => (
                <div
                  key={l.id}
                  onClick={() => navigate(`/leagues/${l.id}`)}
                  className="bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer league-card-hover"
                  data-testid={`sport-league-${l.id}`}
                >
                  <div className="flex justify-between mb-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${meta.badgeClass}`}>{meta.icon} {meta.label}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${l.status === "registration" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{l.status === "registration" ? "Open" : l.status === "active" ? "Active" : "Ended"}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">{l.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{l.city}</p>
                  <div className="flex justify-between mt-3 text-xs text-gray-400">
                    <span>{l.max_players - (l.current_players || 0)} spots left</span>
                    <span>{l.format}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No {meta.label} leagues open yet</p>
              <p className="text-sm text-gray-400 mt-1">Check back soon!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
