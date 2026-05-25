import BRAND from "../config/brandConfig";

const SIZES = {
  sm:   { fontSize: 18, sportsSize: 6.5, sportsGap: 2 },
  md:   { fontSize: 24, sportsSize: 8.5, sportsGap: 3 },
  lg:   { fontSize: 30, sportsSize: 10,  sportsGap: 3 },
  xl:   { fontSize: 38, sportsSize: 13,  sportsGap: 4 },
  hero: { fontSize: 48, sportsSize: 16,  sportsGap: 5 },
};

function SplitX() {
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {/* Spacer — reserves glyph width without painting */}
      <span style={{ visibility: "hidden" }}>X</span>
      {/* Teal — top-left triangle */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          color: "#10B981",
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
        }}
      >
        X
      </span>
      {/* Orange — bottom-right triangle */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          color: "#F97316",
          clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
        }}
      >
        X
      </span>
    </span>
  );
}

export default function Logo({
  size = "md",
  variant = "default",
  className = "",
  testId = "brand-logo",
}) {
  const { fontSize, sportsSize, sportsGap } = SIZES[size] || SIZES.md;
  const isLight = variant === "light" || variant === "hero";

  const baseColor = isLight
    ? "oklch(96% 0.005 220)"
    : "oklch(14% 0.012 265)";
  const sportsColor = isLight
    ? "oklch(72% 0.01 220)"
    : "oklch(50% 0.015 265)";

  return (
    <span
      role="img"
      aria-label={BRAND.full_name}
      data-testid={testId}
      className={`inline-flex flex-col items-center select-none group ${className}`}
      style={{ fontFamily: "'Outfit', system-ui, sans-serif", lineHeight: 1 }}
    >
      {/* Wordmark */}
      <span
        aria-hidden="true"
        className="flex items-baseline motion-safe:transition-[letter-spacing] motion-safe:duration-150 motion-safe:ease-out group-hover:[letter-spacing:0.05em]"
        style={{
          fontSize,
          fontWeight: 900,
          letterSpacing: "0.02em",
          color: baseColor,
        }}
      >
        <span>VEN</span>
        <span style={{ color: "#10B981" }}>LA</span>
        <SplitX />
      </span>

      {/* SPORTS tagline */}
      <span
        aria-hidden="true"
        style={{
          fontSize: sportsSize,
          fontWeight: 700,
          letterSpacing: "0.22em",
          color: sportsColor,
          marginTop: sportsGap,
        }}
      >
        SPORTS
      </span>
    </span>
  );
}
