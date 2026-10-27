import axios from "axios";

/**
 * Reports one funnel stage to the server (registration_started, league_viewed, league_registration_started).
 * The server stores the event name, time, sport and league, plus the user id when signed in. No cookie, no visitor id.
 * Sent at most once per browser session for the same event, sport and league. Never throws and never blocks the page.
 */
export function reportFunnelEvent(event, { sport = "", leagueId = "" } = {}) {
  try {
    const key = `venlax_evt:${event}:${sport}:${leagueId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* storage blocked: still send */
  }
  axios
    .post(`${import.meta.env.VITE_BACKEND_URL}/api/events`, { event, sport, league_id: leagueId }, { withCredentials: true, timeout: 4000 })
    .catch(() => {});
}
