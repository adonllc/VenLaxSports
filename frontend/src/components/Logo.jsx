// Nexus mark: three interlocking sport rings (Tennis/Pickleball/Cricket)
function NexusIcon({ size }) {
  const h = Math.round(size * 48 / 52);
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 52 48"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle cx="26" cy="13" r="12" fill="none" stroke="#10B981" strokeWidth="2.5" />
      <circle cx="14" cy="34" r="12" fill="none" stroke="#F97316" strokeWidth="2.5" />
      <circle cx="38" cy="34" r="12" fill="none" stroke="#2563EB" strokeWidth="2.5" />
    </svg>
  );
}

// Wordmark: VEN (emerald) + LAX (orange) in Archivo expanded black, SPORTS wide-spaced beneath
function VenlaxWordmark({ size = "md", variant = "default" }) {
  const sizeMap = {
    sm: { fontSize: 26, letterSpacing: -0.5, subtitleFz: 10, subtitleLs: 5 },
    md: { fontSize: 34, letterSpacing: -1, subtitleFz: 12, subtitleLs: 7 },
    lg: { fontSize: 50, letterSpacing: -1.5, subtitleFz: 17, subtitleLs: 10 },
    xl: { fontSize: 70, letterSpacing: -2, subtitleFz: 24, subtitleLs: 14 },
    hero: { fontSize: 104, letterSpacing: -3, subtitleFz: 36, subtitleLs: 22 },
  };

  const { fontSize, letterSpacing, subtitleFz, subtitleLs } = sizeMap[size] || sizeMap.md;

  // "light"/"hero" = single white mark; "onDark" keeps emerald/orange with a white subtitle.
  const isWhite = variant === "light" || variant === "hero";
  const venColor = isWhite ? "#FFFFFF" : "#047857";
  const laxColor = isWhite ? "#FFFFFF" : "#EA580C";
  const subColor = isWhite || variant === "onDark" ? "#FFFFFF" : "#111827";

  const wordStyle = {
    fontSize: `${fontSize}px`,
    fontWeight: 900,
    fontStretch: "112%",
    fontFamily: "'Archivo', 'Cabinet Grotesk', sans-serif",
    letterSpacing: `${letterSpacing}px`,
    textTransform: "uppercase",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: "8px", alignItems: "center" }}>
      <div style={{ display: "flex", lineHeight: 0.85 }}>
        <span style={{ ...wordStyle, color: venColor }}>VEN</span>
        <span style={{ ...wordStyle, color: laxColor }}>LAX</span>
      </div>
      <span
        style={{
          fontSize: `${subtitleFz}px`,
          fontWeight: 800,
          fontFamily: "'Montserrat', sans-serif",
          color: subColor,
          letterSpacing: `${subtitleLs}px`,
          paddingLeft: `${subtitleLs}px`,
        }}
      >
        SPORTS
      </span>
    </div>
  );
}

const ICON_SIZES = {
  sm:   36,
  md:   52,
  lg:   64,
  xl:   80,
  hero: 110,
};

export default function Logo({
  size = "md",
  variant = "default",
  className = "",
  testId = "brand-logo",
  withIcon = true,
}) {
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md;

  return (
    <div
      className={`flex items-center gap-2.5 ${className}`}
      data-testid={testId}
      style={{ flexShrink: 0, alignItems: "center" }}
    >
      {withIcon && <NexusIcon size={iconSize} />}
      <VenlaxWordmark size={size} variant={variant} />
    </div>
  );
}
