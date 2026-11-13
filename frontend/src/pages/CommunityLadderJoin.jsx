import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { apiError } from "../utils/challengeUi";
import { clearPendingLadder, entrantWord, methodLabel } from "../utils/ladderUi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const box = { border: "1px solid #E5E7EB" };
const muted = { color: "#6B7280" };

/** Where invitation emails and share links land. Works before sign-up: the token waits in the browser through registration. */
export default function CommunityLadderJoin() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [partner, setPartner] = useState(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  useDocumentMeta({ title: "Join a Ladder | VENLAX Sports", description: "You have been invited to a VENLAX ladder.", noindex: true });

  useEffect(() => {
    if (!token) { setError("This invitation link is incomplete."); return; }
    axios.get(`${API}/community-ladders/invites/preview`, { params: { token } })
      .then((r) => setInfo(r.data))
      .catch((e) => setError(apiError(e, "This invitation is not valid any more.")));
  }, [token]);

  useEffect(() => {
    if (info?.format !== "doubles" || q.trim().length < 2 || !user) { setHits([]); return undefined; }
    const t = setTimeout(() => {
      axios.get(`${API}/challenges/players`, { params: { q: q.trim(), sport: info.sport, limit: 6 }, withCredentials: true })
        .then((r) => setHits(r.data)).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, info, user]);

  const keepToken = () => { try { localStorage.setItem("ladder_invite_token", token); } catch { /* private mode: the link still works if they come back to it */ } };

  const answer = async (action) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/community-ladders/join-with-token`, { token, action, partner_id: partner?.id }, { withCredentials: true });
      clearPendingLadder();
      navigate(action === "decline" ? "/play" : `/community-ladders/${data.id}`);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const doubles = info?.format === "doubles";
  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-12" style={{ background: "#F9FAFB" }}>
      <div className="bg-white w-full max-w-lg p-6" style={box} data-testid="ladder-join-card">
        {!info && !error && <p className="text-sm" style={muted}>Loading...</p>}
        {error && !info && <p className="text-sm" style={{ color: "#B42318" }} role="alert" data-testid="ladder-join-error">{error}</p>}
        {info && (
          <>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#008F70" }}>You are invited</p>
            <h1 className="font-heading font-bold text-2xl mt-1" style={{ color: "#1D1D1D" }} data-testid="ladder-join-name">{info.name}</h1>
            <p className="text-sm mt-1" style={muted}>
              {info.sport[0].toUpperCase() + info.sport.slice(1)} {info.format} · {info.division_label} · {info.city} · run by {info.owner_name}
            </p>
            <p className="text-sm mt-3" style={{ color: "#374151" }}>
              {info.participants} of {info.max_participants} {entrantWord(info.format)} so far. Ranked by {methodLabel(info.ranking_method)}. Challenge anyone on the ladder; every verified result updates the standings.
            </p>
            {!user && !loading ? (
              <div className="mt-5" data-testid="ladder-join-signed-out">
                <p className="text-sm mb-3" style={{ color: "#374151" }}>Create a free VENLAX account (or log in) to join. We will bring you straight back here.</p>
                <div className="flex gap-3 flex-wrap">
                  <Link to="/auth?mode=register" onClick={keepToken} className="px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ background: "#008F70", color: "#fff" }} data-testid="ladder-join-signup">Sign up to join</Link>
                  <Link to="/auth" onClick={keepToken} className="px-5 py-3 text-xs font-bold uppercase tracking-wider" style={box} data-testid="ladder-join-login">I have an account</Link>
                </div>
              </div>
            ) : user ? (
              <div className="mt-5">
                {doubles && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold mb-1">Your doubles partner</p>
                    {partner ? (
                      <div className="flex items-center justify-between px-3 py-2" style={box}>
                        <span className="text-sm">{partner.name}</span>
                        <button onClick={() => setPartner(null)} className="text-xs font-semibold" style={{ color: "#008F70" }}>Change</button>
                      </div>
                    ) : (
                      <>
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a player by name" aria-label="Search your partner" className="px-3 py-2 text-sm w-full" style={box} data-testid="ladder-join-partner-search" />
                        {hits.length > 0 && <ul className="mt-1" style={box}>{hits.map((h) => <li key={h.id}><button onClick={() => { setPartner(h); setHits([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" data-testid={`ladder-join-partner-${h.id}`}>{h.name} <span className="text-xs" style={muted}>{h.city}</span></button></li>)}</ul>}
                      </>
                    )}
                  </div>
                )}
                {error && <p className="text-sm mb-3" style={{ color: "#B42318" }} role="alert" data-testid="ladder-join-error">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => answer("accept")} disabled={busy || (doubles && !partner)} className="px-5 py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: "#008F70", color: "#fff" }} data-testid="ladder-join-accept">Join the ladder</button>
                  {info.invite && <button onClick={() => answer("decline")} disabled={busy} className="px-5 py-3 text-xs font-bold uppercase tracking-wider" style={box} data-testid="ladder-join-decline">No thanks</button>}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
