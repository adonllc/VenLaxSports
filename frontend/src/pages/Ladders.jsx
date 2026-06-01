import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const ESPRESSO = "#1B2B4B";
const RUST = "#C24A1D";
const SAND_PALE = "#FFFFFF";
const SAND_LIGHT = "#F3F4F6";
const BORDER = "#E5E7EB";
const COFFEE = "#111827";
const MOCHA = "#374151";
const SIENNA = "#6B7280";
const SPORT_BADGE = {
  tennis:     { bg: "#D1FAE5", color: "#065F46", border: "#10B981" },
  pickleball: { bg: "#FFEDD5", color: "#C2410C", border: "#F97316" },
  cricket:    { bg: "#DBEAFE", color: "#1E40AF", border: "#2563EB" },
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
    <div className="min-h-screen" style={{ background: SAND_PALE }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-heading font-black text-3xl" style={{ color: COFFEE }}>Challenge Ladders</h1>
          <p className="mt-2" style={{ color: MOCHA }}>Always-on ranked play. Challenge anyone above you. No season needed.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["", "tennis", "pickleball"].map((sport) => (
            <button
              key={sport || "all"}
              data-testid={`ladder-sport-filter-${sport || "all"}`}
              onClick={() => setFilters((f) => ({ ...f, sport }))}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={filters.sport === sport
                ? { background: ESPRESSO, color: "white", border: `1px solid ${ESPRESSO}` }
                : { background: "white", color: MOCHA, border: `1px solid ${BORDER}` }}
            >
              {sport ? sport.charAt(0).toUpperCase() + sport.slice(1) : "All Sports"}
            </button>
          ))}
          <span className="mx-1" style={{ color: BORDER, lineHeight: "2rem" }}>|</span>
          {["", "Beginner", "Intermediate", "Advanced", "Competitive"].map((div) => (
            <button
              key={div || "all-div"}
              data-testid={`ladder-division-filter-${div || "all"}`}
              onClick={() => setFilters((f) => ({ ...f, division: div }))}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={filters.division === div
                ? { background: RUST, color: "white", border: `1px solid ${RUST}` }
                : { background: "white", color: MOCHA, border: `1px solid ${BORDER}` }}
            >
              {div || "All Levels"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16" style={{ color: SIENNA }}>Loading ladders...</div>
        ) : ladders.length === 0 ? (
          <div className="text-center py-16" style={{ color: SIENNA }}>No ladders found. Check back soon.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ladders.map((ladder) => {
              const badge = SPORT_BADGE[ladder.sport] || { bg: SAND_LIGHT, color: MOCHA, border: BORDER };
              return (
                <div
                  key={ladder.id}
                  className="rounded-xl p-5 transition-shadow"
                  style={{ background: "white", border: `1px solid ${BORDER}` }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(44,18,6,0.10)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border"
                        style={{ background: badge.bg, color: badge.color, borderColor: badge.border + "60" }}
                      >
                        {ladder.sport}
                      </span>
                      <span className="ml-2 text-xs font-medium" style={{ color: RUST }}>
                        {ladder.division_label}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: SIENNA }}>{ladder.entry_count} players</span>
                  </div>
                  <h3 className="font-semibold mb-1" style={{ color: COFFEE }}>
                    {ladder.city} · {ladder.division_label} {ladder.sport.charAt(0).toUpperCase() + ladder.sport.slice(1)} Ladder
                  </h3>
                  <p className="text-sm mb-4" style={{ color: MOCHA }}>Singles · Always open · Free to join</p>

                  {ladder.top_players?.length > 0 && (
                    <div className="space-y-1 mb-4">
                      {ladder.top_players.slice(0, 3).map((p, i) => (
                        <div key={p.player_id} className="flex items-center gap-2 text-sm">
                          <span className="text-xs font-bold w-5" style={{ color: SIENNA }}>#{i + 1}</span>
                          <span style={{ color: COFFEE }}>{p.name}</span>
                          <span className="ml-auto text-xs" style={{ color: SIENNA }}>{Math.round(p.elo)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      data-testid={`ladder-join-${ladder.id}`}
                      onClick={() => handleJoin(ladder.id)}
                      className="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors"
                      style={{ background: ESPRESSO, color: "white" }}
                      onMouseEnter={e => e.currentTarget.style.background = RUST}
                      onMouseLeave={e => e.currentTarget.style.background = ESPRESSO}
                    >
                      Join Ladder
                    </button>
                    <button
                      data-testid={`ladder-view-${ladder.id}`}
                      onClick={() => navigate(`/ladders/${ladder.id}`)}
                      className="px-4 py-2 text-sm font-medium rounded-md transition-colors"
                      style={{ border: `1px solid ${BORDER}`, color: MOCHA, background: "white" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = RUST}
                      onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
