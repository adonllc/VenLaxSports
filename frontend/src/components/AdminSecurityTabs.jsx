import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/admin`;
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const PAGE = 50;

const input = "px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400";
const inputStyle = { border: `1px solid ${BORDER}` };

const short = (v) => (v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v));
const when = (iso) => (iso ? new Date(iso).toLocaleString() : "");

function Diff({ before, after }) {
  if (!before && !after) return <span style={{ color: MUTED }}>-</span>;
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  return (
    <div className="space-y-0.5">
      {keys.map((k) => (
        <div key={k} className="text-xs break-words">
          <span className="font-semibold">{k}:</span>{" "}
          {before && k in before && <span style={{ color: "#B91C1C" }}>{short(before[k])}</span>}
          {before && k in before && after && k in after && " → "}
          {after && k in after && <span style={{ color: "#00765C" }}>{short(after[k])}</span>}
        </div>
      ))}
    </div>
  );
}

export function AuditLogTab() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${API}/audit-log`, {
        params: { action: action.trim(), target_type: targetType, skip, limit: PAGE },
        withCredentials: true,
      });
      setRows(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e.response?.data?.detail || "Could not load the audit log");
    } finally {
      setLoading(false);
    }
  }, [action, targetType, skip]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4" data-testid="audit-log-tab">
      <div>
        <h2 className="font-heading font-bold text-xl" style={{ color: "#3D3D3D" }}>Audit log</h2>
        <p className="text-sm" style={{ color: MUTED }}>Who did what, and when. Entries cannot be edited or deleted. {total} total.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className={input} style={inputStyle} placeholder="Action, e.g. player.delete" value={action}
               onChange={(e) => { setSkip(0); setAction(e.target.value); }} data-testid="audit-filter-action" />
        <select className={input} style={inputStyle} value={targetType}
                onChange={(e) => { setSkip(0); setTargetType(e.target.value); }} data-testid="audit-filter-type">
          <option value="">All records</option>
          {["user", "league", "match", "payment", "players", "campaign", "feature_flags"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {error && <div className="px-4 py-3 text-sm" style={{ background: "#FEE2E2", color: "#B91C1C" }} role="alert">{error}</div>}
      <div className="overflow-x-auto" style={{ border: `1px solid ${BORDER}` }}>
        <table className="w-full text-sm">
          <thead style={{ background: "#F1F1F1" }}>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: MUTED }}>
              <th className="px-3 py-2">When</th><th className="px-3 py-2">Admin</th><th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Record</th><th className="px-3 py-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-3 py-6 text-center" style={{ color: MUTED }}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center" style={{ color: MUTED }}>Nothing recorded yet.</td></tr>}
            {!loading && rows.map((r) => (
              <tr key={r.id} className="align-top" style={{ borderTop: `1px solid ${BORDER}` }} data-testid={`audit-row-${r.id}`}>
                <td className="px-3 py-2 whitespace-nowrap">{when(r.at)}</td>
                <td className="px-3 py-2">{r.admin_email}<div className="text-xs" style={{ color: MUTED }}>{r.admin_role}</div></td>
                <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.action}</td>
                <td className="px-3 py-2">{r.target_label || r.target_id}<div className="text-xs" style={{ color: MUTED }}>{r.target_type}</div></td>
                <td className="px-3 py-2"><Diff before={r.before} after={r.after} />{r.meta && <div className="text-xs" style={{ color: MUTED }}>{short(r.meta)}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm" style={{ color: MUTED }}>
        <span>{total === 0 ? "" : `${skip + 1}-${Math.min(skip + PAGE, total)} of ${total}`}</span>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-white disabled:opacity-40" style={inputStyle} disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))} data-testid="audit-prev">Newer</button>
          <button className="px-3 py-1.5 bg-white disabled:opacity-40" style={inputStyle} disabled={skip + PAGE >= total} onClick={() => setSkip(skip + PAGE)} data-testid="audit-next">Older</button>
        </div>
      </div>
    </div>
  );
}

export function TeamTab() {
  const [team, setTeam] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/team`, { withCredentials: true });
      setTeam(data);
    } catch (e) {
      setError(e.response?.data?.detail || "Could not load the team");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const change = async (a, role) => {
    const label = team.roles.find((r) => r.id === role)?.label;
    if (!window.confirm(`Change ${a.email} to ${label}? This is recorded in the audit log.`)) return;
    setSaving(a.id);
    setError("");
    try {
      await axios.put(`${API}/team/${a.id}/role`, { admin_role: role }, { withCredentials: true });
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not change the role");
    } finally {
      setSaving("");
    }
  };

  if (!team) return <p className="text-sm" style={{ color: error ? "#B91C1C" : MUTED }}>{error || "Loading…"}</p>;
  return (
    <div className="space-y-4" data-testid="team-tab">
      <div>
        <h2 className="font-heading font-bold text-xl" style={{ color: "#3D3D3D" }}>Team and roles</h2>
        <p className="text-sm" style={{ color: MUTED }}>Each administrator gets only what their role needs. Checked on the server, not just hidden in the screen.</p>
      </div>
      {error && <div className="px-4 py-3 text-sm" style={{ background: "#FEE2E2", color: "#B91C1C" }} role="alert">{error}</div>}
      <div className="overflow-x-auto" style={{ border: `1px solid ${BORDER}` }}>
        <table className="w-full text-sm">
          <thead style={{ background: "#F1F1F1" }}>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: MUTED }}>
              <th className="px-3 py-2">Administrator</th><th className="px-3 py-2">Account type</th><th className="px-3 py-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {team.admins.map((a) => (
              <tr key={a.id} style={{ borderTop: `1px solid ${BORDER}` }} data-testid={`team-row-${a.id}`}>
                <td className="px-3 py-2">{a.name}<div className="text-xs" style={{ color: MUTED }}>{a.email}</div></td>
                <td className="px-3 py-2">{a.base_role}</td>
                <td className="px-3 py-2">
                  {a.base_role === "admin" ? (
                    <select className={input} style={inputStyle} value={a.effective_role} disabled={saving === a.id}
                            onChange={(e) => change(a, e.target.value)} data-testid={`team-role-${a.id}`}>
                      {team.roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  ) : (
                    <span>League administrator <span className="text-xs" style={{ color: MUTED }}>(fixed for city admins)</span></span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">What each role can do</summary>
        <ul className="mt-2 space-y-2">
          {team.roles.map((r) => (
            <li key={r.id}><span className="font-semibold">{r.label}:</span> <span style={{ color: MUTED }}>{r.permissions.join(", ")}</span></li>
          ))}
        </ul>
      </details>
    </div>
  );
}
