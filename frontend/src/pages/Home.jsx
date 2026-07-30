import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const AnimatedCounter = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);

  return (
    <motion.div
      onViewportEnter={() => {
        const numValue = parseInt(value.replace(/,/g, ''));
        let current = 0;
        const increment = Math.ceil(numValue / 40);
        const timer = setInterval(() => {
          current += increment;
          if (current >= numValue) {
            setDisplayValue(numValue);
            clearInterval(timer);
          } else {
            setDisplayValue(current);
          }
        }, 30);
      }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-50px" }}
    >
      <div className="font-dm font-black text-2xl md:text-3xl" style={{ color: "#10B981" }}>
        {displayValue.toLocaleString()}
      </div>
    </motion.div>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const [sport, setSport] = useState("tennis");
  const [skillLevel, setSkillLevel] = useState(3);

  const skillLevels = ["", "Beginner", "Beginner-Intermediate", "Intermediate", "Intermediate-Advanced", "Advanced"];

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" },
    }),
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" },
    }),
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  return (
    <div className="bg-white">
      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-venlax-light via-white to-white">
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 bg-venlax-gray-100 rounded-full"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <motion.span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "#10B981" }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs md:text-sm font-semibold text-venlax-dark">SPRING SEASON LIVE</span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            className="font-geist text-5xl md:text-7xl font-900 leading-tight mb-6 text-venlax-dark"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Find Your<br />
            <motion.span
              className="block"
              style={{ color: "#10B981" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Perfect Match
            </motion.span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="font-jakarta text-lg md:text-xl text-venlax-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Join ranked leagues in Tennis & Pickleball. Compete against skill-matched opponents. Track your rating. Climb the leaderboard.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col md:flex-row gap-4 justify-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <motion.button
              onClick={() => navigate("/leagues")}
              className="px-8 py-4 bg-venlax-primary text-white rounded-lg font-jakarta font-semibold"
              whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(16,185,129,0.2)" }}
              whileTap={{ scale: 0.95 }}
            >
              Find Leagues
            </motion.button>
            <motion.button
              onClick={() => navigate("/auth")}
              className="px-8 py-4 bg-venlax-accent text-white rounded-lg font-jakarta font-semibold"
              whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(249,115,22,0.2)" }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started
            </motion.button>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="flex flex-col md:flex-row gap-12 justify-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {[
              { value: "2,847", label: "Active Players" },
              { value: "156", label: "Weekly Matches" },
              { value: "12", label: "Cities" },
            ].map((stat, i) => (
              <motion.div key={i} custom={i} variants={fadeUpVariants} className="flex flex-col items-center">
                <div className="font-dm font-black text-3xl md:text-4xl mb-2" style={{ color: "#10B981" }}>
                  {stat.value}
                </div>
                <div className="font-jakarta text-sm text-venlax-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* TICKER */}
      <motion.div
        className="overflow-hidden bg-venlax-gray-100 border-t border-b border-venlax-gray-300 py-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-50px" }}
      >
        <style>{`
          @keyframes scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .ticker-content {
            display: flex;
            animation: scroll 30s linear infinite;
            gap: 3rem;
            padding: 0.5rem 0;
          }
        `}</style>
        <div className="ticker-content">
          <div className="whitespace-nowrap flex-shrink-0 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-venlax-primary inline-block"></span>
            <span className="font-jakarta font-semibold text-venlax-dark">Tennis Tier 1:</span>
            <span className="text-venlax-gray-600">3 spots left</span>
          </div>
          <div className="whitespace-nowrap flex-shrink-0 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-venlax-accent inline-block"></span>
            <span className="font-jakarta font-semibold text-venlax-dark">Pickleball Open:</span>
            <span className="text-venlax-gray-600">1 spot left</span>
          </div>
          <div className="whitespace-nowrap flex-shrink-0 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-venlax-primary inline-block"></span>
            <span className="font-jakarta font-semibold text-venlax-dark">Recent Match:</span>
            <span className="text-venlax-gray-600">Sarah beat Marcus 21-18</span>
          </div>
          <div className="whitespace-nowrap flex-shrink-0 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-venlax-accent inline-block"></span>
            <span className="font-jakarta font-semibold text-venlax-dark">Tennis Tier 2:</span>
            <span className="text-venlax-gray-600">6 spots available</span>
          </div>
        </div>
      </motion.div>

      {/* PERSONALIZATION SECTION */}
      <motion.section
        className="py-24 md:py-32 px-6 bg-white"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-100px" }}
      >
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="mb-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
          >
            <h2 className="font-geist text-4xl md:text-5xl font-900 text-venlax-dark mb-4">
              Find Your Skill Match
            </h2>
            <p className="font-jakarta text-lg text-venlax-gray-600 max-w-2xl mx-auto">
              Choose your sport and skill level to discover perfect opponents
            </p>
          </motion.div>

          <motion.div
            className="bg-white border border-venlax-gray-300 rounded-xl p-8 md:p-12 mb-16"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(16,185,129,0.08)" }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid md:grid-cols-2 gap-12">
              {/* Sport toggle */}
              <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-50px" }}>
                <label className="block text-sm font-jakarta font-semibold text-venlax-dark mb-4">Sport</label>
                <div className="flex gap-3 bg-venlax-gray-100 rounded-lg p-1 w-fit">
                  {["tennis", "pickleball"].map((s) => (
                    <motion.button
                      key={s}
                      onClick={() => setSport(s)}
                      className={`px-6 py-3 rounded-md font-jakarta font-semibold transition-all ${
                        sport === s
                          ? "bg-white text-venlax-dark shadow-md"
                          : "bg-transparent text-venlax-gray-600"
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {s === "tennis" ? "🎾 Tennis" : "🏓 Pickleball"}
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* Skill slider */}
              <motion.div initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-50px" }}>
                <label className="block text-sm font-jakarta font-semibold text-venlax-dark mb-4">Skill Level</label>
                <div className="flex gap-4 items-center">
                  <span className="text-xs text-venlax-gray-600">Beginner</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(parseInt(e.target.value))}
                    className="flex-1 h-1.5 rounded-full cursor-pointer accent-venlax-primary"
                    style={{
                      background: `linear-gradient(to right, #10B981 0%, #10B981 ${(skillLevel / 5) * 100}%, #D1D5DB ${
                        (skillLevel / 5) * 100
                      }%, #D1D5DB 100%)`,
                    }}
                  />
                  <span className="text-xs text-venlax-gray-600">Advanced</span>
                </div>
                <motion.div
                  className="mt-4 text-sm font-jakarta font-semibold text-venlax-dark"
                  key={skillLevel}
                  initial={{ scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {skillLevels[skillLevel]} ({skillLevel}/5)
                </motion.div>
              </motion.div>
            </div>

            <motion.div
              className="mt-12 flex justify-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: 0.2 }}
            >
              <motion.button
                onClick={() => navigate("/leagues")}
                className="px-8 py-4 bg-venlax-primary text-white rounded-lg font-jakarta font-semibold"
                whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(16,185,129,0.2)" }}
                whileTap={{ scale: 0.95 }}
              >
                View Leagues
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Feature cards grid */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              {
                title: "Your Profile",
                items: [
                  { label: "Current Rating", value: "1,847" },
                  { label: "Win Rate", value: "67%" },
                  { label: "Rank", value: "#12" },
                ],
              },
              {
                title: "Stats",
                items: [
                  { label: "Serve Accuracy", value: "72%" },
                  { label: "Volley Control", value: "58%" },
                  { label: "Consistency", value: "81%" },
                ],
              },
              {
                title: "Upcoming",
                items: [
                  { label: "vs Marcus", value: "Sat 2 PM" },
                  { label: "vs Sarah", value: "Mon 6 PM" },
                  { label: "Match Count", value: "2" },
                ],
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                className="bg-white border border-venlax-gray-300 rounded-xl p-6"
                custom={i}
                variants={cardVariants}
                whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.08)" }}
              >
                <h3 className="font-jakarta font-bold text-lg text-venlax-dark mb-6">{card.title}</h3>
                <div className="space-y-4">
                  {card.items.map((item, j) => (
                    <div key={j} className="flex justify-between items-start">
                      <span className="font-jakarta text-sm text-venlax-gray-600">{item.label}</span>
                      <motion.span
                        className="font-dm font-bold text-lg text-venlax-primary"
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ delay: j * 0.1 }}
                      >
                        {item.value}
                      </motion.span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* CTA SECTION */}
      <motion.section
        className="py-20 md:py-32 px-6 bg-venlax-dark text-white text-center"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-100px" }}
      >
        <motion.h2
          className="font-geist text-4xl md:text-5xl font-900 mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
        >
          Ready to Compete?
        </motion.h2>
        <motion.p
          className="font-jakarta text-lg text-gray-300 mb-10 max-w-xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ delay: 0.1 }}
        >
          Join thousands of players climbing the leaderboard and building their legacy.
        </motion.p>
        <motion.button
          onClick={() => navigate("/auth")}
          className="px-8 py-4 bg-venlax-accent text-white rounded-lg font-jakarta font-semibold inline-block"
          whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(249,115,22,0.3)" }}
          whileTap={{ scale: 0.95 }}
        >
          Sign Up Now
        </motion.button>
      </motion.section>
    </div>
  );
}
