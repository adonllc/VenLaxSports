import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { MapPin, CalendarDays, Clock } from "lucide-react";
import { apiError } from "../utils/challengeUi";
import { OPEN_STATUS, PROXIMITY, courtLabel, levelRange, sportName, whenText } from "../utils/openChallengeUi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export function Avatar({ owner, size = 44 }) {
  const initial = (owner?.name || "?")[0].toUpperCase();
  return owner?.avatar ? (
    <img src={owner.avatar} alt="" width={size} height={size} className="object-cover shrink-0" style={{ width: size, height: size }} referrerPolicy="no-referrer" />
  ) : (
    <span className="flex items-center justify-center shrink-0 font-bold text-white" style={{ width: size, height: size, background: "#008F70" }} aria-hidden="true">{initial}</span>
  );
}

export function StatusChip({ status }) {
  const s = OPEN_STATUS[status] || OPEN_STATUS.open;
  return <span className="px-2 py-0.5 text-[11px] font-semibold shrink-0" style={{ background: s.bg, color: s.fg }} data-testid={`open-status-${status}`}>{s.label}</span>;
}

/** Find a VENLAX player to be your doubles partner. Uses the same public-profile search as direct challenges. */
export function PartnerPicker({ sport, value, onChange, testid = "partner" }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    const t = setTimeout(() => {
      axios.get(`${API}/challenges/players`, { params: { q, sport }, withCredentials: true })
        .then((r) => setResults(r.data)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, sport]);
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ border: "1px solid #E5E7EB" }} data-testid={`${testid}-chosen`}>
        <span className="text-sm font-medium" style={{ color: "#1D1D1D" }}>{value.name}</span>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold underline" data-testid={`${testid}-clear`}>Change</button>
      </div>
    );
  }
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your partner by name" className="w-full px-3 py-2 text-sm" style={{ border: "1px solid #E5E7EB" }} data-testid={`${testid}-search`} aria-label="Search partner" />
      {results.length > 0 && (
        <ul className="mt-1 max-h-44 overflow-auto bg-white" style={{ border: "1px solid #E5E7EB" }}>
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { onChange({ id: p.id, name: p.name }); setQ(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" data-testid={`${testid}-option-${p.id}`}>
                {p.name} <span className="text-xs" style={{ color: "#6B7280" }}>{p.city} · level {p.level}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Accept dialog: confirms, and for doubles picks the partner. */
export function AcceptDialog({ challenge, onClose, onDone }) {
  const [partner, setPartner] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const doubles = challenge.format === "doubles";
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const { data } = await axios.post(`${API}/open-challenges/${challenge.id}/accept`, { partner_id: partner?.id || null }, { withCredentials: true });
      onDone(data);
    } catch (e) {
      setErr(apiError(e));
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(29,29,29,0.55)" }} role="dialog" aria-modal="true" aria-label="Accept challenge" data-testid="accept-dialog">
      <div className="bg-white w-full max-w-md p-6">
        <h2 className="font-heading font-bold text-xl" style={{ color: "#1D1D1D" }}>Accept {challenge.owner.name}'s challenge?</h2>
        <p className="text-sm mt-2" style={{ color: "#4C4C4C" }}>{sportName(challenge)} · {whenText(challenge)}{challenge.venue ? ` · ${challenge.venue}` : ""}. You will agree the exact time and court together next. First to accept gets it.</p>
        {doubles && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#6B7280" }}>Your partner</p>
            <PartnerPicker sport={challenge.sport} value={partner} onChange={setPartner} testid="accept-partner" />
          </div>
        )}
        {err && <p className="text-sm mt-3" style={{ color: "#B42318" }} role="alert" data-testid="accept-error">{err}</p>}
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold" style={{ border: "1px solid #E5E7EB" }} data-testid="accept-cancel">Not now</button>
          <button onClick={submit} disabled={busy || (doubles && !partner)} className="px-4 py-2 text-sm font-bold uppercase tracking-wider disabled:opacity-50" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="accept-confirm">{busy ? "Reserving..." : "Accept challenge"}</button>
        </div>
      </div>
    </div>
  );
}

export function OpenChallengeCard({ c, onAccept, showOwner = true }) {
  const prox = PROXIMITY[c.proximity];
  return (
    <article className="bg-white p-5" style={{ border: "1px solid #E5E7EB" }} data-testid={`open-card-${c.id}`}>
      <div className="flex items-start gap-3">
        {showOwner && <Avatar owner={c.owner} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {showOwner && <p className="font-semibold truncate" style={{ color: "#1D1D1D" }}>{c.owner.name}</p>}
              <p className="text-sm font-medium" style={{ color: "#008F70" }}>{sportName(c)}</p>
            </div>
            <StatusChip status={c.status} />
          </div>
          <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Opponent level {levelRange(c)}{c.is_mine ? ` · you are ${c.level}` : ` · they are ${c.level}`}</p>
        </div>
      </div>
      <dl className="mt-4 space-y-1.5 text-sm" style={{ color: "#4C4C4C" }}>
        <div className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" style={{ color: "#F2A922" }} aria-hidden="true" /><span>{[c.venue, c.city, c.zip_code].filter(Boolean).join(" · ")}{prox ? ` · ${prox}` : ""}</span></div>
        <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 shrink-0" style={{ color: "#F2A922" }} aria-hidden="true" /><span>{whenText(c)}</span></div>
        <div className="flex items-center gap-2"><Clock className="w-4 h-4 shrink-0" style={{ color: "#F2A922" }} aria-hidden="true" /><span>Court: {courtLabel(c.court_pref).toLowerCase()}{c.max_distance_miles ? ` · up to ${c.max_distance_miles} mi travel` : ""}</span></div>
      </dl>
      {c.notes && <p className="text-sm mt-3 italic" style={{ color: "#4C4C4C" }}>"{c.notes}"</p>}
      {c.ineligible_reason && <p className="text-xs mt-3" style={{ color: "#8A5A00" }} data-testid={`open-ineligible-${c.id}`}>{c.ineligible_reason}</p>}
      <div className="flex gap-2 mt-4">
        {c.can.accept && onAccept && (
          <button onClick={() => onAccept(c)} className="flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid={`open-accept-${c.id}`}>Accept challenge</button>
        )}
        <Link to={c.challenge_id && (c.is_mine || c.is_acceptor) ? `/challenges/${c.challenge_id}` : `/find-opponent/${c.id}`} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-center" style={{ border: "1px solid #1D1D1D", color: "#1D1D1D" }} data-testid={`open-view-${c.id}`}>
          {c.challenge_id && (c.is_mine || c.is_acceptor) ? "Open match" : "Details"}
        </Link>
      </div>
    </article>
  );
}
