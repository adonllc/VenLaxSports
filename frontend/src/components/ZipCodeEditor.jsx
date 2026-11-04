import { useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/** Inline zip / postal code editor. Used to match waiting doubles players who live close together. */
export default function ZipCodeEditor() {
  const { user, fetchMe } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await axios.patch(`${API}/users/me`, { zip_code: draft.trim() || null }, { withCredentials: true });
      await fetchMe();
      setEditing(false);
    } catch (e) {
      setError(e.response?.status === 422 ? "Enter a valid zip or postal code." : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-1 text-sm" style={{ color: "#4C4C4C" }} data-testid="zip-section">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. 30350"
            autoComplete="postal-code"
            maxLength={10}
            className="px-3 py-1.5 text-sm"
            style={{ border: "1px solid #E5E7EB", color: "#3D3D3D", background: "white" }}
            data-testid="input-dashboard-zip"
          />
          <button onClick={save} disabled={saving} className="px-3 py-1.5 text-xs font-bold disabled:opacity-60" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="save-zip-btn">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={() => { setEditing(false); setError(""); }} className="text-xs font-semibold" style={{ color: "#6B7280" }} data-testid="cancel-zip-btn">
            Cancel
          </button>
          {error && <span className="text-xs text-red-600 w-full" role="alert">{error}</span>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span>{user.zip_code ? `Zip: ${user.zip_code}` : "No zip code added"}</span>
          <button onClick={() => { setDraft(user.zip_code || ""); setEditing(true); }} className="text-xs font-semibold" style={{ color: "#008F70" }} data-testid="edit-zip-btn">
            {user.zip_code ? "Edit" : "Add zip"}
          </button>
          {!user.zip_code && <span className="text-xs" style={{ color: "#6B7280" }}>Helps match you with partners nearby.</span>}
        </div>
      )}
    </div>
  );
}
