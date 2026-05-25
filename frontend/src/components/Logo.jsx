import BRAND from "../config/brandConfig";

const S = { tennis: "#10B981", pickle: "#F97316", cricket: "#2563EB", ball: "#EA580C" };

const HEIGHTS = { sm: 28, md: 36, lg: 44, xl: 52, hero: 64 };

const PALETTES = {
  default: { text: "#111827", x: "#10B981", sub: "#9CA3AF", rule: "#D1D5DB" },
  light:   { text: "#FFFFFF", x: "#34D399", sub: "#9CA3AF", rule: "#374151" },
  hero:    { text: "#FFFFFF", x: "#34D399", sub: "#9CA3AF", rule: "#374151" },
};

export default function Logo({ variant = "default", size = "md", className = "", testId = "brand-logo" }) {
  const h = HEIGHTS[size] || HEIGHTS.md;
  const p = PALETTES[variant] || PALETTES.default;

  return (
    <svg
      viewBox="0 0 220 44"
      height={h}
      aria-label={BRAND.full_name}
      data-testid={testId}
      className={className}
      style={{ display: "block" }}
    >
      {/* Tennis ball */}
      <circle cx="13" cy="19" r="11" fill={S.tennis} />
      <path d="M7,12 Q13,19 7,26" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M19,12 Q13,19 19,26" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Pickleball */}
      <circle cx="37" cy="19" r="11" fill={S.pickle} />
      <circle cx="34" cy="16" r="1.8" fill="white" />
      <circle cx="40" cy="16" r="1.8" fill="white" />
      <circle cx="34" cy="22" r="1.8" fill="white" />
      <circle cx="40" cy="22" r="1.8" fill="white" />
      <circle cx="37" cy="19" r="1.8" fill="white" />

      {/* Cricket bat + ball */}
      <rect x="57" y="8" width="5" height="22" rx="2.5" fill={S.cricket} />
      <circle cx="69" cy="19" r="8" fill={S.ball} />

      {/* Divider */}
      <line x1="84" y1="6" x2="84" y2="34" stroke={p.rule} strokeWidth="1" />

      {/* VENLA + X wordmark */}
      <text fontFamily="'Outfit', sans-serif" fontWeight="900" fontStyle="italic" fontSize="24" y="29">
        <tspan x="92" fill={p.text}>VENLA</tspan>
        <tspan fill={p.x}>X</tspan>
      </text>

      {/* SPORTS */}
      <text
        x="93"
        y="41"
        fontFamily="'Outfit', sans-serif"
        fontSize="6.5"
        fontWeight="700"
        letterSpacing="3"
        fill={p.sub}
      >
        SPORTS
      </text>
    </svg>
  );
}
