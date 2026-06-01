import { useState, useRef, useCallback } from "react";
import axios from "axios";
import { Search, X, CheckCircle } from "lucide-react";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/**
 * Partner search with name/email autocomplete + email-invite fallback.
 *
 * Props:
 *   onPartnerSelect(user | null)  — called when a registered user is chosen/cleared
 *   onEmailChange(email)          — called when user switches to email-invite mode
 */
export default function PartnerSearch({ onPartnerSelect, onEmailChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const timer = useRef(null);

  const runSearch = useCallback((q) => {
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await axios.get(
          `${API}/users/search?q=${encodeURIComponent(q)}`,
          { withCredentials: true }
        );
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleQueryChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    if (selected) { setSelected(null); onPartnerSelect(null); }
    runSearch(q);
  };

  const handleSelect = (user) => {
    setSelected(user);
    setQuery(user.name);
    setResults([]);
    onPartnerSelect(user);
  };

  const clearSelected = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    onPartnerSelect(null);
  };

  const switchToEmail = () => {
    setEmailMode(true);
    setSelected(null);
    setQuery("");
    setResults([]);
    onPartnerSelect(null);
  };

  const switchToSearch = () => {
    setEmailMode(false);
    setEmail("");
    onEmailChange("");
  };

  if (emailMode) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700">Partner Email</label>
          <button
            type="button"
            onClick={switchToSearch}
            className="text-xs text-emerald-600 hover:underline"
          >
            Search by name instead
          </button>
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); onEmailChange(e.target.value); }}
          placeholder="partner@example.com"
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          data-testid="partner-email-input"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">Find Your Partner</label>
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="Search by name or email…"
          className="w-full border border-gray-200 rounded-md pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          data-testid="partner-search-input"
        />
        {(query || selected) && (
          <button
            type="button"
            onClick={clearSelected}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <X size={13} className="text-gray-400 hover:text-gray-600" />
          </button>
        )}
        {searching && !selected && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {results.length > 0 && !selected && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
            {results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelect(u)}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2.5 border-b border-gray-50 last:border-0"
                data-testid={`partner-result-${u.id}`}
              >
                <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0">
                  {u.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  {u.city && <p className="text-xs text-gray-400">{u.city}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !searching && !selected && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow p-3 text-sm text-gray-500">
            No players found for "{query}"
          </div>
        )}
      </div>

      {selected && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 mt-1">
          <CheckCircle size={12} />
          <span>{selected.name} selected as partner</span>
        </div>
      )}

      <p className="text-xs text-gray-400 pt-0.5">
        Partner not on VenLax yet?{" "}
        <button
          type="button"
          onClick={switchToEmail}
          className="text-emerald-600 hover:underline"
        >
          Invite by email instead
        </button>
      </p>
    </div>
  );
}
