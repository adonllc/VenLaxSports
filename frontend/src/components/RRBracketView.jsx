import { Trophy, Clock } from "lucide-react";

export default function RRBracketView({ matches = [], generated = false }) {
  if (!generated) {
    return (
      <div className="text-center text-gray-400 py-16 flex flex-col items-center gap-3">
        <Trophy size={32} className="text-gray-300" />
        <p className="font-medium">Playoffs begin after the Round Robin completes</p>
        <p className="text-sm">Top qualifiers will be seeded automatically</p>
      </div>
    );
  }

  const byRound = matches.reduce((acc, m) => {
    const r = m.round || "Final";
    if (!acc[r]) acc[r] = [];
    acc[r].push(m);
    return acc;
  }, {});

  const ROUND_LABELS = { SF: "Semifinals", F: "Final", "3rd": "3rd Place", QF: "Quarterfinals" };

  return (
    <div className="space-y-8">
      {Object.entries(byRound).map(([round, roundMatches]) => (
        <div key={round}>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
            {ROUND_LABELS[round] || round}
          </h3>
          <div className="space-y-3">
            {roundMatches.map((m, idx) => (
              <div
                key={m.id || idx}
                data-testid={`rr-bracket-match-${m.id}`}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className={`px-4 py-3 flex justify-between items-center ${m.winner_id === m.player1_id ? "bg-emerald-50" : "bg-white"}`}>
                  <span className="font-medium text-gray-900">{m.player1_name}</span>
                  {m.winner_id === m.player1_id && <Trophy size={14} className="text-emerald-600" />}
                </div>
                <div className="h-px bg-gray-100" />
                <div className={`px-4 py-3 flex justify-between items-center ${m.winner_id === m.player2_id ? "bg-emerald-50" : "bg-white"}`}>
                  <span className="font-medium text-gray-900">{m.player2_name}</span>
                  {m.winner_id === m.player2_id && <Trophy size={14} className="text-emerald-600" />}
                </div>
                {m.status === "scheduled" && (
                  <div className="px-4 py-2 bg-gray-50 flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={12} />
                    Schedule this match with your opponent within the week
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
