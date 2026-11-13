import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Search, Swords, Trophy, Users } from "lucide-react";
import { LADDER_STATUS } from "../utils/ladderUi";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/** PLAY & COMPETE: the two ways to get a ranked or friendly match without waiting for a league. */
export default function PlayCompete() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [waiting, setWaiting] = useState(0);
  const [mine, setMine] = useState([]);
  useDocumentMeta({ title: "Play & Compete | VENLAX Sports", description: "Join a ladder or challenge any VENLAX player to a match.", noindex: true });

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    axios.get(`${API}/challenges/open-count`, { withCredentials: true }).then((r) => setWaiting(r.data.waiting)).catch(() => {});
    axios.get(`${API}/community-ladders/mine`, { withCredentials: true }).then((r) => setMine(r.data)).catch(() => {});
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen" style={{ background: "#F9FAFB" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#008F70" }}>Play & Compete</p>
        <h1 className="font-heading font-bold text-3xl mt-1" style={{ color: "#1D1D1D" }}>How do you want to play?</h1>
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          <Link to="/find-opponent" className="bg-white p-6 hover:shadow-md transition-shadow" style={{ border: "1px solid #E5E7EB" }} data-testid="play-find-opponent">
            <Search className="w-7 h-7" style={{ color: "#008F70" }} />
            <h2 className="font-heading font-bold text-lg mt-4" style={{ color: "#1D1D1D" }}>Find an opponent</h2>
            <p className="text-sm mt-1" style={{ color: "#4C4C4C" }}>Browse open match requests near you, or post your own and let players accept it. No ladder, no waiting.</p>
          </Link>
          <Link to="/ladders" className="bg-white p-6 hover:shadow-md transition-shadow" style={{ border: "1px solid #E5E7EB" }} data-testid="play-join-ladder">
            <Trophy className="w-7 h-7" style={{ color: "#F2A922" }} />
            <h2 className="font-heading font-bold text-lg mt-4" style={{ color: "#1D1D1D" }}>Join an existing ladder</h2>
            <p className="text-sm mt-1" style={{ color: "#4C4C4C" }}>Climb a ranked city ladder. Your wins move your official rank.</p>
          </Link>
          <Link to="/challenges" className="bg-white p-6 hover:shadow-md transition-shadow relative" style={{ border: "1px solid #E5E7EB" }} data-testid="play-challenge-player">
            {waiting > 0 && <span className="absolute top-4 right-4 px-2 py-0.5 text-xs font-bold text-white" style={{ background: "#008F70" }} data-testid="play-waiting-badge">{waiting} waiting</span>}
            <Swords className="w-7 h-7" style={{ color: "#008F70" }} />
            <h2 className="font-heading font-bold text-lg mt-4" style={{ color: "#1D1D1D" }}>Challenge a player</h2>
            <p className="text-sm mt-1" style={{ color: "#4C4C4C" }}>Pick any VENLAX player, agree a time and play. No ladder needed. Friendly matches never change a ladder rank.</p>
          </Link>
          <Link to="/community-ladders/new" className="bg-white p-6 hover:shadow-md transition-shadow" style={{ border: "1px solid #E5E7EB" }} data-testid="play-create-ladder">
            <Users className="w-7 h-7" style={{ color: "#F2A922" }} />
            <h2 className="font-heading font-bold text-lg mt-4" style={{ color: "#1D1D1D" }}>Create your own ladder</h2>
            <p className="text-sm mt-1" style={{ color: "#4C4C4C" }}>Start a ladder for your friends or your city. VENLAX keeps the rankings. No admin needed.</p>
          </Link>
        </div>
        {mine.length > 0 && (
          <div className="mt-10" data-testid="play-my-ladders">
            <h2 className="font-heading font-bold text-lg mb-3" style={{ color: "#1D1D1D" }}>Your community ladders</h2>
            <div className="space-y-2">
              {mine.map((l) => {
                const s = LADDER_STATUS[l.status] || LADDER_STATUS.active;
                return (
                  <Link key={l.id} to={`/community-ladders/${l.id}`} className="flex items-center justify-between gap-3 bg-white px-4 py-3 hover:shadow-sm" style={{ border: "1px solid #E5E7EB" }} data-testid={`play-ladder-${l.id}`}>
                    <span className="min-w-0"><span className="block font-semibold text-sm truncate" style={{ color: "#1D1D1D" }}>{l.name}</span><span className="block text-xs" style={{ color: "#6B7280" }}>{l.city} · {l.sport} {l.format} · {l.participants} in{l.my_rank ? ` · you are #${l.my_rank}` : ""}{l.is_owner ? " · you run it" : ""}</span></span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold shrink-0" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
