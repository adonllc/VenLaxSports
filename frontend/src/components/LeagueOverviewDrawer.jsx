import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const box = { border: "1px solid #E5E7EB" };
const head = { color: "#6B7280" };
const TABS = [["players", "Players"], ["teams", "Doubles teams"], ["payments", "Payments"], ["coupons", "Coupons"], ["matches", "Matches"]];

const STATUS = {
  paid: ["Paid", "#065F46", "#D1FAE5"],
  free: ["Free", "#374151", "#F1F1F1"],
  pending_zelle: ["Zelle pending", "#92400E", "#FEF3C7"],
  awaiting_payment: ["Zelle started, no reference sent", "#92400E", "#F1F1F1"],
  covered_by_partner: ["Partner paid", "#065F46", "#D1FAE5"],
  refunded: ["Refunded", "#374151", "#F1F1F1"],
  unpaid: ["No payment", "#991B1B", "#FEE2E2"],
};
const METHOD = { card: "Card (Stripe)", zelle: "Zelle", credit: "VenLax Credit", coupon: "Coupon", manual: "Marked paid by admin", free: "Free league", partner: "Paid by partner", none: "-" };
const ENTRY = { singles: "Singles", doubles_team: "Doubles team", doubles_half: "Doubles half" };
const TEAM = { paired: "Paired", waiting_partner: "Waiting for partner" };

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const day = (s) => (s ? String(s).slice(0, 10) : "-");

function Pill({ kind }) {
  const [label, color, bg] = STATUS[kind] || [kind, "#374151", "#F1F1F1"];
  return <span className="inline-block px-2 py-0.5 text-xs font-semibold" style={{ color, background: bg }}>{label}</span>;
}

function Tile({ label, value, sub, testid }) {
  return (
    <div className="p-3 bg-white" style={box} data-testid={testid}>
      <p className="text-xs uppercase tracking-wide" style={head}>{label}</p>
      <p className="text-xl font-bold" style={{ color: "#1D1D1D" }}>{value}</p>
      {sub && <p className="text-xs" style={head}>{sub}</p>}
    </div>
  );
}

function csv(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ActionDialog({ action, data, leagues, busy, onCancel, onRun }) {
  const [refund, setRefund] = useState("none");
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const p = action.player;
  const targets = leagues.filter((l) => l.id !== data.league.id && l.sport === data.league.sport && l.format === data.league.format && ["registration", "active"].includes(l.status));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }}>
      <div className="bg-white w-full max-w-md p-5" style={box} data-testid="roster-action-dialog">
        {action.type === "mark_paid" && (
          <>
            <h3 className="font-bold text-lg mb-1">Mark {p.name} as paid</h3>
            <p className="text-sm mb-3" style={head}>Use when you were paid outside the site (cash, a Zelle you already checked). It is logged in the audit log.</p>
            <label className="block text-sm mb-1">Amount received (blank = league fee {money(data.league.entry_fee)})</label>
            <input className="w-full px-3 py-2 mb-3 text-sm" style={box} value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="mark-paid-amount" />
            <label className="block text-sm mb-1">Note</label>
            <input className="w-full px-3 py-2 mb-4 text-sm" style={box} value={note} onChange={(e) => setNote(e.target.value)} data-testid="mark-paid-note" />
          </>
        )}
        {action.type === "remove" && (
          <>
            <h3 className="font-bold text-lg mb-1">Remove {p.name}</h3>
            <p className="text-sm mb-3" style={head}>They paid {money(p.total)} ({METHOD[p.payment_method]}). Their place is freed. Choose what happens to the money:</p>
            {[["none", "No refund"], ["credit", `Give ${money(p.total)} as VenLax Credit`], ["card", "Refund to their card (Stripe, full amount)"]].map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-sm mb-2">
                <input type="radio" name="refund" checked={refund === v} onChange={() => setRefund(v)} data-testid={`remove-refund-${v}`} /> {l}
              </label>
            ))}
            {refund === "card" && p.payment_method !== "card" && <p className="text-xs text-red-600 mb-2">Only a Stripe card payment can be refunded to a card.</p>}
          </>
        )}
        {action.type === "move" && (
          <>
            <h3 className="font-bold text-lg mb-1">Move {p.name} to another league</h3>
            <p className="text-sm mb-3" style={head}>Only same sport and format. Their payment and standing move with them.</p>
            <select className="w-full px-3 py-2 mb-4 text-sm bg-white" style={box} value={target} onChange={(e) => setTarget(e.target.value)} data-testid="move-target">
              <option value="">Choose a league</option>
              {targets.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.current_players || 0}/{l.max_players}) - {l.entry_fee ? money(l.entry_fee) : "Free"}</option>)}
            </select>
            {targets.length === 0 && <p className="text-xs mb-3" style={head}>No other open league of the same sport and format.</p>}
          </>
        )}
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 text-sm" style={box} onClick={onCancel} data-testid="roster-action-cancel">Cancel</button>
          <button
            className="px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: action.type === "remove" ? "#B91C1C" : "#008F70" }}
            disabled={busy || (action.type === "move" && !target)}
            onClick={() => onRun(action.type === "mark_paid" ? { amount: amount === "" ? null : Number(amount), note } : action.type === "remove" ? { refund } : { to_league_id: target })}
            data-testid="roster-action-confirm"
          >
            {busy ? "Working..." : action.type === "remove" ? "Remove player" : action.type === "move" ? "Move player" : "Mark paid"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Admin: one league in full. Players, how each paid, doubles teams, payments, coupons, matches, and roster actions. */
export default function LeagueOverviewDrawer({ leagueId, leagues, onClose, onChanged, onGoToZelle }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("players");
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fMethod, setFMethod] = useState("");
  const [fEntry, setFEntry] = useState("");
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const { data: d } = await axios.get(`${API}/admin/leagues/${leagueId}/overview`, { withCredentials: true });
      setData(d);
      setErr("");
    } catch (e) {
      setErr(e.response?.data?.detail || "Could not load this league");
    }
  }, [leagueId]);
  useEffect(() => { load(); }, [load]);

  const players = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.players.filter((p) =>
      (!needle || p.name.toLowerCase().includes(needle) || (p.email || "").toLowerCase().includes(needle) || (p.coupon || "").toLowerCase().includes(needle)) &&
      (!fStatus || p.payment_status === fStatus) && (!fMethod || p.payment_method === fMethod) && (!fEntry || p.entry_type === fEntry));
  }, [data, q, fStatus, fMethod, fEntry]);

  const run = async (body) => {
    setBusy(true);
    const path = { mark_paid: "mark-paid", remove: "remove", move: "move" }[action.type];
    try {
      const { data: out } = await axios.post(`${API}/admin/leagues/${leagueId}/players/${action.player.player_id}/${path}`, body, { withCredentials: true });
      setMsg(action.type === "remove" ? `${action.player.name} removed${out.credited ? ` and credited ${money(out.credited)}` : out.stripe_refund_id ? " and refunded to their card" : ""}.`
        : action.type === "move" ? `${action.player.name} moved to ${out.to_league}.${out.fee_changed ? ` Note the fee differs (${money(out.from_fee)} to ${money(out.to_fee)}).` : ""}`
        : `${action.player.name} marked paid.`);
      setAction(null);
      await load();
      onChanged && onChanged();
    } catch (e) {
      setMsg(e.response?.data?.detail || "That did not work");
      setAction(null);
    } finally {
      setBusy(false);
    }
  };

  const approveZelle = async (p) => {
    const ok = window.confirm(`Approve ${p.name}'s Zelle payment of ${money(p.amount_paid)}? Only do this once you see the money in your Zelle account. It registers them in the league.`);
    if (!ok) return;
    try {
      await axios.post(`${API}/admin/zelle/${p.session_id}/approve`, {}, { withCredentials: true });
      setMsg(`${p.name} approved and registered.`);
      await load();
      onChanged && onChanged();
    } catch (e) {
      setMsg(e.response?.data?.detail || "Could not approve that Zelle payment");
    }
  };

  const exportPlayers = () => {
    const withContact = data.contact_visible;
    const header = ["Name", ...(withContact ? ["Email", "Phone"] : []), "Registered", "Joined", "Entry", "Payment", "Method", "Paid", "Credit", "Coupon", "Partner", "Team", "Wins", "Losses"];
    download(`${data.league.name.replace(/\W+/g, "-")}-players.csv`, csv([header, ...players.map((p) => [
      p.name, ...(withContact ? [p.email, p.phone] : []), p.registered ? "yes" : "no", day(p.joined_at), p.entry_label,
      STATUS[p.payment_status]?.[0] || p.payment_status, METHOD[p.payment_method], p.amount_paid, p.credit_applied, p.coupon || "", p.partner_name || "", p.team_status || "", p.wins, p.losses])]));
  };

  const copyEmails = async () => {
    const list = players.map((p) => p.email).filter(Boolean).join(", ");
    try { await navigator.clipboard.writeText(list); setMsg(`Copied ${list ? list.split(", ").length : 0} emails.`); } catch { setMsg("Could not copy. Use Export CSV instead."); }
  };

  const select = "px-2 py-1.5 text-sm bg-white";
  const th = "text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,.4)" }} data-testid="league-overview">
      <div className="w-full max-w-6xl h-full overflow-y-auto" style={{ background: "#F9FAFB" }}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-white" style={{ borderBottom: "1px solid #E5E7EB" }}>
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-lg truncate" data-testid="overview-title">{data ? data.league.name : "League"}</h2>
            {data && <p className="text-xs capitalize" style={head}>{data.league.sport} · {data.league.format} · {data.league.city} · {data.league.status} · {day(data.league.start_date)} to {day(data.league.end_date)} · {data.league.entry_fee ? money(data.league.entry_fee) : "Free"}</p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {data && <Link to={`/leagues/${leagueId}`} className="text-sm hover:underline" style={{ color: "#B7791F" }}>Public page</Link>}
            <button onClick={onClose} className="px-3 py-1.5 text-sm" style={box} data-testid="overview-close">Close</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {err && <p className="text-sm text-red-600" data-testid="overview-error">{err}</p>}
          {!data && !err && <p className="text-sm" style={head}>Loading...</p>}
          {msg && <p className="text-sm px-3 py-2 bg-white" style={box} data-testid="overview-msg">{msg}</p>}
          {data && (
            <>
              {data.flags.length > 0 && (
                <div className="flex flex-wrap gap-2" data-testid="overview-flags">
                  {data.flags.map((f) => (
                    <span key={f.key} className="px-2.5 py-1 text-xs font-semibold" style={{ background: "#FEF3C7", color: "#92400E" }}>
                      {f.label}{f.key === "zelle_pending" && onGoToZelle && <button className="ml-2 underline" onClick={onGoToZelle}>Open Zelle queue</button>}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <Tile testid="tile-filled" label="Players" value={`${data.summary.filled}/${data.summary.max_players}`} sub={data.summary.min_players_to_start ? `min ${data.summary.min_players_to_start}${data.summary.needs_more ? `, needs ${data.summary.needs_more} more` : ", reached"}` : null} />
                <Tile testid="tile-collected" label="Collected" value={money(data.summary.collected)} sub={data.summary.credit_used ? `+ ${money(data.summary.credit_used)} credit` : null} />
                <Tile testid="tile-pending" label="Pending" value={money(data.summary.pending)} sub="Zelle to approve" />
                <Tile testid="tile-coupons" label="Coupon entries" value={data.summary.coupon_entries} />
                <Tile testid="tile-free" label="Free entries" value={data.summary.free_entries} />
                <Tile testid="tile-start" label="Starts in" value={data.summary.days_to_start == null ? "-" : `${data.summary.days_to_start}d`} sub={day(data.league.start_date)} />
              </div>

              {Object.keys(data.summary.by_method).length > 0 && (
                <p className="text-sm" style={head} data-testid="by-method">
                  By method: {Object.entries(data.summary.by_method).map(([m, v]) => `${METHOD[m] || m} ${v.players} (${money(v.amount)})`).join(" · ")}
                </p>
              )}

              <div className="flex gap-1 flex-wrap" style={{ borderBottom: "1px solid #E5E7EB" }}>
                {TABS.map(([id, label]) => (
                  <button key={id} onClick={() => setTab(id)} data-testid={`overview-tab-${id}`}
                    className="px-3 py-2 text-sm font-medium" style={{ borderBottom: tab === id ? "2px solid #008F70" : "2px solid transparent", color: tab === id ? "#008F70" : "#4C4C4C" }}>
                    {label}{id === "players" ? ` (${data.players.length})` : id === "teams" ? ` (${data.teams.length})` : id === "payments" ? ` (${data.ledger.length})` : id === "coupons" ? ` (${data.coupons.length})` : ""}
                  </button>
                ))}
              </div>

              {tab === "players" && (
                <div className="bg-white" style={box}>
                  <div className="flex flex-wrap items-center gap-2 p-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <input placeholder="Search name, email or coupon" className="px-3 py-1.5 text-sm w-56" style={box} value={q} onChange={(e) => setQ(e.target.value)} data-testid="overview-search" />
                    <select className={select} style={box} value={fStatus} onChange={(e) => setFStatus(e.target.value)} data-testid="filter-status">
                      <option value="">Any payment status</option>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
                    </select>
                    <select className={select} style={box} value={fMethod} onChange={(e) => setFMethod(e.target.value)} data-testid="filter-method">
                      <option value="">Any method</option>
                      {Object.entries(METHOD).filter(([k]) => k !== "none").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select className={select} style={box} value={fEntry} onChange={(e) => setFEntry(e.target.value)} data-testid="filter-entry">
                      <option value="">Any entry type</option>
                      {Object.entries(ENTRY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <span className="text-xs" style={head}>{players.length} shown</span>
                    <div className="ml-auto flex gap-2">
                      {data.contact_visible && <button className="px-3 py-1.5 text-sm" style={box} onClick={copyEmails} data-testid="copy-emails">Copy emails</button>}
                      <button className="px-3 py-1.5 text-sm" style={box} onClick={exportPlayers} data-testid="export-csv">Export CSV</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead style={{ borderBottom: "1px solid #F3F4F6", color: "#6B7280" }}>
                        <tr>
                          {["Player", ...(data.contact_visible ? ["Contact"] : []), "Level", "Joined", "Entry", "Payment", "Method", "Paid", "Coupon", "Partner", "W-L", "Actions"].map((h) => <th key={h} className={th}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                        {players.map((p) => (
                          <tr key={p.player_id} data-testid={`overview-player-${p.player_id}`}>
                            <td className="px-3 py-2 font-medium whitespace-nowrap">{p.name}{!p.registered && <span className="ml-1 text-xs" style={head}>(not registered yet)</span>}{p.suspended && <span className="ml-1 text-xs text-red-600">suspended</span>}</td>
                            {data.contact_visible && <td className="px-3 py-2 text-xs">{p.email}<br />{p.phone}</td>}
                            <td className="px-3 py-2">{p.skill_level || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{day(p.joined_at)}</td>
                            <td className="px-3 py-2 text-xs">{p.entry_label}</td>
                            <td className="px-3 py-2"><Pill kind={p.payment_status} /></td>
                            <td className="px-3 py-2 text-xs">{METHOD[p.payment_method] || p.payment_method}{p.zelle_reference ? ` (ref ${p.zelle_reference})` : ""}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{money(p.amount_paid)}{p.credit_applied > 0 && <span className="text-xs" style={head}> +{money(p.credit_applied)} credit</span>}</td>
                            <td className="px-3 py-2">{p.coupon || "-"}</td>
                            <td className="px-3 py-2 text-xs">{p.partner_name || (p.team_status === "waiting_partner" ? "Waiting for partner" : "-")}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{p.registered ? `${p.wins}-${p.losses}` : "-"}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2 text-xs font-semibold whitespace-nowrap">
                                {!p.registered && data.can.mark_paid && p.payment_method === "zelle" && ["awaiting_payment", "pending_zelle"].includes(p.payment_status) && p.session_id && !p.invite_token && <button style={{ color: "#008F70" }} onClick={() => approveZelle(p)} data-testid={`act-approve-zelle-${p.player_id}`}>Approve Zelle</button>}
                                {p.registered && data.can.mark_paid && !["paid", "free", "covered_by_partner"].includes(p.payment_status) && <button style={{ color: "#008F70" }} onClick={() => setAction({ type: "mark_paid", player: p })} data-testid={`act-markpaid-${p.player_id}`}>Mark paid</button>}
                                {p.registered && data.can.move && <button style={{ color: "#008F70" }} onClick={() => setAction({ type: "move", player: p })} data-testid={`act-move-${p.player_id}`}>Move</button>}
                                {p.registered && data.can.remove && <button className="text-red-600" onClick={() => setAction({ type: "remove", player: p })} data-testid={`act-remove-${p.player_id}`}>Remove</button>}
                                {p.email && <a href={`mailto:${p.email}`} style={{ color: "#B7791F" }}>Email</a>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {players.length === 0 && <p className="text-center py-8 text-sm" style={head}>No players match.</p>}
                  </div>
                </div>
              )}

              {tab === "teams" && (
                <div className="bg-white overflow-x-auto" style={box}>
                  {data.teams.length === 0 ? <p className="text-center py-8 text-sm" style={head}>No doubles teams in this league.</p> : (
                    <table className="w-full text-sm">
                      <thead style={{ color: "#6B7280" }}><tr>{["Team", "Status", "Paid so far", "Signup"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                      <tbody className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                        {data.teams.map((t) => (
                          <tr key={t.token}>
                            <td className="px-3 py-2">{t.players.join(" + ")}</td>
                            <td className="px-3 py-2">{TEAM[t.status]}</td>
                            <td className="px-3 py-2">{money(t.paid)}</td>
                            <td className="px-3 py-2">{t.pair_by_venlax ? "VenLax finds the partner (half fee)" : "Own partner (full team fee)"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === "payments" && (
                <div className="bg-white overflow-x-auto" style={box}>
                  {data.ledger.length === 0 ? <p className="text-center py-8 text-sm" style={head}>No payments yet.</p> : (
                    <table className="w-full text-sm">
                      <thead style={{ color: "#6B7280" }}><tr>{["Date", "Player", "Amount", "Credit", "Method", "Status", "Coupon", "Entry"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                      <tbody className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                        {data.ledger.map((t) => (
                          <tr key={t.session_id}>
                            <td className="px-3 py-2 whitespace-nowrap">{day(t.created_at)}</td>
                            <td className="px-3 py-2">{t.name}{t.email && <span className="block text-xs" style={head}>{t.email}</span>}</td>
                            <td className="px-3 py-2">{money(t.amount)}</td>
                            <td className="px-3 py-2">{t.credit_applied ? money(t.credit_applied) : "-"}</td>
                            <td className="px-3 py-2 text-xs">{METHOD[t.method] || t.method}{t.reference ? ` (ref ${t.reference})` : ""}</td>
                            <td className="px-3 py-2 text-xs">{t.status}</td>
                            <td className="px-3 py-2">{t.coupon || "-"}</td>
                            <td className="px-3 py-2 text-xs">{t.entry_label}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === "coupons" && (
                <div className="bg-white" style={box}>
                  {data.coupons.length === 0 ? <p className="text-center py-8 text-sm" style={head}>No coupons used in this league.</p> : data.coupons.map((c) => (
                    <div key={c.code} className="px-4 py-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <p className="font-semibold">{c.code} <span className="text-sm font-normal" style={head}>used {c.uses}x</span></p>
                      <p className="text-sm" style={head}>{c.players.join(", ")}</p>
                    </div>
                  ))}
                </div>
              )}

              {tab === "matches" && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Tile label="Total" value={data.matches.total} />
                  <Tile label="Scheduled" value={data.matches.scheduled} />
                  <Tile label="In progress" value={data.matches.in_progress} />
                  <Tile label="Completed" value={data.matches.completed} />
                  <Tile label="Cancelled" value={data.matches.cancelled} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {action && data && <ActionDialog action={action} data={data} leagues={leagues} busy={busy} onCancel={() => setAction(null)} onRun={run} />}
    </div>
  );
}
