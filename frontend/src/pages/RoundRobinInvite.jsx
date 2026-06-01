import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Trophy, AlertCircle } from "lucide-react";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function RoundRobinInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  useEffect(() => {
    fetchInvite();
  }, [token]);

  useEffect(() => {
    if (user) fetchInvite();
  }, [user]);

  const fetchInvite = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/round-robin/invite/${token}`);
      setInvite(data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.detail || "Invalid or expired invite link.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!user) {
      navigate(`/auth?next=/round-robin/invite/${token}`);
      return;
    }
    setAccepting(true);
    try {
      const res = await axios.post(
        `${API}/round-robin/invite/${token}/accept`,
        { waiver_accepted: waiverAccepted },
        { withCredentials: true }
      );
      setAccepted(true);
      setTimeout(() => navigate(`/round-robin/${res.data.league_id}`), 1500);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to accept invite.");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading invite...</div>;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
          <h1 className="font-bold text-gray-900 text-lg mb-2">Invite Unavailable</h1>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <p className="text-xs text-gray-400">Contact your inviter to send a new invite link.</p>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <Trophy size={40} className="text-emerald-500 mx-auto mb-4" />
          <h1 className="font-bold text-gray-900 text-lg mb-2">You're in!</h1>
          <p className="text-gray-500 text-sm">Redirecting to league...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-4">{invite?.sport === "tennis" ? "🎾" : "🏓"}</div>
        <h1 className="font-black text-gray-900 text-xl mb-1">You're invited!</h1>
        <p className="text-gray-500 text-sm mb-6">
          <strong>{invite?.inviter_name}</strong> wants you as their doubles partner
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">League</span>
            <span className="font-medium text-gray-900">{invite?.league_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Sport</span>
            <span className="font-medium text-gray-900">{invite?.sport?.toUpperCase()}</span>
          </div>
        </div>

        {!user ? (
          <div>
            <p className="text-sm text-gray-500 mb-4">Log in or create an account to accept this invite.</p>
            <Link
              to={`/auth?next=/round-robin/invite/${token}`}
              data-testid="btn-login-to-accept"
              className="block w-full bg-[#1B2B4B] text-white rounded-md py-2.5 text-sm font-bold hover:bg-[#142040] transition text-center"
            >
              Log in to accept
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer bg-amber-50 border border-amber-200 rounded-xl px-3 py-3" data-testid="rr-waiver-checkbox-label">
              <input
                type="checkbox"
                checked={waiverAccepted}
                onChange={(e) => setWaiverAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-black flex-shrink-0"
                data-testid="rr-waiver-checkbox"
              />
              <span className="text-[11px] text-amber-900 leading-relaxed">
                I have read and agree to the{" "}
                <a href="/terms#waiver" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-amber-700">
                  Liability Waiver & Assumption of Risk
                </a>
                . I understand that matches are unsupervised, courts are player-selected, and I participate at my own risk.
              </span>
            </label>
            <button
              data-testid="btn-accept-invite"
              onClick={handleAccept}
              disabled={accepting || !waiverAccepted}
              className="w-full bg-[#1B2B4B] text-white rounded-md py-2.5 text-sm font-bold hover:bg-[#142040] transition disabled:opacity-50"
            >
              {accepting ? "Accepting..." : "Accept & Join as Partner"}
            </button>
          </div>
        )}
        {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
      </div>
    </div>
  );
}
