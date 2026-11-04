import { AVAILABILITY_ROWS, BACKHANDS, HANDS, STYLE_OPTIONS, courtSideOptions } from "../config/playProfile";

const BORDER = "#D1D5DB";
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008F70]";

/** Connected single-choice buttons. Clicking the selected one clears it. */
function Segmented({ label, options, value, onSelect, testPrefix }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full sm:inline-flex sm:w-auto" style={{ border: `1px solid ${BORDER}` }}>
      {options.map((o, i) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(o.value)}
            className={`flex-1 sm:flex-none px-3 py-2 text-sm font-medium transition-colors ${FOCUS}`}
            style={{
              background: active ? "#008F70" : "#FFFFFF",
              color: active ? "#FFFFFF" : "#374151",
              borderLeft: i ? `1px solid ${BORDER}` : "none",
            }}
            data-testid={`${testPrefix}-${o.value}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Standalone toggle button for multi-select and single-select-with-clear groups. */
function Chip({ active, onClick, testId, dimmed, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 text-sm font-medium transition-colors ${FOCUS}`}
      style={{
        background: active ? "#008F70" : "#FFFFFF",
        color: active ? "#FFFFFF" : "#374151",
        border: `1px solid ${active ? "#008F70" : BORDER}`,
        opacity: dimmed && !active ? 0.55 : 1,
      }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-widest pb-2" style={{ color: "#B7791F", borderBottom: "2px solid #F2A922" }}>
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="py-3 sm:grid sm:grid-cols-[9.5rem_1fr] sm:items-start sm:gap-4" style={{ borderBottom: "1px solid #F1F1F1" }}>
      <div className="mb-2 sm:mb-0 sm:pt-2">
        <p className="text-sm font-semibold" style={{ color: "#1D1D1D" }}>{label}</p>
        {hint && <p className="text-xs" style={{ color: "#6B7280" }}>{hint}</p>}
      </div>
      <div>{children}</div>
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
  const availability = value.availability || [];
  const flexible = availability.includes("flexible");

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

  // "Flexible" is exclusive: choosing it replaces specific slots, choosing a slot drops it.
  const toggleAvailability = (v) => {
    if (v === "flexible") return setKey("availability", flexible ? undefined : ["flexible"]);
    const base = availability.filter((a) => a !== "flexible");
    setKey("availability", base.includes(v) ? base.filter((a) => a !== v) : [...base, v]);
  };

  const years = value.years_playing;
  const setYears = (n) => setKey("years_playing", n == null ? undefined : Math.min(60, Math.max(0, n)));

  return (
    <div className="space-y-7" data-testid="play-profile-form">
      <Section title="On court">
        <Field label="Court side" hint="Which side you prefer in doubles">
          <Segmented label="Preferred court side" options={courtSideOptions(sports)} value={value.court_side} onSelect={(v) => toggleKey("court_side", v)} testPrefix="pp-court-side" />
        </Field>
        <Field label="Dominant hand">
          <Segmented label="Dominant hand" options={HANDS} value={value.dominant_hand} onSelect={(v) => toggleKey("dominant_hand", v)} testPrefix="pp-hand" />
        </Field>
        {showTennis && (
          <Field label="Backhand" hint="Tennis">
            <Segmented label="Backhand" options={BACKHANDS} value={value.backhand} onSelect={(v) => toggleKey("backhand", v)} testPrefix="pp-backhand" />
          </Field>
        )}
      </Section>

      <Section title="Play style">
        {showTennis && (
          <Field label="🎾 Tennis">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tennis play style">
              {STYLE_OPTIONS.tennis.map((o) => (
                <Chip key={o.value} active={value.play_style?.tennis === o.value} onClick={() => setStyle("tennis", o.value)} testId={`pp-style-tennis-${o.value}`}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </Field>
        )}
        {showPickleball && (
          <Field label="🏓 Pickleball">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Pickleball play style">
              {STYLE_OPTIONS.pickleball.map((o) => (
                <Chip key={o.value} active={value.play_style?.pickleball === o.value} onClick={() => setStyle("pickleball", o.value)} testId={`pp-style-pickleball-${o.value}`}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </Field>
        )}
      </Section>

      <Section title="Experience & schedule">
        <Field label="Years playing">
          <div className="inline-flex items-stretch" style={{ border: `1px solid ${BORDER}` }}>
            <button
              type="button"
              onClick={() => setYears(years == null ? undefined : years - 1)}
              disabled={years == null || years <= 0}
              aria-label="Decrease years playing"
              className={`w-9 text-lg font-bold disabled:opacity-40 ${FOCUS}`}
              style={{ background: "#F1F1F1", color: "#1D1D1D" }}
              data-testid="pp-years-dec"
            >
              −
            </button>
            <input
              type="number"
              min={0}
              max={60}
              inputMode="numeric"
              value={years ?? ""}
              placeholder="–"
              aria-label="Years playing"
              onChange={(e) => setYears(e.target.value === "" ? undefined : parseInt(e.target.value, 10) || 0)}
              className="w-14 text-center text-sm font-semibold focus:outline-none"
              style={{ color: "#1D1D1D", background: "white" }}
              data-testid="pp-years"
            />
            <button
              type="button"
              onClick={() => setYears((years ?? 0) + 1)}
              disabled={years != null && years >= 60}
              aria-label="Increase years playing"
              className={`w-9 text-lg font-bold disabled:opacity-40 ${FOCUS}`}
              style={{ background: "#F1F1F1", color: "#1D1D1D" }}
              data-testid="pp-years-inc"
            >
              +
            </button>
          </div>
        </Field>
        <Field label="Availability" hint="Pick all that work">
          <div className="space-y-2" role="group" aria-label="Availability">
            {AVAILABILITY_ROWS.map((row) => (
              <div key={row.label} className="flex flex-wrap items-center gap-2">
                <span className="w-20 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>{row.label}</span>
                {row.slots.map((s) => (
                  <Chip key={s.value} active={availability.includes(s.value)} dimmed={flexible} onClick={() => toggleAvailability(s.value)} testId={`pp-avail-${s.value}`}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Any time</span>
              <Chip active={flexible} onClick={() => toggleAvailability("flexible")} testId="pp-avail-flexible">
                Flexible
              </Chip>
            </div>
          </div>
        </Field>
      </Section>

      <Section title="Doubles">
        <div className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#1D1D1D" }}>Looking for a doubles partner</p>
            <p className="text-xs" style={{ color: "#6B7280" }}>Shown on your profile so others can reach out.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!value.looking_for_partner}
            aria-label="Looking for a doubles partner"
            onClick={() => setKey("looking_for_partner", value.looking_for_partner ? undefined : true)}
            className={`relative h-6 w-11 shrink-0 transition-colors ${FOCUS}`}
            style={{ background: value.looking_for_partner ? "#008F70" : "#D1D5DB" }}
            data-testid="pp-looking-for-partner"
          >
            <span
              className="absolute top-0.5 h-5 w-5 bg-white transition-all"
              style={{ left: value.looking_for_partner ? "1.375rem" : "0.125rem" }}
            />
          </button>
        </div>
      </Section>
    </div>
  );
}
