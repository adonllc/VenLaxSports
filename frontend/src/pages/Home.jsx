import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { MapPin, Users, Calendar, Trophy, ArrowRight, Star, TrendingUp } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_CONFIG = {
  tennis: {
    color: "text-tennis", bg: "bg-tennis-bg", badge: "sport-badge-tennis", border: "border-tennis",
    accent: "#10B981", label: "Tennis", icon: "🎾",
    tagline: "Singles, Doubles & Mixed",
    image: "https://images.unsplash.com/photo-1696661115319-a9b6801e2571?w=800&q=80",
    stats: ["Best-of-3 Sets", "NTRP Rating", "3.0 – 5.0+"],
  },
  cricket: {
    color: "text-cricket", bg: "bg-cricket-bg", badge: "sport-badge-cricket", border: "border-cricket",
    accent: "#2563EB", label: "Cricket", icon: "🏏",
    tagline: "T10, T20 & Beyond",
    image: "https://images.pexels.com/photos/3602833/pexels-photo-3602833.jpeg?w=800",
    stats: ["T10 & T20 Formats", "NRR Tracking", "Corporate Leagues"],
  },
  pickleball: {
    color: "text-pickleball", bg: "bg-pickleball-bg", badge: "sport-badge-pickleball", border: "border-pickleball",
    accent: "#F97316", label: "Pickleball", icon: "🏓",
    tagline: "Singles, Doubles & Mixed",
    image: "https://images.unsplash.com/photo-1777382141965-68d47862eaf9?w=800&q=80",
    stats: ["Rally Scoring", "Win-by-2", "DUPR Rating"],
  },
};

const STATS = [
  { value: "1,200+", label: "Active Players", icon: Users },
  { value: "80+", label: "Active Leagues", icon: Trophy },
  { value: "15", label: "Cities", icon: MapPin },
  { value: "2", label: "Countries", icon: Star },
];

const STEPS = [
  { num: "01", title: "Create Your Profile", desc: "Sign up, set your sport preferences, and get your rating assigned." },
  { num: "02", title: "Join a League", desc: "Browse leagues by sport, city, and format. Pay the entry fee and get in." },
  { num: "03", title: "Play & Track", desc: "Schedule matches, report scores, and watch your ranking climb." },
];

export default function Home() {
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [activeSport, setActiveSport] = useState("tennis");
  const [loading, setLoading] = useState(true);

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
    fetchLeagues();
  }, []);

  const filteredLeagues = leagues.filter((l) => l.sport === activeSport).slice(0, 3);

  return (
    <div className="bg-white" data-testid="home-page">
      {/* Hero */}
      <section className="relative min-h-[88vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-3">
          {Object.values(SPORT_CONFIG).map((s, i) => (
            <div key={i} className="relative overflow-hidden">
              <img src={s.image} alt={s.label} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/55" />
            </div>
          ))}
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white w-full">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6 animate-fade-in">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            Now live in USA & India
          </div>
          <h1 className="font-heading font-black text-5xl sm:text-6xl lg:text-7xl mb-6 leading-tight animate-fade-in delay-100">
            Play. Compete.<br />
            <span className="text-emerald-400">Champion.</span>
          </h1>
          <p className="text-xl text-gray-200 mb-10 max-w-2xl mx-auto animate-fade-in delay-200">
            Join competitive Tennis, Cricket & Pickleball leagues across 15 cities in USA and India.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in delay-300">
            <button
              onClick={() => navigate("/leagues")}
              className="px-8 py-4 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-colors text-base"
              data-testid="hero-browse-btn"
            >
              Browse Leagues
            </button>
            <button
              onClick={() => navigate("/auth?mode=register")}
              className="px-8 py-4 border-2 border-white text-white font-semibold rounded-xl hover:bg-white/10 transition-colors text-base"
              data-testid="hero-signup-btn"
            >
              Sign Up Free
            </button>
          </div>
          {/* Sport Badges */}
          <div className="flex justify-center gap-4 mt-12 animate-fade-in delay-400">
            {Object.values(SPORT_CONFIG).map((s) => (
              <div key={s.label} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-sm font-medium">
                <span>{s.icon}</span> {s.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center" data-testid={`stat-${s.label.replace(/\s+/g, "-").toLowerCase()}`}>
                <p className="stat-counter text-4xl sm:text-5xl text-emerald-400 mb-1">{s.value}</p>
                <p className="text-sm text-gray-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sport Cards */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Choose Your Sport</p>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-gray-900">Three Sports, One Platform</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {Object.entries(SPORT_CONFIG).map(([sport, config]) => (
              <div
                key={sport}
                onClick={() => navigate(`/sport/${sport}`)}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden sport-card-hover cursor-pointer group"
                data-testid={`sport-card-${sport}`}
              >
                <div className="h-48 overflow-hidden relative">
                  <img src={config.image} alt={config.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <span className="text-3xl">{config.icon}</span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className={`font-heading font-bold text-xl ${config.color} mb-1`}>{config.label}</h3>
                  <p className="text-sm text-gray-500 mb-4">{config.tagline}</p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {config.stats.map((stat) => (
                      <span key={stat} className={`px-2.5 py-1 text-xs font-medium rounded-full ${config.badge}`}>{stat}</span>
                    ))}
                  </div>
                  <div className={`flex items-center gap-1.5 text-sm font-semibold ${config.color} group-hover:gap-3 transition-all`}>
                    View Leagues <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Leagues */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Now Open</p>
              <h2 className="font-heading font-bold text-3xl text-gray-900">Featured Leagues</h2>
            </div>
            <Link to="/leagues" className="text-sm font-semibold text-black border border-black px-4 py-2 rounded-lg hover:bg-black hover:text-white transition-colors" data-testid="view-all-leagues">
              View All Leagues
            </Link>
          </div>

          {/* Sport Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {Object.entries(SPORT_CONFIG).map(([sport, config]) => (
              <button
                key={sport}
                onClick={() => setActiveSport(sport)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeSport === sport
                    ? `text-white`
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={activeSport === sport ? { backgroundColor: config.accent } : {}}
                data-testid={`tab-${sport}`}
              >
                {config.icon} {config.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredLeagues.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
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

      {/* How It Works */}
      <section className="py-20 bg-gray-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">Simple Process</p>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl">How It Works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.num} className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/10 text-2xl font-heading font-black text-emerald-400 mb-5 group-hover:bg-emerald-400 group-hover:text-black transition-colors">
                  {step.num}
                </div>
                <h3 className="font-heading font-bold text-xl mb-3">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Countries */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border border-blue-200 league-card-hover">
              <div className="text-4xl mb-4">🇺🇸</div>
              <h3 className="font-heading font-bold text-2xl text-gray-900 mb-2">United States</h3>
              <p className="text-gray-600 text-sm mb-6">Tennis & Pickleball leagues in New York, Los Angeles, Chicago, Atlanta, San Francisco & more.</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {["Tennis", "Pickleball", "USD Pricing", "Stripe Payments"].map((t) => (
                  <span key={t} className="px-3 py-1 bg-white text-blue-700 text-xs font-semibold rounded-full border border-blue-200">{t}</span>
                ))}
              </div>
              <button onClick={() => navigate("/leagues?country=USA")} className="flex items-center gap-2 text-sm font-semibold text-blue-700 hover:gap-4 transition-all" data-testid="usa-browse-btn">
                Browse USA Leagues <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-8 border border-orange-200 league-card-hover">
              <div className="text-4xl mb-4">🇮🇳</div>
              <h3 className="font-heading font-bold text-2xl text-gray-900 mb-2">India</h3>
              <p className="text-gray-600 text-sm mb-6">Cricket leagues in Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Pune & more.</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {["Cricket", "T20 & T10", "INR Pricing", "Corporate Leagues"].map((t) => (
                  <span key={t} className="px-3 py-1 bg-white text-orange-700 text-xs font-semibold rounded-full border border-orange-200">{t}</span>
                ))}
              </div>
              <button onClick={() => navigate("/leagues?country=India")} className="flex items-center gap-2 text-sm font-semibold text-orange-700 hover:gap-4 transition-all" data-testid="india-browse-btn">
                Browse India Leagues <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-black text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <TrendingUp className="w-12 h-12 text-emerald-400 mx-auto mb-6" />
          <h2 className="font-heading font-black text-4xl sm:text-5xl mb-4">Ready to compete?</h2>
          <p className="text-gray-400 mb-8 text-lg">Join thousands of players across Tennis, Cricket & Pickleball leagues today.</p>
          <button
            onClick={() => navigate("/auth?mode=register")}
            className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-base transition-colors"
            data-testid="cta-signup-btn"
          >
            Get Started — It's Free
          </button>
        </div>
      </section>
    </div>
  );
}

function LeagueCard({ league }) {
  const navigate = useNavigate();
  const config = SPORT_CONFIG[league.sport] || {};
  const isFree = !league.entry_fee || league.entry_fee === 0;
  const spotsLeft = league.max_players - (league.current_players || 0);

  return (
    <div
      onClick={() => navigate(`/leagues/${league.id}`)}
      className="bg-white border border-gray-200 rounded-2xl p-5 league-card-hover cursor-pointer"
      data-testid={`league-card-${league.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${config.badge}`}>{config.icon} {config.label}</span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isFree ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>
          {isFree ? "FREE" : `${league.currency === "INR" ? "₹" : "$"}${league.entry_fee}`}
        </span>
      </div>
      <h3 className="font-heading font-bold text-gray-900 mb-1 line-clamp-2">{league.name}</h3>
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
        <MapPin className="w-3 h-3" /> {league.city}, {league.country}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {spotsLeft} spots left</span>
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {league.start_date}</span>
      </div>
    </div>
  );
}
