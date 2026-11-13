import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { apiError } from "../utils/challengeUi";
import { OPEN_STATUS, fmtDay } from "../utils/openChallengeUi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/** Admin moderation of the Open Challenge Board: reported posts first, with remove / dismiss. */
export default function OpenChallengesPanel() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/admin/open-challenges`, { withCredentials: true }); setRows(data); } catch { /* optional panel */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (id, action, body = {}) => {
    setMsg("");
    try { await axios.post(`${API}/admin/open-challenges/${id}/${action}`, body, { withCredentials: true }); setMsg("Done."); await load(); } catch (e) { setMsg(apiError(e)); }
  };
  const remove = (r) => {
    const reason = window.prompt(`Remove ${r.owner_name}'s challenge? Reason (the player sees it):`, "Does not follow the community guidelines");
    if (reason !== null) run(r.id, "remove", { reason });
  };

  if (rows.length === 0) return null;
  return (
    <div className="bg-white overflow-hidden mt-6" style={{ border: "1px solid #E5E7EB" }} data-testid="open-challenges-panel">
      <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <h3 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Open challenge board</h3>
        <span className="text-sm" style={{ color: "#6B7280" }}>{rows.filter((r) => r.reports > 0).length} reported · {rows.length} total</span>
      </div>
      {msg && <p className="px-5 pt-3 text-sm" role="status" data-testid="open-panel-msg">{msg}</p>}
      <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
        {rows.slice(0, 50).map((r) => {
          const s = OPEN_STATUS[r.status] || OPEN_STATUS.open;
          const live = ["draft", "open", "paused", "accepted"].includes(r.status);
          return (
            <div key={r.id} className="px-5 py-4 flex items-start justify-between gap-3 flex-wrap" data-testid={`open-row-${r.id}`}>
              <div className="min-w-0">
                <p className="font-medium" style={{ color: "#3D3D3D" }}>{r.owner_name} · {r.sport} {r.format} <span className="ml-2 px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                  {r.reports > 0 && <span className="ml-2 px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: "#B42318" }}>{r.reports} report{r.reports > 1 ? "s" : ""}</span>}</p>
                <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{r.city} · {fmtDay(r.date)}{r.notes ? ` · "${r.notes}"` : ""}</p>
                {r.report_reasons.map((x, i) => <p key={i} className="text-xs mt-0.5" style={{ color: "#B42318" }}>Report: {x}</p>)}
              </div>
              <div className="flex gap-3 items-center">
                {r.reports > 0 && <button onClick={() => run(r.id, "dismiss-reports")} className="text-xs font-semibold underline" data-testid={`open-dismiss-${r.id}`}>Dismiss</button>}
                {live && <button onClick={() => remove(r)} className="text-xs font-semibold underline" style={{ color: "#B42318" }} data-testid={`open-remove-${r.id}`}>Remove</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
