import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../components/Logo";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://api.venlaxsports.com";

const PRIMARY = "#10B981";
const ACCENT = "#F97316";
const DARK = "#3F4652";
const LIGHT = "#FAF6F1";
const CREAM = "#F9F7F4";
const PALE_BLUE = "#F0F7FF";
const PALE_AMBER = "#FFFAF0";
const BORDER = "#E8E3DE";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (custom = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut", delay: custom * 0.1 },
  }),
};

const scaleReveal = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (custom = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut", delay: custom * 0.08 },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

const counter = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8 } },
};

const floatingBlob = (duration) => ({
  animate: {
    y: [0, 30, -20, 0],
    x: [0, 15, -10, 0],
    rotate: [0, 360],
  },
  transition: {
    duration,
    repeat: Infinity,
    ease: "easeInOut",
  },
});

const pulseEffect = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.7, 1, 0.7],
  },
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

const shimmer = {
  animate: {
    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
  },
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: "linear",
  },
};

const viewportConfig = { once: true, margin: "-80px" };

export default function PreLaunch() {
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [sport, setSport] = useState("tennis");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [skillLevel, setSkillLevel] = useState("intermediate");
  const [waitlistId, setWaitlistId] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [openFaq, setOpenFaq] = useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferredBy(ref);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !city) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          city: city.trim(),
          sport,
          skill_level: skillLevel,
          referred_by: referredBy,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWaitlistId(data.waitlist_id || "");
        setSubmitted(true);
      } else {
        setError(data.detail || "Something went wrong. Try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const features = [
    {
      icon: "🎯",
      title: "Smart Matchmaking",
      body: "No more sandbaggers. No more mismatches. We match you with players at your exact level in your city — every time.",
      mockup: (
        <div className="flex-1 rounded-xl p-6 space-y-3" style={{ background: CREAM, border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#6B7A96", fontFamily: "'DM Sans', monospace" }}>Opponent Found</p>
          {[
            { name: "Marcus T.", rating: 1847, record: "12W 3L" },
            { name: "Sarah K.", rating: 1823, record: "9W 4L" },
          ].map((player) => (
            <motion.div key={player.name} className="bg-white rounded-lg px-4 py-3 flex items-center justify-between" style={{ border: `1px solid ${BORDER}` }} whileHover={{ y: -2, boxShadow: `0 8px 16px ${PRIMARY}15` }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: PALE_BLUE, color: PRIMARY }}>
                  {player.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: DARK, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{player.name}</p>
                  <p className="text-xs" style={{ color: "#6B7A96", fontFamily: "'DM Sans', monospace" }}>{player.record}</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ color: "white", background: PRIMARY, fontFamily: "'DM Sans', monospace" }}>{player.rating}</span>
            </motion.div>
          ))}
        </div>
      ),
    },
    {
      icon: "📈",
      title: "Live City Rankings",
      body: "Every match counts. Every win moves you up. Your VENLAX ranking is the official record of where you stand.",
      mockup: (
        <div className="flex-1 rounded-xl p-6" style={{ background: CREAM, border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#6B7A96", fontFamily: "'DM Sans', monospace" }}>Austin TX — Tennis Singles</p>
          <div className="space-y-2">
            {[
              { rank: 1, name: "Alex M.", rating: 2103, delta: "+12" },
              { rank: 2, name: "Jordan P.", rating: 1984, delta: "+5" },
              { rank: 3, name: "Taylor S.", rating: 1947, delta: "-3" },
            ].map((row) => (
              <motion.div
                key={row.rank}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={row.rank === 3
                  ? { background: PALE_BLUE, border: `1px solid ${PRIMARY}20` }
                  : { background: "white", border: `1px solid ${BORDER}` }
                }
                whileHover={{ x: 2 }}
              >
                <span className="text-xs font-bold w-4" style={{ color: "#6B7A96", fontFamily: "'DM Sans', monospace" }}>{row.rank}</span>
                <span className="text-sm font-medium flex-1" style={{ color: DARK, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{row.name}</span>
                <span className="text-xs" style={{ color: "#6B7A96", fontFamily: "'DM Sans', monospace" }}>{row.rating}</span>
                <span className="text-xs font-medium" style={{ color: row.delta.startsWith("+") ? PRIMARY : "#EF4444", fontFamily: "'DM Sans', monospace" }}>{row.delta}</span>
              </motion.div>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: "📅",
      title: "Flexible League Formats",
      body: "Singles, Doubles, Mixed Doubles, or Casual — pick the format that fits your game. You choose the intensity.",
      mockup: (
        <div className="flex-1 rounded-xl p-6 space-y-3" style={{ background: CREAM, border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#6B7A96", fontFamily: "'DM Sans', monospace" }}>Choose Your Format</p>
          {[
            { name: "Singles League", sub: "Round Robin · 6 matches", badge: "Popular", badgeBg: PALE_BLUE, badgeColor: PRIMARY },
            { name: "Doubles League", sub: "Round Robin · 6 matches", badge: "Team Play", badgeBg: PALE_AMBER, badgeColor: "#92400E" },
          ].map((fmt) => (
            <motion.div key={fmt.name} className="bg-white rounded-lg px-4 py-3 flex items-center justify-between" style={{ border: `1px solid ${BORDER}` }} whileHover={{ y: -2 }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: DARK, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{fmt.name}</p>
                <p className="text-xs" style={{ color: "#6B7A96", fontFamily: "'DM Sans', monospace" }}>{fmt.sub}</p>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-md" style={{ background: fmt.badgeBg, color: fmt.badgeColor, fontFamily: "'DM Sans', monospace" }}>{fmt.badge}</span>
            </motion.div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: LIGHT }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: CREAM, borderColor: BORDER }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="md" />
          <motion.a
            href="#early-access"
            className="text-sm font-bold px-4 py-2 rounded-md transition-colors"
            style={{ background: PRIMARY, color: "white" }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Get Early Access
          </motion.a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg, ${PALE_BLUE} 0%, ${PALE_AMBER} 100%)` }} className="py-28 px-6 relative overflow-hidden">
        <motion.div
          className="absolute top-10 right-10 w-40 h-40 rounded-full"
          style={{ background: `${PRIMARY}15`, filter: "blur(60px)" }}
          {...floatingBlob(8)}
        />
        <motion.div
          className="absolute bottom-20 left-5 w-56 h-56 rounded-full"
          style={{ background: `${ACCENT}12`, filter: "blur(80px)" }}
          {...floatingBlob(10)}
        />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-8"
            style={{ background: "rgba(255,255,255,0.85)", border: `1px solid ${BORDER}`, backdropFilter: "blur(10px)", color: DARK }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: PRIMARY }}
              animate={{ scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            Launching in select cities — 2026
          </motion.div>

          <motion.div
            className="text-center text-sm font-semibold mb-6"
            style={{ color: PRIMARY }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            🚀 100+ founding members claimed their spots — only 15 left
          </motion.div>

          <motion.h1
            className="font-black leading-tight mb-6"
            style={{ fontSize: "clamp(2.5rem, 6vw, 3.5rem)", color: DARK, fontFamily: "'Barlow Condensed', sans-serif" }}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            Stop Hunting for Good Matches.
            <br />
            <motion.span
              style={{ color: PRIMARY, display: "inline-block" }}
              animate={{ opacity: [0.8, 1], y: [10, 0] }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              Play in a Real League.
            </motion.span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl max-w-2xl mx-auto mb-10"
            style={{ color: "#4B5563" }}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            VENLAX runs competitive Tennis and Pickleball leagues in your city — real rankings, skill-matched opponents, and players who actually show up.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.a
              href="#early-access"
              className="font-semibold px-8 py-4 rounded-lg transition-all text-base"
              style={{ background: PRIMARY, color: "white" }}
              whileHover={{ scale: 1.05, y: -3, boxShadow: `0 12px 32px ${PRIMARY}30` }}
              whileTap={{ scale: 0.95 }}
              data-testid="hero-cta-primary"
            >
              Secure My Spot — 15 Left
            </motion.a>
            <motion.a
              href="#early-access"
              className="font-medium px-8 py-4 rounded-lg transition-all text-base"
              style={{ border: `2px solid ${PRIMARY}`, color: PRIMARY, background: PALE_BLUE }}
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.95 }}
              data-testid="hero-cta-secondary"
            >
              Notify Me When My City Opens
            </motion.a>
          </motion.div>

          <motion.p
            className="text-sm mt-6"
            style={{ color: "#6B7A96" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Limited early-access spots per city. No spam, ever.
          </motion.p>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-b py-5 px-6" style={{ background: CREAM, borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm"
            style={{ color: DARK, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            {[
              "Placed by skill — no sandbaggers",
              "Flexible scheduling — you set times",
              "Official VENLAX city ranking",
              "Tennis + Pickleball on one profile",
            ].map((point) => (
              <motion.div key={point} className="flex items-center gap-2" variants={staggerItem}>
                <span className="font-bold" style={{ color: PRIMARY }}>✓</span>
                {point}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 px-6" style={{ background: LIGHT }}>
        <div className="max-w-3xl mx-auto">
          <motion.p
            className="font-semibold text-sm uppercase tracking-widest mb-4 text-center"
            style={{ color: PRIMARY }}
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            Sound familiar?
          </motion.p>

          <motion.h2
            className="font-black text-center mb-12"
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: DARK, fontFamily: "'Barlow Condensed', sans-serif" }}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            Finding competitive play shouldn't be this hard.
          </motion.h2>

          <motion.div
            className="space-y-5"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            {[
              { icon: "😤", title: "You're stuck in dead group chats.", body: "No-shows, cancellations, zero accountability." },
              { icon: "📊", title: "You have no idea where you stand.", body: "No ranking, no record, no proof — just vibes." },
              { icon: "🎾", title: "Real competitive leagues? Don't exist.", body: "Clubs cost thousands. Pickup courts are chaos." },
            ].map((item, idx) => (
              <motion.div
                key={item.title}
                className="flex gap-5 p-6 rounded-lg cursor-pointer"
                style={{ border: `1px solid ${BORDER}`, background: CREAM }}
                variants={staggerItem}
                whileHover={{ y: -6, boxShadow: `0 16px 32px ${PRIMARY}15`, background: PALE_BLUE }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-3xl flex-shrink-0">{item.icon}</div>
                <div>
                  <p className="font-semibold mb-1" style={{ color: DARK, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.1rem" }}>
                    {item.title}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "#4B5563" }}>{item.body}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-20 px-6" style={{ background: `linear-gradient(135deg, ${PALE_AMBER} 0%, ${PALE_BLUE} 100%)` }}>
        <div className="max-w-4xl mx-auto">
          <motion.p
            className="font-semibold text-sm uppercase tracking-widest mb-4 text-center"
            style={{ color: PRIMARY, fontFamily: "'DM Sans', monospace" }}
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            Enter VENLAX Sports
          </motion.p>

          <motion.h2
            className="font-black text-center mb-14"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: DARK }}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            From scattered to unstoppable.
          </motion.h2>

          <motion.div
            className="grid md:grid-cols-2 gap-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            {[
              { before: "Endless group chats going nowhere", after: "Organized city leagues with confirmed players" },
              { before: "No idea of your actual skill level", after: "An official VENLAX ranking that grows with every win" },
              { before: "Hunting for opponents who match you", after: "Auto-matched by skill, location, and availability" },
              { before: "Playing alone with no community", after: "A city-wide network of players who show up" },
            ].map((item, idx) => (
              <motion.div
                key={item.before}
                className="rounded-lg p-5 cursor-pointer"
                style={{ background: "rgba(255,255,255,0.5)", border: `1px solid ${BORDER}`, backdropFilter: "blur(10px)" }}
                variants={staggerItem}
                whileHover={{ x: 6, scale: 1.02, boxShadow: `0 12px 24px ${PRIMARY}20` }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-sm line-through mb-2" style={{ color: "#8B8B8B" }}>{item.before}</p>
                <p className="font-medium flex items-start gap-2" style={{ color: DARK, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  <span className="mt-0.5 flex-shrink-0" style={{ color: PRIMARY }}>→</span>
                  {item.after}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Zig-Zag */}
      <section className="py-24 px-6" style={{ background: LIGHT }}>
        <div className="max-w-5xl mx-auto">
          <motion.p
            className="font-semibold text-sm uppercase tracking-widest text-center mb-16"
            style={{ color: PRIMARY }}
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            Built for players who want more
          </motion.p>

          <div className="space-y-24">
            {features.map((feat, idx) => (
              <motion.div
                key={feat.title}
                className={`flex flex-col md:flex-row items-center gap-12 ${idx % 2 === 1 ? "md:flex-row-reverse" : ""}`}
                variants={scaleReveal}
                initial="hidden"
                whileInView="visible"
                viewport={viewportConfig}
                custom={idx}
              >
                <div className="flex-1">
                  <div className="text-5xl mb-4">{feat.icon}</div>
                  <h3
                    className="font-black mb-4"
                    style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", color: DARK, fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {feat.title}
                  </h3>
                  <p className="text-lg leading-relaxed" style={{ color: "#4B5563" }}>{feat.body}</p>
                </div>
                <motion.div whileHover={{ y: -4 }}>
                  {feat.mockup}
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6" style={{ background: CREAM }}>
        <div className="max-w-4xl mx-auto">
          <motion.p
            className="font-semibold text-sm uppercase tracking-widest mb-4 text-center"
            style={{ color: PRIMARY }}
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            Simple by design
          </motion.p>

          <motion.h2
            className="font-black text-center mb-16"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: DARK }}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            Three steps to your first match.
          </motion.h2>

          <motion.div
            className="grid md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            {[
              { step: "01", title: "Join", body: "Sign up in 2 minutes. Set your sport, skill level, and city." },
              { step: "02", title: "Get Matched", body: "We place you in the right league, at your level, in your city." },
              { step: "03", title: "Play & Rise", body: "Win matches. Climb the city leaderboard. Your ranking follows you." },
            ].map((s, idx) => (
              <motion.div
                key={s.step}
                className="text-center"
                variants={staggerItem}
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full font-bold text-xl mb-6"
                  style={{ background: PRIMARY, color: "white", fontFamily: "'Barlow Condensed', sans-serif" }}
                  whileHover={{ scale: 1.15 }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  {s.step}
                </motion.div>
                <h3 className="font-bold mb-3" style={{ fontSize: "1.25rem", color: DARK, fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#4B5563" }}>{s.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6" style={{ background: CREAM }}>
        <div className="max-w-2xl mx-auto">
          <motion.p
            className="font-semibold text-sm uppercase tracking-widest mb-4 text-center"
            style={{ color: PRIMARY }}
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            Common questions
          </motion.p>

          <motion.h2
            className="font-black text-center mb-12"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: DARK }}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            Everything you need to know.
          </motion.h2>

          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
          >
            {[
              { q: "How are matches scheduled?", a: "You and your opponent coordinate directly. VENLAX gives you 7 days per match round. You pick what works." },
              { q: "What if no one is in my city yet?", a: "You're on the list. When enough players sign up in your city, we open it and notify you first." },
              { q: "Can I play both Tennis and Pickleball?", a: "Yes. One profile, separate rankings per sport. Register for each league individually." },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="rounded-lg overflow-hidden"
                style={{ border: `1px solid ${BORDER}` }}
                variants={staggerItem}
              >
                <motion.button
                  type="button"
                  className="w-full text-left px-6 py-4 flex justify-between items-center transition-all cursor-pointer"
                  style={{ background: openFaq === i ? LIGHT : PALE_BLUE, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  whileHover={{ background: openFaq === i ? LIGHT : PALE_AMBER }}
                  whileTap={{ scale: 0.98 }}
                  data-testid={`faq-${i}`}
                >
                  <span className="font-medium text-sm" style={{ color: DARK }}>{item.q}</span>
                  <motion.span
                    className="text-lg flex-shrink-0 ml-4"
                    style={{ color: PRIMARY }}
                    animate={{ rotate: openFaq === i ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {openFaq === i ? "−" : "+"}
                  </motion.span>
                </motion.button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="px-6 pb-4 text-sm leading-relaxed pt-3" style={{ borderTop: `1px solid ${BORDER}`, color: "#4B5563", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="early-access" className="py-24 px-6" style={{ background: PRIMARY, color: "white" }}>
        <div className="max-w-xl mx-auto text-center">
          <motion.h2
            className="font-black mb-4"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)" }}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            Your city is opening soon.
          </motion.h2>

          <motion.p
            className="text-lg mb-10"
            style={{ color: "rgba(255,255,255,0.8)" }}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1 }}
          >
            Early access members get priority city placement and founding member status.
          </motion.p>

          {submitted ? (
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="rounded-lg p-8 text-center" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <p className="font-bold text-xl mb-2" style={{ color: "#FED7AA", fontFamily: "'Barlow Condensed', sans-serif" }}>
                  You're on the early access list.
                </p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                  We'll notify you the moment {city || "your city"} opens.
                </p>
              </div>

              {waitlistId && (
                <motion.div
                  className="rounded-lg p-6 space-y-4"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className="text-white font-semibold text-sm text-center">Move up the list — invite players from your city</p>
                  <div className="rounded-md px-3 py-2.5 text-xs font-mono truncate" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>
                    {`${window.location.origin}/?ref=${waitlistId}`}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?ref=${waitlistId}`); }}
                      className="py-2.5 rounded-md text-sm font-medium transition-colors"
                      style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.75)" }}
                      whileHover={{ background: "rgba(255,255,255,0.1)" }}
                      data-testid="copy-referral-link"
                    >
                      Copy Link
                    </motion.button>
                    <motion.a
                      href={`https://wa.me/?text=${encodeURIComponent(`I'm getting early access to VENLAX — competitive Tennis/Pickleball leagues. Join me: ${window.location.origin}/?ref=${waitlistId}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 rounded-md text-sm font-medium text-center block transition-colors"
                      style={{ background: "#25D366", color: "white" }}
                      whileHover={{ scale: 1.02 }}
                      data-testid="share-whatsapp"
                    >
                      Share on WhatsApp
                    </motion.a>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.form
              onSubmit={handleSubmit}
              className="space-y-4"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                required
                className="w-full rounded-lg px-4 py-4 text-base focus:outline-none transition-all placeholder:text-white/60"
                style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "white" }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.8)"; e.currentTarget.style.background = "rgba(0,0,0,0.25)"; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(16,185,129,0.2)`; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.background = "rgba(0,0,0,0.15)"; e.currentTarget.style.boxShadow = "none"; }}
                variants={staggerItem}
                whileFocus={{ scale: 1.01 }}
                data-testid="waitlist-email"
              />
              <motion.input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Your city (e.g. Austin, TX)"
                required
                className="w-full rounded-lg px-4 py-4 text-base focus:outline-none transition-all placeholder:text-white/60"
                style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "white" }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.8)"; e.currentTarget.style.background = "rgba(0,0,0,0.25)"; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(16,185,129,0.2)`; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.background = "rgba(0,0,0,0.15)"; e.currentTarget.style.boxShadow = "none"; }}
                variants={staggerItem}
                whileFocus={{ scale: 1.01 }}
                data-testid="waitlist-city"
              />
              <motion.div className="flex gap-3" variants={staggerItem}>
                {[
                  { value: "tennis", label: "🎾 Tennis" },
                  { value: "pickleball", label: "🏓 Pickleball" },
                  { value: "both", label: "Both" },
                ].map((opt) => (
                  <motion.button
                    key={opt.value}
                    type="button"
                    onClick={() => setSport(opt.value)}
                    className="flex-1 py-3 rounded-lg text-sm font-medium transition-colors"
                    style={sport === opt.value
                      ? { background: "#FED7AA", color: "#1F2937" }
                      : { border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }
                    }
                    whileHover={{ background: sport === opt.value ? "#FED7AA" : "rgba(255,255,255,0.1)" }}
                    data-testid={`sport-${opt.value}`}
                  >
                    {opt.label}
                  </motion.button>
                ))}
              </motion.div>
              {error && <p className="text-sm" style={{ color: "#FDA4AF" }}>{error}</p>}
              <motion.button
                type="submit"
                disabled={submitting || !email || !city}
                className="w-full font-bold py-4 rounded-lg text-base transition-all disabled:opacity-50"
                style={{ background: "#FED7AA", color: "#1F2937" }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                variants={staggerItem}
                data-testid="waitlist-submit"
              >
                {submitting ? "Securing your spot..." : "Secure My Early Access Spot"}
              </motion.button>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>Limited early-access spots per city. First come, first placed. No spam, ever.</p>
            </motion.form>
          )}
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        className="py-8 px-6 border-t"
        style={{ borderColor: BORDER, background: CREAM }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={viewportConfig}
      >
        <motion.div
          className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4"
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={viewportConfig}
          transition={{ duration: 0.5 }}
        >
          <Logo size="md" />
          <div className="flex gap-6 text-xs" style={{ color: "#6B7A96", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <span>© 2026 VENLAX Sports. All rights reserved.</span>
          </div>
        </motion.div>
      </motion.footer>
    </div>
  );
}
