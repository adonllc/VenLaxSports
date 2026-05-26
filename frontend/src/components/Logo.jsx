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

  const textFill   = onDark ? "#ffffff" : "#064E3B";
  const dotFill    = onDark ? "#34D399" : "#10B981";
  const sportsFill = onDark ? "#6EECBB" : "#6B7C76";

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
      {/* Emerald dot — top-right of wordmark */}
      <circle cx="308" cy="14" r="9" fill={dotFill} />

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

      {/* SPORTS subtitle */}
      <text
        x="190"
        y="87"
        textAnchor="middle"
        fontFamily="Barlow, sans-serif"
        fontSize="11"
        fontWeight="600"
        letterSpacing="5"
        fill={sportsFill}
      >SPORTS</text>
    </svg>
  );
}
