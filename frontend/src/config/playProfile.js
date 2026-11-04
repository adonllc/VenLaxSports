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
