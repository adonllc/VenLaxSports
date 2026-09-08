import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { activeSports } from "../config/platformConfig";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="bg-white min-h-screen flex flex-col">
      {/* HERO SECTION — Orange full-bleed */}
      <section className="flex-1 flex items-center justify-center px-6 py-20" style={{ backgroundColor: "#EA580C" }}>
        <div className="max-w-2xl text-center">
          {/* Nexus icon only (three sport rings) */}
          <motion.div
            className="mb-8 flex justify-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <svg
              width={80}
              height={74}
              viewBox="0 0 52 48"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: "block" }}
              aria-hidden="true"
            >
              <circle cx="26" cy="13" r="12" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
              <circle cx="14" cy="34" r="12" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
              <circle cx="38" cy="34" r="12" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
            </svg>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="font-black text-5xl md:text-6xl leading-tight mb-4 text-white"
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, type: "spring", stiffness: 80 }}
          >
            Sports just got<br />a new home.
          </motion.h1>

          {/* Pillars tagline */}
          <motion.p
            className="text-xl md:text-2xl font-bold mb-6"
            style={{ color: "#065F46", fontFamily: "'Sora', system-ui, sans-serif" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            Play. Connect. Compete. Share.
          </motion.p>

          {/* Subheading */}
          <motion.p
            className="text-lg md:text-xl mb-12 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.9)", fontFamily: "'IBM Plex Sans', sans-serif" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Everything you love about Tennis &amp; Pickleball — in one place.
          </motion.p>

          {/* Primary CTA */}
          <motion.div
            className="flex justify-center mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <motion.button
              onClick={() => navigate("/auth")}
              className="px-10 py-4 bg-white text-orange-600 rounded-lg font-semibold transition-all"
              style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
              whileHover={{ scale: 1.10, y: -5, boxShadow: "0 20px 48px rgba(0,0,0,0.3)" }}
              whileTap={{ scale: 0.95 }}
              aria-label="Sign up for VenLax Sports"
              data-testid="hero-join-venlax"
            >
              Join VenLax →
            </motion.button>
          </motion.div>

          {/* Explore-by-sport secondary CTAs */}
          <motion.div
            className="flex flex-col md:flex-row gap-4 justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {activeSports.map((s) => (
              <motion.button
                key={s.id}
                onClick={() => navigate(`/sport/${s.id}`)}
                className="px-8 py-3.5 rounded-lg font-semibold transition-all text-white border-2 border-white"
                style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
                whileHover={{ scale: 1.08, y: -4, backgroundColor: "rgba(255,255,255,0.15)" }}
                whileTap={{ scale: 0.95 }}
                aria-label={`Explore ${s.label} leagues`}
                data-testid={`hero-explore-${s.id}`}
              >
                {s.icon} Explore {s.label}
              </motion.button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PROOF STATEMENT — quiet close, no competing CTA */}
      <motion.section
        className="py-20 px-6 bg-white text-center border-t border-gray-200"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <motion.p
          className="text-3xl md:text-4xl font-black max-w-2xl mx-auto"
          style={{ fontFamily: "'Sora', system-ui, sans-serif", color: "#10B981" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Your game doesn't end when the match ends.
        </motion.p>
      </motion.section>
    </div>
  );
}
