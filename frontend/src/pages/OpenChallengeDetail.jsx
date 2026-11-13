import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { apiError } from "../utils/challengeUi";
import {
  clearPendingOpenChallenge, fmtDay, levelRange, rememberOpenChallenge, shareText, shareUrl, windowLabel,
} from "../utils/openChallengeUi";
import { AcceptDialog, Avatar, OpenChallengeCard } from "../components/OpenChallengeParts";
import OpenChallengeForm from "../components/OpenChallengeForm";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const btn = "px-4 py-2.5 text-xs font-bold uppercase tracking-wider";

function SharePanel({ c }) {
  const [emails, setEmails] = useState("");
  const [msg, setMsg] = useState("");
  const url = shareUrl(c.id);
  const text = shareText(c);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setMsg("Link copied."); } catch { setMsg(url); }
  };
  const native = () => navigator.share?.({ title: "VENLAX challenge", text, url }).catch(() => {});
  const send = async () => {
    setMsg("");
    try {
      const list = emails.split(/[\s,;]+/).filter(Boolean);
      const { data } = await axios.post(`${API}/open-challenges/${c.id}/share`, { emails: list }, { withCredentials: true });
      setMsg(`Sent to ${data.sent} ${data.sent === 1 ? "person" : "people"}.`);
      setEmails("");
    } catch (e) { setMsg(apiError(e)); }
  };
  const enc = encodeURIComponent;
  return (
    <section className="bg-white p-5 mt-6" style={{ border: "1px solid #E5E7EB" }} data-testid="share-panel">
      <h2 className="font-heading font-bold text-lg" style={{ color: "#1D1D1D" }}>Invite friends to take it</h2>
      <p className="text-sm mt-1" style={{ color: "#4C4C4C" }}>Anyone with the link sees the match. New players sign up and land right back here.</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={copy} className={btn} style={{ border: "1px solid #1D1D1D" }} data-testid="share-copy">Copy link</button>
        {typeof navigator !== "undefined" && navigator.share && <button onClick={native} className={btn} style={{ border: "1px solid #1D1D1D" }} data-testid="share-native">Share...</button>}
        <a href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" className={btn} style={{ border: "1px solid #1D1D1D" }} data-testid="share-whatsapp">WhatsApp</a>
        <a href={`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer" className={btn} style={{ border: "1px solid #1D1D1D" }} data-testid="share-x">X</a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer" className={btn} style={{ border: "1px solid #1D1D1D" }} data-testid="share-facebook">Facebook</a>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="friend@example.com, another@example.com" className="flex-1 px-3 py-2 text-sm" style={{ border: "1px solid #E5E7EB" }} aria-label="Friends' email addresses" data-testid="share-emails" />
        <button onClick={send} disabled={!emails.trim()} className={`${btn} disabled:opacity-50`} style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="share-send">Email invites</button>
      </div>
      {msg && <p className="text-sm mt-2" role="status" data-testid="share-msg">{msg}</p>}
    </section>
  );
}

/** One open challenge. Signed out it is the public landing page: a teaser plus sign-up that returns here. */
export default function OpenChallengeDetail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [c, setC] = useState(null);
  const [preview, setPreview] = useState(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useDocumentMeta({
    title: preview ? `${preview.sport[0].toUpperCase()}${preview.sport.slice(1)} ${preview.format} in ${preview.city || "your area"} | VENLAX Sports` : "Open challenge | VENLAX Sports",
    description: "Someone near you is looking for a match. Accept the challenge on VENLAX Sports.",
    noindex: true,
  });

  const load = useCallback(async () => {
    try {
      if (user) {
        try {
          const { data } = await axios.get(`${API}/open-challenges/${id}`, { withCredentials: true });
          setC(data);
          clearPendingOpenChallenge();
          return;
        } catch { /* not allowed to see the full card: fall back to the public teaser */ }
      }
      const { data } = await axios.get(`${API}/open-challenges/public/${id}`, { withCredentials: true });
      setPreview(data);
    } catch { setMissing(true); }
  }, [id, user]);
  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const act = async (action, body = {}) => {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await axios.post(`${API}/open-challenges/${id}/${action}`, body, { withCredentials: true });
      setC(data);
    } catch (e) { setMsg(apiError(e)); }
    setBusy(false);
  };
  const report = async () => {
    const reason = window.prompt("What is wrong with this challenge?");
    if (!reason) return;
    try { await axios.post(`${API}/open-challenges/${id}/report`, { reason }, { withCredentials: true }); setMsg("Thanks. An admin will review it."); } catch (e) { setMsg(apiError(e)); }
  };
  const block = async () => {
    if (!window.confirm(`Block ${c.owner.name}? You will not see each other's challenges.`)) return;
    try { await axios.post(`${API}/open-challenges/blocks/${c.owner.id}`, {}, { withCredentials: true }); navigate("/find-opponent"); } catch (e) { setMsg(apiError(e)); }
  };
  const goAuth = (mode) => { rememberOpenChallenge(id); navigate(mode === "register" ? "/auth?mode=register" : "/auth"); };

  if (missing) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#F9FAFB" }}>
        <div className="text-center max-w-sm" data-testid="open-missing">
          <h1 className="font-heading font-bold text-2xl" style={{ color: "#1D1D1D" }}>This challenge is no longer here</h1>
          <p className="text-sm mt-2" style={{ color: "#4C4C4C" }}>It may have been taken, withdrawn or expired.</p>
          <Link to={user ? "/find-opponent" : "/auth?mode=register"} className={`${btn} inline-block mt-5`} style={{ background: "#F2A922", color: "#1D1D1D" }}>{user ? "Find another opponent" : "Join VENLAX Sports"}</Link>
        </div>
      </div>
    );
  }

  // Signed out (or the full card is not available): the teaser.
  if (!c && preview) {
    return (
      <div className="min-h-screen" style={{ background: "#F9FAFB" }}>
        <div className="max-w-xl mx-auto px-4 py-12" data-testid="open-public">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#008F70" }}>Open challenge</p>
          <div className="bg-white p-6 mt-2" style={{ border: "1px solid #E5E7EB" }}>
            <div className="flex items-center gap-3"><Avatar owner={{ name: preview.owner_first_name, avatar: preview.avatar }} size={52} />
              <div><p className="font-heading font-bold text-xl" style={{ color: "#1D1D1D" }}>{preview.owner_first_name} wants a match</p>
                <p className="text-sm" style={{ color: "#008F70" }}>{preview.sport[0].toUpperCase()}{preview.sport.slice(1)} {preview.format}</p></div></div>
            <p className="text-sm mt-4" style={{ color: "#4C4C4C" }}>{preview.city} · {fmtDay(preview.date)}, {windowLabel(preview.time_window).toLowerCase()} · opponent level {levelRange(preview)}</p>
            {preview.available ? (
              user ? <p className="text-sm mt-5" style={{ color: "#8A5A00" }}>Your skill level is outside this challenge's range, so you cannot accept it. <Link to="/find-opponent" className="underline font-semibold">See challenges for you</Link>.</p> : (
                <div className="mt-6">
                  <p className="text-sm font-semibold" style={{ color: "#1D1D1D" }}>Free to join. Sign up and you come straight back to accept it.</p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <button onClick={() => goAuth("register")} className={btn} style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="public-register">Create free account</button>
                    <button onClick={() => goAuth("login")} className={btn} style={{ border: "1px solid #1D1D1D" }} data-testid="public-login">I already have one</button>
                  </div>
                </div>
              )
            ) : <p className="text-sm mt-5 font-semibold" style={{ color: "#B42318" }} data-testid="public-unavailable">This challenge has been taken or is no longer available.</p>}
          </div>
        </div>
      </div>
    );
  }

  if (!c) return <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: "#6B7280" }}>Loading...</div>;

  return (
    <div className="min-h-screen" style={{ background: "#F9FAFB" }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/find-opponent" className="text-sm font-semibold underline" data-testid="back-to-board">All open challenges</Link>
        <div className="mt-4">
          {editing ? (
            <OpenChallengeForm initial={c} onCancel={() => setEditing(false)} onSaved={(d) => { setC(d); setEditing(false); setMsg("Saved."); }} />
          ) : <OpenChallengeCard c={c} onAccept={() => setAccepting(true)} />}
        </div>
        {msg && <p className="mt-4 text-sm" role="status" data-testid="detail-msg">{msg}</p>}

        {!editing && (
          <div className="flex flex-wrap gap-2 mt-4" data-testid="owner-actions">
            {c.can.publish && <button disabled={busy} onClick={() => act("publish")} className={btn} style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="act-publish">Publish</button>}
            {c.can.edit && <button onClick={() => setEditing(true)} className={btn} style={{ border: "1px solid #1D1D1D" }} data-testid="act-edit">Edit</button>}
            {c.can.pause && <button disabled={busy} onClick={() => act("pause")} className={btn} style={{ border: "1px solid #1D1D1D" }} data-testid="act-pause">Pause</button>}
            {c.can.resume && <button disabled={busy} onClick={() => act("resume")} className={btn} style={{ border: "1px solid #1D1D1D" }} data-testid="act-resume">Resume</button>}
            {c.can.edit && <button disabled={busy} onClick={() => act("close")} className={btn} style={{ border: "1px solid #1D1D1D" }} data-testid="act-close">Close</button>}
            {c.can.cancel && <button disabled={busy} onClick={() => window.confirm("Cancel this challenge?") && act("cancel")} className={btn} style={{ border: "1px solid #B42318", color: "#B42318" }} data-testid="act-cancel">Cancel</button>}
          </div>
        )}

        {c.accepted_by && <p className="mt-4 text-sm" style={{ color: "#4C4C4C" }} data-testid="accepted-by">Accepted by {c.accepted_by}. {c.challenge_id && <Link to={`/challenges/${c.challenge_id}`} className="underline font-semibold">Agree a time and enter the score</Link>}</p>}
        {c.can.share && <SharePanel c={c} />}

        {!c.is_mine && (
          <div className="flex gap-4 mt-6 text-xs">
            {c.can.report && <button onClick={report} className="underline" style={{ color: "#6B7280" }} data-testid="act-report">Report this challenge</button>}
            {c.can.block && <button onClick={block} className="underline" style={{ color: "#6B7280" }} data-testid="act-block">Block {c.owner.name}</button>}
          </div>
        )}
      </div>
      {accepting && <AcceptDialog challenge={c} onClose={() => { setAccepting(false); load(); }} onDone={(d) => navigate(`/challenges/${d.challenge_id}`)} />}
    </div>
  );
}
