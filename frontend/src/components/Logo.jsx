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

// UFC-Style wordmark: VEN (green) + LAX (orange, bold) with SPORTS subtitle
function VenlaxWordmark({ size = "md", variant = "default" }) {
  // Subtitle tracking is positive and wide (classic small-caps luxury tagline
  // treatment) even though the primary VEN/LAX mark stays tight and bold —
  // that contrast between a dense wordmark and an airy tagline is what reads
  // as considered rather than default.
  const sizeMap = {
    sm: { fontSize: 28, letterSpacing: -0.5, subtitleFz: 10, subtitleLs: 3 },
    md: { fontSize: 36, letterSpacing: -1.5, subtitleFz: 12, subtitleLs: 3.5 },
    lg: { fontSize: 52, letterSpacing: -2, subtitleFz: 16, subtitleLs: 4.5 },
    xl: { fontSize: 72, letterSpacing: -2.5, subtitleFz: 22, subtitleLs: 6 },
    hero: { fontSize: 104, letterSpacing: -3.5, subtitleFz: 32, subtitleLs: 8 },
  };

  const GOLD = "#D4A017";

  const { fontSize, letterSpacing, subtitleFz, subtitleLs } = sizeMap[size] || sizeMap.md;

  // Motion-tick scale: angled speed-line ticks flanking SPORTS, sized off
  // the subtitle font so they stay proportional across all logo sizes.
  const tickScale = subtitleFz / 12;
  const tickH = Math.round(9 * tickScale);
  const tickW = Math.max(2, Math.round(4 * tickScale));
  const tickGap = Math.max(1, Math.round(2 * tickScale));
  const tick = <div style={{ width: `${tickW}px`, height: `${tickH}px`, background: GOLD, transform: "skewX(-18deg)" }} />;

  const isLight = variant === "light" || variant === "hero";
  const venColor = isLight ? "#FFFFFF" : "#10B981";
  const laxColor = isLight ? "#FFFFFF" : "#F97316";

  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: "10px", alignItems: "center" }}>
      <div style={{ display: "flex", lineHeight: 0.8 }}>
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
            textTransform: "uppercase",
          }}
        >
          LAX
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
        <div style={{ display: "flex", gap: `${tickGap}px` }}>{tick}{tick}{tick}</div>
        <span
          style={{
            fontSize: `${subtitleFz}px`,
            fontWeight: 900,
            fontFamily: "'Outfit', sans-serif",
            color: GOLD,
            letterSpacing: `${subtitleLs}px`,
          }}
        >
          SPORTS
        </span>
        <div style={{ display: "flex", gap: `${tickGap}px` }}>{tick}{tick}{tick}</div>
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
