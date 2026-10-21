// Builds the "About this league" text from the league's own fields, so every
// league reads well even when the organizer wrote no description.

const SPORTS = { tennis: "Tennis", pickleball: "Pickleball", cricket: "Cricket" };

function formatName(format = "") {
  const f = String(format).toLowerCase();
  if (f === "mixed" || f === "mixed_doubles") return "mixed doubles";
  return f || "singles";
}

function niceDate(iso) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function price(league) {
  const fee = Number(league.entry_fee) || 0;
  if (fee <= 0) return "Free to join.";
  const symbol = league.currency === "INR" ? "₹" : "$";
  const amount = `${symbol}${fee.toFixed(2)}`;
  const team = ["doubles", "mixed doubles"].includes(formatName(league.format));
  return team
    ? `Entry fee: ${amount} per team of two. One partner pays and the other joins at no extra charge.`
    : `Entry fee: ${amount} per player for the season.`;
}

export function leagueDescription(league = {}) {
  const sport = SPORTS[String(league.sport).toLowerCase()] || league.sport || "Sports";
  const format = formatName(league.format);
  const start = niceDate(league.start_date);
  const end = niceDate(league.end_date);
  const type = league.league_type;

  let summary = `A ${sport} ${format} league in ${league.city || "your city"}`;
  if (league.venue) summary += ` at ${league.venue}`;
  if (start && end) summary += `, running ${start} to ${end}`;
  if (league.season) summary += ` (${league.season})`;
  summary += ".";

  const label = league.division_label ? String(league.division_label).toLowerCase() : null;
  const range = league.division_ntrp_min != null && league.division_ntrp_max != null
    ? ` rated ${league.division_ntrp_min} to ${league.division_ntrp_max}` : "";
  summary += label
    ? ` Open to ${label} players${range}. You are matched against players near your rating.`
    : " Players of all levels are welcome, and you are matched against players near your rating.";

  const points = [];
  if (type === "round_robin") {
    points.push("Round Robin: everyone plays everyone once on a fixed schedule set upfront. The organizer books the courts.");
  } else if (type === "box") {
    const size = league.box_group_size || 6;
    points.push(`Box League: you play in a group of ${size}. The top ${league.box_promote || 2} move up each cycle and the bottom ${league.box_relegate || 2} move down.`);
  } else {
    points.push("Flex League: you arrange your own match times. Contact your opponent within 48 hours, and each match has a 7-day window.");
    points.push("A typical season is 5–7 matches over 6–8 weeks.");
  }

  const max = Number(league.max_players) || 0;
  if (max > 0) {
    const full = (Number(league.current_players) || 0) >= max;
    points.push(`Up to ${max} players${full ? ", currently full" : ""}.`);
  }
  points.push(price(league));
  points.push("Report each score after the match. Standings and your skill rating update automatically.");
  if (type !== "box") {
    points.push("The top 4 advance to the playoffs in leagues of 12 or fewer players, or the top 8 in larger leagues.");
  }
  return { summary, points };
}
