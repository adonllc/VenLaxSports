import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { apiError } from "../utils/challengeUi";
import { LADDER_STATUS, methodLabel } from "../utils/ladderUi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const box = { border: "1px solid #E5E7EB" };

/** Admin: every player-created ladder, with the moderation controls. Admins keep global control. */
export default function CommunityLaddersPanel() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/community-ladders/admin/all`, { withCredentials: true });
      setRows(data);
    } catch { /* optional panel */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (id, action, body = {}) => {
    setBusy(id);
    setMsg("");
    try {
      await axios.post(`${API}/community-ladders/${id}/${action}`, body, { withCredentials: true });
      setMsg(`Done: ${action}.`);
      await load();
    } catch (e) {
      setMsg(apiError(e));
    } finally {
      setBusy("");
    }
  };

  if (rows.length === 0) return null;
  return (
    <div className="bg-white overflow-hidden mt-6" style={box} data-testid="community-ladders-panel">
      <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <h3 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Community ladders</h3>
        <span className="text-sm" style={{ color: "#6B7280" }}>{rows.length} total</span>
      </div>
      {msg && <p className="px-5 pt-3 text-sm" role="status" data-testid="community-ladders-msg">{msg}</p>}
      <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
        {rows.map((l) => {
          const s = LADDER_STATUS[l.status] || LADDER_STATUS.active;
          return (
            <div key={l.id} className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap" data-testid={`community-ladder-${l.id}`}>
              <div className="min-w-0">
                <p className="font-medium" style={{ color: "#3D3D3D" }}>{l.name} <span className="ml-2 px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.fg }}>{s.label}</span></p>
                <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{l.owner_name} · {l.city} · {l.sport} {l.format} · {methodLabel(l.ranking_method)} · {l.visibility} · {l.participants}/{l.max_participants}</p>
              </div>
              <div className="flex gap-3 items-center">
                <a href={`/community-ladders/${l.id}`} className="text-xs font-semibold hover:underline" style={{ color: "#B7791F" }} data-testid={`community-ladder-view-${l.id}`}>View</a>
                {l.status === "active" && <button onClick={() => run(l.id, "pause")} disabled={busy === l.id} className="text-xs font-semibold underline" data-testid={`community-ladder-pause-${l.id}`}>Pause</button>}
                {l.status === "paused" && <button onClick={() => run(l.id, "resume")} disabled={busy === l.id} className="text-xs font-semibold underline" data-testid={`community-ladder-resume-${l.id}`}>Resume</button>}
                {["active", "paused"].includes(l.status) && <button onClick={() => window.confirm(`Close "${l.name}"?`) && run(l.id, "close", { reason: "closed by an admin" })} disabled={busy === l.id} className="text-xs font-semibold underline" style={{ color: "#B42318" }} data-testid={`community-ladder-close-${l.id}`}>Close</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
