// Shared options and labels for community ladders. Keep these in step with backend/challenge_config.py.
import { pendingChallengeInvitePath } from "./challengeUi";
import { pendingOpenChallengePath } from "./openChallengeUi";

export const SIZES = [4, 8, 16, 32];
export const DURATIONS = [30, 60, 90];
export const DIVISIONS = ["Beginner", "Intermediate", "Advanced", "Competitive"];

export const METHODS = [
  { value: "leapfrog", label: "Leapfrog", help: "Beat someone ranked above you and you take their place. Everyone in between moves down one." },
  { value: "points", label: "Points", help: "3 points for a win, 1 for playing. Most points ranks first." },
  { value: "elo", label: "ELO", help: "A rating that moves with every result. Beating a stronger player is worth more." },
];

export const methodLabel = (m) => METHODS.find((x) => x.value === m)?.label || m;

export const LADDER_STATUS = {
  draft: { label: "Draft", bg: "#F1F1F1", fg: "#4C4C4C" },
  active: { label: "Live", bg: "#E6F4F0", fg: "#00765C" },
  paused: { label: "Paused", bg: "#FFF6E0", fg: "#8A5A00" },
  completed: { label: "Finished", bg: "#F1F1F1", fg: "#4C4C4C" },
  closed: { label: "Closed", bg: "#F1F1F1", fg: "#4C4C4C" },
  expired: { label: "Expired", bg: "#F1F1F1", fg: "#4C4C4C" },
};

export const entrantWord = (format, n = 2) => (format === "doubles" ? (n === 1 ? "team" : "teams") : (n === 1 ? "player" : "players"));

export const INVITE_STATUS = { invited: "Invited", accepted: "Joined", declined: "Declined", expired: "Expired", revoked: "Withdrawn", requested: "Asked to join" };

/** Where to send a person once they sign in or sign up: a ladder invitation they arrived with, or an open challenge they were looking at. */
export const pendingLadderPath = () => {
  try {
    const t = localStorage.getItem("ladder_invite_token");
    if (t) return `/community-ladders/join?token=${encodeURIComponent(t)}`;
  } catch { /* storage blocked */ }
  return pendingChallengeInvitePath() || pendingOpenChallengePath();
};

export const clearPendingLadder = () => {
  try { localStorage.removeItem("ladder_invite_token"); } catch { /* storage unavailable: nothing to clear */ }
};
