import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Trophy, Users, ChevronRight, Bell } from "lucide-react";
import NotifyMeBanner from "../components/NotifyMeBanner";
import NotifyMeModal from "../components/NotifyMeModal";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const SPORT_CONFIG = {
  tennis: { label: "Tennis", emoji: "🎾", color: "text-emerald-600" },
  pickleball: { label: "Pickleball", emoji: "🏓", color: "text-orange-500" },
  cricket: { label: "Cricket", emoji: "🏏", color: "text-blue-600" },
};

export default function CityLeaderboard() {
  const { city, sport } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    axios
      .get(`${API}/public/city/${encodeURIComponent(city)}/sport/${sport}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [city, sport]);

  const cfg = SPORT_CONFIG[sport] || { label: sport, emoji: "🏆", color: "text-gray-700" };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50" data-testid="city-leaderboard-page">
      {/* SEO header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${cfg.color}`}>
            {cfg.emoji} {cfg.label}
          </p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-heading font-black text-3xl text-gray-900 mb-1">
                {city} Leaderboard
              </h1>
              <p className="text-gray-500 text-sm">
                Top ranked {cfg.label.toLowerCase()} players in {city}
              </p>
            </div>
            <button
              onClick={() => setBellOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-emerald-600 transition"
              data-testid="city-notify-bell"
              title={`Notify me when ${city} ${cfg.label} opens`}
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notify Me</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Top Players */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h2 className="font-heading font-bold text-gray-900">Top Players</h2>
          </div>
          {!data || (data.leaders?.length ?? 0) === 0 ? (
            <div className="py-14 text-center">
              <p className="text-gray-500 text-sm mb-4">
                No players in {city} yet — be the first!
              </p>
              <Link
                to="/auth"
                className="inline-block bg-[#1B2B4B] text-white rounded-md px-6 py-2.5 text-sm font-bold hover:bg-[#142040] transition"
                data-testid="city-first-player-cta"
              >
                Join VenLax Sports
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.leaders.map((player, i) => (
                <div
                  key={player.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition"
                  data-testid={`leaderboard-row-${i}`}
                >
                  <span className="w-6 text-center font-bold text-gray-400 text-sm shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {player.profile_public ? (
                      <Link
                        to={`/players/${player.id}`}
                        className="font-medium text-gray-900 hover:underline truncate block"
                      >
                        {player.name}
                      </Link>
                    ) : (
                      <span className="text-gray-400 italic text-sm">{player.name}</span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${cfg.color} shrink-0`}>
                    {player.rating?.toFixed(2)}
                  </span>
                  {player.profile_public && (
                    <Link
                      to={`/players/${player.id}`}
                      className="text-gray-300 hover:text-gray-600 transition shrink-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Leagues */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="font-heading font-bold text-gray-900">
              Active Leagues in {city}
            </h2>
          </div>
          {!data || (data.active_leagues?.length ?? 0) === 0 ? (
            <div className="p-4">
              <NotifyMeBanner city={city} sport={sport} />
            </div>
          ) : data.active_leagues.every(l => l.status !== "registration") ? (
            <div className="p-4">
              <NotifyMeBanner city={city} sport={sport} />
              <div className="mt-3 divide-y divide-gray-50">
                {data.active_leagues.map(league => (
                  <Link
                    key={league.id}
                    to={`/leagues/${league.id}/public`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
                    data-testid={`city-league-${league.id}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{league.name}</p>
                      <p className="text-xs text-gray-500">
                        {league.current_players}/{league.max_players} players
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                      league.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {league.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.active_leagues.map(league => (
                <Link
                  key={league.id}
                  to={`/leagues/${league.id}/public`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
                  data-testid={`city-league-${league.id}`}
                >
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{league.name}</p>
                    <p className="text-xs text-gray-500">
                      {league.current_players}/{league.max_players} players
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                    league.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {league.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Join CTA */}
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm mb-3">
            Play competitively in {city}. No club required.
          </p>
          <Link
            to="/auth"
            className="inline-block bg-[#1B2B4B] text-white rounded-md px-8 py-3 text-sm font-bold hover:bg-[#142040] transition"
            data-testid="city-join-cta"
          >
            Join Free · VenLax Sports
          </Link>
        </div>
      </div>
      <NotifyMeModal
        isOpen={bellOpen}
        onClose={() => setBellOpen(false)}
        city={city}
        sport={sport}
      />
    </div>
  );
}
