// Shared labels and formatting for direct player challenges.
export const SPORTS = [
  { value: "tennis", label: "Tennis" },
  { value: "pickleball", label: "Pickleball" },
];

export const STATUS = {
  sent: { label: "Waiting for answer", bg: "#FFF6E0", fg: "#8A5A00" },
  scheduling: { label: "Agree a time", bg: "#E6F4F0", fg: "#00765C" },
  scheduled: { label: "Scheduled", bg: "#E6F4F0", fg: "#00765C" },
  in_progress: { label: "Play time", bg: "#F2A922", fg: "#1D1D1D" },
  result_submitted: { label: "Score to confirm", bg: "#FFF6E0", fg: "#8A5A00" },
  disputed: { label: "Disputed", bg: "#FDECEC", fg: "#B42318" },
  confirmed: { label: "Completed", bg: "#E6F4F0", fg: "#00765C" },
  declined: { label: "Declined", bg: "#F1F1F1", fg: "#4C4C4C" },
  expired: { label: "Expired", bg: "#F1F1F1", fg: "#4C4C4C" },
  cancelled: { label: "Cancelled", bg: "#F1F1F1", fg: "#4C4C4C" },
  voided: { label: "Voided", bg: "#F1F1F1", fg: "#4C4C4C" },
};

export const fmtWhen = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

export const sideNames = (side) => side.map((p) => p.name).join(" & ");

/** "Ann vs Bob" from the viewer's point of view: their side first. */
export const matchup = (c) => {
  const mine = c.my_side === 2 ? 1 : 0;
  return `${sideNames(c.sides[mine])} vs ${sideNames(c.sides[1 - mine])}`;
};

export const sportLabel = (c) => `${c.sport[0].toUpperCase()}${c.sport.slice(1)} ${c.format}`;

/** Score string from the viewer's side: "6-4, 3-6, 6-2". Sides are stored from the challenger's view. */
export const scoreText = (result, mySide) =>
  (result?.sets || []).map((s) => (mySide === 2 ? `${s.b}-${s.a}` : `${s.a}-${s.b}`)).join(", ");

export const apiError = (e, fallback = "Something went wrong. Try again.") => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join("; ");
  return fallback;
};
