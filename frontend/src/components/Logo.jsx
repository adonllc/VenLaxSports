import BRAND from "../config/brandConfig";

// viewBox 0 0 400 200 — aspect ratio 2:1
const ASPECT = 400 / 200;

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

  const textFill    = onDark ? "#ffffff"  : "#064E3B";
  const dotFill     = onDark ? "#34D399"  : "#10B981";
  const sportsFill  = onDark ? "#6EECBB"  : "#6B7C76";

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={BRAND.full_name}
      role="img"
      data-testid={testId}
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Emerald dot accent — positioned top-right of text */}
      <circle cx="320" cy="55" r="12" fill={dotFill} />

      {/* VENLAX wordmark */}
      <text
        x="50%"
        y="130"
        textAnchor="middle"
        fontFamily="Barlow Condensed, sans-serif"
        fontSize="80"
        fontWeight="900"
        letterSpacing="-0.02em"
        fill={textFill}
        style={{ textTransform: "uppercase" }}
      >
        VENLAX
      </text>

      {/* SPORTS subtitle */}
      <text
        x="50%"
        y="168"
        textAnchor="middle"
        fontFamily="Barlow, sans-serif"
        fontSize="14"
        fontWeight="600"
        letterSpacing="0.8em"
        fill={sportsFill}
        style={{ textTransform: "uppercase" }}
      >
        SPORTS
      </text>
    </svg>
  );
}
