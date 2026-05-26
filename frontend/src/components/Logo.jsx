import BRAND from "../config/brandConfig";

// height → width ratio from viewBox 0 0 390 72
const ASPECT = 390 / 72;

const SIZES = {
  sm:   32,
  md:   44,
  lg:   56,
  xl:   68,
  hero: 88,
};

export default function Logo({
  size = "md",
  variant = "default",
  className = "",
  testId = "brand-logo",
}) {
  const height = SIZES[size] || SIZES.md;
  const width = Math.round(height * ASPECT);

  // variant="light"|"hero" → logo appears on dark background
  const onDark = variant === "light" || variant === "hero";

  const venFill    = onDark ? "#ffffff"  : "#0F2044";
  const laFill     = onDark ? "#34D399"  : "#059669";
  const xFill      = "#F97316";
  const stripeT    = onDark ? "#34D399"  : "#10B981";
  const stripeP    = "#F97316";
  const stripeC    = onDark ? "#60A5FA"  : "#2563EB";
  const stripeLtr  = onDark ? "#06122a"  : "#ffffff";
  const divider    = onDark ? "#0d2040"  : "#C7D9F5";
  const sportsClr  = onDark ? "#1e3a6e"  : "#90ADCF";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 390 72"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={BRAND.full_name}
      role="img"
      data-testid={testId}
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Stripe block — emerald Tennis / orange Pickleball / blue Cricket */}
      <rect x="0" y="4"  width="28" height="18" rx="2.5" fill={stripeT}/>
      <rect x="0" y="27" width="28" height="18" rx="2.5" fill={stripeP}/>
      <rect x="0" y="50" width="28" height="18" rx="2.5" fill={stripeC}/>
      <text x="14" y="17" fontFamily="Outfit,sans-serif" fontSize="7.5" fontWeight="800"
            fill={stripeLtr} textAnchor="middle">T</text>
      <text x="14" y="40" fontFamily="Outfit,sans-serif" fontSize="7.5" fontWeight="800"
            fill={stripeLtr} textAnchor="middle">P</text>
      <text x="14" y="63" fontFamily="Outfit,sans-serif" fontSize="7.5" fontWeight="800"
            fill={stripeLtr} textAnchor="middle">C</text>
      {/* Divider */}
      <line x1="38" y1="2" x2="38" y2="70" stroke={divider} strokeWidth="1.5"/>
      {/* Wordmark */}
      <text x="48"  y="56" fontFamily="Outfit,sans-serif" fontSize="56" fontWeight="900"
            fontStyle="italic" fill={venFill} letterSpacing="-2">VEN</text>
      <text x="162" y="56" fontFamily="Outfit,sans-serif" fontSize="56" fontWeight="900"
            fontStyle="italic" fill={laFill} letterSpacing="-2">LA</text>
      <text x="234" y="56" fontFamily="Outfit,sans-serif" fontSize="56" fontWeight="900"
            fontStyle="italic" fill={xFill} letterSpacing="-2">X</text>
      {/* Sub-caption — visible at lg+ sizes, imperceptibly small at sm/md */}
      <text x="50"  y="71" fontFamily="Outfit,sans-serif" fontSize="8.5" fontWeight="700"
            fill={sportsClr} letterSpacing="7">SPORTS</text>
      <text x="170" y="71" fontFamily="Outfit,sans-serif" fontSize="7.5" fontWeight="600"
            fill={sportsClr} letterSpacing="1.2">TENNIS · PICKLEBALL · CRICKET</text>
    </svg>
  );
}
