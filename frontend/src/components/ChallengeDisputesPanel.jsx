import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { apiError, fmtWhen, scoreText, sideNames, sportLabel } from "../utils/challengeUi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const box = { border: "1px solid #E5E7EB" };

/** Admin: direct challenges whose score one player disputed. Shows nothing when there are none. */
export default function ChallengeDisputesPanel() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [fix, setFix] = useState({});

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/direct-challenges`, { withCredentials: true });
      setRows(data);
    } catch { /* optional panel: stay hidden if it cannot load */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id, action, sets) => {
    setBusy(id);
    setMsg("");
    try {
      await axios.post(`${API}/admin/direct-challenges/${id}/resolve`, { action, sets }, { withCredentials: true });
      setMsg(action === "void" ? "Match voided." : "Result settled.");
      await load();
    } catch (e) {
      setMsg(apiError(e));
    } finally {
      setBusy("");
    }
  };

  const parseSets = (text) => text.split(",").map((t) => t.trim()).filter(Boolean).map((t) => {
    const [a, b] = t.split("-").map((n) => parseInt(n, 10));
    return { a, b };
  });

  if (rows.length === 0 && !msg) return null;
  return (
    <div className="mb-6 bg-white overflow-hidden" style={box} data-testid="challenge-disputes-panel">
      <div className="p-5" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <h2 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Disputed challenge scores ({rows.length})</h2>
        <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Friendly matches only. A dispute never counts for either player until you settle it.</p>
      </div>
      {msg && <p className="px-5 pt-3 text-sm" role="status" data-testid="challenge-disputes-msg">{msg}</p>}
      {rows.map((c) => (
        <div key={c.id} className="p-5" style={{ borderTop: "1px solid #F3F4F6" }} data-testid={`dispute-${c.id}`}>
          <p className="font-semibold text-sm">{sideNames(c.sides[0])} vs {sideNames(c.sides[1])} <span className="text-xs font-normal" style={{ color: "#6B7280" }}>{sportLabel(c)} · {fmtWhen(c.scheduled_at)}</span></p>
          <p className="text-sm mt-1">Entered score: <span className="font-mono font-bold">{scoreText(c.result, 1)}</span> <span className="text-xs" style={{ color: "#6B7280" }}>({sideNames(c.sides[0])} first)</span></p>
          <p className="text-sm mt-1" style={{ color: "#B42318" }}>Dispute: {c.dispute?.reason}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button onClick={() => resolve(c.id, "confirm")} disabled={busy === c.id} className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50" style={{ background: "#008F70" }} data-testid={`dispute-keep-${c.id}`}>Keep entered score</button>
            <input value={fix[c.id] || ""} onChange={(e) => setFix((f) => ({ ...f, [c.id]: e.target.value }))} placeholder={`Corrected: 6-4, 3-6, 6-2`} aria-label="Corrected score" className="px-3 py-2 text-sm w-48" style={box} data-testid={`dispute-fix-input-${c.id}`} />
            <button onClick={() => resolve(c.id, "set_score", parseSets(fix[c.id] || ""))} disabled={busy === c.id || !(fix[c.id] || "").trim()} className="px-3 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid={`dispute-fix-${c.id}`}>Use corrected score</button>
            <button onClick={() => window.confirm("Void this match? It will not count for either player.") && resolve(c.id, "void")} disabled={busy === c.id} className="px-3 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50" style={box} data-testid={`dispute-void-${c.id}`}>Void match</button>
          </div>
        </div>
      ))}
    </div>
  );
}
