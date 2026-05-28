import BRAND from "../config/brandConfig";

// viewBox 0 0 380 90 — tight crop, aspect ~4.2:1
const ASPECT = 380 / 90;

const SIZES = {
  sm:   40,
  md:   56,
  lg:   68,
  xl:   80,
  hero: 96,
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

  const textFill   = onDark ? "#ffffff" : "#111827";
  const sportsFill = onDark ? "#C9572A" : "#6B7280";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 380 90"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={BRAND.full_name}
      role="img"
      data-testid={testId}
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* ── Tennis ball ── cx=316 cy=13 r=9 */}
      <circle cx="316" cy="13" r="9" fill="#C8E600" />
      {/* Seam: two mirrored curves */}
      <path d="M309 9 Q312 4 316 13 Q320 22 323 17" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M309 17 Q312 22 316 13 Q320 4 323 9" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"/>

      {/* ── Pickleball ── cx=338 cy=13 r=9  (bright orange, drilled holes) */}
      <circle cx="338" cy="13" r="9" fill="#F97316" />
      <circle cx="338" cy="7.5" r="2" fill="rgba(0,0,0,0.30)" />
      <circle cx="333" cy="15" r="2" fill="rgba(0,0,0,0.30)" />
      <circle cx="343" cy="15" r="2" fill="rgba(0,0,0,0.30)" />

      {/* ── Cricket ball ── cx=360 cy=13 r=9  (crimson, white seam) */}
      <circle cx="360" cy="13" r="9" fill="#CC1100" />
      {/* Main seam arc */}
      <path d="M352 13 Q356 8 360 13 Q364 18 368 13" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Stitch marks */}
      <line x1="355" y1="10.5" x2="355" y2="12.5" stroke="white" strokeWidth="1"/>
      <line x1="358" y1="9.2"  x2="358" y2="11.2" stroke="white" strokeWidth="1"/>
      <line x1="362" y1="14.8" x2="362" y2="16.8" stroke="white" strokeWidth="1"/>
      <line x1="365" y1="13.5" x2="365" y2="15.5" stroke="white" strokeWidth="1"/>

      {/* VENLAX wordmark */}
      <text
        x="190"
        y="72"
        textAnchor="middle"
        fontFamily="Barlow Condensed, sans-serif"
        fontSize="72"
        fontWeight="900"
        letterSpacing="-1"
        fill={textFill}
      >VENLAX</text>

      {/* Brand accent line */}
      <rect x="40" y="75" width="300" height="2.5" fill="#C9572A" rx="1" />

      {/* SPORTS subtitle */}
      <text
        x="190"
        y="88"
        textAnchor="middle"
        fontFamily="Barlow, sans-serif"
        fontSize="11"
        fontWeight="700"
        letterSpacing="5"
        fill={sportsFill}
      >SPORTS</text>
    </svg>
  );
}
