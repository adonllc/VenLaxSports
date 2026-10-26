import { useEffect, useState } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/admin/ambassadors`;
const fieldStyle = { border: "1px solid #E5E7EB" };

export default function AmbassadorsCard() {
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  const load = () => axios.get(API, { withCredentials: true }).then((r) => setRows(r.data.ambassadors)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await axios.post(API, { email, code, label }, { withCredentials: true });
      setMsg({ ok: true, text: `Done. Their link: ${data.link}` });
      setEmail(""); setCode(""); setLabel("");
      load();
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.detail || "Could not save. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Stop listing ${row.name} as an ambassador? Their code ${row.code} keeps working.`)) return;
    await axios.delete(`${API}/${row.user_id}`, { withCredentials: true }).catch(() => {});
    load();
  };

  const copy = (row) => {
    navigator.clipboard.writeText(row.link).then(() => {
      setCopied(row.user_id);
      setTimeout(() => setCopied(""), 1500);
    }).catch(() => {});
  };

  return (
    <div className="bg-white" style={{ border: "1px solid #E5E7EB" }} data-testid="ambassadors-card">
      <div className="p-5" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <h2 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Ambassadors</h2>
        <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
          A local person or club with a memorable referral code. They register first, then you give their account a code. Signups use the normal $5 / $5 referral rules: credit is paid only after the new player's first confirmed match.
        </p>
      </div>

      <form onSubmit={add} className="p-5 grid sm:grid-cols-4 gap-3 items-end" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "#4C4C4C" }}>Their account email</label>
          <input required type="email" className="w-full px-3 py-2 text-sm" style={fieldStyle} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="ambassador-email" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "#4C4C4C" }}>Code (3 to 20 letters, numbers, _)</label>
          <input required className="w-full px-3 py-2 text-sm uppercase" style={fieldStyle} value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} placeholder="ATLCLUB" data-testid="ambassador-code" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "#4C4C4C" }}>Club or name (optional)</label>
          <input className="w-full px-3 py-2 text-sm" style={fieldStyle} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} data-testid="ambassador-label" />
        </div>
        <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#008F70" }} data-testid="ambassador-save">
          {busy ? "Saving…" : "Make ambassador"}
        </button>
      </form>
      {msg && <p className="px-5 pt-3 text-sm break-all" role={msg.ok ? "status" : "alert"} style={{ color: msg.ok ? "#00765C" : "#DC2626" }}>{msg.text}</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto p-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase" style={{ color: "#6B7280" }}>
                <th className="px-3 py-2">Ambassador</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Signups</th><th className="px-3 py-2">Played a match</th><th className="px-3 py-2">Waiting</th><th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} style={{ borderTop: "1px solid #F3F4F6" }}>
                  <td className="px-3 py-2">{r.label || r.name}<div className="text-xs" style={{ color: "#6B7280" }}>{r.email}</div></td>
                  <td className="px-3 py-2 font-mono">{r.code}</td>
                  <td className="px-3 py-2">{r.signups}</td>
                  <td className="px-3 py-2">{r.first_match_played}</td>
                  <td className="px-3 py-2">{r.waiting}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => copy(r)} className="text-xs px-2 py-1 mr-2" style={{ color: "#B7791F", border: "1px solid #E5A885" }}>{copied === r.user_id ? "Copied" : "Copy link"}</button>
                    <button onClick={() => remove(r)} className="text-xs text-red-500 px-2 py-1" style={{ border: "1px solid #FECACA" }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
