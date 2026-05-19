import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Trophy, Share2, Swords, MapPin } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_COLORS = {
  tennis: "#10B981",
  pickleball: "#F97316",
  cricket: "#2563EB",
};

export default function PublicProfile() {
  const { id: playerId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [challenging, setChallenging] = useState(false);
  const [challengeSent, setChallengeSent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/player/${playerId}`)
      .then(r => setProfile(r.data))
      .catch(() => setError("Player not found or profile is private."))
      .finally(() => setLoading(false));
  }, [playerId]);

  const handleChallenge = async () => {
    if (!user) {
      navigate(`/auth?next=/players/${playerId}`);
      return;
    }
    setChallenging(true);
    try {
      await axios.post(
        `${API}/public/challenge`,
        { challenged_id: playerId },
        { withCredentials: true }
      );
      setChallengeSent(true);
    } catch (e) {
      alert(e.response?.data?.detail || "Could not send challenge.");
    } finally {
      setChallenging(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.href}?utm_source=venlax&utm_medium=profile`;
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
        <p className="text-gray-500 mb-4">{error}</p>
        <Link to="/leagues" className="text-sm font-medium text-black underline">
          Browse leagues
        </Link>
      </div>
    </div>
  );

  const isOwnProfile = user && (user.id === playerId || user._id === playerId);

  const chartData = (profile.rating_history || []).map((h, i) => ({
    match: i + 1,
    rating: h.rating,
    sport: h.sport,
  }));

  const lastSport = profile.rating_history?.[profile.rating_history.length - 1]?.sport || "tennis";
  const chartColor = SPORT_COLORS[lastSport] || "#10B981";

  return (
    <div className="min-h-screen bg-gray-50" data-testid="public-profile-page">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Player card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-heading font-black text-2xl text-gray-900">{profile.name}</h1>
              {profile.city && (
                <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {profile.city}{profile.country ? `, ${profile.country}` : ""}
                </p>
              )}
            </div>
            <button
              onClick={handleShare}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition shrink-0"
              data-testid="profile-share-btn"
              title="Copy profile link"
            >
              <Share2 className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          {copied && (
            <p className="text-xs text-emerald-600 mt-2">Profile link copied!</p>
          )}

          {/* Stats row */}
          <div className="mt-5 flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900">{profile.wins}</p>
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide">Wins</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900">{profile.losses}</p>
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide">Losses</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-600">
                {profile.tennis_rating?.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide">Tennis</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-orange-500">
                {profile.pickleball_rating?.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide">Pickleball</p>
            </div>
          </div>

          {/* Challenge button — hidden for own profile */}
          {!isOwnProfile && (
            <button
              onClick={handleChallenge}
              disabled={challenging || challengeSent}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-black text-white rounded-md py-2.5 text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50"
              data-testid="challenge-btn"
            >
              <Swords className="w-4 h-4" />
              {challengeSent
                ? "Challenge Sent!"
                : challenging
                ? "Sending..."
                : `Challenge ${profile.name}`}
            </button>
          )}
        </div>

        {/* ELO chart */}
        {chartData.length > 1 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="font-heading font-bold text-gray-900 mb-5">Rating History</h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 16 }}>
                <XAxis
                  dataKey="match"
                  label={{ value: "Match #", position: "insideBottom", offset: -8, fontSize: 11 }}
                  tick={{ fontSize: 10 }}
                />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => [v.toFixed(2), "Rating"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="rating"
                  stroke={chartColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent matches */}
        {(profile.recent_matches?.length ?? 0) > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <h2 className="font-heading font-bold text-gray-900">Recent Matches</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {profile.recent_matches.map((m, i) => {
                const won = m.winner_id === playerId;
                const opponent = won ? m.player2_name : m.player1_name;
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      won ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-500"
                    }`}>
                      {won ? "W" : "L"}
                    </span>
                    <span className="text-sm text-gray-700 flex-1">vs {opponent}</span>
                    <span className="text-xs text-gray-400 shrink-0">{m.sport}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Join CTA for non-users */}
        {!user && (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm mb-3">Play competitively. Track your rating.</p>
            <Link
              to="/auth"
              className="inline-block bg-black text-white rounded-md px-8 py-3 text-sm font-bold hover:bg-gray-800 transition"
              data-testid="profile-join-cta"
            >
              Join VenLax Sports Free
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
