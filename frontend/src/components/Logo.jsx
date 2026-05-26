import BRAND from "../config/brandConfig";

// viewBox 0 0 390 78 — aspect ratio 5.0:1
const ASPECT = 390 / 78;

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

  const onDark = variant === "light" || variant === "hero";

  const venFill   = onDark ? "#ffffff" : "#0F2044";
  const laFill    = onDark ? "#34D399" : "#059669";
  const xFill     = "#F97316";
  const stripeT   = onDark ? "#34D399" : "#10B981";
  const stripeP   = "#F97316";
  const stripeC   = onDark ? "#60A5FA" : "#2563EB";
  const divider   = onDark ? "#1a3460" : "#C7D9F5";
  const sportsClr = onDark ? "#5b90cc" : "#7a9fc0";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 390 78"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={BRAND.full_name}
      role="img"
      data-testid={testId}
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Sport stripes — plain colored blocks, no labels */}
      <rect x="0" y="2"  width="28" height="18" rx="2.5" fill={stripeT}/>
      <rect x="0" y="24" width="28" height="18" rx="2.5" fill={stripeP}/>
      <rect x="0" y="46" width="28" height="18" rx="2.5" fill={stripeC}/>

      {/* Divider */}
      <line x1="38" y1="1" x2="38" y2="76" stroke={divider} strokeWidth="1.5"/>

      {/* VEN LA — baseline y=60 */}
      <text x="48"  y="60" fontFamily="Outfit,sans-serif" fontSize="54" fontWeight="900"
            fontStyle="italic" fill={venFill} letterSpacing="-2">VEN</text>
      <text x="162" y="60" fontFamily="Outfit,sans-serif" fontSize="54" fontWeight="900"
            fontStyle="italic" fill={laFill} letterSpacing="-2">LA</text>

      {/* X — elevated: larger + raised baseline creates an apex mark */}
      <text x="233" y="50" fontFamily="Outfit,sans-serif" fontSize="66" fontWeight="900"
            fontStyle="italic" fill={xFill} letterSpacing="-2">X</text>

      {/* SPORTS — fontSize 16 = ~11px at lg, legible */}
      <text x="50" y="74" fontFamily="Outfit,sans-serif" fontSize="16" fontWeight="700"
            fill={sportsClr} letterSpacing="5">SPORTS</text>
    </svg>
  );
}
