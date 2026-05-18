import { Link } from "react-router-dom";
import { Trophy, CalendarDays, Users, BarChart3, Zap, Repeat, ArrowRight } from "lucide-react";

const STEPS = [
  {
    n: "01",
    icon: Trophy,
    title: "Choose your format",
    body: "Singles. Doubles. Mixed. Monthly or seasonal — pick the league that fits your level and city.",
    accent: "text-emerald-500",
  },
  {
    n: "02",
    icon: CalendarDays,
    title: "Get your fixture list",
    body: "Five ranked matches against players at your skill level. Skill-matched. City-based. No soft opponents.",
    accent: "text-amber-500",
  },
  {
    n: "03",
    icon: Users,
    title: "Lock in your match",
    body: "Contact your opponent directly. See their rating, availability, and location. One tap to confirm.",
    accent: "text-sky-500",
  },
  {
    n: "04",
    icon: BarChart3,
    title: "Log. Rank. Repeat.",
    body: "Submit results in seconds. Your rating and standings update in real time — every match counts.",
    accent: "text-purple-500",
  },
  {
    n: "05",
    icon: Zap,
    title: "Earn your playoff spot",
    body: "Top performers advance to the bracket. Single-elimination. Auto-seeded. No second chances.",
    accent: "text-pink-500",
  },
  {
    n: "06",
    icon: Repeat,
    title: "Never stop competing",
    body: "New seasons drop year-round. Spring. Summer. Fall. Winter. Defend your rank. Chase the title.",
    accent: "text-rose-500",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-white py-24 px-6" data-testid="how-it-works">
      <div className="max-w-6xl mx-auto">
        <div className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-3">The Process</p>
          <h2 className="font-heading font-black text-3xl sm:text-4xl text-gray-900 mb-3">
            Six moves. One <span className="text-emerald-500">championship season.</span>
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            No admin chaos. No spreadsheets. Just ranked competition, handled.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className="group bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                data-testid={`how-step-${s.n}`}
              >
                <div className="flex items-start gap-4 mb-3">
                  <span className="font-heading font-black text-3xl text-gray-200 group-hover:text-gray-300 transition-colors">{s.n}</span>
                  <div className={`w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center ${s.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="font-heading font-bold text-lg text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link
            to="/leagues"
            className="inline-flex items-center gap-2 text-sm font-semibold bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
            data-testid="how-cta-leagues"
          >
            See open leagues <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-gray-400 mt-3">
            $9.99 singles · $19.99 doubles · All US cities · No commitment.
          </p>
        </div>
      </div>
    </section>
  );
}
