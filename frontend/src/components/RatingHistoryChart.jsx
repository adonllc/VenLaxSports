import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const SPORT_COLOR = {
  tennis: "#10b981",
  pickleball: "#f97316",
  cricket: "#2563eb",
};

/**
 * Rating history line chart for the logged-in user.
 * Cricket is excluded by design (team-based NRR rather than ELO).
 */
export default function RatingHistoryChart({ user, defaultSport = "tennis" }) {
  const eligibleSports = ["tennis", "pickleball"].filter((s) => user?.[`${s}_rating`] !== undefined);
  const [sport, setSport] = useState(eligibleSports.includes(defaultSport) ? defaultSport : eligibleSports[0] || "tennis");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get(`${API}/users/me/rating-history`, { params: { sport, limit: 50 }, withCredentials: true })
      .then(({ data }) => { if (!cancelled) setHistory(data); })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sport]);

  const chartData = useMemo(() => {
    return history.map((h, i) => ({
      idx: i + 1,
      rating: h.rating,
      label: `vs ${h.opponent_name || "?"} • ${h.result}`,
      delta: h.delta,
    }));
  }, [history]);

  const currentRating = user?.[`${sport}_rating`] ?? (chartData.at(-1)?.rating ?? 3.0);
  const startRating = chartData[0]?.rating ?? currentRating;
  const totalChange = +(currentRating - startRating).toFixed(2);
  const trend = totalChange > 0 ? "up" : totalChange < 0 ? "down" : "flat";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5" data-testid="rating-history-chart">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Rating History</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-heading font-black text-2xl text-gray-900" data-testid="rating-current">
              {currentRating?.toFixed(2)}
            </span>
            {chartData.length > 0 && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-gray-500"
                }`}
                data-testid="rating-trend"
              >
                {trend === "up" && <TrendingUp className="w-3.5 h-3.5" />}
                {trend === "down" && <TrendingDown className="w-3.5 h-3.5" />}
                {trend === "flat" && <Minus className="w-3.5 h-3.5" />}
                {totalChange > 0 ? "+" : ""}{totalChange}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
          {eligibleSports.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                sport === s ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`rating-sport-tab-${s}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-sm text-gray-400">Loading...</div>
      ) : chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-center px-4">
          <p className="text-sm text-gray-400">
            No matches scored yet. Play a {sport} match and your rating curve will appear here.
          </p>
        </div>
      ) : (
        <div className="h-48" data-testid="rating-chart-svg">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="idx" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} domain={["auto", "auto"]} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  fontSize: "12px", borderRadius: "10px", border: "1px solid #e5e7eb",
                  background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
                formatter={(value, _name, item) => {
                  const d = item?.payload?.delta;
                  const sign = d > 0 ? "+" : "";
                  return [`${value}  (${sign}${d?.toFixed(3)})`, item?.payload?.label];
                }}
                labelFormatter={(idx) => `Match #${idx}`}
              />
              <ReferenceLine y={startRating} stroke="#d1d5db" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="rating"
                stroke={SPORT_COLOR[sport] || "#10b981"}
                strokeWidth={2.5}
                dot={{ fill: SPORT_COLOR[sport] || "#10b981", r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
