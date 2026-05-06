/**
 * Platform Configuration
 * ──────────────────────
 * Set REACT_APP_PLATFORM in your .env file to switch between deployments:
 *   REACT_APP_PLATFORM=USA    → USA version (Tennis + Pickleball focus)
 *   REACT_APP_PLATFORM=India  → India version (Cricket focus)
 *
 * Both deployments share the same codebase. Only content, defaults,
 * currency, and featured sports change per platform.
 */

const PLATFORM_CONFIGS = {
  USA: {
    platformName: "LeaguePro",
    country: "USA",
    heroBadge: "Leagues now open for registration",
    heroSubtitle: "Join competitive Tennis, Cricket & Pickleball leagues across top cities near you.",
    footerTagline: "Competitive sports leagues for Tennis, Cricket & Pickleball.",
    defaultSport: "tennis",
    primarySports: ["tennis", "pickleball"],
    defaultCurrency: "USD",
    currencySymbol: "$",
    paymentProvider: "stripe",
    statsRegion: "15+ Cities",
    featuredCities: [
      { name: "New York", icon: "🏙️", sports: ["Tennis", "Pickleball"], desc: "Central Park courts & indoor facilities." },
      { name: "Los Angeles", icon: "🌴", sports: ["Pickleball", "Tennis"], desc: "Year-round outdoor play at top LA venues." },
      { name: "Chicago", icon: "🌆", sports: ["Tennis", "Pickleball"], desc: "Competitive leagues at Grant Park & beyond." },
      { name: "San Francisco", icon: "🌉", sports: ["Tennis"], desc: "Golden Gate Park courts & indoor clubs." },
      { name: "Atlanta", icon: "🏟️", sports: ["Pickleball", "Tennis"], desc: "Fastest-growing pickleball scene in the South." },
      { name: "Houston", icon: "🤠", sports: ["Tennis", "Pickleball"], desc: "Year-round leagues across Houston's top clubs." },
    ],
    citySectionTitle: "Find a League Near You",
    citySectionDesc: "Competitive leagues now running in cities across the country — new seasons starting regularly.",
    leagueFilterDefault: {},
  },

  India: {
    platformName: "LeaguePro",
    country: "India",
    heroBadge: "Leagues now open for registration",
    heroSubtitle: "Join competitive Cricket, Tennis & Pickleball leagues across top cities near you.",
    footerTagline: "Competitive sports leagues for Cricket, Tennis & Pickleball.",
    defaultSport: "cricket",
    primarySports: ["cricket"],
    defaultCurrency: "INR",
    currencySymbol: "₹",
    paymentProvider: "razorpay",
    statsRegion: "12+ Cities",
    featuredCities: [
      { name: "Mumbai", icon: "🌊", sports: ["Cricket", "Tennis"], desc: "Corporate and amateur cricket at top Mumbai grounds." },
      { name: "Delhi", icon: "🏛️", sports: ["Cricket"], desc: "T10 & T20 corporate leagues across Delhi-NCR." },
      { name: "Bangalore", icon: "🌿", sports: ["Cricket", "Pickleball"], desc: "Night leagues & weekend tournaments in Bangalore." },
      { name: "Chennai", icon: "🌞", sports: ["Cricket", "Tennis"], desc: "Premier leagues at MA Chidambaram practice grounds." },
      { name: "Hyderabad", icon: "💎", sports: ["Cricket"], desc: "Fast-growing corporate league hub in Hyderabad." },
      { name: "Pune", icon: "🏔️", sports: ["Cricket", "Tennis"], desc: "Weekend cricket and tennis leagues across Pune." },
    ],
    citySectionTitle: "Find a League Near You",
    citySectionDesc: "Competitive leagues now running in cities across the country — new seasons starting regularly.",
    leagueFilterDefault: {},
  },
};

export const PLATFORM = process.env.REACT_APP_PLATFORM || "USA";
export const platformConfig = PLATFORM_CONFIGS[PLATFORM] || PLATFORM_CONFIGS.USA;
export default platformConfig;
