import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Search, User, X } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Typeahead opponent picker — searches by name/email.
 * If `leagueId` is supplied, results are restricted to league members.
 */
export default function OpponentSearch({ leagueId, value, onSelect, testId = "opponent-search" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query, limit: "8" });
        if (leagueId) params.set("league_id", leagueId);
        const { data } = await axios.get(`${API}/users/search?${params}`, { withCredentials: true });
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, leagueId]);

  const pick = (u) => {
    setSelected(u);
    setQuery("");
    setOpen(false);
    onSelect?.(u);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    onSelect?.(null);
  };

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50" data-testid={`${testId}-selected`}>
        <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
          {selected.name?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{selected.name}</p>
          <p className="text-xs text-gray-500 truncate">{selected.email}</p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-gray-400 hover:text-red-500"
          aria-label="Clear opponent"
          data-testid={`${testId}-clear`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={leagueId ? "Search league members by name or email" : "Type a name or email (min 2 chars)"}
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
          data-testid={`${testId}-input`}
          aria-label="Search opponent"
          autoComplete="off"
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto" data-testid={`${testId}-results`}>
          {loading && <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="px-3 py-2 text-xs text-gray-400">No players found</div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pick(u)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
              data-testid={`${testId}-option-${u.id}`}
            >
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-3 h-3 text-gray-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {u.name}
                  <span className="text-xs text-gray-400 ml-1.5">
                    {u.gender === "male" ? "(M)" : u.gender === "female" ? "(F)" : ""}
                  </span>
                </p>
                <p className="text-xs text-gray-500 truncate">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
