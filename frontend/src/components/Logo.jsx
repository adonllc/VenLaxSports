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

  const textFill   = onDark ? "#ffffff" : "#0F1D38";
  const sportsFill = onDark ? "#C5D600" : "#007B70";

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
      {/* Three sport dots — Tennis (lime) · Pickleball (teal) · Cricket (orange) */}
      <circle cx="316" cy="13" r="9" fill="#C5D600" />
      <circle cx="338" cy="13" r="9" fill="#00B4A4" />
      <circle cx="360" cy="13" r="9" fill="#E86010" />

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

      {/* Lime accent line */}
      <rect x="40" y="75" width="300" height="2.5" fill="#C5D600" rx="1" />

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
