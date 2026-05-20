import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Trophy } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Standings() {
  const { id: leagueId } = useParams();
  const navigate = useNavigate();
  const [standings, setStandings] = useState([]);
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/leagues/${leagueId}`),
      axios.get(`${API}/leagues/${leagueId}/standings`),
    ]).then(([lRes, sRes]) => {
      setLeague(lRes.data);
      setStandings(sRes.data);
    }).catch(() => navigate("/leagues")).finally(() => setLoading(false));
  }, [leagueId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>;

  const sport = league?.sport;
  const accentClass = sport === "tennis" ? "text-tennis" : sport === "cricket" ? "text-cricket" : "text-pickleball";

  return (
    <div className="min-h-screen bg-gray-50" data-testid="standings-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => navigate(`/leagues/${leagueId}`)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6" data-testid="back-to-league">
          <ArrowLeft className="w-4 h-4" /> Back to League
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h1 className="font-heading font-black text-2xl text-gray-900">Standings</h1>
            {league && <p className={`text-sm font-medium mt-1 ${accentClass}`}>{league.name}</p>}
          </div>

          {standings.length === 0 ? (
            <div className="text-center py-16">
              <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500">No standings yet — play some matches!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="standings-table">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Player</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">W</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">L</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">D</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">MP</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {standings.map((s, i) => (
                    <tr key={i} className={`transition-colors ${i === 0 ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-gray-50"}`} data-testid={`standing-row-${i}`}>
                      <td className="px-6 py-4 text-gray-400 font-heading font-bold">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        <Link
                          to={`/players/${s.player_id}`}
                          className="hover:underline"
                          data-testid={`standings-player-link-${i}`}
                        >
                          {s.player_name}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-center font-semibold text-emerald-600">{s.wins}</td>
                      <td className="px-4 py-4 text-center text-red-500">{s.losses}</td>
                      <td className="px-4 py-4 text-center text-gray-500">{s.draws || 0}</td>
                      <td className="px-4 py-4 text-center text-gray-600">{s.matches_played}</td>
                      <td className="px-4 py-4 text-center font-heading font-black text-gray-900 text-lg">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
