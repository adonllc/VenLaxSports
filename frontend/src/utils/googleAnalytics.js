/**
 * Google Tag Manager (which carries Google Analytics), loaded only after the visitor accepts analytics
 * in the consent banner. Decline, or no answer yet: Google's script is never requested.
 *
 *   Container: GTM-W3PK96GG   (public id, not a secret; override with VITE_GTM_ID at build time)
 *
 * The app is a single-page app, so the browser never reloads between pages. We push our own events to
 * the dataLayer and GTM tags fire from them:
 *   virtual_page_view   { page_path, page_location, page_title }   one per route change
 *   exception           { description }                            unhandled JavaScript errors (message only)
 */
const GTM_ID = import.meta.env.VITE_GTM_ID || "GTM-W3PK96GG";
const CONSENT_KEY = "venlax_analytics_consent";

let started = false;
// Admin switch (Admin > Feature Flags). Unknown until /site-status answers; until then nothing starts.
let settings = { loaded: false, enabled: false };

/** Called once by SiteSettingsProvider with the admin's choice. */
export function configureAnalytics({ enabled }) {
  settings = { loaded: true, enabled: Boolean(enabled) };
}

const hasConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false; // storage blocked: treat as no consent
  }
};

const push = (event) => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
};

/** Load GTM once, if the visitor has accepted. Safe to call many times. Returns true the first time it starts. */
export function initGoogleAnalytics() {
  if (started || !GTM_ID || !settings.loaded || !settings.enabled || !hasConsent()) return false;
  started = true;

  push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
  document.head.appendChild(script);

  window.addEventListener("error", (e) => trackException(e.message));
  window.addEventListener("unhandledrejection", (e) => trackException(e.reason?.message || "unhandled rejection"));
  return true;
}

/** One event per route change. Events pushed before GTM finishes loading are replayed by GTM. */
export function trackPageView(path) {
  if (!started) return;
  push({ event: "virtual_page_view", page_path: path, page_location: window.location.href, page_title: document.title });
}

/**
 * Conversion events for Tag Manager (sign_up, begin_checkout, join_league, purchase).
 * Pass only non-personal values: sport, city, league id, price. Never names, emails or ids of people.
 */
export function trackEvent(name, params = {}) {
  if (!started) return;
  push({ event: name, ...params });
}

/** Message only, truncated, no user data. */
export function trackException(description) {
  if (!started) return;
  push({ event: "exception", description: String(description || "unknown").slice(0, 150) });
}
