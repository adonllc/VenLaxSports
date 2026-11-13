// Shared labels and helpers for the Open Challenge Board. Keep in step with backend/challenge_config.py.
export const LEVELS = Array.from({ length: 13 }, (_, i) => 1 + i * 0.5);   // 1.0 .. 7.0
export const WINDOWS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "any", label: "Any time" },
];
export const COURTS = [
  { value: "any", label: "No preference" },
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
];
export const VISIBILITY = [
  { value: "public", label: "Public: on the board and shareable" },
  { value: "link_only", label: "Link only: not on the board" },
];

export const OPEN_STATUS = {
  draft: { label: "Draft", bg: "#F1F1F1", fg: "#4C4C4C" },
  open: { label: "Open", bg: "#E6F4F0", fg: "#00765C" },
  paused: { label: "Paused", bg: "#FFF6E0", fg: "#8A5A00" },
  scheduling: { label: "Agree a time", bg: "#E6F4F0", fg: "#00765C" },
  scheduled: { label: "Scheduled", bg: "#E6F4F0", fg: "#00765C" },
  in_progress: { label: "In progress", bg: "#F2A922", fg: "#1D1D1D" },
  completed: { label: "Completed", bg: "#E6F4F0", fg: "#00765C" },
  disputed: { label: "Disputed", bg: "#FDECEC", fg: "#B42318" },
  cancelled: { label: "Cancelled", bg: "#F1F1F1", fg: "#4C4C4C" },
  closed: { label: "Closed", bg: "#F1F1F1", fg: "#4C4C4C" },
  expired: { label: "Expired", bg: "#F1F1F1", fg: "#4C4C4C" },
  removed: { label: "Removed", bg: "#FDECEC", fg: "#B42318" },
};

export const PROXIMITY = { same_zip: "Same ZIP code", same_city: "Same city", other: "" };

export const windowLabel = (v) => WINDOWS.find((w) => w.value === v)?.label || v;
export const courtLabel = (v) => COURTS.find((w) => w.value === v)?.label || v;
export const levelRange = (c) => (c.min_level === c.max_level ? `${c.min_level}` : `${c.min_level} to ${c.max_level}`);
export const sportName = (c) => `${c.sport[0].toUpperCase()}${c.sport.slice(1)} ${c.format}`;

export const fmtDay = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

export const whenText = (c) => `${fmtDay(c.date)} · ${c.start_time ? `${c.start_time}` : windowLabel(c.time_window).toLowerCase()}`;

export const shareUrl = (id) => `${window.location.origin}/find-opponent/${id}`;

export const shareText = (c) =>
  `I'm looking for a ${c.sport} ${c.format} opponent around ${fmtDay(c.date)}${c.city ? ` in ${c.city}` : ""}. Accept my challenge on VENLAX Sports:`;

// A visitor who is not signed in comes back to the challenge after signing up or in.
const KEY = "pending_open_challenge";
export const rememberOpenChallenge = (id) => { try { localStorage.setItem(KEY, id); } catch { /* storage blocked: they land on the dashboard */ } };
export const pendingOpenChallengePath = () => {
  try {
    const id = localStorage.getItem(KEY);
    return id ? `/find-opponent/${id}` : null;
  } catch {
    return null;
  }
};
export const clearPendingOpenChallenge = () => { try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ } };
