import BRAND from "../config/brandConfig";

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
  const iconWidth = ICON_SIZES[size] || ICON_SIZES.md;
  const textSize = TEXT_SIZES[size] || TEXT_SIZES.md;
  const textColor = variant === "light" ? "text-white" : "text-gray-900";

  return (
    <div
      className={`flex items-center gap-2.5 ${className}`}
      data-testid={testId}
      style={{ flexShrink: 0 }}
    >
      <img
        src="/venlaxlogotr.png"
        alt=""
        width={iconWidth}
        height="auto"
        style={{ display: "block", width: iconWidth, height: "auto" }}
      />
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
