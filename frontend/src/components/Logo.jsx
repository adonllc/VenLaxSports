import BRAND from "../config/brandConfig";
import logoImg from "../assets/logo.png";

const HEIGHTS = { sm: 28, md: 36, lg: 44, xl: 52, hero: 64 };

export default function Logo({ variant = "default", size = "md", className = "", testId = "brand-logo" }) {
  const h = HEIGHTS[size] || HEIGHTS.md;
  const isDark = variant === "light" || variant === "hero";

  return (
    <span
      className={`inline-flex items-center ${isDark ? "bg-white rounded-lg px-2 py-0.5" : ""} ${className}`}
      data-testid={testId}
      aria-label={BRAND.full_name}
    >
      <img
        src={logoImg}
        height={h}
        alt={BRAND.full_name}
        style={{ height: h, width: "auto", display: "block" }}
      />
    </span>
  );
}
