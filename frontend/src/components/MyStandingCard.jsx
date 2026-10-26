const GREEN = "#008F70";
const INK = "#3D3D3D";
const BODY = "#5C5C5C";

// What each column means. The points line follows the formula on the Rules page.
export const STAT_HELP = [
  ["W", "Wins", "Matches you have won."],
  ["L", "Losses", "Matches you have lost."],
  ["MP", "Matches played", "Matches you have completed so far this season."],
  ["PTS", "Points", "Your league score. Each win earns 3 points and each loss still earns 1. Set and game margins and bonus points (for example for playing every match) adjust it slightly. More points means a higher place."],
];

/**
 * A player's own standing: their W, L, MP and PTS and what each one means. Nobody else's name or numbers.
 * row: the player's standings row, or undefined before their first match.
 */
export default function MyStandingCard({ row, leagueName }) {
  const values = { W: row?.wins ?? 0, L: row?.losses ?? 0, MP: row?.matches_played ?? 0, PTS: row?.points ?? 0 };
  return (
    <div className="p-6 sm:p-8" data-testid="my-standing-card">
      <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: GREEN }}>Your standing</p>
      <h2 className="mt-1 text-2xl font-bold" style={{ color: INK, fontFamily: "Rubik, system-ui, sans-serif" }}>{row?.player_name || "You"}</h2>
      {leagueName && <p className="text-sm" style={{ color: BODY }}>{leagueName}</p>}

      <div className="mt-6 grid grid-cols-4 gap-3" data-testid="my-standing-stats">
        {STAT_HELP.map(([key, label]) => (
          <div key={key} className="p-4 text-center" style={{ background: "#F1F1F1" }}>
            <div className="text-3xl font-bold tabular-nums" style={{ color: key === "PTS" ? GREEN : INK, fontFamily: "Rubik, system-ui, sans-serif" }} data-testid={`stat-${key}`}>{values[key]}</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wide" style={{ color: BODY }} title={label}>{key}</div>
          </div>
        ))}
      </div>

      {!row && (
        <p className="mt-4 text-sm" style={{ color: BODY }}>Your numbers start moving after your first match.</p>
      )}

      <dl className="mt-6 space-y-3" data-testid="stat-legend">
        {STAT_HELP.map(([key, label, text]) => (
          <div key={key} className="flex gap-3">
            <dt className="w-24 shrink-0 text-sm font-bold" style={{ color: INK }}>{key} <span className="font-normal" style={{ color: BODY }}>({label})</span></dt>
            <dd className="text-sm" style={{ color: BODY }}>{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
