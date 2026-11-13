import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Swords } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { apiError, clearChallengeInvite, rememberChallengeInvite } from "../utils/challengeUi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const btn = "px-5 py-3 text-xs font-bold uppercase tracking-wider";

/** Where the email link lands. Signed out: the challenge teaser and sign-up (which returns here). Signed in: the invite becomes a challenge. */
export default function ChallengeInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const claiming = useRef(false);
  useDocumentMeta({ title: "You have been challenged | VENLAX Sports", description: "Someone challenged you to a match on VENLAX Sports.", noindex: true });

  useEffect(() => {
    if (!token) { setInfo({ valid: false, reason: "This invitation link is not valid." }); return; }
    axios.get(`${API}/challenges/email-invites/preview`, { params: { token } })
      .then((r) => setInfo(r.data)).catch(() => setInfo({ valid: false, reason: "We could not load this invitation. Try again." }));
  }, [token]);

  // Signed in: turn the invitation into a real challenge and open it.
  useEffect(() => {
    if (loading || !user || !token || claiming.current) return;
    claiming.current = true;
    axios.post(`${API}/challenges/email-invites/claim`, { token }, { withCredentials: true })
      .then((r) => { clearChallengeInvite(); navigate(`/challenges/${r.data.challenge_id}`, { replace: true }); })
      .catch((e) => { clearChallengeInvite(); setError(apiError(e, "Could not open this challenge.")); });
  }, [user, loading, token, navigate]);

  const go = (path) => { rememberChallengeInvite(token); navigate(path); };
  const sport = info?.sport ? `${info.sport[0].toUpperCase()}${info.sport.slice(1)} ${info.format}` : "";

  return (
    <div className="min-h-screen" style={{ background: "#F9FAFB" }}>
      <div className="max-w-xl mx-auto px-4 py-12" data-testid="challenge-invite">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#008F70" }}>Play & Compete</p>
        <div className="bg-white p-6 mt-2" style={{ border: "1px solid #E5E7EB" }}>
          {!info && <p className="text-sm" style={{ color: "#6B7280" }}>Loading...</p>}
          {info && !info.valid && (
            <div data-testid="invite-invalid">
              <h1 className="font-heading font-bold text-2xl" style={{ color: "#1D1D1D" }}>{info.reason}</h1>
              <Link to={user ? "/challenges" : "/auth?mode=register"} className={`${btn} inline-block mt-5`} style={{ background: "#F2A922", color: "#1D1D1D" }}>{user ? "Go to my challenges" : "Join VenLax Sports"}</Link>
            </div>
          )}
          {info?.valid && (
            <>
              <div className="flex items-center gap-3">
                <span className="inline-flex w-12 h-12 items-center justify-center shrink-0" style={{ background: "#F2A922" }}><Swords className="w-6 h-6" style={{ color: "#1D1D1D" }} aria-hidden="true" /></span>
                <div>
                  <h1 className="font-heading font-bold text-2xl leading-tight" style={{ color: "#1D1D1D" }}>{info.sender_first_name} challenged you</h1>
                  <p className="text-sm" style={{ color: "#008F70" }}>{sport}</p>
                </div>
              </div>
              {info.message && <p className="mt-4 px-4 py-3 text-sm italic" style={{ background: "#F1F1F1", border: "1px solid #E5E7EB" }}>"{info.message}"</p>}
              {error ? (
                <p className="mt-5 text-sm" style={{ color: "#B42318" }} role="alert" data-testid="invite-error">{error} <Link to="/challenges" className="underline font-semibold">Go to my challenges</Link></p>
              ) : user ? (
                <p className="mt-5 text-sm" style={{ color: "#4C4C4C" }} data-testid="invite-opening">Opening your challenge...</p>
              ) : info.claimable ? (
                <div className="mt-6">
                  <p className="text-sm font-semibold" style={{ color: "#1D1D1D" }}>VenLax Sports is free to join. Create your account and you come straight back to accept it.</p>
                  <div className="flex flex-wrap gap-3 mt-4">
                    <button onClick={() => go("/auth?mode=register")} className={btn} style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="invite-register">Create free account</button>
                    <button onClick={() => go("/auth")} className={btn} style={{ border: "1px solid #1D1D1D" }} data-testid="invite-login">I already have one</button>
                  </div>
                </div>
              ) : <p className="mt-5 text-sm font-semibold" style={{ color: "#B42318" }} data-testid="invite-unavailable">{info.reason}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
