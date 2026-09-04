import { Link } from "react-router-dom";
import { Trophy, TrendingUp } from "lucide-react";

const TENNIS_DIVISIONS = [
  { level: "Beginner", range: "2.0 – 2.5", desc: "New to competitive play" },
  { level: "Intermediate", range: "3.0 – 3.5", desc: "Consistent rallies" },
  { level: "Advanced", range: "4.0 – 4.5", desc: "Tournament-ready" },
  { level: "Elite", range: "5.0+", desc: "Semi-professional" },
];

const VENLAX_RULES = [
  {
    title: "Match Format",
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
      "No facility insurance provided. Home player liable.",
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
    tagline: "You arrange match timing. 5–7 matches, 6–8 weeks.",
    color: "bg-orange-500",
    highlights: ["Self-scheduled", "You book courts & opponents", "Top 4–8 qualify for playoffs"],
  },
  {
    id: "rr",
    label: "Round Robin",
    tagline: "Fixed schedule: everyone plays everyone once.",
    color: "bg-blue-600",
    highlights: ["Organizer books courts", "Group phase calendar set upfront", "Top players advance to playoffs"],
  },
  {
    id: "box",
    label: "Box League",
    tagline: "Small groups (6 players) competing within boxes.",
    color: "bg-violet-600",
    highlights: ["Tight-knit groups", "Top 2 promote, bottom 2 relegate each cycle", "No season-end playoffs"],
  },
  {
    id: "ladder",
    label: "Challenge Ladder",
    tagline: "Ongoing ranked ladder. Challenge anyone above you.",
    color: "bg-amber-500",
    highlights: ["Permanent ranked list", "Join anytime, climb year-round", "Win = swap ranks with opponent"],
  },
];

export default function Rules() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b" style={{ background: "white", borderColor: "#E5E7EB" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "#EA580C", fontFamily: "'Sora', system-ui, sans-serif" }}>Rules & Formats</p>
          <h1 className="font-heading font-black text-6xl sm:text-7xl mb-2" style={{ color: "#047857", fontFamily: "'Sora', system-ui, sans-serif" }}>Rules</h1>
          <p className="max-w-lg" style={{ color: "#6B7280" }}>
            Quick & clear. We keep only VENLAX-specific rules here. For standard tennis rules & scoring,
            see <a href="https://www.usta.com/en/home.html" target="_blank" rel="noopener noreferrer" style={{ color: "#065F46" }} className="hover:underline font-semibold">USTA Rules of Tennis →</a>
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Divisions */}
        <section className="mb-28">
          <h2 className="font-heading font-black text-4xl sm:text-5xl mb-8" style={{ color: "#047857", fontFamily: "'Sora', system-ui, sans-serif" }}>Skill Divisions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TENNIS_DIVISIONS.map((div, i) => (
              <div key={i} className="rounded-lg p-5" style={{ border: "1px solid #E5E7EB", background: "white" }}>
                <div className="font-heading font-bold text-lg" style={{ color: "#065F46" }}>{div.level}</div>
                <div style={{ color: "#6B7280" }}>{div.range}</div>
                <div className="text-sm mt-2" style={{ color: "#6B7280" }}>{div.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Format Cards */}
        <section className="mb-28">
          <h2 className="font-heading font-black text-4xl sm:text-5xl mb-3" style={{ color: "#047857", fontFamily: "'Sora', system-ui, sans-serif" }}>League Structures</h2>
          <p className="text-lg mb-8" style={{ color: "#6B7280", fontFamily: "'IBM Plex Sans', sans-serif" }}>How a season runs. Combined with match formats (Singles/Doubles/Mixed) at registration.</p>
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

        {/* Platform Rules */}
        <section className="mb-28">
          <h2 className="font-heading font-black text-4xl sm:text-5xl mb-8" style={{ color: "#047857", fontFamily: "'Sora', system-ui, sans-serif" }}>Platform Rules</h2>
          <div className="space-y-10">
            {VENLAX_RULES.map((section, i) => (
              <div key={i}>
                <h3 className="font-heading font-bold text-lg mb-4 flex items-center gap-2" style={{ color: "#065F46" }}>
                  <Trophy size={20} style={{ color: "#C24A1D" }} />
                  {section.title}
                </h3>
                <ul className="space-y-2 ml-8" style={{ color: "#374151" }}>
                  {section.items.map((item, j) => (
                    <li key={j} className="flex gap-3">
                      <span className="font-bold mt-0.5" style={{ color: "#C24A1D" }}>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Points Formula */}
        <section className="mb-28 rounded-lg p-8" style={{ background: "#F8F9FA", border: "1px solid #E5E7EB" }}>
          <h2 className="font-heading font-black text-3xl sm:text-4xl mb-6 flex items-center gap-2" style={{ color: "#047857", fontFamily: "'Sora', system-ui, sans-serif" }}>
            <TrendingUp size={24} style={{ color: "#065F46" }} />
            Ranking Formula
          </h2>
          <div className="mb-6 p-4 rounded font-mono" style={{ background: "#DBEAFE", color: "#065F46" }}>
            {POINTS_FORMULA.formula}
          </div>
          <div className="space-y-3">
            {POINTS_FORMULA.legend.map((item, i) => (
              <div key={i} className="flex gap-4">
                <span className="font-bold min-w-fit" style={{ color: "#065F46" }}>{item.sym}:</span>
                <span style={{ color: "#374151" }}>{item.def}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Back to Leagues */}
        <div className="text-center pt-12" style={{ borderTop: "1px solid #E5E7EB" }}>
          <Link to="/leagues" style={{ color: "#047857", fontFamily: "'Sora', system-ui, sans-serif" }} className="hover:underline text-xl font-black">
            ← Back to Leagues
          </Link>
        </div>
      </div>
    </div>
  );
}
