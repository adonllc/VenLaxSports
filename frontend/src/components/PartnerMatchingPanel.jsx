import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const GAPS = [
  { value: 0, label: "Exact level" },
  { value: 0.5, label: "Within ±0.5" },
  { value: 1, label: "Within ±1.0" },
];
const SCORING = [
  { key: "location", label: "Same zip / city" },
  { key: "play_profile", label: "Court side / availability" },
];
const box = { border: "1px solid #E5E7EB" };
const head = { color: "#6B7280" };

function Person({ p }) {
  return (
    <div>
      <p className="text-sm font-medium">{p.name} <span className="text-xs" style={head}>L{p.level.toFixed(1)}</span></p>
      <p className="text-xs" style={head}>
        {p.email}{p.city ? ` · ${p.city}` : ""}{p.zip_code ? ` ${p.zip_code}` : ""}{p.paid ? " · paid" : ""}
      </p>
    </div>
  );
}

/** Admin: suggested partner pairs for opted-in waiting teams, refunds owed, and partner change requests. */
export default function PartnerMatchingPanel() {
  const [gap, setGap] = useState(0);
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState({});
  const [refunds, setRefunds] = useState([]);
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [scoring, setScoring] = useState({ location: false, play_profile: false });

  const load = useCallback(async () => {
    try {
      const opts = { withCredentials: true };
      const [m, r, c, sc] = await Promise.all([
        axios.get(`${API}/admin/partner-matches`, { params: { max_gap: gap }, ...opts }),
        axios.get(`${API}/admin/partner-matches/refund-due`, opts),
        axios.get(`${API}/admin/partner-change-requests`, opts),
        axios.get(`${API}/admin/partner-matches/scoring`, opts),
      ]);
      setData(m.data);
      setScoring(sc.data);
      setRefunds(r.data.rows);
      setRequests(c.data.rows);
      setPicked({});
    } catch {
      setMsg("Could not load partner matching.");
    }
  }, [gap]);

  useEffect(() => { load(); }, [load]);

  const key = (p) => `${p.token_a}|${p.token_b}`;
  const chosen = Object.keys(picked).filter((k) => picked[k]);
  const allPairs = (data?.leagues || []).flatMap((l) => l.pairs);

  const assign = async () => {
    if (!chosen.length) return;
    setBusy(true);
    setMsg("");
    try {
      const pairs = chosen.map((k) => { const [token_a, token_b] = k.split("|"); return { token_a, token_b }; });
      const { data: out } = await axios.post(`${API}/admin/partner-matches/assign`, { pairs }, { withCredentials: true });
      const ok = out.results.filter((r) => r.ok).length;
      const failed = out.results.filter((r) => !r.ok);
      setMsg(`Assigned ${ok} team${ok === 1 ? "" : "s"}.${failed.length ? ` Skipped ${failed.length}: ${failed.map((f) => f.error).join("; ")}` : ""}`);
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "Could not assign.");
    } finally {
      setBusy(false);
    }
  };

  const toggleScoring = async (name, on) => {
    const next = { ...scoring, [name]: on };
    setMsg("");
    try {
      const { data: out } = await axios.put(`${API}/admin/partner-matches/scoring`, next, { withCredentials: true });
      setScoring(out);
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "Could not change the scoring.");
    }
  };

  const markRefunded = async (token) => {
    try {
      await axios.post(`${API}/admin/partner-matches/${token}/mark-refunded`, {}, { withCredentials: true });
      setRefunds((rows) => rows.filter((r) => r.token !== token));
    } catch (e) {
      setMsg(e.response?.data?.detail || "Could not update.");
    }
  };

  const resolve = async (token, action) => {
    try {
      const { data: out } = await axios.post(`${API}/admin/partner-change-requests/${token}/resolve`, { action }, { withCredentials: true });
      setMsg(out.repay_required ? "Approved. One player was already refunded and must pay again to be matched." : action === "approve" ? "Approved. Both players are back on the waiting list." : "Declined.");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "Could not resolve.");
    }
  };

  return (
    <div className="mb-6 bg-white rounded-none overflow-hidden" style={box} data-testid="partner-matching-panel">
      <div className="p-5 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <div>
          <h2 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Auto-assign partners</h2>
          <p className="text-xs mt-1" style={head}>Only players who agreed to be paired by VenLax appear here. You confirm every pair.</p>
        </div>
        <label className="text-xs flex items-center gap-2" style={head}>
          Level match
          <select value={gap} onChange={(e) => setGap(Number(e.target.value))} className="px-2 py-1.5 text-sm" style={box} data-testid="partner-gap-select">
            {GAPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </label>
        <div className="basis-full flex flex-wrap items-center gap-x-5 gap-y-1 text-xs" style={head} data-testid="partner-scoring">
          <span>Also score pairs by:</span>
          {SCORING.map((f) => (
            <label key={f.key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-[#008F70]" checked={!!scoring[f.key]} onChange={(e) => toggleScoring(f.key, e.target.checked)} data-testid={`partner-scoring-${f.key}`} />
              {f.label}
            </label>
          ))}
          <span>(Level is always scored.)</span>
        </div>
      </div>

      {msg && <p className="px-5 pt-3 text-sm" style={{ color: "#374151" }} role="status" data-testid="partner-matching-msg">{msg}</p>}

      {data && data.leagues.length === 0 && (
        <p className="p-5 text-sm" style={head}>No opted-in players are waiting for a partner.</p>
      )}

      {(data?.leagues || []).map((lg) => (
        <div key={lg.league_id} className="p-5" style={{ borderTop: "1px solid #F3F4F6" }} data-testid={`partner-league-${lg.league_id}`}>
          <p className="font-semibold text-sm">{lg.league_name} <span className="text-xs font-normal" style={head}>starts {lg.start_date} · {lg.spots_left} spots left</span></p>
          {lg.pairs.length === 0 ? (
            <p className="text-sm mt-2" style={head}>No pairs at this level setting.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {lg.pairs.map((p) => (
                <label key={key(p)} className="flex items-start gap-3 p-3 cursor-pointer" style={box}>
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#008F70]" checked={!!picked[key(p)]} onChange={(e) => setPicked((s) => ({ ...s, [key(p)]: e.target.checked }))} data-testid={`pair-${p.token_a}`} />
                  <div className="grid sm:grid-cols-2 gap-3 flex-1 min-w-0">
                    <Person p={p.a} />
                    <Person p={p.b} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: "#008F70" }}>{p.score}</p>
                    <p className="text-[11px]" style={head}>{p.gap === 0 ? "same level" : `±${p.gap}`}</p>
                  </div>
                  <div className="basis-full flex flex-wrap gap-1.5 pl-7">
                    {p.reasons.map((r) => <span key={r} className="px-2 py-0.5 text-[11px]" style={{ background: "#F1F1F1", color: "#374151" }}>{r}</span>)}
                  </div>
                </label>
              ))}
            </div>
          )}
          {lg.unmatched.length > 0 && (
            <ul className="mt-3 text-xs space-y-1" style={head}>
              {lg.unmatched.map((u) => <li key={u.token}><strong style={{ color: "#374151" }}>{u.name}</strong> (L{u.level.toFixed(1)}): {u.reason}</li>)}
            </ul>
          )}
          {lg.skipped.length > 0 && (
            <ul className="mt-2 text-xs space-y-1" style={head}>
              {lg.skipped.map((s) => <li key={s.name}>{s.name}: {s.reason}</li>)}
            </ul>
          )}
        </div>
      ))}

      {allPairs.length > 0 && (
        <div className="p-5 flex flex-wrap items-center gap-3" style={{ borderTop: "1px solid #F3F4F6" }}>
          <button onClick={() => setPicked(Object.fromEntries(allPairs.map((p) => [key(p), true])))} className="text-xs font-semibold" style={{ color: "#008F70" }} data-testid="select-all-pairs">Select all</button>
          <button onClick={assign} disabled={busy || !chosen.length} className="px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-50" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="assign-selected-btn">
            {busy ? "Assigning..." : `Assign selected (${chosen.length})`}
          </button>
        </div>
      )}

      {requests.length > 0 && (
        <div className="p-5" style={{ borderTop: "1px solid #F3F4F6" }} data-testid="change-requests">
          <h3 className="font-semibold text-sm mb-2">Partner change requests ({requests.length})</h3>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.token} className="p-3 flex flex-wrap items-center justify-between gap-3" style={box}>
                <div className="text-sm">
                  <p><strong>{r.player_a}</strong> + <strong>{r.player_b}</strong> <span className="text-xs" style={head}>· {r.league_name} · starts {r.start_date}</span></p>
                  <p className="text-xs" style={head}>Asked by {r.requested_by}{r.reason ? `: "${r.reason}"` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => resolve(r.token, "approve")} className="px-3 py-1.5 text-xs font-bold" style={{ background: "#008F70", color: "#fff" }} data-testid={`approve-${r.token}`}>Approve</button>
                  <button onClick={() => resolve(r.token, "decline")} className="px-3 py-1.5 text-xs font-bold" style={{ border: "1px solid #E5E7EB" }} data-testid={`decline-${r.token}`}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {refunds.length > 0 && (
        <div className="p-5" style={{ borderTop: "1px solid #F3F4F6" }} data-testid="refund-due">
          <h3 className="font-semibold text-sm mb-1">Refund due ({refunds.length})</h3>
          <p className="text-xs mb-2" style={head}>These players paid for a team that was merged into another. Refund them in Stripe, then mark it done.</p>
          <div className="space-y-2">
            {refunds.map((r) => (
              <div key={r.token} className="p-3 flex flex-wrap items-center justify-between gap-3" style={box}>
                <p className="text-sm">{r.player_name} <span className="text-xs" style={head}>{r.player_email} · {r.league_name} · now teamed with {r.team_with} · ${r.amount.toFixed(2)}</span></p>
                <button onClick={() => markRefunded(r.token)} className="px-3 py-1.5 text-xs font-bold" style={{ border: "1px solid #008F70", color: "#008F70" }} data-testid={`mark-refunded-${r.token}`}>Mark refunded</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
