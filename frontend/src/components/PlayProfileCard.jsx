import { useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import PlayProfileForm from "./PlayProfileForm";
import PlayProfileChips from "./PlayProfileChips";

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
    <div className="bg-white rounded-none p-6 mb-6" style={{ border: "1px solid #E5E7EB" }} data-testid="play-profile-card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Play profile</h2>
        {!editing && (
          <button onClick={startEdit} className="text-xs font-semibold" style={{ color: "#008F70" }} data-testid="edit-play-profile-btn">
            {hasProfile ? "Edit" : "Add"}
          </button>
        )}
      </div>

      {editing ? (
        <>
          <PlayProfileForm value={draft} onChange={setDraft} sports={user.sport_preferences || []} />
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm font-bold disabled:opacity-60"
              style={{ background: "#F2A922", color: "#1D1D1D" }}
              data-testid="save-play-profile-btn"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-sm font-semibold"
              style={{ color: "#6B7280" }}
              data-testid="cancel-play-profile-btn"
            >
              Cancel
            </button>
            {error && <span className="text-xs text-red-600" data-testid="play-profile-error">{error}</span>}
          </div>
        </>
      ) : hasProfile ? (
        <PlayProfileChips profile={profile} testId="play-profile-summary" />
      ) : (
        <p className="text-sm" style={{ color: "#6B7280" }}>
          Tell opponents and partners how you play: court side, style, when you're free.
        </p>
      )}
    </div>
  );
}
