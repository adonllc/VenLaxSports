import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { motionConfigs, viewportConfig } from "../config/motionConfig";

export default function Home() {
  const navigate = useNavigate();
  const [sport, setSport] = useState("tennis");
  const [skillLevel, setSkillLevel] = useState(3);

  const skillLevels = ["", "Beginner", "Beginner-Intermediate", "Intermediate", "Intermediate-Advanced", "Advanced"];

  const statVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: i * 0.15 },
    }),
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: (i) => ({
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5, delay: i * 0.1 },
    }),
  };

  return (
    <div className="bg-white">
      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background image overlay */}
        <div className="absolute inset-0">
          <motion.img
            src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&h=900&fit=crop"
            alt="Tennis court"
            className="w-full h-full object-cover opacity-20"
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.2 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/90 to-white"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Accent badge */}
          <motion.div
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 bg-slate-100 rounded-full"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.span
              className="w-2 h-2 rounded-full bg-green-500"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-sm font-semibold text-slate-700">SPRING SEASON LIVE</span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            className="text-6xl md:text-7xl font-black leading-tight mb-6 text-slate-900"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            Find Your<br />
            <motion.span
              style={{ color: "#D4AF37", display: "inline-block" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              Bracket
            </motion.span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Join ranked tennis & pickleball leagues in your city. Compete against skill-matched opponents. Track your rating. Rise the leaderboard.
          </motion.p>

          {/* Dual CTAs */}
          <motion.div
            className="flex flex-col md:flex-row gap-4 justify-center mb-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3, staggerChildren: 0.1 }}
          >
            <motion.button
              onClick={() => navigate("/leagues")}
              className="px-8 py-4 bg-slate-900 text-white rounded-lg font-semibold transition-all"
              whileHover={{ scale: 1.05, y: -3, boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }}
              whileTap={{ scale: 0.95 }}
            >
              ▶ Find Your Bracket
            </motion.button>
            <motion.button
              onClick={() => navigate("/auth")}
              className="px-8 py-4 rounded-lg font-semibold transition-all text-slate-900"
              style={{ backgroundColor: "#D4AF37" }}
              whileHover={{ scale: 1.05, y: -3, boxShadow: "0 12px 32px rgba(212,175,55,0.3)" }}
              whileTap={{ scale: 0.95 }}
            >
              Register a Team →
            </motion.button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            className="flex flex-col md:flex-row gap-8 justify-center text-sm font-semibold text-slate-600"
            initial="hidden"
            animate="visible"
            variants={motionConfigs.staggerContainer}
          >
            {[
              { value: "2,847", label: "Active Players" },
              { value: "156", label: "Weekly Matches" },
              { value: "12", label: "Cities" },
            ].map((stat, i) => (
              <motion.div key={i} custom={i} variants={statVariants}>
                <motion.div
                  className="text-3xl font-black"
                  style={{ color: "#D4AF37" }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                >
                  {stat.value}
                </motion.div>
                <div>{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* REGISTRATION TICKER */}
      <motion.div
        className="overflow-hidden bg-slate-100 border-t border-b border-slate-200"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={viewportConfig}
      >
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
          <div className="whitespace-nowrap flex-shrink-0 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
            <span className="font-semibold text-slate-900">Tennis Tier 1:</span>
            <span className="text-slate-600">3 spots left</span>
          </div>
        </div>
      </motion.div>

      {/* INTERACTIVE SECTION */}
      <motion.section
        className="py-24 px-6 bg-white"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={viewportConfig}
      >
        <div className="max-w-6xl mx-auto">
          {/* Section title */}
          <motion.div
            className="mb-16 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
            variants={motionConfigs.fadeUp}
          >
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
              Personalize Your Experience
            </h2>
            <p className="text-lg text-slate-600">
              Choose your sport and skill level to see your perfect bracket
            </p>
          </motion.div>

          {/* Sport toggle + skill selector */}
          <motion.div
            className="bg-white border border-slate-200 rounded-lg p-8 mb-12"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportConfig}
            whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(0,0,0,0.08)" }}
            transition={{ duration: 0.5 }}
          >
            <div className="grid md:grid-cols-2 gap-8">
              {/* Sport toggle */}
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={viewportConfig}>
                <label className="block text-sm font-bold text-slate-900 mb-4">Select Sport</label>
                <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
                  {["tennis", "pickleball"].map((s) => (
                    <motion.button
                      key={s}
                      onClick={() => setSport(s)}
                      className={`px-6 py-3 rounded-md font-semibold transition-all ${
                        sport === s ? "bg-white text-slate-900 shadow-md" : "bg-transparent text-slate-600"
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {s === "tennis" ? "🎾 Tennis" : "🏓 Pickleball"}
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* Skill slider */}
              <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={viewportConfig}>
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
                      background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${(skillLevel / 5) * 100}%, #E5E7EB ${
                        (skillLevel / 5) * 100
                      }%, #E5E7EB 100%)`,
                    }}
                  />
                  <span className="text-sm text-slate-600">Advanced</span>
                </div>
                <motion.div
                  className="mt-2 text-sm font-semibold text-slate-900"
                  key={skillLevel}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {skillLevels[skillLevel]} ({skillLevel}/5)
                </motion.div>
              </motion.div>
            </div>

            {/* View schedule button */}
            <motion.div
              className="mt-8 flex justify-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={viewportConfig}
              transition={{ delay: 0.3 }}
            >
              <motion.button
                onClick={() => navigate("/leagues")}
                className="px-8 py-4 bg-slate-900 text-white rounded-lg font-semibold transition-all"
                whileHover={{ scale: 1.05, y: -3, boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }}
                whileTap={{ scale: 0.95 }}
              >
                View Schedule →
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Bento grid */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
            variants={motionConfigs.staggerContainer}
          >
            {[
              {
                title: "Your Profile",
                items: [
                  { label: "Current Rating", value: "1,847", gold: true },
                  { label: "Win Rate", value: "67%" },
                  { label: "Rank in Region", value: "#12" },
                ],
              },
              {
                title: "Progress",
                items: [
                  { label: "Serve Accuracy", value: "72%", progress: 72 },
                  { label: "Volley Control", value: "58%", progress: 58 },
                ],
              },
              {
                title: "Upcoming Matches",
                items: [
                  { match: "vs Marcus", time: "Sat, 2:00 PM" },
                  { match: "vs Sarah & Jessica", time: "Mon, 6:00 PM" },
                ],
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                className="bg-white border border-slate-200 rounded-xl p-6"
                custom={i}
                variants={cardVariants}
                whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.1)" }}
              >
                <h3 className="text-lg font-bold text-slate-900 mb-4">{card.title}</h3>
                <div className="space-y-4">
                  {card.items &&
                    card.items.map((item, j) =>
                      item.progress !== undefined ? (
                        <motion.div key={j} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={viewportConfig}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                            <span className="text-sm text-slate-600">{item.value}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full"
                              style={{ backgroundColor: "#D4AF37" }}
                              initial={{ width: 0 }}
                              whileInView={{ width: `${item.progress}%` }}
                              viewport={viewportConfig}
                              transition={{ duration: 0.8, delay: 0.2 }}
                            />
                          </div>
                        </motion.div>
                      ) : item.match ? (
                        <motion.div key={j} className="p-3 bg-slate-50 rounded" whileHover={{ backgroundColor: "#F3F4F6" }}>
                          <p className="text-sm font-semibold text-slate-900">{item.match}</p>
                          <p className="text-xs text-slate-600">{item.time}</p>
                        </motion.div>
                      ) : (
                        <div key={j}>
                          <p className="text-sm text-slate-600 mb-1">{item.label}</p>
                          <motion.p
                            className="text-3xl font-black"
                            style={{ color: item.gold ? "#D4AF37" : "inherit" }}
                            animate={{ scale: [1, 1.02, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            {item.value}
                          </motion.p>
                        </div>
                      )
                    )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* FOOTER CTA */}
      <motion.section
        className="py-20 px-6 bg-slate-900 text-white text-center"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={viewportConfig}
      >
        <motion.h2
          className="text-4xl font-black mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportConfig}
        >
          Ready to Compete?
        </motion.h2>
        <motion.p
          className="text-lg text-slate-300 mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={viewportConfig}
          transition={{ delay: 0.1 }}
        >
          Join thousands of players building their legacy on the court.
        </motion.p>
        <motion.button
          onClick={() => navigate("/auth")}
          className="px-8 py-4 rounded-lg font-semibold transition-all"
          style={{ backgroundColor: "#D4AF37", color: "#1F2937" }}
          whileHover={{ scale: 1.08, y: -4, boxShadow: "0 20px 40px rgba(212,175,55,0.4)" }}
          whileTap={{ scale: 0.95 }}
        >
          Get Started Now →
        </motion.button>
      </motion.section>
    </div>
  );
}
