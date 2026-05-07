/**
 * VENLAX brand constants — single source of truth.
 * Victory · Energy · eXperience.
 */

export const BRAND = {
  name: "VENLAX",
  full_name: "VENLAX Sports",
  domain: "venlaxsports.com",
  url: "https://venlaxsports.com",
  email: "hello@venlaxsports.com",
  payments_email: "payments@venlaxsports.com",

  tagline_short: "Victory. Energy. eXperience.",
  tagline_long: "Where Victory Meets Experience.",

  // Acronym breakdown (used on About / Auth left panel)
  pillars: [
    { letter: "V", word: "Victory", icon: "🏆", desc: "Every match, league, and season built around helping players win, improve, and rise." },
    { letter: "E", word: "Energy", icon: "⚡", desc: "The heartbeat of sports — fast, dynamic, community-driven across every city." },
    { letter: "X", word: "eXperience", icon: "🎮", desc: "A seamless digital + physical sports journey, mobile-first, end-to-end." },
  ],

  // Brand story for marketing copy
  story_short:
    "VENLAX stands for Victory, Energy, and eXperience — a global multi-sport platform built for players who want to compete, connect, and rise.",
  story_long:
    "VENLAX is built on a simple belief: sports should be accessible, competitive, and unforgettable. From the USA to India, from Tennis to Cricket to Pickleball, we connect players, venues, and leagues into one unified ecosystem. This is more than a platform — it's a movement.",

  // Phase-specific copy
  hero_title: "Your league. Your rules. Your win.",
  hero_subtitle: "Compete. Connect. Rise.",

  // Render helper for consumers
  full_logo: { prefix: "VEN", accent: "LAX" },
};

export default BRAND;
