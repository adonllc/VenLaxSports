import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Trophy, Users, Calendar, Share2, AlertCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_COLORS = {
  tennis: "text-emerald-600",
  pickleball: "text-orange-500",
  cricket: "text-blue-600",
};

export default function LeagueSpectator() {
  const { id: leagueId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/league/${leagueId}`)
      .then(r => setData(r.data))
      .catch(() => setError("League not found or not public."))
      .finally(() => setLoading(false));
  }, [leagueId]);

  const handleShare = () => {
    const url = `${window.location.href}?utm_source=venlax&utm_medium=spectator`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-4">{error}</p>
        <Link to="/leagues" className="text-sm font-medium text-black underline">
          Browse all leagues
        </Link>
      </div>
    </div>
  );

  const sportColor = SPORT_COLORS[data.sport] || "text-gray-700";

  return (
    <div className="min-h-screen bg-gray-50" data-testid="league-spectator-page">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${sportColor}`}>
                {data.sport} · {data.city}
              </p>
              <h1 className="font-heading font-black text-2xl text-gray-900 mb-2 truncate">
                {data.name}
              </h1>
              <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {data.current_players}/{data.max_players} players
                </span>
                <span className={`capitalize px-2 py-0.5 rounded-full text-xs font-semibold ${
                  data.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {data.status}
                </span>
              </div>
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-black transition shrink-0"
              data-testid="spectator-share-btn"
            >
              <Share2 className="w-4 h-4" />
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
            <Link
              to={`/leagues/${leagueId}`}
              className="flex-1 text-center bg-black text-white rounded-md py-2.5 text-sm font-bold hover:bg-gray-800 transition"
              data-testid="spectator-join-btn"
            >
              Join this league
            </Link>
          </div>
        </div>

        {/* Standings */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h2 className="font-heading font-bold text-gray-900">Standings</h2>
          </div>
          {data.standings.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Season starting soon — check back after matches begin!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="spectator-standings-table">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Player</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">W</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">L</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.standings.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/players/${s.player_id}`}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {s.player_name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center text-emerald-600 font-medium">{s.wins}</td>
                      <td className="px-3 py-3 text-center text-red-400">{s.losses}</td>
                      <td className="px-3 py-3 text-center font-bold text-gray-900">
                        {s.points?.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent results */}
        {data.recent_matches.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <h2 className="font-heading font-bold text-gray-900">Recent Results</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {data.recent_matches.map((m, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-gray-700">
                    <span className="font-medium">{m.player1_name}</span>
                    <span className="text-gray-400 mx-2">vs</span>
                    <span className="font-medium">{m.player2_name}</span>
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 ml-4">
                    {m.winner_name} won
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Join CTA */}
        <div className="text-center py-2">
          <p className="text-gray-500 text-sm mb-3">Want to compete? No club required.</p>
          <Link
            to="/auth"
            className="inline-block bg-black text-white rounded-md px-8 py-3 text-sm font-bold hover:bg-gray-800 transition"
            data-testid="spectator-signup-cta"
          >
            Join VenLax Sports Free
          </Link>
        </div>
      </div>
    </div>
  );
}
