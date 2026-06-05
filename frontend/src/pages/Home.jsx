import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { motionConfigs, viewportConfig } from "../config/motionConfig";

export default function Home() {
  const navigate = useNavigate();
  const [sport, setSport] = useState("tennis");
  const [skillLevel, setSkillLevel] = useState(3);

  const skillLevels = ["", "Beginner", "Beginner-Intermediate", "Intermediate", "Intermediate-Advanced", "Advanced"];

  return (
    <div className="bg-white">
      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background image overlay */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&h=900&fit=crop"
            alt="Tennis court"
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/90 to-white"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Accent badge */}
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 bg-slate-100 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-sm font-semibold text-slate-700">SPRING SEASON LIVE</span>
          </div>

          {/* Main headline */}
          <h1 className="text-6xl md:text-7xl font-black leading-tight mb-6 text-slate-900">
            Find Your<br />
            <span style={{ color: "#D4AF37" }}>Bracket</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Join ranked tennis & pickleball leagues in your city. Compete against skill-matched opponents. Track your rating. Rise the leaderboard.
          </p>

          {/* Dual CTAs */}
          <div className="flex flex-col md:flex-row gap-4 justify-center mb-16">
            <button
              onClick={() => navigate("/leagues")}
              className="px-8 py-4 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              ▶ Find Your Bracket
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="px-8 py-4 bg-amber-500 text-slate-900 rounded-lg font-semibold hover:bg-amber-600 transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "#D4AF37" }}
            >
              Register a Team →
            </button>
          </div>

          {/* Stats row */}
          <div className="flex flex-col md:flex-row gap-8 justify-center text-sm font-semibold text-slate-600">
            <div>
              <div className="text-3xl font-black" style={{ color: "#D4AF37" }}>
                2,847
              </div>
              <div>Active Players</div>
            </div>
            <div>
              <div className="text-3xl font-black" style={{ color: "#D4AF37" }}>
                156
              </div>
              <div>Weekly Matches</div>
            </div>
            <div>
              <div className="text-3xl font-black" style={{ color: "#D4AF37" }}>
                12
              </div>
              <div>Cities</div>
            </div>
          </div>
        </div>
      </section>

      {/* REGISTRATION TICKER */}
      <div className="overflow-hidden bg-slate-100 border-t border-b border-slate-200">
        <style>{`
          @keyframes scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .ticker-content {
            display: flex;
            animation: scroll 30s linear infinite;
            gap: 2rem;
            padding: 1rem 0;
          }
        `}</style>
        <div className="ticker-content">
          <div className="whitespace-nowrap flex-shrink-0 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
            <span className="font-semibold text-slate-900">Tennis Tier 1:</span>
            <span className="text-slate-600">3 spots left</span>
          </div>
          <div className="whitespace-nowrap flex-shrink-0 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
            <span className="font-semibold text-slate-900">Pickleball Open:</span>
            <span className="text-slate-600">1 spot left</span>
          </div>
          <div className="whitespace-nowrap flex-shrink-0 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
            <span className="font-semibold text-slate-900">Recent Match:</span>
            <span className="text-slate-600">Sarah beat Marcus 21-18</span>
          </div>
          <div className="whitespace-nowrap flex-shrink-0 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#D4AF37" }}></span>
            <span className="font-semibold text-slate-900">Tennis Tier 2:</span>
            <span className="text-slate-600">6 spots available</span>
          </div>
          {/* Duplicate for loop */}
          <div className="whitespace-nowrap flex-shrink-0 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
            <span className="font-semibold text-slate-900">Tennis Tier 1:</span>
            <span className="text-slate-600">3 spots left</span>
          </div>
        </div>
      </div>

      {/* INTERACTIVE SECTION */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          {/* Section title */}
          <div className="mb-16 text-center">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
              Personalize Your Experience
            </h2>
            <p className="text-lg text-slate-600">
              Choose your sport and skill level to see your perfect bracket
            </p>
          </div>

          {/* Sport toggle + skill selector */}
          <div className="bg-white border border-slate-200 rounded-lg p-8 mb-12">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Sport toggle */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-4">Select Sport</label>
                <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
                  <button
                    onClick={() => setSport("tennis")}
                    className={`px-6 py-3 rounded-md font-semibold transition-all ${
                      sport === "tennis"
                        ? "bg-white text-slate-900 shadow-md"
                        : "bg-transparent text-slate-600"
                    }`}
                  >
                    🎾 Tennis
                  </button>
                  <button
                    onClick={() => setSport("pickleball")}
                    className={`px-6 py-3 rounded-md font-semibold transition-all ${
                      sport === "pickleball"
                        ? "bg-white text-slate-900 shadow-md"
                        : "bg-transparent text-slate-600"
                    }`}
                  >
                    🏓 Pickleball
                  </button>
                </div>
              </div>

              {/* Skill slider */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-4">Your Skill Level</label>
                <div className="flex gap-4 items-center">
                  <span className="text-sm text-slate-600">Beginner</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-200 rounded-full cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${(skillLevel / 5) * 100}%, #E5E7EB ${(skillLevel / 5) * 100}%, #E5E7EB 100%)`,
                    }}
                  />
                  <span className="text-sm text-slate-600">Advanced</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {skillLevels[skillLevel]} ({skillLevel}/5)
                </div>
              </div>
            </div>

            {/* View schedule button */}
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => navigate("/leagues")}
                className="px-8 py-4 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                View Schedule →
              </button>
            </div>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Player Profile */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Your Profile</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Current Rating</p>
                  <p className="text-3xl font-black" style={{ color: "#D4AF37" }}>
                    1,847
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Win Rate</p>
                  <p className="text-xl font-bold text-slate-900">67%</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Rank in Region</p>
                  <p className="text-2xl font-bold text-slate-900">#12</p>
                </div>
              </div>
            </div>

            {/* Skill Progress */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Progress</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-900">Serve Accuracy</span>
                    <span className="text-sm text-slate-600">72%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full" style={{ width: "72%", backgroundColor: "#D4AF37" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-900">Volley Control</span>
                    <span className="text-sm text-slate-600">58%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full" style={{ width: "58%", backgroundColor: "#D4AF37" }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Roster (Locked) */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 relative opacity-50">
              <div className="absolute top-4 right-4 bg-slate-900 text-white px-3 py-1 rounded text-xs font-semibold">
                Unlocks after Week 1
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Roster Management</h3>
              <div className="space-y-3">
                <div className="h-8 bg-slate-200 rounded"></div>
                <div className="h-8 bg-slate-200 rounded"></div>
              </div>
            </div>

            {/* Analytics (Locked) */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 relative opacity-50">
              <div className="absolute top-4 right-4 bg-slate-900 text-white px-3 py-1 rounded text-xs font-semibold">
                Unlocks after Week 1
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Match Analytics</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="h-16 bg-slate-200 rounded flex-1"></div>
                  <div className="h-16 bg-slate-200 rounded flex-1"></div>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Upcoming Matches</h3>
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded">
                  <p className="text-sm font-semibold text-slate-900">vs Marcus</p>
                  <p className="text-xs text-slate-600">Sat, 2:00 PM</p>
                </div>
                <div className="p-3 bg-slate-50 rounded">
                  <p className="text-sm font-semibold text-slate-900">vs Sarah & Jessica</p>
                  <p className="text-xs text-slate-600">Mon, 6:00 PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="py-20 px-6 bg-slate-900 text-white text-center">
        <h2 className="text-4xl font-black mb-4">Ready to Compete?</h2>
        <p className="text-lg text-slate-300 mb-8">
          Join thousands of players building their legacy on the court.
        </p>
        <button
          onClick={() => navigate("/auth")}
          className="px-8 py-4 rounded-lg font-semibold transition-all hover:-translate-y-0.5"
          style={{ backgroundColor: "#D4AF37", color: "#1F2937" }}
        >
          Get Started Now →
        </button>
      </section>
    </div>
  );
}
