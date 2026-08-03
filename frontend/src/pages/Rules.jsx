import { Link } from "react-router-dom";
import { Trophy, Calendar, Target, TrendingUp, AlertCircle, ArrowUpDown } from "lucide-react";

const TENNIS_DIVISIONS = [
  { level: "Beginner", range: "2.0 – 2.5", desc: "New to competitive play" },
  { level: "Intermediate", range: "3.0 – 3.5", desc: "Consistent rallies" },
  { level: "Advanced", range: "4.0 – 4.5", desc: "Tournament-ready" },
  { level: "Elite", range: "5.0+", desc: "Semi-professional" },
];

const VENLAX_RULES = [
  {
    title: "VENLAX-Specific Match Format",
    items: [
      "Best of 3 sets. Sets to 6 games, win by 2.",
      "6–6 in any set: 7-point tiebreak (win by 2).",
      "Sets split 1–1: 10-point Match Tiebreak (win by 2) in 3rd set.",
      "Optional: No-ad scoring at deuce (one deciding point).",
      "For standard scoring & line calling, see USTA Rules of Tennis →",
    ],
  },
  {
    title: "Season & Scheduling",
    items: [
      "5–7 matches over 6–8 weeks.",
      "Each match has 7-day window. Contact opponent within 48 hours.",
      "Offer 3+ time slots. Higher seed books court & provides balls.",
      "Confirm 24 hours before match.",
      "15+ min late = forfeit. Cancel <2 hrs before = forfeit.",
      "No response within 48 hours = walkover to opponent.",
    ],
  },
  {
    title: "Score Reporting & Disputes",
    items: [
      "Winner reports within 24 hours: set scores, times, court, surface.",
      "Photo of scorecard (both signatures) strongly encouraged.",
      "Opponent confirms within 24 hours (auto-confirmed if silent).",
      "Disputes raised within 24 hours only. Organizer rules final in 24 hours.",
      "Late disputes need photographic evidence to be eligible.",
    ],
  },
  {
    title: "Rankings & Playoff Qualification",
    items: [
      "Points = 3(Wins) + 1(Losses) + 0.5(Set Δ) + 0.1(Game Δ) + Bonus",
      "Bonus: +2 all matches played, +1 straight-set win, +0.5 close 3-set loss",
      "Tiebreakers: Set Δ → Game Δ → Head-to-Head → Opponent Strength",
      "Top 4 (≤12 players) or Top 8 (>12 players) → playoffs",
    ],
  },
  {
    title: "Playoffs",
    items: [
      "Semifinals: Best of 3. 3rd set = 10-point Match Tiebreak.",
      "Final: Best of 3 OR Match Tiebreak (decided before playoffs).",
      "Bronze match (3rd/4th): optional, same format as semifinals.",
    ],
  },
  {
    title: "Withdrawals & No-Shows",
    items: [
      "Mid-season withdrawal: completed matches stand. Remaining = walkovers for opponents.",
      "Replacements accepted only before 50% of season.",
      "3 no-shows in a season = automatic withdrawal.",
    ],
  },
  {
    title: "Court & Safety",
    items: [
      "Court must be hazard-free (no potholes, debris, standing water).",
      "Evening matches need functioning lights.",
      "Unsafe court on match day → home player reschedules within 7 days or opponent gets walkover.",
      "Heat policy: >95°F → organizer must offer hydration breaks.",
      "VENLAX provides no facility insurance. Home player liable.",
    ],
  },
  {
    title: "Sportsmanship & Conduct",
    items: [
      "1st violation: verbal warning. 2nd: point penalty. 3rd: game penalty. 4th: match default.",
      "No coaching in singles. Doubles: verbal only, no electronics.",
      "Suspected match fixing → organizer investigates. 1st offense: season suspension. 2nd: permanent removal.",
    ],
  },
];

const POINTS_FORMULA = {
  formula: "3(W) + 1(L) + 0.5(SW − SL) + 0.1(GW − GL) + Bonus",
  legend: [
    { sym: "W", def: "Match wins" },
    { sym: "L", def: "Match losses" },
    { sym: "SW − SL", def: "Sets won minus lost" },
    { sym: "GW − GL", def: "Games won minus lost" },
    { sym: "Bonus", def: "+2 all matches · +1 straight-set · +0.5 close loss" },
  ],
};

const FORMAT_CARDS = [
  {
    id: "flex",
    label: "Flex League",
    tagline: "Self-scheduled matches over 6–8 weeks.",
    color: "bg-orange-500",
    highlights: ["5–7 matches", "You arrange timing", "Top 4–8 → playoffs"],
  },
  {
    id: "rr",
    label: "Round Robin",
    tagline: "Pre-scheduled: everyone plays everyone once.",
    color: "bg-blue-600",
    highlights: ["Fixed schedule", "Group phase", "Top players → playoffs"],
  },
  {
    id: "box",
    label: "Box League",
    tagline: "6-player boxes with promotion/relegation.",
    color: "bg-violet-600",
    highlights: ["~6 per box", "Top 2 promote, bottom 2 relegate", "No playoffs"],
  },
  {
    id: "ladder",
    label: "Challenge Ladder",
    tagline: "Always-on: challenge anyone above you.",
    color: "bg-amber-500",
    highlights: ["Permanent ranked list", "Join anytime", "Win = rank swap"],
  },
];

export default function Rules() {
  return (
    <div className="min-h-screen bg-white pt-32 px-6 pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-16 text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-4">VENLAX Rules</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Quick & clear. We keep only VENLAX-specific rules here. For standard tennis rules & scoring,
            see <a href="https://www.usta.com/en/home.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">USTA Rules of Tennis →</a>
          </p>
        </div>

        {/* Divisions */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">Skill Divisions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TENNIS_DIVISIONS.map((div, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-5">
                <div className="font-bold text-lg text-slate-900">{div.level}</div>
                <div className="text-slate-600">{div.range}</div>
                <div className="text-sm text-slate-500 mt-2">{div.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Format Cards */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">Match Formats</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FORMAT_CARDS.map((card) => (
              <div key={card.id} className={`${card.color} text-white rounded-lg p-6`}>
                <div className="text-2xl font-bold mb-2">{card.label}</div>
                <div className="text-sm opacity-90 mb-4">{card.tagline}</div>
                <ul className="text-sm space-y-1">
                  {card.highlights.map((h, i) => (
                    <li key={i}>• {h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* VENLAX-Specific Rules */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">VENLAX-Specific Rules</h2>
          <div className="space-y-10">
            {VENLAX_RULES.map((section, i) => (
              <div key={i}>
                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Trophy size={20} className="text-orange-500" />
                  {section.title}
                </h3>
                <ul className="space-y-2 text-slate-700 ml-8">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex gap-3">
                      <span className="text-orange-500 font-bold mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Points Formula */}
        <section className="mb-20 bg-slate-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp size={24} className="text-blue-600" />
            Ranking Formula
          </h2>
          <div className="mb-6 p-4 bg-blue-100 rounded text-blue-900 font-mono">
            {POINTS_FORMULA.formula}
          </div>
          <div className="space-y-3">
            {POINTS_FORMULA.legend.map((item, i) => (
              <div key={i} className="flex gap-4">
                <span className="font-bold text-slate-900 min-w-fit">{item.sym}:</span>
                <span className="text-slate-700">{item.def}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Back to Leagues */}
        <div className="text-center pt-8 border-t border-slate-200">
          <Link to="/leagues" className="text-blue-600 hover:underline text-lg font-semibold">
            ← Back to Leagues
          </Link>
        </div>
      </div>
    </div>
  );
}
