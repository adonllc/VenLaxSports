import { isLaunchCity } from "../config/platformConfig";

/**
 * Open / coming-soon marker next to a city name. Always text, never color alone.
 * Open: amber square tag. Not open yet: plain muted text.
 */
export default function CityStatusTag({ city, className = "" }) {
  if (isLaunchCity(city)) {
    return (
      <span
        className={`inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider align-middle ${className}`}
        style={{ background: "#F2A922", color: "#3D3D3D" }}
        data-testid="city-tag-open"
      >
        Now open
      </span>
    );
  }
  return (
    <span className={`text-[11px] ${className}`} style={{ color: "#5C5C5C" }} data-testid="city-tag-soon">
      Coming soon
    </span>
  );
}
