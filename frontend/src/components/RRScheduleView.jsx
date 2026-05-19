import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const STATUS_CHIP = {
  scheduled: "bg-gray-100 text-gray-600",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function RRScheduleView({ rounds = [], currentUserId }) {
  const [openRound, setOpenRound] = useState(1);

  if (rounds.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        Schedule not yet generated. Waiting for minimum players to register.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rounds.map(rnd => {
        const isOpen = openRound === rnd.round;
        return (
          <div key={rnd.round} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              data-testid={`rr-round-toggle-${rnd.round}`}
              onClick={() => setOpenRound(isOpen ? null : rnd.round)}
              className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="text-left">
                <span className="font-bold text-gray-900">Round {rnd.round}</span>
                <span className="text-sm text-gray-500 ml-3">
                  Week of {rnd.week_start} – {rnd.week_end}
                </span>
              </div>
              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {rnd.matches.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400 italic">BYE — no match this round</div>
                ) : (
                  rnd.matches.map((m, idx) => {
                    const isUser = m.player1_id === currentUserId || m.player2_id === currentUserId;
                    return (
                      <div
                        key={m.match_id || idx}
                        data-testid={`rr-match-row-${m.match_id}`}
                        className={`px-5 py-3 flex items-center justify-between ${isUser ? "bg-emerald-50" : "bg-white"}`}
                      >
                        <span className="text-sm font-medium text-gray-900">
                          {m.player1_name} <span className="text-gray-400 mx-2">vs</span> {m.player2_name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CHIP[m.status] || STATUS_CHIP.scheduled}`}>
                            {m.status || "Scheduled"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
