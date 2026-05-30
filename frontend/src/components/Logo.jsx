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

const ICON_SIZES = {
  sm:   36,
  md:   52,
  lg:   64,
  xl:   80,
  hero: 110,
};

const TEXT_SIZES = {
  sm:   "text-xl",
  md:   "text-3xl",
  lg:   "text-4xl",
  xl:   "text-5xl",
  hero: "text-6xl",
};

export default function Logo({
  size = "md",
  variant = "default",
  className = "",
  testId = "brand-logo",
}) {
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md;
  const textSize = TEXT_SIZES[size] || TEXT_SIZES.md;
  const textColor = variant === "light" ? "text-white" : "text-gray-900";

  return (
    <div
      className={`flex items-center gap-2.5 ${className}`}
      data-testid={testId}
      style={{ flexShrink: 0 }}
    >
      <NexusIcon size={iconSize} />
      <span
        className={`font-black tracking-tight leading-none ${textSize} ${textColor}`}
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        <span>VEN</span>
        <span style={{ color: "#10B981" }}>LAX</span>
      </span>
    </div>
  );
}
