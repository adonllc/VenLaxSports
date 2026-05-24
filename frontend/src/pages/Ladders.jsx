import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_COLORS = {
  tennis: "text-emerald-700 bg-emerald-50 border-emerald-200",
  pickleball: "text-orange-700 bg-orange-50 border-orange-200",
};

export default function Ladders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ladders, setLadders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ sport: "", division: "" });

  useEffect(() => {
    fetchLadders();
  }, [filters]);

  const fetchLadders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.sport) params.sport = filters.sport;
      if (filters.division) params.division = filters.division;
      const { data } = await axios.get(`${API}/ladders`, { params });
      setLadders(data);
    } catch {
      setLadders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (ladderId) => {
    if (!user) { navigate("/auth"); return; }
    try {
      await axios.post(`${API}/ladders/${ladderId}/join`, {}, { withCredentials: true });
      navigate(`/ladders/${ladderId}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Could not join ladder");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Challenge Ladders</h1>
          <p className="mt-2 text-gray-500">Always-on ranked play. Challenge anyone above you. No season needed.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["", "tennis", "pickleball"].map((sport) => (
            <button
              key={sport || "all"}
              data-testid={`ladder-sport-filter-${sport || "all"}`}
              onClick={() => setFilters((f) => ({ ...f, sport }))}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filters.sport === sport
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {sport ? sport.charAt(0).toUpperCase() + sport.slice(1) : "All Sports"}
            </button>
          ))}
          <span className="mx-1 text-gray-300">|</span>
          {["", "Beginner", "Intermediate", "Advanced", "Competitive"].map((div) => (
            <button
              key={div || "all-div"}
              data-testid={`ladder-division-filter-${div || "all"}`}
              onClick={() => setFilters((f) => ({ ...f, division: div }))}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filters.division === div
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {div || "All Levels"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading ladders...</div>
        ) : ladders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No ladders found. Check back soon.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ladders.map((ladder) => (
              <div
                key={ladder.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${SPORT_COLORS[ladder.sport] || "text-gray-600 bg-gray-50 border-gray-200"}`}>
                      {ladder.sport}
                    </span>
                    <span className="ml-2 text-xs text-indigo-600 font-medium">
                      {ladder.division_label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{ladder.entry_count} players</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {ladder.city} · {ladder.division_label} {ladder.sport.charAt(0).toUpperCase() + ladder.sport.slice(1)} Ladder
                </h3>
                <p className="text-sm text-gray-500 mb-4">Singles · Always open · Free to join</p>

                {/* Top 3 players */}
                {ladder.top_players?.length > 0 && (
                  <div className="space-y-1 mb-4">
                    {ladder.top_players.slice(0, 3).map((p, i) => (
                      <div key={p.player_id} className="flex items-center gap-2 text-sm">
                        <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                        <span className="text-gray-700">{p.name}</span>
                        <span className="ml-auto text-xs text-gray-400">{Math.round(p.elo)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    data-testid={`ladder-join-${ladder.id}`}
                    onClick={() => handleJoin(ladder.id)}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Join Ladder
                  </button>
                  <button
                    data-testid={`ladder-view-${ladder.id}`}
                    onClick={() => navigate(`/ladders/${ladder.id}`)}
                    className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:border-gray-400 transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
