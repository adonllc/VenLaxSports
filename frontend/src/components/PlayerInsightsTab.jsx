import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import PlayerProfilePanel from "./PlayerProfilePanel";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/admin/players`;
const PAGE = 50;
const GREEN = "#008F70";

const STAGES = {
  signed_up: ["Signed up", "#F1F1F1", "#4C4C4C"],
  email_verified: ["Email verified", "#F1F1F1", "#4C4C4C"],
  profile_complete: ["Profile done", "#FEF3C7", "#92400E"],
  joined: ["Joined a league", "#E8F6F2", "#00765C"],
  paid: ["Paid", "#DCFCE7", "#166534"],
  played: ["Played", "#D1FAE5", "#065F46"],
};
const FORMAT = { singles: "Singles", doubles: "Doubles", mixed_doubles: "Mixed" };
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const day = (iso) => (iso || "").slice(0, 10);

function Stage({ stage }) {
  const [label, bg, fg] = STAGES[stage] || STAGES.signed_up;
  return <span className="text-xs px-2 py-1 whitespace-nowrap" style={{ background: bg, color: fg }}>{label}</span>;
}

export default function PlayerInsightsTab() {
  const [overview, setOverview] = useState(null);
  const [segment, setSegment] = useState("all");
  const [q, setQ] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [notInLeague, setNotInLeague] = useState("");
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [tagList, setTagList] = useState([]);
  const [segments, setSegments] = useState([]);
  const [segmentId, setSegmentId] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [openId, setOpenId] = useState("");
  const [dups, setDups] = useState(null);
  const [perms, setPerms] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    axios.get(`${API}/overview`, { withCredentials: true }).then((r) => setOverview(r.data)).catch(() => setError("Could not load the player overview."));
  }, []);

  const params = useCallback(() => {
    const p = { segment, q: q.trim() || undefined, league_id: leagueId || undefined, not_in_league: notInLeague || undefined,
      tag: tag || undefined, status: status || undefined };
    return p;
  }, [segment, q, leagueId, notInLeague, tag, status]);

  const loadSidebars = useCallback(() => {
    axios.get(`${API}/tags`, { withCredentials: true }).then((r) => setTagList(r.data.tags)).catch(() => {});
    axios.get(`${API}/segments`, { withCredentials: true }).then((r) => setSegments(r.data.segments)).catch(() => {});
  }, []);
  useEffect(() => {
    loadSidebars();
    axios.get(`${API.replace("/players", "")}/me/permissions`, { withCredentials: true }).then((r) => setPerms(r.data.permissions)).catch(() => {});
  }, [loadSidebars]);

  useEffect(() => {
    const t = setTimeout(() => {
      axios.get(API, { params: { ...params(), skip, limit: PAGE }, withCredentials: true })
        .then((r) => { setData(r.data); setError(""); })
        .catch(() => setError("Could not load players."));
    }, 250);
    return () => clearTimeout(t);
  }, [params, skip, refresh]);

  const pick = (fn) => (...a) => { setSkip(0); fn(...a); };
  const leagueName = (id) => overview?.leagues.find((l) => l.league_id === id)?.name || "";

  const applySegment = (id) => {
    setSegmentId(id);
    const seg = segments.find((x) => x.id === id);
    if (!seg) return;
    const f = seg.filters;
    setSkip(0);
    setSegment(f.segment || "all"); setQ(f.q || ""); setLeagueId(f.league_id || ""); setNotInLeague(f.not_in_league || "");
    setTag(f.tag || ""); setStatus(f.status || "");
  };
  const saveSegment = async () => {
    const name = window.prompt("Name this segment (it saves the filters you have set now):");
    if (!name?.trim()) return;
    try {
      const { data: d } = await axios.post(`${API}/segments`, { name, filters: { ...params(), q: q.trim() } }, { withCredentials: true });
      loadSidebars();
      setSegmentId(d.id);
    } catch (e) { setError(e.response?.data?.detail || "Could not save the segment"); }
  };
  const deleteSegment = async () => {
    const seg = segments.find((x) => x.id === segmentId);
    if (!seg || !window.confirm(`Delete the saved segment "${seg.name}"?`)) return;
    try { await axios.delete(`${API}/segments/${segmentId}`, { withCredentials: true }); setSegmentId(""); loadSidebars(); }
    catch (e) { setError(e.response?.data?.detail || "Could not delete the segment"); }
  };
  const toggle = (id) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const bulk = async (mode) => {
    if (!bulkTag.trim() || selected.size === 0) return;
    if (!window.confirm(`${mode === "add" ? "Add" : "Remove"} the tag "${bulkTag.trim()}" ${mode === "add" ? "to" : "from"} ${selected.size} selected players?`)) return;
    try {
      const { data: d } = await axios.post(`${API}/bulk/tags`, { user_ids: [...selected], add: mode === "add" ? [bulkTag] : [], remove: mode === "remove" ? [bulkTag] : [] }, { withCredentials: true });
      setNotice(`${d.changed} of ${d.selected} players changed.`);
      setSelected(new Set()); setBulkTag(""); setRefresh((n) => n + 1); loadSidebars();
    } catch (e) { setError(e.response?.data?.detail || "Could not change the tags"); }
  };
  const findDuplicates = async () => {
    try { setDups((await axios.get(`${API}/duplicates`, { withCredentials: true })).data); }
    catch (e) { setError(e.response?.data?.detail || "Could not check for duplicates"); }
  };
  const canTag = perms.includes("players.write");
  const pageIds = (data?.players || []).map((p) => p.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const selectPage = () => setSelected((cur) => { const n = new Set(cur); pageIds.forEach((id) => (allOnPage ? n.delete(id) : n.add(id))); return n; });

  const exportCsv = async () => {
    const res = await axios.get(`${API}/export.csv`, { params: params(), withCredentials: true, responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url; a.download = `players-${segment}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="players-tab">
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {overview && (
        <>
          <div className="bg-white p-5" style={{ border: "1px solid #E5E7EB" }}>
            <h2 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Where players drop off</h2>
            <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
              Every account except admins. Each bar is the share of all signups. Money collected from league fees: {money(overview.revenue)}.
            </p>
            <div className="space-y-2" data-testid="funnel">
              {overview.funnel.map((s) => (
                <div key={s.label} className="flex items-center gap-3 text-sm">
                  <div className="w-48 shrink-0" style={{ color: "#3D3D3D" }}>{s.label}</div>
                  <div className="flex-1 h-5" style={{ background: "#F1F1F1" }}>
                    <div className="h-5" style={{ width: `${s.percent}%`, background: GREEN }} />
                  </div>
                  <div className="w-24 text-right tabular-nums">{s.count} ({s.percent}%)</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white" style={{ border: "1px solid #E5E7EB" }}>
            <h2 className="font-heading font-bold text-lg p-5 pb-2" style={{ color: "#3D3D3D" }}>Leagues</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase" style={{ color: "#6B7280" }}>
                    <th className="px-5 py-2">League</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Registered</th><th className="px-3 py-2">Promo</th>
                    <th className="px-3 py-2">Revenue</th><th className="px-3 py-2">Waiting for partner</th><th className="px-3 py-2">Players in city not joined</th><th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {overview.leagues.map((l) => (
                    <tr key={l.league_id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td className="px-5 py-2">{l.name}<div className="text-xs" style={{ color: "#6B7280" }}>{l.city} · {l.sport} · {FORMAT[l.format] || l.format} · {money(l.entry_fee)} · starts {l.start_date}</div></td>
                      <td className="px-3 py-2">{l.status}</td>
                      <td className="px-3 py-2 tabular-nums">{l.registered}/{l.capacity}</td>
                      <td className="px-3 py-2 tabular-nums">{l.with_promo}</td>
                      <td className="px-3 py-2 tabular-nums">{money(l.revenue)}</td>
                      <td className="px-3 py-2 tabular-nums">{l.waiting_for_partner}</td>
                      <td className="px-3 py-2 tabular-nums">{l.city_players_not_joined}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button className="text-xs px-2 py-1 mr-2" style={{ border: `1px solid ${GREEN}`, color: GREEN }} onClick={pick(() => { setNotInLeague(""); setLeagueId(l.league_id); setSegment("all"); })}>Who joined</button>
                        <button className="text-xs px-2 py-1" style={{ border: "1px solid #E5A885", color: "#B7791F" }} onClick={pick(() => { setLeagueId(""); setNotInLeague(l.league_id); setSegment("all"); })}>Not joined</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {overview.promos.length > 0 && (
            <div className="bg-white p-5" style={{ border: "1px solid #E5E7EB" }}>
              <h2 className="font-heading font-bold text-lg mb-2" style={{ color: "#3D3D3D" }}>Promo codes</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase" style={{ color: "#6B7280" }}><th className="py-1">Code</th><th>Used</th><th>Players</th><th>Limit</th><th>Active</th></tr></thead>
                <tbody>
                  {overview.promos.map((p) => (
                    <tr key={p.code} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td className="py-1 font-mono">{p.code}</td><td>{p.used}</td><td>{p.players}</td><td>{p.max_uses ?? "none"}</td><td>{p.active ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2" data-testid="segments">
            {overview.segments.map((s) => (
              <button
                key={s.id}
                onClick={pick(() => { setSegment(s.id); setLeagueId(""); setNotInLeague(""); })}
                className="text-xs px-3 py-2"
                style={segment === s.id && !leagueId && !notInLeague
                  ? { background: GREEN, color: "#fff", border: `1px solid ${GREEN}` }
                  : { background: "#fff", color: "#3D3D3D", border: "1px solid #E5E7EB" }}
                data-testid={`segment-${s.id}`}
              >
                {s.label} ({s.count})
              </button>
            ))}
          </div>
        </>
      )}

      <div className="bg-white" style={{ border: "1px solid #E5E7EB" }}>
        <div className="p-5 flex flex-wrap items-center gap-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
          <input
            className="px-3 py-2 text-sm w-64 bg-white text-gray-900 placeholder:text-gray-400" style={{ border: "1px solid #E5E7EB" }} placeholder="Search name or email"
            value={q} onChange={pick((e) => setQ(e.target.value))} data-testid="players-search"
          />
          {leagueId && <button className="text-xs px-2 py-1" style={{ border: "1px solid #E5E7EB" }} onClick={pick(() => setLeagueId(""))}>Joined {leagueName(leagueId)} ✕</button>}
          {notInLeague && <button className="text-xs px-2 py-1" style={{ border: "1px solid #E5E7EB" }} onClick={pick(() => setNotInLeague(""))}>Not in {leagueName(notInLeague)} ✕</button>}
          <select className="px-3 py-2 text-sm bg-white text-gray-900" style={{ border: "1px solid #E5E7EB" }} value={tag} onChange={pick((e) => { setTag(e.target.value); setSegmentId(""); })} data-testid="players-tag-filter" aria-label="Filter by tag">
            <option value="">Any tag</option>
            {tagList.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>)}
          </select>
          <select className="px-3 py-2 text-sm bg-white text-gray-900" style={{ border: "1px solid #E5E7EB" }} value={status} onChange={pick((e) => { setStatus(e.target.value); setSegmentId(""); })} data-testid="players-status-filter" aria-label="Filter by account status">
            <option value="">Any status</option>
            <option value="active">Active</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option>
          </select>
          <select className="px-3 py-2 text-sm bg-white text-gray-900" style={{ border: "1px solid #E5E7EB" }} value={segmentId} onChange={(e) => applySegment(e.target.value)} data-testid="players-saved-segments" aria-label="Saved segments">
            <option value="">Saved segments…</option>
            {segments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button className="text-xs px-2 py-2 bg-white text-gray-900" style={{ border: "1px solid #E5E7EB" }} onClick={saveSegment} data-testid="players-save-segment">Save filters</button>
          {segmentId && <button className="text-xs px-2 py-2 bg-white text-gray-900" style={{ border: "1px solid #E5E7EB" }} onClick={deleteSegment} data-testid="players-delete-segment">Delete segment</button>}
          <button className="text-xs px-2 py-2 bg-white text-gray-900" style={{ border: "1px solid #E5E7EB" }} onClick={findDuplicates} data-testid="players-find-duplicates">Find duplicates</button>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm" style={{ color: "#6B7280" }}>{data ? `${data.total} players` : "Loading…"}</span>
            <button onClick={exportCsv} className="text-xs font-semibold px-3 py-2 text-white" style={{ background: GREEN }} data-testid="players-export">Export CSV</button>
          </div>
        </div>

        {notice && <p className="px-5 py-2 text-sm" style={{ background: "#E8F6F2", color: "#00765C" }} role="status">{notice}</p>}
        {selected.size > 0 && (
          <div className="px-5 py-3 flex flex-wrap items-center gap-2" style={{ background: "#F9FAFB", borderBottom: "1px solid #F3F4F6" }} data-testid="players-bulk-bar">
            <span className="text-sm font-semibold">{selected.size} selected</span>
            {canTag ? (
              <>
                <input className="px-3 py-1.5 text-sm bg-white text-gray-900 placeholder:text-gray-400" style={{ border: "1px solid #E5E7EB" }} placeholder="Tag" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} data-testid="players-bulk-tag" />
                <button className="px-3 py-1.5 text-sm text-white" style={{ background: GREEN }} onClick={() => bulk("add")} data-testid="players-bulk-add">Add tag</button>
                <button className="px-3 py-1.5 text-sm bg-white text-gray-900" style={{ border: "1px solid #E5E7EB" }} onClick={() => bulk("remove")} data-testid="players-bulk-remove">Remove tag</button>
              </>
            ) : <span className="text-xs" style={{ color: "#6B7280" }}>Your role cannot change tags.</span>}
            <button className="px-3 py-1.5 text-sm bg-white text-gray-900" style={{ border: "1px solid #E5E7EB" }} onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}
        {dups && (
          <div className="p-5 space-y-3" style={{ borderBottom: "1px solid #F3F4F6" }} data-testid="players-duplicates">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{dups.total_groups === 0 ? "No likely duplicates found." : `${dups.total_groups} possible duplicate groups`}</p>
              <button className="text-xs px-2 py-1 bg-white text-gray-900" style={{ border: "1px solid #E5E7EB" }} onClick={() => setDups(null)}>Hide</button>
            </div>
            <p className="text-xs" style={{ color: "#6B7280" }}>Report only. Accounts are never merged automatically; a merge needs a separate, reviewed step.</p>
            {dups.groups.map((g, i) => (
              <div key={i} className="p-3 text-sm" style={{ border: "1px solid #E5E7EB" }}>
                <p className="text-xs font-semibold uppercase" style={{ color: g.confidence === "high" ? "#B45309" : "#6B7280" }}>{g.confidence} · {g.reasons.join(", ")}</p>
                {g.players.map((x) => <button key={x.id} className="block underline text-left" onClick={() => setOpenId(x.id)}>{x.name} · {x.email} · {x.created_at?.slice(0, 10)} · {x.status}</button>)}
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase" style={{ color: "#6B7280" }}>
                <th className="pl-5 py-2 w-8"><input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={selectPage} data-testid="players-select-all" /></th>
                <th className="px-3 py-2">Player</th><th className="px-3 py-2">Signed up</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Leagues and how they joined</th><th className="px-3 py-2">Paid</th><th className="px-3 py-2">Matches</th><th className="px-3 py-2">Open leagues not joined</th>
              </tr>
            </thead>
            <tbody>
              {(data?.players || []).map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #F3F4F6" }} className="align-top">
                  <td className="pl-5 py-2"><input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} data-testid={`players-select-${p.id}`} /></td>
                  <td className="px-3 py-2">
                    <button className="font-semibold underline text-left" onClick={() => setOpenId(p.id)} data-testid={`players-open-${p.id}`}>{p.name}</button>
                    {p.status && p.status !== "active" && <span className="ml-2 text-xs px-1.5 py-0.5" style={{ background: p.status === "suspended" ? "#FEF3C7" : "#F3F4F6", color: p.status === "suspended" ? "#92400E" : "#4C4C4C" }}>{p.status}</span>}
                    <div className="text-xs" style={{ color: "#6B7280" }}>{p.email}{p.city ? ` · ${p.city}` : ""}</div>
                    {(p.tags || []).length > 0 && <div className="flex flex-wrap gap-1 mt-1">{p.tags.map((t) => <span key={t} className="text-xs px-1.5 py-0.5" style={{ background: "#F1F1F1" }}>{t}</span>)}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{day(p.signed_up)}</td>
                  <td className="px-3 py-2">{p.source}</td>
                  <td className="px-3 py-2"><Stage stage={p.stage} />{p.waiting_for_partner && <div className="text-xs mt-1" style={{ color: "#B45309" }}>waiting for partner</div>}</td>
                  <td className="px-3 py-2">
                    {p.leagues.length === 0 ? <span style={{ color: "#6B7280" }}>none</span> : p.leagues.map((j) => (
                      <div key={j.league_id} className="text-xs">{j.name} · {FORMAT[j.format] || j.format} · <strong>{j.how}</strong></div>
                    ))}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{money(p.total_paid)}</td>
                  <td className="px-3 py-2 tabular-nums">{p.matches_played}</td>
                  <td className="px-3 py-2 text-xs">{p.open_leagues_not_joined.join(", ") || <span style={{ color: "#6B7280" }}>none</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.players.length === 0 && <p className="p-6 text-sm text-center" style={{ color: "#6B7280" }}>No players match.</p>}
        </div>

        {data && data.total > PAGE && (
          <div className="p-4 flex items-center justify-between text-sm" style={{ borderTop: "1px solid #F3F4F6" }}>
            <button disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))} className="px-3 py-1 disabled:opacity-40" style={{ border: "1px solid #E5E7EB" }}>Previous</button>
            <span style={{ color: "#6B7280" }}>{skip + 1} to {Math.min(skip + PAGE, data.total)} of {data.total}</span>
            <button disabled={skip + PAGE >= data.total} onClick={() => setSkip(skip + PAGE)} className="px-3 py-1 disabled:opacity-40" style={{ border: "1px solid #E5E7EB" }}>Next</button>
          </div>
        )}
      </div>
      {openId && <PlayerProfilePanel playerId={openId} onClose={() => setOpenId("")} onChanged={() => { setRefresh((n) => n + 1); loadSidebars(); }} />}
    </div>
  );
}
