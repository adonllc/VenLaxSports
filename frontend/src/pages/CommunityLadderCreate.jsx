import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { SPORTS, apiError } from "../utils/challengeUi";
import { DIVISIONS, DURATIONS, METHODS, SIZES, entrantWord } from "../utils/ladderUi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const box = { border: "1px solid #E5E7EB" };
const muted = { color: "#6B7280" };
const field = "px-3 py-2.5 text-sm bg-white w-full";

function Row({ label, hint, children, htmlFor }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1" style={{ color: "#1D1D1D" }} htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="text-xs mt-1" style={muted}>{hint}</p>}
    </div>
  );
}

function Choice({ options, value, onChange, testid }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className="px-4 py-2 text-sm font-semibold" data-testid={`${testid}-${o.value}`}
          style={value === o.value ? { background: "#008F70", color: "#fff", border: "1px solid #008F70" } : { background: "#fff", color: "#374151", border: "1px solid #E5E7EB" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Step 1: set the ladder up. It is saved as a draft the creator reviews and publishes on the next screen. */
export default function CommunityLadderCreate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useDocumentMeta({ title: "Create Your Own Ladder | VENLAX Sports", description: "Start a ladder, invite friends, and let VENLAX keep the rankings.", noindex: true });
  const [f, setF] = useState({
    name: "", sport: "tennis", format: "singles", division_label: "Intermediate", city: "", zip_code: "",
    max_participants: 8, visibility: "public", join_mode: "open", ranking_method: "leapfrog", duration_days: 60, description: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    setF((s) => (s.city ? s : { ...s, city: user.city || "", zip_code: user.zip_code || "" }));
  }, [user, loading, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/community-ladders`, { ...f, zip_code: f.zip_code.trim() || undefined, description: f.description.trim() || undefined }, { withCredentials: true });
      navigate(`/community-ladders/${data.id}`);
    } catch (err) {
      setError(apiError(err, "Could not save the ladder."));
    } finally {
      setBusy(false);
    }
  };

  const method = METHODS.find((m) => m.value === f.ranking_method);
  return (
    <div className="min-h-screen" style={{ background: "#F9FAFB" }}>
      <form onSubmit={submit} className="max-w-2xl mx-auto px-4 sm:px-6 py-8" data-testid="ladder-create-form">
        <Link to="/play" className="text-xs font-semibold" style={{ color: "#008F70" }}>Play & Compete</Link>
        <h1 className="font-heading font-bold text-3xl mt-1" style={{ color: "#1D1D1D" }}>Create your own ladder</h1>
        <p className="text-sm mt-1" style={muted}>Set the rules, invite your friends, and VENLAX keeps the rankings. No admin needed. You review everything before it goes live.</p>

        <div className="bg-white p-5 mt-6 space-y-5" style={box}>
          <Row label="Ladder name" htmlFor="ladder-name">
            <input id="ladder-name" value={f.name} onChange={(e) => set("name")(e.target.value)} maxLength={60} placeholder="Saturday Social Ladder" required className={field} style={box} data-testid="ladder-name" />
          </Row>
          <Row label="Sport"><Choice options={SPORTS} value={f.sport} onChange={set("sport")} testid="ladder-sport" /></Row>
          <Row label="Format" hint={f.format === "doubles" ? "Teams of two. Each team is one place on the ladder." : "One player per place."}>
            <Choice options={[{ value: "singles", label: "Singles" }, { value: "doubles", label: "Doubles" }]} value={f.format} onChange={set("format")} testid="ladder-format" />
          </Row>
          <Row label="Skill level" htmlFor="ladder-skill" hint="A guide for who should join.">
            <select id="ladder-skill" value={f.division_label} onChange={(e) => set("division_label")(e.target.value)} className={field} style={box} data-testid="ladder-skill">
              {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Row>
          <div className="grid sm:grid-cols-2 gap-5">
            <Row label="City" htmlFor="ladder-city"><input id="ladder-city" value={f.city} onChange={(e) => set("city")(e.target.value)} required className={field} style={box} data-testid="ladder-city" /></Row>
            <Row label="ZIP code (optional)" htmlFor="ladder-zip"><input id="ladder-zip" value={f.zip_code} onChange={(e) => set("zip_code")(e.target.value)} className={field} style={box} data-testid="ladder-zip" /></Row>
          </div>
          <Row label={`Maximum ${entrantWord(f.format)}`}>
            <Choice options={SIZES.map((n) => ({ value: n, label: String(n) }))} value={f.max_participants} onChange={set("max_participants")} testid="ladder-size" />
          </Row>
          <Row label="Ranking method" hint={method?.help}>
            <Choice options={METHODS} value={f.ranking_method} onChange={set("ranking_method")} testid="ladder-method" />
          </Row>
          <Row label="Competition length" hint="The ladder finishes after this long and the final standings are kept.">
            <Choice options={DURATIONS.map((n) => ({ value: n, label: `${n} days` }))} value={f.duration_days} onChange={set("duration_days")} testid="ladder-duration" />
          </Row>
          <Row label="Who can find it" hint={f.visibility === "public" ? "Listed on the ladders page. Anyone nearby can see the standings." : "Hidden. Only people you invite, or who have your link, can see it."}>
            <Choice options={[{ value: "public", label: "Public" }, { value: "private", label: "Private" }]} value={f.visibility} onChange={set("visibility")} testid="ladder-visibility" />
          </Row>
          {f.visibility === "public" && (
            <Row label="How people join" hint="Open: anyone can join. Approval: you accept each request.">
              <Choice options={[{ value: "open", label: "Open" }, { value: "approval", label: "I approve each one" }]} value={f.join_mode} onChange={set("join_mode")} testid="ladder-joinmode" />
            </Row>
          )}
          <Row label="Match scheduling"><p className="text-sm" style={{ color: "#374151" }} data-testid="ladder-scheduling">Flexible: players agree their own date, time and court.</p></Row>
          <Row label="About this ladder (optional)" htmlFor="ladder-desc">
            <textarea id="ladder-desc" value={f.description} onChange={(e) => set("description")(e.target.value)} maxLength={500} rows={3} className={field} style={box} data-testid="ladder-description" />
          </Row>
        </div>

        {error && <p className="text-sm mt-4" style={{ color: "#B42318" }} role="alert" data-testid="ladder-create-error">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={busy} className="px-5 py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: "#008F70", color: "#fff" }} data-testid="ladder-create-submit">
            {busy ? "Saving..." : "Save and review"}
          </button>
          <Link to="/play" className="px-5 py-3 text-xs font-bold uppercase tracking-wider" style={box}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
