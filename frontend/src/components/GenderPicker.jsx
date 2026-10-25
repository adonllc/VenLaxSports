import { useState } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/** Mixed Doubles is one male and one female player, so a player must say which they are once. */
export default function GenderPicker({ onSaved }) {
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const choose = async (gender) => {
    setSaving(gender);
    setError("");
    try {
      await axios.patch(`${API}/users/me`, { gender }, { withCredentials: true });
      await onSaved?.();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not save. Please try again.");
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="space-y-2" data-testid="gender-picker">
      <p className="text-sm font-semibold" style={{ color: "#3D3D3D", fontFamily: "Rubik, sans-serif" }}>
        Mixed Doubles is one male and one female player. Which are you?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[["male", "Male"], ["female", "Female"]].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            disabled={!!saving}
            className="px-3 py-2.5 text-sm font-semibold disabled:opacity-50"
            style={{ border: "2px solid #E5E7EB", background: "#fff", color: "#3D3D3D", fontFamily: "Rubik, sans-serif" }}
            data-testid={`gender-${value}`}
          >
            {saving === value ? "Saving…" : label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
