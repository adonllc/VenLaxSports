// Option lists for the play profile. Values must match backend/models.py (PlayProfile).

export const COURT_SIDE_LABELS = {
  tennis: { right: "Deuce side", left: "Ad side", either: "Either side" },
  pickleball: { right: "Right side", left: "Left side", either: "Either side" },
};

// Read-only views (public profile, search) are not tied to one sport, so keep labels neutral.
export const COURT_SIDE_NEUTRAL = { right: "Right side", left: "Left side", either: "Either side" };

export const HANDS = [
  { value: "right", label: "Right-handed" },
  { value: "left", label: "Left-handed" },
];

export const BACKHANDS = [
  { value: "one_hand", label: "One-handed backhand" },
  { value: "two_hand", label: "Two-handed backhand" },
];

export const STYLE_OPTIONS = {
  tennis: [
    { value: "baseline", label: "Baseliner" },
    { value: "serve_volley", label: "Serve & volley" },
    { value: "all_court", label: "All-court" },
    { value: "aggressive", label: "Aggressive" },
    { value: "counterpuncher", label: "Counterpuncher" },
  ],
  pickleball: [
    { value: "banger", label: "Banger" },
    { value: "dinker", label: "Dinker" },
    { value: "all_court", label: "All-court" },
  ],
};

export const AVAILABILITY = [
  { value: "weekday_morning", label: "Weekday mornings" },
  { value: "weekday_evening", label: "Weekday evenings" },
  { value: "weekend_morning", label: "Weekend mornings" },
  { value: "weekend_afternoon", label: "Weekend afternoons" },
  { value: "weekend_evening", label: "Weekend evenings" },
  { value: "flexible", label: "Flexible schedule" },
];

// Grid layout for the editor: row label + the slot values it contains.
export const AVAILABILITY_ROWS = [
  { label: "Weekdays", slots: [
    { value: "weekday_morning", label: "Morning" },
    { value: "weekday_evening", label: "Evening" },
  ] },
  { label: "Weekends", slots: [
    { value: "weekend_morning", label: "Morning" },
    { value: "weekend_afternoon", label: "Afternoon" },
    { value: "weekend_evening", label: "Evening" },
  ] },
];

const labelOf = (list, value) => list.find((o) => o.value === value)?.label;

export function courtSideOptions(sports) {
  const sport = !sports.length || sports.includes("tennis") ? "tennis" : "pickleball";
  const labels = COURT_SIDE_LABELS[sport];
  return [
    { value: "right", label: labels.right },
    { value: "left", label: labels.left },
    { value: "either", label: labels.either },
  ];
}

/** Flat list of display strings for the read-only chips. */
export function profileChips(pp) {
  if (!pp) return [];
  const chips = [];
  if (pp.looking_for_partner) chips.push("Looking for a partner");
  if (pp.court_side) chips.push(COURT_SIDE_NEUTRAL[pp.court_side]);
  if (pp.dominant_hand) chips.push(labelOf(HANDS, pp.dominant_hand));
  if (pp.backhand) chips.push(labelOf(BACKHANDS, pp.backhand));
  if (pp.play_style?.tennis) chips.push(`Tennis: ${labelOf(STYLE_OPTIONS.tennis, pp.play_style.tennis)}`);
  if (pp.play_style?.pickleball) chips.push(`Pickleball: ${labelOf(STYLE_OPTIONS.pickleball, pp.play_style.pickleball)}`);
  if (pp.years_playing != null) chips.push(`${pp.years_playing} yr${pp.years_playing === 1 ? "" : "s"} playing`);
  (pp.availability || []).forEach((a) => chips.push(labelOf(AVAILABILITY, a)));
  return chips.filter(Boolean);
}

const hasStyle = (pp) => !!(pp?.play_style?.tennis || pp?.play_style?.pickleball);

/** Core fields that make a profile "complete". Backhand and partner flag are optional extras. */
const CORE_CHECKS = [
  (pp) => !!pp.court_side,
  (pp) => !!pp.dominant_hand,
  hasStyle,
  (pp) => pp.years_playing != null,
  (pp) => !!pp.availability?.length,
];

export function profileCompletion(pp) {
  const p = pp || {};
  const done = CORE_CHECKS.filter((check) => check(p)).length;
  return { done, total: CORE_CHECKS.length, pct: Math.round((done / CORE_CHECKS.length) * 100) };
}

/** Labeled rows for the dashboard summary. `value` is null when unset. */
export function profileRows(pp) {
  const p = pp || {};
  const styles = [
    p.play_style?.tennis && `Tennis: ${labelOf(STYLE_OPTIONS.tennis, p.play_style.tennis)}`,
    p.play_style?.pickleball && `Pickleball: ${labelOf(STYLE_OPTIONS.pickleball, p.play_style.pickleball)}`,
  ].filter(Boolean);
  const rows = [
    { key: "court_side", label: "Court side", value: p.court_side ? COURT_SIDE_NEUTRAL[p.court_side] : null },
    { key: "dominant_hand", label: "Hand", value: labelOf(HANDS, p.dominant_hand) || null },
  ];
  if (p.backhand) rows.push({ key: "backhand", label: "Backhand", value: labelOf(BACKHANDS, p.backhand) });
  rows.push(
    { key: "play_style", label: "Play style", value: styles.length ? styles.join(" · ") : null },
    { key: "years_playing", label: "Experience", value: p.years_playing != null ? `${p.years_playing} year${p.years_playing === 1 ? "" : "s"}` : null },
    {
      key: "availability",
      label: "Availability",
      value: p.availability?.length ? p.availability.map((a) => labelOf(AVAILABILITY, a)).join(", ") : null,
    },
  );
  return rows;
}
