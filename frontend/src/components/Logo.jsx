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
      <circle cx="26" cy="13" r="12" fill="none" stroke="#10B981" strokeWidth="4" />
      <circle cx="14" cy="34" r="12" fill="none" stroke="#F97316" strokeWidth="4" />
      <circle cx="38" cy="34" r="12" fill="none" stroke="#2563EB" strokeWidth="4" />
    </svg>
  );
}

// Premium wordmark: VEN (dark) + LAX (teal) with SPORTS subtitle + dashes
function VenlaxWordmark({ size = "md", variant = "default" }) {
  const sizeMap = {
    sm: { fontSize: 20, letterSpacing: -0.5, subtitleFz: 10, subtitleLs: -0.25, dashLen: "24px" },
    md: { fontSize: 36, letterSpacing: -1, subtitleFz: 14, subtitleLs: -0.4, dashLen: "32px" },
    lg: { fontSize: 52, letterSpacing: -1.5, subtitleFz: 18, subtitleLs: -0.5, dashLen: "40px" },
    xl: { fontSize: 72, letterSpacing: -2, subtitleFz: 24, subtitleLs: -0.6, dashLen: "48px" },
    hero: { fontSize: 104, letterSpacing: -3, subtitleFz: 32, subtitleLs: -0.8, dashLen: "56px" },
  };

  const { fontSize, letterSpacing, subtitleFz, subtitleLs, dashLen } = sizeMap[size] || sizeMap.md;

  const isLight = variant === "light" || variant === "hero";
  const venColor = isLight ? "#FFFFFF" : "#004D40";
  const laxColor = "#10B981";

  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: "4px", alignItems: "center" }}>
      <div style={{ display: "flex", lineHeight: 1 }}>
        <span
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: 900,
            fontFamily: "'Outfit', sans-serif",
            color: venColor,
            letterSpacing: `${letterSpacing}px`,
          }}
        >
          VEN
        </span>
        <span
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: 900,
            fontFamily: "'Outfit', sans-serif",
            color: laxColor,
            letterSpacing: `${letterSpacing}px`,
          }}
        >
          LAX
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
        <div style={{ width: dashLen, height: "2px", background: "#F97316" }} />
        <span
          style={{
            fontSize: `${subtitleFz}px`,
            fontWeight: 600,
            fontFamily: "'Outfit', sans-serif",
            color: "#F97316",
            letterSpacing: `${subtitleLs}px`,
            fontStyle: "italic",
          }}
        >
          SPORTS
        </span>
        <div style={{ width: dashLen, height: "2px", background: "#F97316" }} />
      </div>
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
