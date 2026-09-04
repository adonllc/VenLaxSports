import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Logo from "../components/Logo";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="bg-white min-h-screen flex flex-col">
      {/* HERO SECTION — Orange full-bleed */}
      <section className="flex-1 flex items-center justify-center px-6 py-20" style={{ backgroundColor: "#EA580C" }}>
        <div className="max-w-2xl text-center">
          {/* Logo */}
          <motion.div
            className="mb-8 flex justify-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Logo size="lg" variant="light" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="font-black text-6xl md:text-7xl leading-tight mb-6 text-white"
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, type: "spring", stiffness: 80 }}
          >
            Find Your<br />
            <span style={{ color: "white" }}>Bracket</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            className="text-lg md:text-xl mb-12 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.9)", fontFamily: "'IBM Plex Sans', sans-serif" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Join ranked tennis & pickleball leagues in your city. Compete against skill-matched opponents. Track your rating. Rise the leaderboard.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col md:flex-row gap-4 justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <motion.button
              onClick={() => navigate("/leagues")}
              className="px-8 py-4 bg-white text-orange-600 rounded-lg font-semibold transition-all"
              style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
              whileHover={{ scale: 1.10, y: -5, boxShadow: "0 20px 48px rgba(0,0,0,0.3)" }}
              whileTap={{ scale: 0.95 }}
            >
              ▶ Find Your Bracket
            </motion.button>
            <motion.button
              onClick={() => navigate("/auth")}
              className="px-8 py-4 rounded-lg font-semibold transition-all text-white border-2 border-white"
              style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
              whileHover={{ scale: 1.10, y: -5, backgroundColor: "rgba(255,255,255,0.15)" }}
              whileTap={{ scale: 0.95 }}
            >
              Join a League →
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* FOOTER CTA — Neutral background */}
      <motion.section
        className="py-20 px-6 bg-white text-center border-t border-gray-200"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <motion.h2
          className="text-5xl font-black mb-4 text-gray-900"
          style={{ fontFamily: "'Sora', system-ui, sans-serif", color: "#10B981" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Ready to Compete?
        </motion.h2>
        <motion.p
          className="text-lg mb-8 text-gray-600 max-w-md mx-auto"
          style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          Join 2,000+ players in ranked leagues. Compete fairly. Track your progress.
        </motion.p>
        <motion.button
          onClick={() => navigate("/auth")}
          className="px-8 py-4 rounded-lg font-semibold transition-all text-white"
          style={{ backgroundColor: "#047857", fontFamily: "'IBM Plex Sans', sans-serif" }}
          whileHover={{ scale: 1.12, y: -6, boxShadow: "0 24px 56px rgba(4,120,87,0.35)" }}
          whileTap={{ scale: 0.95 }}
        >
          Get Started Now →
        </motion.button>
      </motion.section>
    </div>
  );
}
