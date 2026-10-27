import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/admin`;
const GREEN = "#008F70";
const AMBER = "#F2A922";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const INK = "#1D1D1D";

const control = "px-3 py-2 text-sm bg-white text-gray-900";
const controlStyle = { border: `1px solid ${BORDER}` };

const isoDay = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => isoDay(new Date(Date.now() - n * 86400000));
const pct = (v) => (v === null || v === undefined ? "n/a" : `${v}%`);

const EVENT_LABELS = {
  registration_started: "Opened the sign-up form",
  league_viewed: "Viewed a league page",
  league_registration_started: "Started joining a league",
};

function Card({ label, value, note, help, testid }) {
  return (
    <div className="p-4 bg-white" style={{ border: `1px solid ${BORDER}` }} data-testid={testid}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }} title={help}>{label}</p>
      <p className="font-heading font-bold text-3xl mt-1" style={{ color: INK }}>{value}</p>
      {note && <p className="text-xs mt-1" style={{ color: MUTED }}>{note}</p>}
    </div>
  );
}

function Section({ title, children, hint }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-heading font-bold text-lg" style={{ color: INK }}>{title}</h3>
        {hint && <p className="text-xs" style={{ color: MUTED }}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function DashboardTab() {
  const [range, setRange] = useState({ from: daysAgo(29), to: daysAgo(0) });
  const [sport, setSport] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [source, setSource] = useState("");
  const [leagues, setLeagues] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/leagues`, { params: { limit: 200 }, withCredentials: true }).then((r) => setLeagues(r.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: d } = await axios.get(`${API}/dashboard`, {
        params: { date_from: range.from, date_to: range.to, sport, league_id: leagueId, source },
        withCredentials: true,
      });
      setData(d);
    } catch (e) {
      setError(e.response?.data?.detail || "Could not load the dashboard");
    } finally {
      setLoading(false);
    }
  }, [range, sport, leagueId, source]);
  useEffect(() => { load(); }, [load]);

  const preset = (n) => setRange({ from: daysAgo(n - 1), to: daysAgo(0) });
  const d = data;
  const def = d?.definitions || {};
  const maxFunnel = d ? Math.max(1, ...d.funnel.map((f) => f.count)) : 1;
  const sportsInUse = [...new Set(leagues.map((l) => l.sport))];
  const leagueChoices = leagues.filter((l) => !sport || l.sport === sport);

  return (
    <div className="space-y-8" data-testid="dashboard-tab">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          {[7, 30, 90].map((n) => (
            <button key={n} onClick={() => preset(n)} className="px-3 py-2 text-sm bg-white text-gray-900" style={controlStyle} data-testid={`dash-preset-${n}`}>Last {n} days</button>
          ))}
        </div>
        <label className="text-xs" style={{ color: MUTED }}>From
          <input type="date" className={`${control} block`} style={controlStyle} value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} data-testid="dash-from" />
        </label>
        <label className="text-xs" style={{ color: MUTED }}>To
          <input type="date" className={`${control} block`} style={controlStyle} value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} data-testid="dash-to" />
        </label>
        <label className="text-xs" style={{ color: MUTED }}>Sport
          <select className={`${control} block`} style={controlStyle} value={sport} onChange={(e) => { setSport(e.target.value); setLeagueId(""); }} data-testid="dash-sport">
            <option value="">All sports</option>
            {sportsInUse.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-xs" style={{ color: MUTED }}>League
          <select className={`${control} block max-w-[220px]`} style={controlStyle} value={leagueId} onChange={(e) => setLeagueId(e.target.value)} data-testid="dash-league">
            <option value="">All leagues</option>
            {leagueChoices.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="text-xs" style={{ color: MUTED }}>Signup source
          <select className={`${control} block`} style={controlStyle} value={source} onChange={(e) => setSource(e.target.value)} data-testid="dash-source">
            <option value="">All sources</option>
            {(d?.available_sources || []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="px-4 py-3 text-sm" style={{ background: "#FEE2E2", color: "#B91C1C" }} role="alert">{error}</div>}
      {!d && loading && <p className="text-sm" style={{ color: MUTED }}>Loading…</p>}

      {d && (
        <div className={loading ? "opacity-60 space-y-8" : "space-y-8"}>
          <Section title="Players" hint="Hover a label to see how it is calculated. Full definitions are at the bottom.">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="Registered players" value={d.players.total} help={def.total_players} testid="kpi-total" />
              <Card label="New today / 7d / 30d" value={`${d.players.new_today} / ${d.players.new_week} / ${d.players.new_month}`} help={def.new_players} testid="kpi-new" />
              <Card label="Active players" value={d.players.active} note={`${d.players.inactive} inactive`} help={def.active_players} testid="kpi-active" />
              <Card label="Not in a league" value={d.not_participating} note="of those who signed up in this period" help={def.not_participating} testid="kpi-not-participating" />
              <Card label="League registrations" value={d.league_registrations.total} note={`${d.league_registrations.in_range} in this period · ${d.league_registrations.distinct_players} players`} help={def.league_registrations} testid="kpi-registrations" />
              <Card label="Sign-up to league" value={pct(d.conversion.signup_to_league)} help={def.signup_to_league} testid="kpi-signup-league" />
              <Card label="League to first match" value={pct(d.conversion.league_to_played)} help={def.league_to_played} testid="kpi-league-played" />
              <Card label="Activated in 7 days" value={pct(d.activation_7d.rate)} note={`${d.activation_7d.eligible} players eligible`} help={def.activation_7d} testid="kpi-activation" />
              <Card label="Referral sign-ups" value={d.referral_registrations} note="in this period" help={def.referral_registrations} testid="kpi-referrals" />
              {Object.entries(d.sport_distribution).map(([s, n]) => <Card key={s} label={`${s} players`} value={n} help={def.sport_distribution} testid={`kpi-sport-${s}`} />)}
            </div>
          </Section>

          <Section title="Sign-up funnel" hint={`People who signed up between ${d.range.from} and ${d.range.to}, and how far they have got since.`}>
            <div className="space-y-2" data-testid="funnel">
              {d.funnel.map((f) => (
                <div key={f.stage} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0" style={{ color: INK }}>{f.stage}</span>
                  <div className="flex-1 h-6 bg-gray-100">
                    <div className="h-6" style={{ width: `${(100 * f.count) / maxFunnel}%`, background: GREEN, minWidth: f.count ? 2 : 0 }} />
                  </div>
                  <span className="w-16 text-right font-semibold" style={{ color: INK }}>{f.count}</span>
                  <span className="w-28 text-right text-xs" style={{ color: MUTED }}>{pct(f.pct_of_previous)} of previous</span>
                </div>
              ))}
            </div>
            <div className="p-4 bg-white" style={{ border: `1px solid ${BORDER}` }} data-testid="site-events">
              <p className="text-sm font-semibold" style={{ color: INK }}>Before an account exists</p>
              <ul className="mt-2 text-sm space-y-1">
                {Object.entries(d.site_events.counts).map(([k, n]) => <li key={k}>{EVENT_LABELS[k] || k}: <strong>{n}</strong></li>)}
              </ul>
              <p className="text-xs mt-2" style={{ color: MUTED }}>
                {d.site_events.tracked_since ? `Counted from ${d.site_events.tracked_since}. ` : "Nothing counted yet. "}
                Visitors are counted once per browser session and are never identified. Website visits are not tracked here.
              </p>
            </div>
          </Section>

          <Section title="Registrations over time">
            <div className="h-64 bg-white p-2" style={{ border: `1px solid ${BORDER}` }} data-testid="trend-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#F1F1F1" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="signups" name="Sign-ups" stroke={GREEN} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="league_registrations" name="League registrations" stroke={AMBER} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <div className="grid md:grid-cols-2 gap-8">
            <Section title="Needs attention">
              <ul className="text-sm space-y-2 bg-white p-4" style={{ border: `1px solid ${BORDER}` }} data-testid="attention">
                <li>Zelle payments waiting: <strong>{d.pending.zelle_payments}</strong></li>
                <li>Open disputes: <strong>{d.pending.open_disputes}</strong></li>
                <li>Doubles teams waiting for a partner: <strong>{d.pending.doubles_waiting_for_partner}</strong></li>
                <li>Emails that failed to send (30 days): <strong>{d.alerts.email_send_failures_30d}</strong> in {d.alerts.email_jobs_with_failures_30d} sends</li>
                <li>Registration errors: <span style={{ color: MUTED }}>not tracked yet</span></li>
              </ul>
            </Section>
            <Section title="Recent activity">
              <div className="text-sm bg-white p-4 space-y-3" style={{ border: `1px solid ${BORDER}` }} data-testid="recent">
                {d.recent.signups.length === 0 && d.recent.joins.length === 0 && <p style={{ color: MUTED }}>Nothing to show, or your role cannot see player names.</p>}
                {d.recent.signups.length > 0 && <div><p className="text-xs font-semibold uppercase" style={{ color: MUTED }}>New players</p>
                  {d.recent.signups.map((s, i) => <p key={i}>{s.name} <span className="text-xs" style={{ color: MUTED }}>{s.at?.slice(0, 10)}</span></p>)}</div>}
                {d.recent.joins.length > 0 && <div><p className="text-xs font-semibold uppercase" style={{ color: MUTED }}>Joined a league</p>
                  {d.recent.joins.map((j, i) => <p key={i}>{j.name} → {j.league} <span className="text-xs" style={{ color: MUTED }}>{j.at?.slice(0, 10)}</span></p>)}</div>}
              </div>
            </Section>
          </div>

          <Section title="Email campaigns" hint={def.campaigns}>
            <div className="overflow-x-auto" style={{ border: `1px solid ${BORDER}` }}>
              <table className="w-full text-sm" data-testid="campaigns-table">
                <thead style={{ background: "#F1F1F1" }}>
                  <tr className="text-left text-xs uppercase tracking-wide" style={{ color: MUTED }}>
                    <th className="px-3 py-2">Campaign</th><th className="px-3 py-2">Sent</th><th className="px-3 py-2">Sign-ups from link</th><th className="px-3 py-2">Of those joined a league</th>
                  </tr>
                </thead>
                <tbody>
                  {d.campaigns.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center" style={{ color: MUTED }}>No campaigns yet.</td></tr>}
                  {d.campaigns.map((c) => (
                    <tr key={c.campaign} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td className="px-3 py-2">{c.campaign}</td><td className="px-3 py-2">{c.sent}</td><td className="px-3 py-2">{c.signups}</td><td className="px-3 py-2">{c.joined_league}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">How every number is calculated</summary>
            <ul className="mt-2 space-y-2">
              {Object.entries(def).map(([k, v]) => <li key={k}><span className="font-semibold">{k.replace(/_/g, " ")}:</span> <span style={{ color: MUTED }}>{v}</span></li>)}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
