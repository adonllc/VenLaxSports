import { Check, Clock } from "lucide-react";

const fmt = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * Tells a visitor whether this league will actually run, with no registration counts.
 *   waiting   "Starts when 8 players have joined."
 *   confirmed "Season confirmed. Starts Nov 10."
 *   missed    "This season did not reach 8 players."
 * Renders nothing when the league has no minimum configured (never invent a claim).
 */
export default function SeasonStartLine({ league }) {
  const min = league?.min_players_to_start;
  if (!min) return null;

  const joined = league.current_players || 0;
  let state = null;
  if (league.status === "cancelled") state = "missed";
  else if (league.status === "registration") state = joined >= min ? "confirmed" : "waiting";
  if (!state) return null;

  const start = fmt(league.start_date);
  const text = {
    waiting: `Starts when ${min} players have joined.`,
    confirmed: `Season confirmed.${start ? ` Starts ${start}.` : ""}`,
    missed: `This season did not reach ${min} players.`,
  }[state];

  const Icon = state === "confirmed" ? Check : Clock;
  const style =
    state === "confirmed"
      ? { background: "#E8F6F2", color: "#00765C" }
      : { background: "#F1F1F1", color: "#3D3D3D" };

  return (
    <p
      role="status"
      className="mb-4 flex items-center gap-2 px-3 py-2.5 text-sm font-medium"
      style={{ ...style, fontFamily: "Rubik, sans-serif" }}
      data-testid={`season-start-${state}`}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      {text}
    </p>
  );
}
