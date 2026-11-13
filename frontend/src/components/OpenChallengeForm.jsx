import { useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { AVAILABILITY } from "../config/playProfile";
import { apiError, SPORTS } from "../utils/challengeUi";
import { COURTS, LEVELS, VISIBILITY, WINDOWS } from "../utils/openChallengeUi";
import { PartnerPicker } from "./OpenChallengeParts";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const field = { border: "1px solid #E5E7EB" };
const today = () => new Date().toISOString().slice(0, 10);

function Label({ children, htmlFor }) {
  return <label htmlFor={htmlFor} className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#6B7280" }}>{children}</label>;
}

/** Create or edit an open challenge. `initial` is an existing post view when editing. */
export default function OpenChallengeForm({ initial, onSaved, onCancel }) {
  const { user } = useAuth();
  const editing = Boolean(initial);
  const [f, setF] = useState({
    sport: initial?.sport || "tennis", format: initial?.format || "singles",
    level: initial?.level ?? 3.5, min_level: initial?.min_level ?? "", max_level: initial?.max_level ?? "",
    city: initial?.city || user?.city || "", zip_code: initial?.zip_code || user?.zip_code || "",
    venue: initial?.venue || "", court_pref: initial?.court_pref || "any",
    date: initial?.date || "", time_window: initial?.time_window || "any", start_time: initial?.start_time || "",
    availability: initial?.availability || [], notes: initial?.notes || "", visibility: initial?.visibility || "public",
    max_distance_miles: initial?.max_distance_miles || "",
  });
  const [partner, setPartner] = useState(null);
  const [showMore, setShowMore] = useState(Boolean(initial?.notes || initial?.availability?.length || initial?.max_distance_miles));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const toggleAvail = (v) => setF((p) => ({ ...p, availability: p.availability.includes(v) ? p.availability.filter((x) => x !== v) : [...p.availability, v] }));
  const doubles = f.format === "doubles";

  const submit = async (publish) => {
    setBusy(true);
    setErr("");
    const body = {
      ...f, level: Number(f.level),
      min_level: f.min_level === "" ? null : Number(f.min_level), max_level: f.max_level === "" ? null : Number(f.max_level),
      start_time: f.start_time || null, zip_code: f.zip_code || null,
      max_distance_miles: f.max_distance_miles === "" ? null : Number(f.max_distance_miles),
      partner_id: doubles ? partner?.id || initial?.partner_id || null : null,
    };
    try {
      const { data } = editing
        ? await axios.patch(`${API}/open-challenges/${initial.id}`, body, { withCredentials: true })
        : await axios.post(`${API}/open-challenges`, { ...body, publish }, { withCredentials: true });
      onSaved(data);
    } catch (e) {
      setErr(apiError(e));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(true); }} className="bg-white p-5 sm:p-6" style={{ border: "1px solid #E5E7EB" }} data-testid="open-challenge-form">
      <h2 className="font-heading font-bold text-xl" style={{ color: "#1D1D1D" }}>{editing ? "Edit your challenge" : "Post an open challenge"}</h2>
      <p className="text-sm mt-1" style={{ color: "#4C4C4C" }}>Tell players what you want to play. The first eligible player to accept gets the match. No ladder needed.</p>

      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <div><Label htmlFor="oc-sport">Sport</Label>
          <select id="oc-sport" value={f.sport} onChange={set("sport")} className="w-full px-3 py-2 text-sm bg-white" style={field} data-testid="oc-sport">{SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        <div><Label htmlFor="oc-format">Match type</Label>
          <select id="oc-format" value={f.format} onChange={set("format")} className="w-full px-3 py-2 text-sm bg-white" style={field} data-testid="oc-format"><option value="singles">Singles</option><option value="doubles">Doubles</option></select></div>
        {doubles && (
          <div className="sm:col-span-2"><Label>Your partner</Label>
            <PartnerPicker sport={f.sport} value={partner || (initial?.partner_id ? { id: initial.partner_id, name: "Current partner" } : null)} onChange={setPartner} testid="oc-partner" />
            <p className="text-xs mt-1" style={{ color: "#6B7280" }}>The player who accepts brings their own partner.</p></div>
        )}
        <div><Label htmlFor="oc-level">Your skill level</Label>
          <select id="oc-level" value={f.level} onChange={set("level")} className="w-full px-3 py-2 text-sm bg-white" style={field} data-testid="oc-level">{LEVELS.map((l) => <option key={l} value={l}>{l.toFixed(1)}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="oc-min">Opponent from</Label>
            <select id="oc-min" value={f.min_level} onChange={set("min_level")} className="w-full px-3 py-2 text-sm bg-white" style={field} data-testid="oc-min-level"><option value="">Auto</option>{LEVELS.map((l) => <option key={l} value={l}>{l.toFixed(1)}</option>)}</select></div>
          <div><Label htmlFor="oc-max">to</Label>
            <select id="oc-max" value={f.max_level} onChange={set("max_level")} className="w-full px-3 py-2 text-sm bg-white" style={field} data-testid="oc-max-level"><option value="">Auto</option>{LEVELS.map((l) => <option key={l} value={l}>{l.toFixed(1)}</option>)}</select></div>
        </div>
        <div><Label htmlFor="oc-city">City</Label>
          <input id="oc-city" value={f.city} onChange={set("city")} className="w-full px-3 py-2 text-sm" style={field} placeholder="Alpharetta" data-testid="oc-city" /></div>
        <div><Label htmlFor="oc-zip">ZIP code</Label>
          <input id="oc-zip" value={f.zip_code} onChange={set("zip_code")} className="w-full px-3 py-2 text-sm" style={field} placeholder="30009" inputMode="numeric" data-testid="oc-zip" /></div>
        <div className="sm:col-span-2"><Label htmlFor="oc-venue">Preferred location or court</Label>
          <input id="oc-venue" value={f.venue} onChange={set("venue")} required maxLength={120} className="w-full px-3 py-2 text-sm" style={field} placeholder="Wills Park courts" data-testid="oc-venue" /></div>
        <div><Label htmlFor="oc-date">Preferred date</Label>
          <input id="oc-date" type="date" min={today()} value={f.date} onChange={set("date")} required className="w-full px-3 py-2 text-sm" style={field} data-testid="oc-date" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="oc-window">Time of day</Label>
            <select id="oc-window" value={f.time_window} onChange={set("time_window")} className="w-full px-3 py-2 text-sm bg-white" style={field} data-testid="oc-window">{WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}</select></div>
          <div><Label htmlFor="oc-start">Exact time (optional)</Label>
            <input id="oc-start" type="time" value={f.start_time} onChange={set("start_time")} className="w-full px-3 py-2 text-sm" style={field} data-testid="oc-start" /></div>
        </div>
        <div><Label htmlFor="oc-court">Court preference</Label>
          <select id="oc-court" value={f.court_pref} onChange={set("court_pref")} className="w-full px-3 py-2 text-sm bg-white" style={field} data-testid="oc-court">{COURTS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
        <div><Label htmlFor="oc-vis">Who can see it</Label>
          <select id="oc-vis" value={f.visibility} onChange={set("visibility")} className="w-full px-3 py-2 text-sm bg-white" style={field} data-testid="oc-visibility">{VISIBILITY.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
      </div>

      <button type="button" onClick={() => setShowMore((s) => !s)} className="mt-4 text-sm font-semibold underline" aria-expanded={showMore} data-testid="oc-more-toggle">{showMore ? "Hide extra options" : "More options: availability, travel, notes"}</button>
      {showMore && (
        <div className="grid gap-4 mt-3" data-testid="oc-more">
          <fieldset><legend className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#6B7280" }}>Other times that also work</legend>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY.map((a) => (
                <label key={a.value} className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm cursor-pointer" style={{ border: "1px solid #E5E7EB", background: f.availability.includes(a.value) ? "#E6F4F0" : "white" }}>
                  <input type="checkbox" checked={f.availability.includes(a.value)} onChange={() => toggleAvail(a.value)} data-testid={`oc-avail-${a.value}`} />{a.label}
                </label>
              ))}
            </div></fieldset>
          <div><Label htmlFor="oc-dist">Maximum travel (miles)</Label>
            <input id="oc-dist" type="number" min="1" max="100" value={f.max_distance_miles} onChange={set("max_distance_miles")} className="w-full sm:w-40 px-3 py-2 text-sm" style={field} data-testid="oc-distance" /></div>
          <div><Label htmlFor="oc-notes">Notes</Label>
            <textarea id="oc-notes" value={f.notes} onChange={set("notes")} maxLength={500} rows={3} className="w-full px-3 py-2 text-sm" style={field} placeholder="Friendly rally, bring a fresh can of balls" data-testid="oc-notes" /></div>
        </div>
      )}

      {err && <p className="text-sm mt-4" style={{ color: "#B42318" }} role="alert" data-testid="oc-error">{err}</p>}
      <div className="flex flex-wrap gap-3 mt-6">
        <button type="submit" disabled={busy} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="oc-submit">{editing ? "Save changes" : busy ? "Publishing..." : "Publish challenge"}</button>
        {!editing && <button type="button" disabled={busy} onClick={() => submit(false)} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider" style={{ border: "1px solid #1D1D1D" }} data-testid="oc-save-draft">Save as draft</button>}
        <button type="button" onClick={onCancel} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider" style={{ color: "#4C4C4C" }} data-testid="oc-cancel">Cancel</button>
      </div>
    </form>
  );
}
