import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function LadderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ladder, setLadder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [challengingId, setChallengingId] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchLadder();
  }, [id]);

  const fetchLadder = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/ladders/${id}`, { withCredentials: true });
      setLadder(data);
    } catch {
      setLadder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChallenge = async (challengedPlayerId) => {
    setChallengingId(challengedPlayerId);
    setMsg("");
    try {
      await axios.post(`${API}/ladders/challenges`, {
        ladder_id: id,
        challenged_player_id: challengedPlayerId,
      }, { withCredentials: true });
      setMsg("Challenge sent! They have 72 hours to accept.");
      fetchLadder();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Could not send challenge");
    } finally {
      setChallengingId(null);
    }
  };

  const handleJoin = async () => {
    if (!user) { navigate("/auth"); return; }
    setMsg("");
    try {
      await axios.post(`${API}/ladders/${id}/join`, {}, { withCredentials: true });
      fetchLadder();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Could not join");
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>;
  if (!ladder) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Ladder not found</div>;

  const isInLadder = ladder.my_rank != null;
  const onCooldown = ladder.my_cooldown_until && new Date(ladder.my_cooldown_until) > new Date();
  const cooldownDisplay = onCooldown
    ? `Cooldown until ${new Date(ladder.my_cooldown_until).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <button onClick={() => navigate("/ladders")} className="hover:text-gray-700">← Ladders</button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {ladder.city} · {ladder.division_label} {ladder.sport.charAt(0).toUpperCase() + ladder.sport.slice(1)} Ladder
          </h1>
          <p className="text-gray-500 mt-1">Singles · {ladder.entry_count} players · Always open</p>
        </div>

        {/* My rank banner */}
        {isInLadder && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-indigo-800">Your Rank</p>
              <p className="text-2xl font-bold text-indigo-900">#{ladder.my_rank} of {ladder.entry_count}</p>
            </div>
            {cooldownDisplay && (
              <span className="text-xs text-orange-700 bg-orange-100 px-3 py-1.5 rounded-md font-medium">
                {cooldownDisplay}
              </span>
            )}
          </div>
        )}

        {msg && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
            {msg}
          </div>
        )}

        {/* Join CTA */}
        {!isInLadder && (
          <div className="mb-6">
            <button
              data-testid="ladder-detail-join"
              onClick={handleJoin}
              className="w-full py-3 bg-[#1B2B4B] text-white font-semibold rounded-xl hover:bg-[#142040] transition-colors"
            >
              Join this Ladder
            </button>
          </div>
        )}

        {/* Ranked list */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Rankings</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {(ladder.entries || []).map((entry) => {
              const isMe = user && entry.player_id === user.id;
              const canChallenge = isInLadder && entry.can_challenge && !onCooldown;
              return (
                <div
                  key={entry.player_id}
                  data-testid={`ladder-entry-${entry.rank}`}
                  className={`px-4 py-3 flex items-center gap-3 ${isMe ? "bg-indigo-50" : ""}`}
                >
                  <span className="w-8 text-sm font-bold text-gray-400">#{entry.rank}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isMe ? "text-indigo-900" : "text-gray-900"}`}>
                      {entry.name} {isMe && <span className="text-xs text-indigo-500">(you)</span>}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400 font-mono">{Math.round(entry.elo)}</span>
                  {canChallenge && (
                    <button
                      data-testid={`challenge-btn-${entry.player_id}`}
                      onClick={() => handleChallenge(entry.player_id)}
                      disabled={challengingId === entry.player_id}
                      className="px-3 py-1 text-xs font-semibold bg-[#1B2B4B] text-white rounded-md hover:bg-[#142040] disabled:opacity-50 transition-colors"
                    >
                      {challengingId === entry.player_id ? "..." : "Challenge"}
                    </button>
                  )}
                  {isInLadder && !isMe && !canChallenge && entry.rank > ladder.my_rank && (
                    <span className="text-xs text-gray-300">below you</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
