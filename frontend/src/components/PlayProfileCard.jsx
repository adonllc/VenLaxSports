import { useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import PlayProfileForm from "./PlayProfileForm";
import { profileCompletion, profileRows } from "../config/playProfile";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function PlayProfileCard() {
  const { user, fetchMe } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;
  const profile = user.play_profile || {};
  const hasProfile = Object.keys(profile).length > 0;
  const { done, total, pct } = profileCompletion(profile);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  const startEdit = () => { setDraft(profile); setError(""); setEditing(true); };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await axios.patch(
        `${API}/users/me`,
        { play_profile: Object.keys(draft).length ? draft : null },
        { withCredentials: true }
      );
      await fetchMe();
      setEditing(false);
    } catch {
      setError("Could not save your play profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-none mb-6" style={{ border: "1px solid #E5E7EB" }} data-testid="play-profile-card">
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-lg" style={{ color: "#1D1D1D" }}>Play profile</h2>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
              {editing
                ? "Opponents and partners see this on your public profile."
                : hasProfile ? `${done} of ${total} details added` : "Tell opponents and partners how you play."}
            </p>
          </div>
          {!editing && (
            <button
              onClick={startEdit}
              className="shrink-0 px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
              style={hasProfile
                ? { border: "1px solid #008F70", color: "#008F70", background: "white" }
                : { background: "#F2A922", color: "#1D1D1D" }}
              data-testid="edit-play-profile-btn"
            >
              {hasProfile ? "Edit" : "Add"}
            </button>
          )}
        </div>
        {!editing && hasProfile && (
          <div className="mt-3 h-1.5 w-full" style={{ background: "#F1F1F1" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Play profile completion">
            <div className="h-full" style={{ width: `${pct}%`, background: pct === 100 ? "#008F70" : "#F2A922" }} />
          </div>
        )}
      </div>

      {editing ? (
        <>
          <div className="px-6 pb-2">
            <PlayProfileForm value={draft} onChange={setDraft} sports={user.sport_preferences || []} />
          </div>
          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 px-6 py-3 bg-white" style={{ borderTop: "1px solid #E5E7EB" }}>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="px-5 py-2 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
              style={{ background: "#F2A922", color: "#1D1D1D" }}
              data-testid="save-play-profile-btn"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="text-sm font-semibold"
              style={{ color: "#6B7280" }}
              data-testid="cancel-play-profile-btn"
            >
              Cancel
            </button>
            {error && <span className="text-xs text-red-600" role="alert" data-testid="play-profile-error">{error}</span>}
          </div>
        </>
      ) : hasProfile ? (
        <div className="px-6 pb-6" data-testid="play-profile-summary">
          {profile.looking_for_partner && (
            <span className="inline-block mb-3 px-2.5 py-1 text-xs font-bold uppercase tracking-wide" style={{ background: "#FEF3C7", color: "#92400E" }}>
              Looking for a partner
            </span>
          )}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {profileRows(profile).map((r) => (
              <div key={r.key} className="flex items-baseline justify-between gap-4 py-2" style={{ borderTop: "1px solid #F1F1F1" }}>
                <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>{r.label}</dt>
                <dd className="text-sm text-right" style={{ color: r.value ? "#1D1D1D" : "#9CA3AF", fontWeight: r.value ? 600 : 400 }}>
                  {r.value || "Not set"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div className="px-6 pb-6">
          <p className="text-sm" style={{ color: "#4C4C4C" }}>
            Add your court side, play style and availability to get matched with the right opponents and doubles partners.
          </p>
        </div>
      )}
    </div>
  );
}
