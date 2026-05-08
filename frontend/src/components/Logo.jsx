import BRAND from "../config/brandConfig";

/**
 * VENLAX Sports wordmark.
 * Renders as: VEN[LAX in emerald] [SPORTS in lighter weight]
 *
 * Variants:
 *  - "default" — gray VEN + emerald LAX + gray SPORTS (light backgrounds)
 *  - "light"   — white VEN + emerald LAX + light-gray SPORTS (dark backgrounds)
 *  - "hero"    — bigger gap, larger SPORTS suffix (Auth left panel)
 */
export default function Logo({
  variant = "default",
  size = "md",
  className = "",
  testId = "brand-logo",
}) {
  const sizeMap = {
    sm: { main: "text-base", sports: "text-[10px] ml-1" },
    md: { main: "text-xl", sports: "text-[10px] ml-1.5 tracking-widest" },
    lg: { main: "text-2xl", sports: "text-xs ml-1.5 tracking-widest" },
    xl: { main: "text-3xl", sports: "text-sm ml-2 tracking-widest" },
    hero: { main: "text-3xl", sports: "text-base ml-2 tracking-widest" },
  };
  const colorMap = {
    default: { ven: "text-gray-900", lax: "text-emerald-500", sports: "text-gray-400" },
    light: { ven: "text-white", lax: "text-emerald-400", sports: "text-gray-300" },
    hero: { ven: "text-white", lax: "text-emerald-400", sports: "text-gray-300" },
  };
  const sz = sizeMap[size] || sizeMap.md;
  const c = colorMap[variant] || colorMap.default;

  return (
    <span
      className={`font-heading font-black tracking-tight inline-flex items-baseline ${sz.main} ${className}`}
      data-testid={testId}
      aria-label={BRAND.full_name}
    >
      <span className={c.ven}>VEN</span>
      <span className={c.lax}>LAX</span>
      <span className={`font-semibold uppercase ${c.sports} ${sz.sports}`}>SPORTS</span>
    </span>
  );
}
