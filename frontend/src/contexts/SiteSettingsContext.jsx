import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { defaultOpenCities } from "../config/platformConfig";
import { configureAnalytics } from "../utils/googleAnalytics";

/**
 * Runtime site settings an admin can change without a deploy (Admin > Feature Flags):
 *   openCities        cities whose leagues can be joined, or null when every city is open
 *   google tracking   whether Google Tag Manager may load (visitor consent is still required)
 * Until the answer arrives we use the cities.json default, so the first paint is never blank.
 */
const SiteSettingsContext = createContext(null);

const sameCity = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const makeIsCityOpen = (openCities) => (city) => openCities === null || openCities.some((c) => sameCity(c, city));

const FALLBACK = {
  openCities: defaultOpenCities,
  isCityOpen: makeIsCityOpen(defaultOpenCities),
  loaded: false,
};

export function SiteSettingsProvider({ children }) {
  const [openCities, setOpenCities] = useState(defaultOpenCities);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/api/site-status`, { timeout: 4000 })
      .then((r) => {
        if (cancelled) return;
        if (r.data.open_cities !== undefined) setOpenCities(r.data.open_cities);
        configureAnalytics({ enabled: r.data.google_analytics !== false });
      })
      .catch(() => {
        // Can't reach the API: keep the default city list and fail closed on Google tracking.
        configureAnalytics({ enabled: false });
      })
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ openCities, isCityOpen: makeIsCityOpen(openCities), loaded }), [openCities, loaded]);
  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export const useSiteSettings = () => useContext(SiteSettingsContext) || FALLBACK;
