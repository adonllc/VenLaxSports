import logoImg from "../assets/logo.png";
import BRAND from "../config/brandConfig";

const SIZES = {
  sm:   { height: 44 },
  md:   { height: 56 },
  lg:   { height: 72 },
  xl:   { height: 96 },
  hero: { height: 128 },
};

export default function Logo({
  size = "md",
  variant = "default",
  className = "",
  testId = "brand-logo",
}) {
  const { height } = SIZES[size] || SIZES.md;
  const isDark = variant === "light" || variant === "hero";

  const img = (
    <img
      src={logoImg}
      alt={BRAND.full_name}
      data-testid={testId}
      style={{ height, width: "auto", display: "block" }}
      className={isDark ? "" : className}
    />
  );

  if (isDark) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-lg ${className}`}
        style={{ background: "rgba(255,255,255,0.92)", padding: "6px 10px" }}
      >
        {img}
      </span>
    );
  }

  return img;
}
