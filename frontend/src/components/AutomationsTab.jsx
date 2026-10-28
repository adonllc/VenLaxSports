import { useEffect, useState } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/admin/automations`;
const GREEN = "#008F70";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const field = "w-full px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400";
const fieldStyle = { border: `1px solid ${BORDER}` };
const SEGMENTS = [["all", "Everyone"], ["no_league", "Not in a league"], ["in_league", "In a league"]];
const RUN_TEXT = { sent: "Sent", failed: "Failed to send", exited: "Left out" };

const blank = { name: "", trigger: "signup", delay_hours: 24, segment: "all", city: "", exit_on_league: false, template: "", subject: "", body: "", cta_label: "", cta_url: "" };

function Label({ children }) {
  return <label className="block text-xs font-semibold mb-1" style={{ color: "#4C4C4C" }}>{children}</label>;
}

export default function AutomationsTab() {
  const [data, setData] = useState({ workflows: [], triggers: {}, templates: [] });
  const [form, setForm] = useState(null);       // null = closed, {id?, ...fields}
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(null);       // workflow id whose history is shown
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = () => axios.get(API, { withCredentials: true }).then((r) => setData(r.data)).catch(() => setMsg({ ok: false, text: "Could not load automations" }));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const body = () => ({
    name: form.name, trigger: form.trigger, delay_hours: Number(form.delay_hours), exit_on_league: form.exit_on_league,
    conditions: { segment: form.segment, city: form.city.trim() || null },
    email: form.template ? { template: form.template } : { subject: form.subject, body: form.body, cta_label: form.cta_label.trim() || null, cta_url: form.cta_url.trim() || null },
  });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (form.id) await axios.put(`${API}/${form.id}`, body(), { withCredentials: true });
      else await axios.post(API, body(), { withCredentials: true });
      setForm(null);
      setMsg({ ok: true, text: "Saved. It is switched off until you turn it on." });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.detail || "Could not save" });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (w) => {
    const on = !w.enabled;
    if (on && !window.confirm(`Turn on "${w.name}"?\n\nIt will email players when "${data.triggers[w.trigger]}" happens from now on, after a ${w.delay_hours} hour wait. It does not email anyone from the past.`)) return;
    try {
      await axios.post(`${API}/${w.id}/${on ? "enable" : "disable"}`, {}, { withCredentials: true });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.detail || "That did not work" });
    }
  };

  const edit = (w) => setForm({
    id: w.id, name: w.name, trigger: w.trigger, delay_hours: w.delay_hours, segment: w.conditions?.segment || "all", city: w.conditions?.city || "",
    exit_on_league: !!w.exit_on_league, template: w.email?.template || "", subject: w.email?.subject || "", body: w.email?.body || "",
    cta_label: w.email?.cta_label || "", cta_url: w.email?.cta_url || "",
  });

  const showHistory = async (w) => {
    if (open === w.id) { setOpen(null); return; }
    const r = await axios.get(`${API}/${w.id}/history`, { withCredentials: true }).catch(() => null);
    setRuns(r?.data.runs || []);
    setOpen(w.id);
  };

  const custom = form && !form.template;

  return (
    <div className="space-y-6" data-testid="automations-tab">
      <div className="bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Automations</h2>
            <p className="text-xs mt-1" style={{ color: MUTED }}>
              When something happens to a player, wait, then send one email. A workflow only acts on events after you turn it on, never on past sign-ups.
              Players who unsubscribed, are suspended, or already got that email are left out. At most one automation email per player per day.
            </p>
          </div>
          {!form && <button onClick={() => setForm({ ...blank })} className="px-4 py-2 text-sm font-semibold text-white whitespace-nowrap" style={{ background: GREEN }} data-testid="automation-new">New workflow</button>}
        </div>
        {msg && <p className="mt-3 text-sm" role={msg.ok ? "status" : "alert"} style={{ color: msg.ok ? "#00765C" : "#DC2626" }}>{msg.text}</p>}
      </div>

      {form && (
        <form onSubmit={save} className="bg-white p-5 space-y-4" style={{ border: `1px solid ${BORDER}` }} data-testid="automation-form">
          <h3 className="font-heading font-bold text-base" style={{ color: "#3D3D3D" }}>{form.id ? "Edit workflow" : "New workflow"}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <input className={field} style={fieldStyle} value={form.name} onChange={set("name")} maxLength={80} required data-testid="automation-name" />
            </div>
            <div>
              <Label>When</Label>
              <select className={field} style={fieldStyle} value={form.trigger} onChange={set("trigger")} data-testid="automation-trigger">
                {Object.entries(data.triggers).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label>Wait this many hours first (0 to {data.max_delay_hours})</Label>
              <input type="number" min={0} max={data.max_delay_hours} className={field} style={fieldStyle} value={form.delay_hours} onChange={set("delay_hours")} data-testid="automation-delay" />
            </div>
            <div>
              <Label>Only send to</Label>
              <select className={field} style={fieldStyle} value={form.segment} onChange={set("segment")} data-testid="automation-segment">
                {SEGMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label>City (optional)</Label>
              <input className={field} style={fieldStyle} value={form.city} onChange={set("city")} placeholder="Atlanta" data-testid="automation-city" />
            </div>
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input type="checkbox" checked={form.exit_on_league} onChange={set("exit_on_league")} data-testid="automation-exit-league" />
              Stop if they join a league while waiting
            </label>
          </div>

          <div>
            <Label>Email</Label>
            <select className={field} style={fieldStyle} value={form.template} onChange={set("template")} data-testid="automation-template">
              {data.templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              <option value="">Write my own</option>
            </select>
          </div>
          {custom && (
            <div className="space-y-3">
              <div><Label>Subject</Label><input className={field} style={fieldStyle} value={form.subject} onChange={set("subject")} maxLength={150} data-testid="automation-subject" /></div>
              <div><Label>Message ({"{name}"} becomes the first name)</Label><textarea className={field} style={fieldStyle} rows={6} value={form.body} onChange={set("body")} maxLength={5000} data-testid="automation-body" /></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>Button text (optional)</Label><input className={field} style={fieldStyle} value={form.cta_label} onChange={set("cta_label")} /></div>
                <div><Label>Button link (venlaxsports.com only)</Label><input className={field} style={fieldStyle} value={form.cta_url} onChange={set("cta_url")} placeholder="https://venlaxsports.com/leagues" /></div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button disabled={busy} className="px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: GREEN }} data-testid="automation-save">{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2 text-sm bg-white text-gray-900" style={{ border: `1px solid ${BORDER}` }}>Cancel</button>
          </div>
        </form>
      )}

      {data.workflows.length === 0 && !form && <p className="text-sm" style={{ color: MUTED }}>No workflows yet.</p>}
      {data.workflows.map((w) => (
        <div key={w.id} className="bg-white p-5" style={{ border: `1px solid ${BORDER}` }} data-testid={`automation-${w.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-heading font-bold text-base" style={{ color: "#3D3D3D" }}>
                {w.name}
                <span className="ml-2 text-xs px-2 py-1 font-semibold" style={w.enabled ? { background: "#DCFCE7", color: "#166534" } : { background: "#F3F4F6", color: "#4C4C4C" }}>{w.enabled ? "On" : "Off"}</span>
              </h3>
              <p className="text-sm mt-1" style={{ color: "#4C4C4C" }}>
                {data.triggers[w.trigger] || w.trigger}, wait {w.delay_hours}h, then send {w.email?.template ? (data.templates.find((t) => t.id === w.email.template)?.label || w.email.template) : `"${w.email?.subject}"`}.
              </p>
              <p className="text-xs mt-1" style={{ color: MUTED }}>
                Sent {w.stats.sent} · left out {w.stats.exited} · failed {w.stats.failed}
                {w.enabled && w.enabled_at ? ` · acting on events since ${new Date(w.enabled_at).toLocaleString()}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => toggle(w)} className="px-3 py-1.5 text-sm font-semibold text-white" style={{ background: w.enabled ? "#B45309" : GREEN }} data-testid={`automation-toggle-${w.id}`}>{w.enabled ? "Turn off" : "Turn on"}</button>
              {!w.enabled && <button onClick={() => edit(w)} className="px-3 py-1.5 text-sm bg-white text-gray-900" style={{ border: `1px solid ${BORDER}` }} data-testid={`automation-edit-${w.id}`}>Edit</button>}
              <button onClick={() => showHistory(w)} className="px-3 py-1.5 text-sm bg-white text-gray-900" style={{ border: `1px solid ${BORDER}` }} data-testid={`automation-history-${w.id}`}>{open === w.id ? "Hide history" : "History"}</button>
            </div>
          </div>
          {open === w.id && (
            <div className="mt-4 overflow-x-auto">
              {runs.length === 0 ? <p className="text-sm" style={{ color: MUTED }}>Nothing has happened yet.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase" style={{ color: MUTED }}><th className="py-2 pr-4">When</th><th className="py-2 pr-4">Player</th><th className="py-2 pr-4">Result</th><th className="py-2">Why</th></tr></thead>
                  <tbody>
                    {runs.map((r, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #F3F4F6" }}>
                        <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                        <td className="py-2 pr-4">{r.email}</td>
                        <td className="py-2 pr-4">{RUN_TEXT[r.status] || r.status}</td>
                        <td className="py-2" style={{ color: MUTED }}>{r.reason || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
