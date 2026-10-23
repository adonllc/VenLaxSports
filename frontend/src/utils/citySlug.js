import { platformConfig } from "../config/platformConfig";

/** "New York" -> "new-york": lowercase, hyphenated, no spaces or %20 in city URLs. */
export const citySlug = (name) => String(name).toLowerCase().trim().replace(/\s+/g, "-");

/** Resolve a URL segment ("new-york", or an old "New York") back to the real city name. */
export function cityFromSlug(param) {
  const wanted = citySlug(decodeURIComponent(param));
  const hit = platformConfig.featuredCities.find((c) => citySlug(c.name) === wanted);
  if (hit) return hit.name;
  return wanted.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export const cityPath = (name, sport) => `/city/${citySlug(name)}/sport/${sport}`;
