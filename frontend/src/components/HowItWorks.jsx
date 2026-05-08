import { Link } from "react-router-dom";
import { Trophy, CalendarDays, Users, BarChart3, Zap, Repeat, ArrowRight } from "lucide-react";

const STEPS = [
  {
    n: "01",
    icon: Trophy,
    title: "Pick your league",
    body: "Singles, doubles or mixed — choose the format that fits your game. New leagues spin up monthly, quarterly, half-yearly and yearly so there's always one open near you.",
    accent: "text-emerald-500",
  },
  {
    n: "02",
    icon: CalendarDays,
    title: "Get a personalized schedule",
    body: "Once registration closes, you'll get 5 matches against players at your skill level — one a week, with a built-in makeup week for life's curveballs.",
    accent: "text-amber-500",
  },
  {
    n: "03",
    icon: Users,
    title: "Schedule matches your way",
    body: "Coordinate court time directly with your opponent — VENLAX shows you their availability, contact, and rating so you can lock in a slot in one tap.",
    accent: "text-sky-500",
  },
  {
    n: "04",
    icon: BarChart3,
    title: "Report scores & track progress",
    body: "Log results in seconds. Watch your rating curve, win rate and standings update in real time on your dashboard — every match counts.",
    accent: "text-purple-500",
  },
  {
    n: "05",
    icon: Zap,
    title: "Climb to the playoffs",
    body: "Top performers in each division earn an auto-generated playoff bracket — single-elim seeding, with the next round spawning the moment results are in.",
    accent: "text-pink-500",
  },
  {
    n: "06",
    icon: Repeat,
    title: "Play all season, every season",
    body: "Spring, summer, fall, winter — VENLAX runs leagues all year so your competitive momentum never stops. Defend your title, rise a division, build the streak.",
    accent: "text-rose-500",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-white py-24 px-6" data-testid="how-it-works">
      <div className="max-w-6xl mx-auto">
        <div className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-3">How VENLAX Sports works</p>
          <h2 className="font-heading font-black text-3xl sm:text-4xl text-gray-900 mb-3">
            Six steps from <span className="text-emerald-500">signup</span> to <span className="text-emerald-500">silverware</span>.
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            Built for players who want to compete, connect, and rise — without the spreadsheet headaches.
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
            Browse open leagues <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-gray-400 mt-3">
            Standard pricing — $9.99 singles · $19.99 doubles · open to every USA city.
          </p>
        </div>
      </div>
    </section>
  );
}
