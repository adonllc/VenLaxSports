import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const LIME      = "#C5D600";
const LIME_HOVER= "#AEBE00";
const NAVY      = "#1B2A4A";
const TEAL      = "#00B4A4";
const PAGE_BG   = "#0A192F";
const BORDER_D  = "rgba(255,255,255,0.10)";
const D_HEAD    = "#ffffff";
const D_BODY    = "rgba(255,255,255,0.70)";
const D_MUTED   = "rgba(255,255,255,0.42)";
const NUM_COLOR = "rgba(255,255,255,0.12)";

const STEPS = [
  {
    n: "01",
    title: "Choose your format",
    body: "Singles. Doubles. Mixed. Monthly or seasonal — pick the league that fits your level and city.",
  },
  {
    n: "02",
    title: "Get your fixture list",
    body: "Five ranked matches against players at your skill level. Skill-matched. City-based. No soft opponents.",
  },
  {
    n: "03",
    title: "Lock in your match",
    body: "Contact your opponent directly. See their rating, availability, and location. One tap to confirm.",
  },
  {
    n: "04",
    title: "Log. Rank. Repeat.",
    body: "Submit results in seconds. Your rating and standings update in real time — every match counts.",
  },
  {
    n: "05",
    title: "Earn your playoff spot",
    body: "Top performers advance to the bracket. Single-elimination. Auto-seeded. No second chances.",
  },
  {
    n: "06",
    title: "Never stop competing",
    body: "New seasons drop year-round. Spring. Summer. Fall. Winter. Defend your rank. Chase the title.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 border-t" style={{ background: PAGE_BG, borderColor: BORDER_D }} data-testid="how-it-works">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-start">

          {/* Left: sticky heading */}
          <div className="lg:sticky lg:top-28 lg:w-72 flex-shrink-0">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] mb-4" style={{ color: TEAL }}>
              The Process
            </p>
            <h2
              className="font-heading font-black leading-[0.9] tracking-tight mb-6 uppercase"
              style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", color: D_HEAD }}
            >
              Six moves.<br />
              <span style={{ color: LIME }}>One championship<br />season.</span>
            </h2>
            <p className="font-body text-sm leading-relaxed mb-8 max-w-[28ch]" style={{ color: D_BODY }}>
              No admin chaos. No spreadsheets. Ranked competition, handled.
            </p>
            <Link
              to="/leagues"
              className="inline-flex items-center gap-2 font-body text-sm font-bold px-6 py-3 rounded-md transition-colors"
              style={{ background: LIME, color: NAVY }}
              onMouseEnter={e => e.currentTarget.style.background = "#AEBE00"}
              onMouseLeave={e => e.currentTarget.style.background = LIME}
              data-testid="how-cta-leagues"
            >
              See open leagues <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Right: step list */}
          <div className="flex-1 divide-y" style={{ borderColor: BORDER_D }}>
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="py-7 flex gap-6 items-start group"
                data-testid={`how-step-${s.n}`}
              >
                <span
                  className="font-heading font-black flex-shrink-0 leading-none mt-0.5 select-none transition-colors duration-200"
                  style={{ fontSize: "2rem", color: NUM_COLOR, width: "2.5rem", textAlign: "right" }}
                  onMouseEnter={e => e.currentTarget.style.color = LIME}
                  onMouseLeave={e => e.currentTarget.style.color = NUM_COLOR}
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="font-heading font-bold mb-1.5 leading-tight tracking-tight" style={{ fontSize: "1.25rem", color: D_HEAD }}>
                    {s.title}
                  </h3>
                  <p className="font-body text-sm leading-relaxed" style={{ color: D_MUTED }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
