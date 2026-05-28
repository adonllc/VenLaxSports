/**
 * ═══════════════════════════════════════════════════════════════════
 *  LEAGUEPRO — PHASE-DRIVEN PLATFORM CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Set REACT_APP_PHASE in your .env to control the active deployment:
 *
 *  REACT_APP_PHASE=1  → Phase 1 — USA: Tennis + Pickleball (ACTIVE)
 *  REACT_APP_PHASE=2  → Phase 2 — USA: Add Cricket
 *  REACT_APP_PHASE=3  → Phase 3 — India: Cricket focus (INR + Razorpay)
 *
 *  Each phase inherits everything from the previous phase unless
 *  explicitly overridden. Only content, sports, currency, cities,
 *  and payment provider change — the codebase is identical.
 * ═══════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────
// ALL AVAILABLE SPORTS (used across all phases)
// ─────────────────────────────────────────────────────────────────────
export const ALL_SPORTS = {
  tennis: {
    id: "tennis", label: "Tennis", icon: "🎾",
    color: "text-tennis", bg: "hover:bg-tennis-light",
    badge: "sport-badge-tennis", accent: "#10B981",
  },
  pickleball: {
    id: "pickleball", label: "Pickleball", icon: "🏓",
    color: "text-pickleball", bg: "hover:bg-pickleball-light",
    badge: "sport-badge-pickleball", accent: "#F97316",
  },
  // PHASE 2 & 3: Cricket unlocked
  cricket: {
    id: "cricket", label: "Cricket", icon: "🏏",
    color: "text-cricket", bg: "hover:bg-cricket-light",
    badge: "sport-badge-cricket", accent: "#2563EB",
  },
};

// ─────────────────────────────────────────────────────────────────────
// PHASE 1 — USA: Tennis + Pickleball
// Status: ACTIVE
// Payment: Stripe (USD)
// ─────────────────────────────────────────────────────────────────────
const PHASE_1 = {
  phase: 1,
  phaseLabel: "Phase 1 — USA: Tennis & Pickleball",
  country: "USA",

  // Sports available in this phase
  // PHASE 2: add "cricket" here
  activeSports: ["tennis", "pickleball"],
  defaultSport: "tennis",

  // Payments
  currency: "USD",
  currencySymbol: "$",
  paymentProvider: "stripe",      // PHASE 3: change to "razorpay"

  // UI copy
  heroBadge: "Season 1 is live. Spots filling fast.",
  heroSubtitle: "Ranked leagues for Tennis & Pickleball players across the USA. Enter your city's circuit.",
  footerTagline: "Ranked leagues. Real competition. Every city. Every season.",
  statsRegion: "All US Cities",

  // City highlights shown on Home page
  featuredCities: [
    { name: "New York",      icon: "🏙️", sports: ["Tennis", "Pickleball"], desc: "Ranked circuits at premier indoor & outdoor courts." },
    { name: "Los Angeles",   icon: "🌴", sports: ["Pickleball", "Tennis"], desc: "Year-round competition at LA's top venues." },
    { name: "Chicago",       icon: "🌆", sports: ["Tennis", "Pickleball"], desc: "Seasons running across Chicago's best courts." },
    { name: "San Francisco", icon: "🌉", sports: ["Tennis"],               desc: "Competitive singles & doubles. Join the circuit." },
    { name: "Atlanta",       icon: "🏟️", sports: ["Pickleball", "Tennis"], desc: "The South's fastest-rising pickleball scene." },
    { name: "Houston",       icon: "🤠", sports: ["Tennis", "Pickleball"], desc: "Ranked leagues at Houston's elite clubs." },
  ],
  citySectionTitle: "Pick Your City. Enter Your Season.",
  citySectionDesc: "Ranked Tennis & Pickleball leagues running across the USA. New seasons open year-round.",
};

// ─────────────────────────────────────────────────────────────────────
// PHASE 2 — USA: Add Cricket
// Status: PLANNED
// Extends Phase 1 — only changed fields listed below
// Payment: Stripe (USD) — same as Phase 1
// ─────────────────────────────────────────────────────────────────────
const PHASE_2 = {
  ...PHASE_1,                           // inherit everything from Phase 1
  phase: 2,
  phaseLabel: "Phase 2 — USA: Tennis, Pickleball & Cricket",

  // Cricket is now active
  activeSports: ["tennis", "pickleball", "cricket"],
  // defaultSport remains "tennis"

  heroSubtitle: "Join competitive Tennis, Pickleball & Cricket leagues across top US cities.",
  footerTagline: "Competitive Tennis, Pickleball & Cricket leagues across the USA.",
  statsRegion: "10+ US Cities",

  // Phase 2 adds two new cricket-friendly cities
  featuredCities: [
    ...PHASE_1.featuredCities,
    { name: "Phoenix", icon: "🌵", sports: ["Tennis", "Cricket"],    desc: "Year-round play with a growing cricket community." },
    { name: "Seattle", icon: "🌧️", sports: ["Cricket", "Pickleball"], desc: "Indoor cricket leagues & top pickleball courts." },
  ],
  citySectionDesc: "Tennis, Pickleball & Cricket leagues now running across top US cities.",
};

// ─────────────────────────────────────────────────────────────────────
// PHASE 3 — India: Cricket focus
// Status: PLANNED
// New country — INR pricing, Razorpay payments
// ─────────────────────────────────────────────────────────────────────
const PHASE_3 = {
  phase: 3,
  phaseLabel: "Phase 3 — India: Cricket Focus",
  country: "India",

  // Cricket is the primary sport; Tennis & Pickleball are secondary
  activeSports: ["cricket", "tennis", "pickleball"],
  defaultSport: "cricket",

  // Payments — PHASE 3: Razorpay with INR
  currency: "INR",
  currencySymbol: "₹",
  paymentProvider: "razorpay",    // TODO: integrate Razorpay when activating Phase 3

  // UI copy
  heroBadge: "Now live — Season 1 open for registration",
  heroSubtitle: "Join competitive Cricket, Tennis & Pickleball leagues across top Indian cities.",
  footerTagline: "Competitive Cricket, Tennis & Pickleball leagues across India.",
  statsRegion: "8+ Indian Cities",

  featuredCities: [
    { name: "Mumbai",    icon: "🌊", sports: ["Cricket", "Tennis"],    desc: "Corporate & amateur cricket at top Mumbai grounds." },
    { name: "Delhi",     icon: "🏛️", sports: ["Cricket"],              desc: "T10 & T20 corporate leagues across Delhi-NCR." },
    { name: "Bangalore", icon: "🌿", sports: ["Cricket", "Pickleball"], desc: "Night leagues & weekend tournaments in Bangalore." },
    { name: "Chennai",   icon: "🌞", sports: ["Cricket", "Tennis"],    desc: "Premier leagues at top Chennai grounds." },
    { name: "Hyderabad", icon: "💎", sports: ["Cricket"],              desc: "Fast-growing corporate league hub in Hyderabad." },
    { name: "Pune",      icon: "🏔️", sports: ["Cricket", "Tennis"],   desc: "Weekend cricket & tennis leagues across Pune." },
  ],
  citySectionTitle: "Find a League Near You",
  citySectionDesc: "Cricket, Tennis & Pickleball leagues now running across top Indian cities.",
};

// ─────────────────────────────────────────────────────────────────────
// ACTIVE PHASE — controlled by REACT_APP_PHASE env var
// CRICKET_ENABLED — independent toggle via REACT_APP_CRICKET_ENABLED
//   Set REACT_APP_CRICKET_ENABLED=true in Coolify to add cricket to any
//   phase without bumping the phase number.
// ─────────────────────────────────────────────────────────────────────
const PHASE_CONFIGS = { 1: PHASE_1, 2: PHASE_2, 3: PHASE_3 };

export const PHASE = parseInt(process.env.REACT_APP_PHASE || "1");
const baseConfig = PHASE_CONFIGS[PHASE] || PHASE_1;

const CRICKET_ENABLED = process.env.REACT_APP_CRICKET_ENABLED === "true";
export const platformConfig = (CRICKET_ENABLED && !baseConfig.activeSports.includes("cricket"))
  ? { ...baseConfig, activeSports: [...baseConfig.activeSports, "cricket"] }
  : baseConfig;

// Resolved sport objects for the active phase (use this in UI components)
export const activeSports = platformConfig.activeSports
  .map((id) => ALL_SPORTS[id])
  .filter(Boolean);

// Map of active sport id -> sport meta (quick lookup)
export const activeSportMap = Object.fromEntries(activeSports.map((s) => [s.id, s]));

// Active sport ids (e.g., ["tennis", "pickleball"])
export const activeSportIds = activeSports.map((s) => s.id);

// Is a sport available in the current phase?
export const isSportActive = (sportId) => activeSportIds.includes(sportId);

// Active country (e.g., "USA" or "India")
export const activeCountry = platformConfig.country;

export default platformConfig;
