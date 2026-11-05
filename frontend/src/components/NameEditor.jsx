import { useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

// Accounts made before first/last names were stored only have a full name: split it on the first space
function split(user) {
  if (user.first_name || user.last_name) return [user.first_name || "", user.last_name || ""];
  const [first = "", ...rest] = (user.name || "").trim().split(/\s+/);
  return [first, rest.join(" ")];
}

/** "Edit name" link next to the player's name on the dashboard, with an inline first / last name form. */
export default function NameEditor() {
  const { user, fetchMe } = useAuth();
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;

  const open = () => {
    const [f, l] = split(user);
    setFirst(f);
    setLast(l);
    setError("");
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await axios.patch(`${API}/users/me`, { first_name: first, last_name: last }, { withCredentials: true });
      await fetchMe();
      setEditing(false);
    } catch (e) {
      const d = e.response?.data?.detail;
      setError(typeof d === "string" ? d : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const field = { border: "1px solid #E5E7EB", color: "#3D3D3D", background: "white" };

  if (!editing) {
    return (
      <button onClick={open} className="text-xs font-semibold" style={{ color: "#008F70" }} data-testid="edit-name-btn">
        Edit name
      </button>
    );
  }
  return (
    <div className="w-full mt-2" data-testid="name-editor">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          placeholder="First name"
          autoComplete="given-name"
          maxLength={50}
          aria-label="First name"
          className="px-3 py-1.5 text-sm"
          style={field}
          data-testid="input-first-name"
        />
        <input
          type="text"
          value={last}
          onChange={(e) => setLast(e.target.value)}
          placeholder="Last name"
          autoComplete="family-name"
          maxLength={50}
          aria-label="Last name"
          className="px-3 py-1.5 text-sm"
          style={field}
          data-testid="input-last-name"
        />
        <button onClick={save} disabled={saving} className="px-3 py-1.5 text-xs font-bold disabled:opacity-60" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="save-name-btn">
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs font-semibold" style={{ color: "#6B7280" }} data-testid="cancel-name-btn">
          Cancel
        </button>
      </div>
      <p className="text-xs mt-1" style={{ color: "#6B7280" }}>This is the name other players, standings and match results show.</p>
      {error && <p className="text-xs text-red-600 mt-1" role="alert">{error}</p>}
    </div>
  );
}
