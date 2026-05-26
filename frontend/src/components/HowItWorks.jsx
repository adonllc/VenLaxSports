import { Link } from "react-router-dom";
import { Trophy, CalendarDays, Users, BarChart3, Zap, Repeat, ArrowRight } from "lucide-react";

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
    <section className="bg-white py-24 border-t border-gray-100" data-testid="how-it-works">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-start">

          {/* Left: sticky heading */}
          <div className="lg:sticky lg:top-28 lg:w-72 flex-shrink-0">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600 mb-4">
              The Process
            </p>
            <h2
              className="font-heading font-black text-gray-900 leading-[0.9] tracking-tight mb-6"
              style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)" }}
            >
              Six moves.<br />
              <span className="text-emerald-500">One championship<br />season.</span>
            </h2>
            <p className="font-body text-sm text-gray-500 leading-relaxed mb-8 max-w-[28ch]">
              No admin chaos. No spreadsheets. Ranked competition, handled.
            </p>
            <Link
              to="/leagues"
              className="inline-flex items-center gap-2 font-body text-sm font-semibold bg-black text-white px-6 py-3 rounded-md hover:bg-gray-800 transition-colors"
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
                  className="font-heading font-black flex-shrink-0 leading-none mt-0.5 select-none transition-colors duration-200 group-hover:text-emerald-200"
                  style={{ fontSize: "2rem", color: "#E5E7EB", width: "2.5rem", textAlign: "right" }}
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="font-heading font-bold text-gray-900 mb-1.5 leading-tight tracking-tight" style={{ fontSize: "1.25rem" }}>
                    {s.title}
                  </h3>
                  <p className="font-body text-sm text-gray-500 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
