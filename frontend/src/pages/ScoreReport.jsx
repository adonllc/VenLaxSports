import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_CONFIG = {
  tennis: { color: "text-tennis", icon: "🎾", label: "Tennis", accent: "#10B981" },
  cricket: { color: "text-cricket", icon: "🏏", label: "Cricket", accent: "#2563EB" },
  pickleball: { color: "text-pickleball", icon: "🏓", label: "Pickleball", accent: "#F97316" },
};

export default function ScoreReport() {
  const { id: matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scoreData, setScoreData] = useState({});
  const [winnerId, setWinnerId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    fetchMatch();
  }, [matchId, user]);

  const fetchMatch = async () => {
    try {
      const { data } = await axios.get(`${API}/matches/${matchId}`, { withCredentials: true });
      setMatch(data);
      if (data.status === "completed") setMsg("This match has already been scored.");
    } catch {
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!winnerId) { setMsg("Please select the winner"); return; }
    setSubmitting(true);
    setMsg("");
    try {
      await axios.post(`${API}/matches/${matchId}/score`, { winner_id: winnerId, score_data: scoreData }, { withCredentials: true });
      setMsg("Score reported successfully!");
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err) {
      const d = err.response?.data?.detail;
      setMsg(typeof d === "string" ? d : "Failed to report score");
    } finally {
      setSubmitting(false);
    }
  };

  const updateScore = (key, val) => setScoreData((s) => ({ ...s, [key]: val }));

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>;
  if (!match) return null;

  const sport = match.sport;
  const config = SPORT_CONFIG[sport] || {};

  return (
    <div className="min-h-screen bg-gray-50" data-testid="score-report-page">
      <div className="max-w-xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <h1 className="font-heading font-bold text-xl text-gray-900">Report Match Score</h1>
              <p className={`text-sm ${config.color}`}>{config.label} Match</p>
            </div>
          </div>

          {/* Match Info */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="font-heading font-bold text-lg text-gray-900">{match.player1_name}</p>
                <p className="text-xs text-gray-500">Player 1</p>
              </div>
              <div className="text-gray-400 font-bold text-sm px-4">VS</div>
              <div className="text-center flex-1">
                <p className="font-heading font-bold text-lg text-gray-900">{match.player2_name}</p>
                <p className="text-xs text-gray-500">Player 2</p>
              </div>
            </div>
            {match.scheduled_date && (
              <p className="text-xs text-gray-400 text-center mt-2">{new Date(match.scheduled_date).toLocaleString()}</p>
            )}
          </div>

          {match.status === "completed" ? (
            <div className="bg-gray-100 rounded-xl p-4 text-center text-gray-600 text-sm">
              Match already scored. Winner: <strong>{match.winner_name}</strong>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Winner Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Who Won? *</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: match.player1_id, name: match.player1_name },
                    { id: match.player2_id, name: match.player2_name },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setWinnerId(p.id)}
                      className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                        winnerId === p.id
                          ? "border-black bg-black text-white"
                          : "border-gray-200 text-gray-700 hover:border-gray-400"
                      }`}
                      data-testid={`winner-${p.id}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sport-specific score */}
              {sport === "tennis" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Set Scores</label>
                  <div className="space-y-2">
                    {[1, 2, 3].map((set) => (
                      <div key={set} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-12">Set {set}</span>
                        <input
                          type="text"
                          placeholder={`${match.player1_name.split(" ")[0]}`}
                          value={scoreData[`set${set}_p1`] || ""}
                          onChange={(e) => updateScore(`set${set}_p1`, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black"
                          data-testid={`set${set}-p1`}
                        />
                        <span className="text-gray-400 font-bold">-</span>
                        <input
                          type="text"
                          placeholder={`${match.player2_name.split(" ")[0]}`}
                          value={scoreData[`set${set}_p2`] || ""}
                          onChange={(e) => updateScore(`set${set}_p2`, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black"
                          data-testid={`set${set}-p2`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sport === "cricket" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Cricket Score</label>
                  <div className="space-y-4">
                    {[
                      { label: match.player1_name, prefix: "p1" },
                      { label: match.player2_name, prefix: "p2" },
                    ].map((team) => (
                      <div key={team.prefix} className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-700 mb-3">{team.label}</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Runs</label>
                            <input type="number" min="0" value={scoreData[`${team.prefix}_runs`] || ""} onChange={(e) => updateScore(`${team.prefix}_runs`, e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black" data-testid={`${team.prefix}-runs`} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Wickets</label>
                            <input type="number" min="0" max="10" value={scoreData[`${team.prefix}_wickets`] || ""} onChange={(e) => updateScore(`${team.prefix}_wickets`, e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black" data-testid={`${team.prefix}-wickets`} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Overs</label>
                            <input type="text" value={scoreData[`${team.prefix}_overs`] || ""} onChange={(e) => updateScore(`${team.prefix}_overs`, e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black" placeholder="20.0" data-testid={`${team.prefix}-overs`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sport === "pickleball" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Game Scores</label>
                  <div className="space-y-2">
                    {[1, 2, 3].map((game) => (
                      <div key={game} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-16">Game {game}</span>
                        <input type="number" min="0" max="25" placeholder="0" value={scoreData[`game${game}_p1`] || ""} onChange={(e) => updateScore(`game${game}_p1`, e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black" data-testid={`game${game}-p1`} />
                        <span className="text-gray-400 font-bold">-</span>
                        <input type="number" min="0" max="25" placeholder="0" value={scoreData[`game${game}_p2`] || ""} onChange={(e) => updateScore(`game${game}_p2`, e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black" data-testid={`game${game}-p2`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Notes (optional)</label>
                <input type="text" value={scoreData.notes || ""} onChange={(e) => updateScore("notes", e.target.value)} placeholder="e.g. Match result notes..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" data-testid="score-notes" />
              </div>

              {msg && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${msg.includes("success") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`} data-testid="score-message">
                  {msg.includes("success") ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {msg}
                </div>
              )}

              <button type="submit" disabled={submitting || !winnerId} className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60 text-sm" data-testid="submit-score-btn">
                {submitting ? "Submitting..." : "Submit Score"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
