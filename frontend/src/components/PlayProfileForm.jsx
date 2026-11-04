import { AVAILABILITY, BACKHANDS, HANDS, STYLE_OPTIONS, courtSideOptions } from "../config/playProfile";

function Pill({ active, onClick, testId, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="px-3 py-1.5 text-sm font-medium transition-colors"
      style={active
        ? { background: "#008F70", color: "#FFFFFF", border: "1px solid #008F70" }
        : { background: "#FFFFFF", color: "#374151", border: "1px solid #E5E7EB" }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function Group({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#6B7280" }}>{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * Controlled play-profile form. `value` is the play_profile object (may be empty),
 * `onChange(next)` receives the whole next object. Clicking a selected option clears it.
 */
export default function PlayProfileForm({ value, onChange, sports = [] }) {
  const showTennis = !sports.length || sports.includes("tennis");
  const showPickleball = !sports.length || sports.includes("pickleball");

  const setKey = (key, v) => {
    const next = { ...value };
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  const toggleKey = (key, v) => setKey(key, value[key] === v ? undefined : v);

  const setStyle = (sport, v) => {
    const style = { ...(value.play_style || {}) };
    if (style[sport] === v) delete style[sport];
    else style[sport] = v;
    setKey("play_style", Object.keys(style).length ? style : undefined);
  };

  const toggleAvailability = (v) => {
    const cur = value.availability || [];
    setKey("availability", cur.includes(v) ? cur.filter((a) => a !== v) : [...cur, v]);
  };

  return (
    <div className="space-y-5" data-testid="play-profile-form">
      <Group label="Preferred court side">
        {courtSideOptions(sports).map((o) => (
          <Pill key={o.value} active={value.court_side === o.value} onClick={() => toggleKey("court_side", o.value)} testId={`pp-court-side-${o.value}`}>
            {o.label}
          </Pill>
        ))}
      </Group>

      <Group label="Dominant hand">
        {HANDS.map((o) => (
          <Pill key={o.value} active={value.dominant_hand === o.value} onClick={() => toggleKey("dominant_hand", o.value)} testId={`pp-hand-${o.value}`}>
            {o.label}
          </Pill>
        ))}
      </Group>

      {showTennis && (
        <Group label="Backhand (tennis)">
          {BACKHANDS.map((o) => (
            <Pill key={o.value} active={value.backhand === o.value} onClick={() => toggleKey("backhand", o.value)} testId={`pp-backhand-${o.value}`}>
              {o.label}
            </Pill>
          ))}
        </Group>
      )}

      {showTennis && (
        <Group label="Tennis play style">
          {STYLE_OPTIONS.tennis.map((o) => (
            <Pill key={o.value} active={value.play_style?.tennis === o.value} onClick={() => setStyle("tennis", o.value)} testId={`pp-style-tennis-${o.value}`}>
              {o.label}
            </Pill>
          ))}
        </Group>
      )}

      {showPickleball && (
        <Group label="Pickleball play style">
          {STYLE_OPTIONS.pickleball.map((o) => (
            <Pill key={o.value} active={value.play_style?.pickleball === o.value} onClick={() => setStyle("pickleball", o.value)} testId={`pp-style-pickleball-${o.value}`}>
              {o.label}
            </Pill>
          ))}
        </Group>
      )}

      <div>
        <label htmlFor="pp-years" className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#6B7280" }}>
          Years playing
        </label>
        <input
          id="pp-years"
          type="number"
          min={0}
          max={60}
          value={value.years_playing ?? ""}
          onChange={(e) => setKey("years_playing", e.target.value === "" ? undefined : Math.min(60, Math.max(0, parseInt(e.target.value, 10) || 0)))}
          className="w-24 px-3 py-1.5 text-sm"
          style={{ border: "1px solid #E5E7EB", color: "#3D3D3D", background: "white" }}
          data-testid="pp-years"
        />
      </div>

      <Group label="Availability">
        {AVAILABILITY.map((o) => (
          <Pill key={o.value} active={(value.availability || []).includes(o.value)} onClick={() => toggleAvailability(o.value)} testId={`pp-avail-${o.value}`}>
            {o.label}
          </Pill>
        ))}
      </Group>

      <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "#374151" }}>
        <input
          type="checkbox"
          checked={!!value.looking_for_partner}
          onChange={(e) => setKey("looking_for_partner", e.target.checked ? true : undefined)}
          data-testid="pp-looking-for-partner"
        />
        I'm looking for a doubles partner
      </label>
    </div>
  );
}
