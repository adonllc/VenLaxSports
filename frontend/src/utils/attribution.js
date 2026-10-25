/**
 * Remembers where a visitor came from so the account they create can be credited to a channel.
 *
 * Only marketing touches are kept: UTM tags on the link, a friend's referral code (?ref=), or an outside website
 * that sent them here. A touch records the site name only (never the full referring URL or any page history).
 * "first" is the first such touch, "last" the most recent; both go to the server with the registration.
 * Kept for 30 days in this browser, then forgotten. A visitor who just types the address has no attribution.
 */
const KEY = "venlax_attribution";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && Date.now() - v.at < MAX_AGE_MS ? v : null;
  } catch {
    return null;
  }
};

const write = (v) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage blocked: attribution is simply skipped */
  }
};

function externalReferrerHost() {
  try {
    if (!document.referrer) return "";
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    return host === window.location.hostname.replace(/^www\./, "") ? "" : host;
  } catch {
    return "";
  }
}

/** Call on every route change. Stores a touch only when the URL or the referrer carries a marketing signal. */
export function captureAttribution(search, pathname) {
  const p = new URLSearchParams(search);
  const touch = {
    source: p.get("utm_source") || "",
    medium: p.get("utm_medium") || "",
    campaign: p.get("utm_campaign") || "",
    content: p.get("utm_content") || "",
    term: p.get("utm_term") || "",
    ref: p.get("ref") || "",
    referrer: externalReferrerHost(),
    landing: pathname,
  };
  if (!(touch.source || touch.medium || touch.campaign || touch.ref || touch.referrer)) return;

  const stored = read();
  write({ first: stored?.first || touch, last: touch, at: stored?.at || Date.now() });
}

/** What to send with a registration: { first, last } or undefined. */
export function getAttribution() {
  const v = read();
  return v ? { first: v.first, last: v.last } : undefined;
}
