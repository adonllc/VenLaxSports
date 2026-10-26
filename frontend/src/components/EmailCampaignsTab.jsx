import { useEffect, useRef, useState } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/admin/email`;
const GREEN = "#008F70";

const AUDIENCES = [
  { id: "early_1", label: "Early list: step 1, season starts" },
  { id: "early_2", label: "Early list: step 2, refer a friend" },
  { id: "early_3", label: "Early list: step 3, registration closes" },
  { id: "registered", label: "Registered users" },
];
const SEGMENTS = [
  { id: "all", label: "All registered users" },
  { id: "no_league", label: "Not in a league yet" },
  { id: "in_league", label: "In a league" },
];

const field = "w-full px-3 py-2 text-sm bg-white";
const fieldStyle = { border: "1px solid #E5E7EB" };

function Label({ children }) {
  return <label className="block text-xs font-semibold mb-1" style={{ color: "#4C4C4C" }}>{children}</label>;
}

export default function EmailCampaignsTab() {
  const [templates, setTemplates] = useState([]);
  const [audience, setAudience] = useState("early_1");
  const [template, setTemplate] = useState("season_starts");
  const [segment, setSegment] = useState("all");
  const [who, setWho] = useState("segment"); // "segment" = everyone matching, "pick" = chosen players only
  const [picked, setPicked] = useState([]);
  const [find, setFind] = useState("");
  const [found, setFound] = useState([]);
  const [city, setCity] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null); // { ok, text }
  const [job, setJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const timer = useRef(null);

  const registered = audience === "registered";
  const custom = registered && template === "custom";

  const payload = () => {
    if (!registered) return { audience: "early_list", step: Number(audience.split("_")[1]) };
    const base = { audience: "registered", segment, city: city.trim() || null, user_ids: who === "pick" ? picked.map((p) => p.id) : null };
    if (!custom) return { ...base, template };
    return { ...base, subject, body, cta_label: ctaLabel.trim() || null, cta_url: ctaUrl.trim() || null };
  };

  const loadJobs = () => axios.get(`${API}/jobs`, { withCredentials: true }).then((r) => setJobs(r.data.jobs)).catch(() => {});

  useEffect(() => {
    axios.get(`${API}/templates`, { withCredentials: true }).then((r) => setTemplates(r.data.templates)).catch(() => {});
    loadJobs();
    return () => clearTimeout(timer.current);
  }, []);

  // any edit makes the previous preview stale: it must be shown again before sending
  useEffect(() => { setPreview(null); }, [audience, template, segment, city, subject, body, ctaLabel, ctaUrl, who, picked]);

  // search for players to pick
  useEffect(() => {
    if (who !== "pick" || find.trim().length < 2) { setFound([]); return undefined; }
    const t = setTimeout(() => {
      axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/admin/players`, { params: { q: find.trim(), limit: 8 }, withCredentials: true })
        .then((r) => setFound(r.data.players)).catch(() => setFound([]));
    }, 250);
    return () => clearTimeout(t);
  }, [find, who]);

  const call = async (name, path, extra = {}) => {
    setBusy(name);
    setMsg(null);
    try {
      const { data } = await axios.post(`${API}/${path}`, { ...payload(), ...extra }, { withCredentials: true });
      return data;
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.detail || "Something went wrong. Please try again." });
      return null;
    } finally {
      setBusy("");
    }
  };

  const doPreview = async () => {
    const data = await call("preview", "preview");
    if (data) setPreview(data);
  };

  const doTest = async () => {
    const data = await call("test", "test");
    if (data) setMsg({ ok: true, text: `Test email sent to ${data.sent_to}.` });
  };

  const poll = (id) => {
    axios.get(`${API}/jobs/${id}`, { withCredentials: true }).then((r) => {
      setJob(r.data);
      if (r.data.status === "running") timer.current = setTimeout(() => poll(id), 2000);
      else loadJobs();
    }).catch(() => {});
  };

  const doSend = async () => {
    if (!preview) return;
    if (!window.confirm(`Send "${preview.subject}" to ${preview.recipients} people now? This cannot be undone.`)) return;
    const data = await call("send", "send", { confirm_count: preview.recipients });
    if (data) {
      setPreview(null);
      setJob({ status: "running", total: data.total, sent: 0, failed: 0 });
      poll(data.job_id);
    }
  };

  return (
    <div className="space-y-6" data-testid="email-tab">
      <div className="bg-white p-5" style={{ border: "1px solid #E5E7EB" }}>
        <h2 className="font-heading font-bold text-lg mb-1" style={{ color: "#3D3D3D" }}>Send an email</h2>
        <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
          Preview first, send a test to yourself, then send. Each person gets a given email once. People who unsubscribed are never emailed.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Who</Label>
            <select className={field} style={fieldStyle} value={audience} onChange={(e) => setAudience(e.target.value)} data-testid="email-audience">
              {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>

          {registered && (
            <div>
              <Label>Email</Label>
              <select className={field} style={fieldStyle} value={template} onChange={(e) => setTemplate(e.target.value)} data-testid="email-template">
                {templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                <option value="custom">Write my own</option>
              </select>
            </div>
          )}

          {registered && (
            <div className="sm:col-span-2">
              <Label>Send to</Label>
              <div className="flex flex-wrap gap-4 text-sm" role="radiogroup" aria-label="Send to">
                {[["segment", "Everyone matching the segment and city below"], ["pick", "Only players I pick"]].map(([v, label]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="who" checked={who === v} onChange={() => setWho(v)} data-testid={`email-who-${v}`} /> {label}
                  </label>
                ))}
              </div>
              {who === "pick" && (
                <div className="mt-3">
                  <input className={field} style={fieldStyle} value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search a player by name or email" data-testid="email-find" />
                  {found.length > 0 && (
                    <ul className="mt-1 bg-white" style={{ border: "1px solid #E5E7EB" }}>
                      {found.filter((f) => !picked.some((p) => p.id === f.id)).map((f) => (
                        <li key={f.id}>
                          <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setPicked([...picked, { id: f.id, name: f.name, email: f.email }]); setFind(""); }} data-testid={`email-pick-${f.id}`}>
                            {f.name} <span style={{ color: "#6B7280" }}>{f.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2" data-testid="email-picked">
                    {picked.map((p) => (
                      <span key={p.id} className="text-xs px-2 py-1" style={{ background: "#E8F6F2", color: "#00765C" }}>
                        {p.name}
                        <button type="button" className="ml-2" aria-label={`Remove ${p.name}`} onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}>✕</button>
                      </span>
                    ))}
                    {picked.length === 0 && <span className="text-xs" style={{ color: "#6B7280" }}>Nobody picked yet. Search above and click a name.</span>}
                  </div>
                </div>
              )}
              {template === "thank_you" && (
                <p className="mt-3 text-xs" style={{ color: "#4C4C4C" }} data-testid="email-coupon-note">
                  Each person gets their own $10 code, made when you send. It works once, only for them, and expires 12 months after it is made. The preview and the test email show an example code that works nowhere.
                </p>
              )}
            </div>
          )}

          {registered && (
            <>
              <div>
                <Label>Segment</Label>
                <select className={field} style={fieldStyle} value={segment} onChange={(e) => setSegment(e.target.value)} data-testid="email-segment">
                  {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <Label>City (optional)</Label>
                <input className={field} style={fieldStyle} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Atlanta" data-testid="email-city" />
              </div>
            </>
          )}
        </div>

        {custom && (
          <div className="mt-4 space-y-3">
            <div>
              <Label>Subject</Label>
              <input className={field} style={fieldStyle} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} data-testid="email-subject" />
            </div>
            <div>
              <Label>Message (plain text, a blank line starts a new paragraph, {"{name}"} becomes the first name)</Label>
              <textarea className={field} style={fieldStyle} rows={7} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} data-testid="email-body" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Button text (optional)</Label>
                <input className={field} style={fieldStyle} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} data-testid="email-cta-label" />
              </div>
              <div>
                <Label>Button link (venlaxsports.com only)</Label>
                <input className={field} style={fieldStyle} value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://venlaxsports.com/leagues" data-testid="email-cta-url" />
              </div>
            </div>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              Only state facts that are true on the site. No made-up counts or urgency.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={doPreview} disabled={!!busy || (registered && who === "pick" && picked.length === 0)} className="px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: GREEN }} data-testid="email-preview">
            {busy === "preview" ? "Checking…" : "Preview"}
          </button>
          <button onClick={doTest} disabled={!!busy} className="px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ border: `1px solid ${GREEN}`, color: GREEN }} data-testid="email-test">
            {busy === "test" ? "Sending…" : "Send test to me"}
          </button>
        </div>

        {msg && (
          <p className="mt-3 text-sm" role={msg.ok ? "status" : "alert"} style={{ color: msg.ok ? "#00765C" : "#DC2626" }}>{msg.text}</p>
        )}
      </div>

      {preview && (
        <div className="bg-white p-5" style={{ border: "1px solid #E5E7EB" }} data-testid="email-preview-panel">
          <h3 className="font-heading font-bold text-base mb-1" style={{ color: "#3D3D3D" }}>{preview.subject}</h3>
          <p className="text-sm" style={{ color: "#4C4C4C" }}>
            <strong>{preview.recipients}</strong> people will get this.
            {preview.sample_emails.length > 0 && <> For example: {preview.sample_emails.join(", ")}.</>}
          </p>
          <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
            Skipped: {Object.entries(preview.skipped).map(([k, v]) => `${v} ${k}`).join(", ")}
          </p>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview.html}
            className="w-full mt-4 bg-white"
            style={{ border: "1px solid #E5E7EB", height: 520 }}
          />
          {preview.over_limit ? (
            <p className="mt-3 text-sm text-red-600">Too many people for one send. Narrow it with the segment or city.</p>
          ) : (
            <button
              onClick={doSend}
              disabled={!!busy || preview.recipients === 0}
              className="mt-4 px-5 py-2.5 text-sm font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ background: "#F2A922", color: "#3D3D3D" }}
              data-testid="email-send"
            >
              {busy === "send" ? "Starting…" : `Send to ${preview.recipients} people`}
            </button>
          )}
        </div>
      )}

      {job && (
        <div className="bg-white p-5" style={{ border: "1px solid #E5E7EB" }} data-testid="email-job">
          <p className="text-sm font-semibold" style={{ color: "#3D3D3D" }}>
            {job.status === "running" ? "Sending…" : "Finished"}: {job.sent} sent{job.failed ? `, ${job.failed} failed` : ""} of {job.total}
          </p>
          {job.status !== "running" && job.failed > 0 && (
            <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Failed ones were not recorded. Preview and send again to retry only them.</p>
          )}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="bg-white" style={{ border: "1px solid #E5E7EB" }}>
          <h3 className="font-heading font-bold text-base p-5 pb-3" style={{ color: "#3D3D3D" }}>Recent sends</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase" style={{ color: "#6B7280" }}>
                  <th className="px-5 py-2">When</th><th className="px-5 py-2">Email</th><th className="px-5 py-2">Sent</th><th className="px-5 py-2">Failed</th><th className="px-5 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                    <td className="px-5 py-2 whitespace-nowrap">{new Date(j.started_at).toLocaleString()}</td>
                    <td className="px-5 py-2">{j.subject}</td>
                    <td className="px-5 py-2">{j.sent}/{j.total}</td>
                    <td className="px-5 py-2">{j.failed}</td>
                    <td className="px-5 py-2">{j.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
