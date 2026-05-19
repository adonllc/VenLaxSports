import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../contexts/AuthContext";
import { Trophy, AlertCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RoundRobinInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

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
        {},
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
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Entry fee</span>
            <span className="font-medium text-gray-900">
              {invite?.entry_fee > 0 ? `$${invite.entry_fee}` : "Free"}
            </span>
          </div>
        </div>

        {!user ? (
          <div>
            <p className="text-sm text-gray-500 mb-4">Log in or create an account to accept this invite.</p>
            <Link
              to={`/auth?next=/round-robin/invite/${token}`}
              data-testid="btn-login-to-accept"
              className="block w-full bg-black text-white rounded-md py-2.5 text-sm font-bold hover:bg-gray-800 transition text-center"
            >
              Log in to accept
            </Link>
          </div>
        ) : (
          <button
            data-testid="btn-accept-invite"
            onClick={handleAccept}
            disabled={accepting}
            className="w-full bg-black text-white rounded-md py-2.5 text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {accepting ? "Accepting..." : "Accept & Join as Partner"}
          </button>
        )}
        {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
      </div>
    </div>
  );
}
