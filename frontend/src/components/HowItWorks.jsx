import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

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
    <section className="py-24 bg-white border-t border-gray-100" data-testid="how-it-works">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-start">

          {/* Left: sticky heading */}
          <div className="lg:sticky lg:top-24 lg:w-80 flex-shrink-0">
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em] mb-4"
              style={{ color: "#C9572A" }}
            >
              The Process
            </p>
            <h2
              className="font-heading font-black leading-[0.9] tracking-tight mb-6 uppercase text-gray-900"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)" }}
            >
              Six moves.<br />
              <span style={{ color: "#C9572A" }}>One championship<br />season.</span>
            </h2>
            <p className="text-sm leading-relaxed mb-8 max-w-[28ch] text-gray-500">
              No admin chaos. No spreadsheets. Ranked competition, handled.
            </p>
            <Link
              to="/leagues"
              className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-lg text-white transition-colors"
              style={{ background: "#C9572A" }}
              onMouseEnter={e => e.currentTarget.style.background = "#B04823"}
              onMouseLeave={e => e.currentTarget.style.background = "#C9572A"}
              data-testid="how-cta-leagues"
            >
              See open leagues <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Right: step list */}
          <div className="flex-1 divide-y divide-gray-100">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="py-7 flex gap-6 items-start group"
                data-testid={`how-step-${s.n}`}
              >
                <span
                  className="font-heading font-black flex-shrink-0 leading-none mt-0.5 select-none transition-colors duration-200"
                  style={{
                    fontSize: "2rem",
                    width: "2.5rem",
                    textAlign: "right",
                    color: "#E5E7EB",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "#C9572A"}
                  onMouseLeave={e => e.currentTarget.style.color = "#E5E7EB"}
                >
                  {s.n}
                </span>
                <div>
                  <h3
                    className="font-heading font-bold mb-1.5 leading-tight tracking-tight text-gray-900"
                    style={{ fontSize: "1.25rem" }}
                  >
                    {s.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
