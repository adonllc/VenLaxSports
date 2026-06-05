// Reusable Framer Motion animation configurations
// Use across pages for consistent motion language

export const motionConfigs = {
  // Entrance animations
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.6 } },
  },
  fadeUp: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  },
  fadeDown: {
    hidden: { opacity: 0, y: -40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  },
  slideInLeft: {
    hidden: { opacity: 0, x: -60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } },
  },
  slideInRight: {
    hidden: { opacity: 0, x: 60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } },
  },
  scaleUp: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
  },

  // Stagger container
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  },
  staggerItem: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  },

  // Scroll animations
  scrollFadeUp: (delay = 0) => ({
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay, ease: "easeOut" },
    },
  }),
  scrollScale: (delay = 0) => ({
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.6, delay, ease: "easeOut" },
    },
  }),

  // Hover effects
  hoverLift: { y: -6, boxShadow: "0 20px 40px rgba(0,0,0,0.1)" },
  hoverScale: { scale: 1.02 },
  hoverGlow: (color = "#10B981") => ({
    boxShadow: `0 12px 32px ${color}30`,
    y: -3,
  }),

  // Button animations
  buttonHover: { scale: 1.05, y: -2 },
  buttonTap: { scale: 0.95 },
  buttonPulse: {
    scale: [1, 1.02, 1],
    transition: { duration: 2, repeat: Infinity },
  },

  // Input/form animations
  inputFocus: { borderColor: "#10B981", boxShadow: "0 0 0 3px rgba(16,185,129,0.1)" },
  labelFloat: { y: -24, fontSize: "0.75rem" },

  // List animations
  listContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  },
  listItem: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4 } },
  },

  // Pulse/breathing effects
  pulse: {
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.7, 1, 0.7],
    },
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },

  // Floating/floating effect
  float: (duration = 4) => ({
    animate: {
      y: [0, -20, 0],
      transition: { duration, repeat: Infinity, ease: "easeInOut" },
    },
  }),

  // Shimmer effect
  shimmer: {
    animate: {
      backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
    },
    transition: { duration: 3, repeat: Infinity, ease: "linear" },
  },

  // Bounce effect
  bounce: {
    animate: {
      y: [0, -12, 0],
    },
    transition: { duration: 0.8, repeat: Infinity },
  },
};

// Viewport configuration for scroll animations
export const viewportConfig = {
  once: true,
  margin: "-100px",
};
