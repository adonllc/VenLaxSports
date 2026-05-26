import { Link } from "react-router-dom";
import {
  ShieldCheck, Trophy, Scale, Users, FileText,
  Target, Zap, TrendingUp, AlertCircle, Calendar, Star, ArrowUpDown,
} from "lucide-react";

// ─── Tennis Data ───────────────────────────────────────────────────
const TENNIS_DIVISIONS = [
  { level: "Beginner",     range: "2.0 – 2.5", desc: "New to competitive play, learning fundamentals." },
  { level: "Intermediate", range: "3.0 – 3.5", desc: "Consistent rallies, competitive club-level play." },
  { level: "Advanced",     range: "4.0 – 4.5", desc: "Tournament-ready, strong tactical game." },
  { level: "Elite",        range: "5.0+",       desc: "High-performance competitive or semi-professional." },
];

const TENNIS_RULES = [
  {
    title: "Match Format",
    items: [
      "Best of 3 sets. Sets to 6 games, win by 2.",
      "At 6–6 in any set: 7-point tiebreak (first to 7, win by 2). Change ends every 6 points.",
      "If sets split 1–1: 10-point Match Tiebreak (first to 10, win by 2) decides the 3rd set. Change ends every 6 points.",
      "No-ad scoring optional: at deuce (40–40), one deciding point — receiver chooses side.",
    ],
  },
  {
    title: "Scoring",
    items: [
      "Points: 0, 15, 30, 40, Game.",
      "A let (net cord on serve that lands in) is replayed on serve only — never in rally.",
      "Players call lines on their own side. Any ball not clearly out is called in. Benefit of doubt always goes to the opponent.",
      "Forfeit score: 6–0, 6–0.",
    ],
  },
  {
    title: "Season & Scheduling",
    items: [
      "Season: 5–7 matches over 6–8 weeks, plus playoffs.",
      "Each match has a 7-day scheduling window. Contact opponent, offer 3 time slots, confirm court.",
      "Higher seed (or first-listed player) provides balls and organises court booking.",
      "Weather interruption: <30 min played → restart from 0. >30 min played → resume from exact score.",
      "15+ min late → forfeit. Cancel within 2 hours of match time → forfeit. No response within 48 hours → walkover awarded to opponent.",
    ],
  },
  {
    title: "Score Reporting",
    items: [
      "Winner reports: all set scores, tiebreak scores, match location, and duration.",
      "Opponent must confirm within 24 hours. No response = auto-confirmed.",
      "Disputes must be raised within 24 hours of result posting. Both players resolve between themselves and resubmit agreed score.",
    ],
  },
  {
    title: "Court Conduct",
    items: [
      "Sportsmanship required at all times. Respect your opponent.",
      "No profanity, racquet abuse, ball abuse, or intimidation.",
      "Penalty progression (player self-governed): Warning → Point penalty → Game penalty → Match default.",
      "No coaching during singles. Doubles partners may communicate freely.",
      "Players are fully responsible for their own conduct. Disputes are resolved between players.",
    ],
  },
  {
    title: "Equipment & Surfaces",
    items: [
      "Home player provides new, unopened balls for the match.",
      "Approved surfaces: hard court, clay, turf, indoor carpet (standard tennis court surfaces).",
      "Players provide their own racquet. No restrictions on string type or tension.",
      "Appropriate tennis footwear required.",
    ],
  },
  {
    title: "Withdrawals & Replacements",
    items: [
      "Mid-season withdrawal: all completed matches stand on record. Remaining matches become walkovers for opponents.",
      "Replacements accepted only before 50% of the season's matches are completed.",
      "Three unplayed matches (no-shows) in a season = automatic withdrawal from standings.",
    ],
  },
  {
    title: "Safety",
    items: [
      "Heat policy: above 95°F / 35°C both players may mutually agree to take a hydration break between sets.",
      "If a player cannot continue safely, they may retire from the match. Opponent is awarded the win.",
      "All player safety decisions are made by the players themselves.",
    ],
  },
];

const POINTS_FORMULA = {
  formula: "Points = 3(W) + 1(L) + 0.5(SW − SL) + 0.1(GW − GL) + Bonus",
  legend: [
    { sym: "W",       def: "Match wins" },
    { sym: "L",       def: "Match losses" },
    { sym: "SW − SL", def: "Sets won minus sets lost" },
    { sym: "GW − GL", def: "Games won minus games lost" },
    { sym: "Bonus",   def: "+2 if all matches played · +1 straight-set win · +0.5 close 3-set loss" },
  ],
  tiebreakers: ["Set differential (SW − SL)", "Game differential (GW − GL)", "Head-to-head record", "Opponent strength"],
};

const TENNIS_PLAYOFFS = [
  {
    title: "Qualification",
    items: [
      "Division of ≤12 players → Top 4 qualify.",
      "Division of >12 players → Top 8 qualify.",
      "Seeding is based on final regular-season standings.",
    ],
  },
  {
    title: "Playoff Format",
    items: [
      "Semifinals: Best of 3 sets. 3rd set = 10-point Match Tiebreak.",
      "Final: Full 3rd set OR Match Tiebreak — decided by league before playoffs begin.",
      "Bronze match (3rd/4th place): optional. Same format as Semifinals.",
    ],
  },
];

// ─── Format Overview Cards ─────────────────────────────────────────
const FORMAT_CARDS = [
  {
    id: "flex",
    label: "Flex League",
    tag: "Self-scheduled",
    tagline: "You set the schedule. We track the results.",
    color: "emerald",
    header: "bg-emerald-500",
    border: "border-emerald-200",
    accent: "text-emerald-700",
    bullet: "text-emerald-500",
    pill: "bg-emerald-600/50 text-emerald-100",
    highlights: [
      "5–7 matches over 6–8 weeks",
      "You arrange each match with your opponent",
      "Top 4 or 8 qualify for playoffs",
      "Points formula rewards wins + margin",
    ],
  },
  {
    id: "rr",
    label: "Round Robin",
    tag: "Auto-scheduled",
    tagline: "Show up. The schedule is already set.",
    color: "blue",
    header: "bg-blue-600",
    border: "border-blue-200",
    accent: "text-blue-700",
    bullet: "text-blue-500",
    pill: "bg-blue-700/50 text-blue-100",
    highlights: [
      "Every player faces every other player once",
      "Rounds pre-assigned — no self-scheduling",
      "Group leaders advance to playoffs",
      "Head-to-head carries extra tiebreaker weight",
    ],
  },
  {
    id: "box",
    label: "Box League",
    tag: "Promotion/Relegation",
    tagline: "Finish top, move up. Finish bottom, move down.",
    color: "violet",
    header: "bg-violet-600",
    border: "border-violet-200",
    accent: "text-violet-700",
    bullet: "text-violet-500",
    pill: "bg-violet-700/50 text-violet-100",
    highlights: [
      "~6 players per box, seeded by ELO",
      "Play every player in your box",
      "Top 2 promote · Bottom 2 relegate",
      "No playoffs — final standings decide",
    ],
  },
  {
    id: "ladder",
    label: "Challenge Ladder",
    tag: "Always-on",
    tagline: "Climb the ranks one challenge at a time.",
    color: "amber",
    header: "bg-amber-500",
    border: "border-amber-200",
    accent: "text-amber-700",
    bullet: "text-amber-500",
    pill: "bg-amber-600/50 text-amber-100",
    highlights: [
      "Permanent ranked list per city + division",
      "Join anytime — ELO-seeded placement",
      "Challenge anyone ranked above you",
      "Win = rank swap · 48h cooldown per challenge",
    ],
  },
];

const FORMAT_COMPARISON_ROWS = [
  { feature: "Season structure",  flex: "6–8 weeks + playoffs",          rr: "Fixed rounds, group phase",     box: "Season with promotion/relegation", ladder: "No season — continuous" },
  { feature: "Match scheduling",  flex: "You arrange with opponent",      rr: "Pre-assigned by organiser",     box: "You arrange within box",           ladder: "You challenge, opponent accepts" },
  { feature: "End goal",          flex: "Qualify for playoffs",           rr: "Top of group → playoffs",       box: "Promote to next division",         ladder: "Climb the ranked list" },
  { feature: "New season entry",  flex: "Open registration",              rr: "Open registration",             box: "Placed by performance",            ladder: "Join anytime" },
  { feature: "Playoffs",          flex: "Yes — top 4 or 8",              rr: "Yes — group leaders",           box: "No — standings decide",            ladder: "No — rank is live" },
  { feature: "Best for",          flex: "Flexible schedules",             rr: "Zero scheduling friction",      box: "Competitive progression",          ladder: "Casual frequent play" },
];

// ─── Format Data ───────────────────────────────────────────────────
const FLEX_LEAGUE_RULES = [
  {
    category: "Scheduling",
    items: [
      "Each match has a 7-day scheduling window. Contact opponent within 48 hours of window opening.",
      "Offer at least 3 available time slots. Opponent picks one or proposes alternatives.",
      "Higher seed (or first-listed player) books the court and provides match balls.",
      "Confirm venue at least 24 hours before match time.",
    ],
  },
  {
    category: "Forfeits",
    items: [
      "15+ minutes late without notice = forfeit.",
      "Cancel within 2 hours of match time = forfeit.",
      "No response to scheduling within 48 hours = walkover awarded to opponent.",
      "3 unplayed matches in a season = automatic withdrawal from standings.",
    ],
  },
  {
    category: "Season Structure",
    items: [
      "5-7 matches over 6-8 weeks, followed by playoffs.",
      "Points accumulated across all matches determine playoff seeding.",
      "Top 4 (≤12 players) or Top 8 (>12 players) advance to playoffs.",
      "Mid-season withdrawal: completed matches stand; remaining become walkovers for opponents.",
    ],
  },
  {
    category: "Standings",
    items: [
      "Points formula: 3(W) + 1(L) + 0.5(SW-SL) + 0.1(GW-GL) + Bonus.",
      "Bonus points: +2 all matches played, +1 straight-set win, +0.5 close 3-set loss.",
      "Tiebreakers in order: set differential, game differential, head-to-head, opponent strength.",
    ],
  },
];

const ROUND_ROBIN_RULES = [
  {
    category: "Scheduling",
    items: [
      "All matches pre-assigned by the league organizer before the season begins.",
      "Each round is assigned a specific week. No self-scheduling required.",
      "Match times and venues communicated in advance by the organizer.",
      "Confirm attendance only. No slot negotiation between players.",
    ],
  },
  {
    category: "Match Order",
    items: [
      "Every player faces every other player in the group at least once.",
      "Number of rounds = number of players minus 1 for even groups.",
      "Bye weeks assigned for odd-player groups. Byes count as a rest, not a win.",
      "No player faces the same opponent twice during the main group phase.",
    ],
  },
  {
    category: "Season Structure",
    items: [
      "Group phase: everyone plays everyone. No early exits until the group phase is complete.",
      "Top finishers from each group advance to playoffs (structure depends on group size).",
      "No mid-season replacements. Spots are fixed at registration close.",
      "Withdrawal: completed matches stand; remaining matches recorded as opponent walkovers.",
    ],
  },
  {
    category: "Standings",
    items: [
      "Same points formula as Flex League: 3(W) + 1(L) + 0.5(SW-SL) + 0.1(GW-GL) + Bonus.",
      "Tiebreakers: head-to-head result first, then set differential, game differential, opponent strength.",
      "Head-to-head carries more weight in Round Robin because all players face each other directly.",
    ],
  },
];

const BOX_LEAGUE_RULES = [
  {
    category: "Box Assignment",
    items: [
      "Players seeded by ELO rating and distributed into boxes of ~6 using a serpentine draft (strongest → weakest → weakest → strongest).",
      "This balances each box so no single box is top-heavy.",
      "Box sizes may vary slightly depending on total player count.",
    ],
  },
  {
    category: "Match Play",
    items: [
      "You play every other player in your box — typically 5 matches in a 6-player box.",
      "Arrange matches with your box opponents directly, same as Flex League.",
      "Same match format (Best of 3 sets for tennis, Best of 3 games for pickleball).",
      "Scores reported and confirmed as normal.",
    ],
  },
  {
    category: "Promotion & Relegation",
    items: [
      "Top 2 finishers in each box are promoted to a higher division next season.",
      "Bottom 2 finishers in each box are relegated to a lower division next season.",
      "Mid-table players (3rd/4th in a 6-player box) stay in the same division.",
      "No playoffs — final box standings determine your outcome.",
    ],
  },
  {
    category: "Standings",
    items: [
      "Same points formula as Flex League: 3(W) + 1(L) + 0.5(SW-SL) + 0.1(GW-GL) + Bonus.",
      "Tiebreakers: wins, then games differential, then ELO rating.",
      "Mid-season withdrawal: completed matches stand; remaining matches become opponent walkovers.",
    ],
  },
];

const LADDER_RULES = [
  {
    category: "Joining & Placement",
    items: [
      "Join a ladder anytime — no registration windows.",
      "Your starting rank is determined by your ELO rating compared to current ladder members.",
      "Separate ladders per city, sport, and division (e.g. NYC · Tennis · Intermediate).",
    ],
  },
  {
    category: "Challenging",
    items: [
      "You may challenge any player ranked above you — no limit on how many ranks up.",
      "Challenger sends the request through the app. Challenged player has 72 hours to accept or decline.",
      "Decline or no response = your challenge lapses. No rank change.",
      "48-hour cooldown between challenges (regardless of win or loss).",
    ],
  },
  {
    category: "Rank Changes",
    items: [
      "Challenger wins → challenger and challenged player swap ranks.",
      "Challenger loses → ranks unchanged. The challenged player keeps their position.",
      "ELO ratings update after every completed ladder match.",
    ],
  },
  {
    category: "Ladder Structure",
    items: [
      "No season end — the ladder runs continuously.",
      "No playoffs — your rank at any moment reflects your standing.",
      "Inactive players (no challenge in 60+ days) may be flagged as inactive by admin.",
    ],
  },
];

// ─── Pickleball Data (unchanged) ───────────────────────────────────
const PICKLEBALL_RULES = [
  {
    title: "Match Format",
    items: [
      "Singles & Doubles matches are first to 11 points, win by 2 (rally scoring allowed in tournament play; VENLAX defaults to traditional side-out).",
      "Best of 3 games per match.",
      "VENLAX tournament finals may be played as 15-point or 21-point games at organiser's discretion.",
    ],
  },
  {
    title: "Scoring & Serving",
    items: [
      "Score announced as Server-Receiver-Server# (e.g., '5-3-2').",
      "Only the serving team can score points (traditional side-out scoring).",
      "The serve must be made underhand, contact below the waist, and land in the diagonal service box.",
      "The 'two-bounce rule' applies — ball must bounce once on each side before volleys are allowed.",
    ],
  },
  {
    title: "Non-Volley Zone (Kitchen)",
    items: [
      "No volleying inside the 7-foot non-volley zone, including the lines.",
      "Momentum from a volley cannot carry the player into the kitchen.",
      "Players may enter the kitchen any time — they just cannot volley there.",
    ],
  },
  {
    title: "VENLAX League Specifics",
    items: [
      "Each player gets ~5 matches over 6 weeks plus a makeup week.",
      "DUPR rating updates are applied after every reported match.",
      "Mixed doubles uses the same scoring rules as standard doubles.",
      "Entry fees vary by league — shown at registration.",
    ],
  },
];

// ─── Ratings ───────────────────────────────────────────────────────
const RATINGS = [
  {
    sport: "Tennis",
    body: "VENLAX uses a skill rating scale of 1.0–7.0, aligned with widely recognized tennis rating conventions. Self-rating on sign-up, then updated after every match based on result, opponent strength, margin of victory, and recent form. Staged K-factor: aggressive for new players, conservative for veterans.",
  },
  {
    sport: "Pickleball",
    body: "VENLAX uses a 1.0–7.0 skill rating scale for pickleball. New players self-select an entry rating; the system corrects it within 5–10 matches based on results and opponent strength.",
  },
];

// ─── Code of Conduct ───────────────────────────────────────────────
const CODE_OF_CONDUCT = [
  "Arrive on time. Forfeit clock starts 15 minutes after the scheduled match time.",
  "Treat your opponent with respect — on and off court.",
  "No coaching from the sidelines during recreational singles.",
  "Photography is welcome. Live streaming requires opponent consent.",
  "Suspected match fixing or score manipulation results in immediate removal.",
  "All disputes, line calls, and conduct issues are resolved between the players on court.",
];

export default function Rules() {
  return (
    <div className="bg-white" data-testid="rules-page">

      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white py-16 sm:py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Official League Rulebook v1.0
          </div>
          <h1 className="font-heading font-black text-4xl sm:text-5xl mb-4 leading-tight">
            The Rules of<br /><span className="text-emerald-400">the Circuit.</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl">
            Every match is governed. Every call is fair. Every result counts.
            Four formats — Flex, Round Robin, Box League, Challenge Ladder.
            Same match rules and scoring across all formats.
          </p>
          <p className="text-gray-500 text-xs max-w-2xl mt-3">
            VENLAX Sports is an independent platform not affiliated with, licensed by, or endorsed by the USTA, USA Pickleball, Universal Tennis, DUPR, or the ITF.
          </p>
        </div>
      </section>

      {/* Quick nav */}
      <div className="border-b border-gray-100 sticky top-0 z-10 bg-white/90 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-1 text-xs font-semibold">
          <a href="#formats"    className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">All Formats</a>
          <a href="#box-league" className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">Box League</a>
          <a href="#ladder"     className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">Ladder</a>
          <a href="#tennis"     className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">🎾 Tennis</a>
          <a href="#divisions"  className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">Divisions</a>
          <a href="#standings"  className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">Points</a>
          <a href="#playoffs"   className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">Playoffs</a>
          <a href="#pickleball" className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">🏓 Pickleball</a>
          <a href="#ratings"    className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">Ratings</a>
          <a href="#conduct"    className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">Conduct</a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 space-y-16">

        {/* ── All Formats ───────────────────────────────────────────── */}
        <section id="formats" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-6 h-6 text-gray-700" />
            <h2 className="font-heading font-black text-2xl text-gray-900">League Formats</h2>
          </div>
          <p className="text-gray-500 text-sm mb-8 max-w-2xl">
            Four formats — same match rules, same scoring, same court conduct. The difference is structure and progression.
          </p>

          {/* 4 format cards */}
          <div className="grid sm:grid-cols-2 gap-4 mb-10" data-testid="format-cards">
            {FORMAT_CARDS.map((f) => (
              <div key={f.id} className={`rounded-2xl border ${f.border} overflow-hidden`} data-testid={`format-card-${f.id}`}>
                <div className={`${f.header} px-5 py-4`}>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-heading font-black text-lg">{f.label}</h3>
                    <span className={`ml-auto text-xs font-semibold ${f.pill} px-2.5 py-0.5 rounded-full`}>{f.tag}</span>
                  </div>
                  <p className="text-white/75 text-xs">{f.tagline}</p>
                </div>
                <div className="p-4 bg-white">
                  <ul className="space-y-1.5">
                    {f.highlights.map((h, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <span className={`${f.bullet} font-bold flex-shrink-0`}>✓</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table — scrollable on mobile */}
          <div className="overflow-x-auto rounded-2xl border border-gray-200 mb-12" data-testid="format-comparison-table">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-gray-400 bg-gray-50 border-b border-gray-200 w-32">Feature</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700 bg-emerald-50 border-b border-l border-gray-200">Flex League</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-blue-700 bg-blue-50 border-b border-l border-gray-200">Round Robin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-violet-700 bg-violet-50 border-b border-l border-gray-200">Box League</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-amber-700 bg-amber-50 border-b border-l border-gray-200">Ladder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {FORMAT_COMPARISON_ROWS.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                    <td className="px-4 py-3 text-gray-500 font-medium">{row.feature}</td>
                    <td className="px-4 py-3 text-gray-800 border-l border-gray-100">{row.flex}</td>
                    <td className="px-4 py-3 text-gray-800 border-l border-gray-100">{row.rr}</td>
                    <td className="px-4 py-3 text-gray-800 border-l border-gray-100">{row.box}</td>
                    <td className="px-4 py-3 text-gray-800 border-l border-gray-100">{row.ladder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Flex League detail */}
          <div className="rounded-2xl border border-emerald-200 overflow-hidden mb-5" data-testid="format-flex-league">
            <div className="bg-emerald-500 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-heading font-black text-lg">Flex League — How It Works</h3>
                <span className="ml-auto text-xs font-semibold text-emerald-100 bg-emerald-600/50 px-2.5 py-0.5 rounded-full">Self-scheduled</span>
              </div>
              <p className="text-emerald-100 text-xs">You set the schedule. We track the results.</p>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-6 bg-white">
              {FLEX_LEAGUE_RULES.map((cat) => (
                <div key={cat.category}>
                  <h4 className="font-heading font-bold text-xs uppercase tracking-[0.1em] text-emerald-700 mb-2">{cat.category}</h4>
                  <ul className="space-y-1.5">
                    {cat.items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                        <span className="text-emerald-500 font-bold flex-shrink-0 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Round Robin detail */}
          <div className="rounded-2xl border border-blue-200 overflow-hidden" data-testid="format-round-robin">
            <div className="bg-blue-600 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-heading font-black text-lg">Round Robin — How It Works</h3>
                <span className="ml-auto text-xs font-semibold text-blue-100 bg-blue-700/50 px-2.5 py-0.5 rounded-full">Auto-scheduled</span>
              </div>
              <p className="text-blue-100 text-xs">Show up. The schedule is already set.</p>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-6 bg-white">
              {ROUND_ROBIN_RULES.map((cat) => (
                <div key={cat.category}>
                  <h4 className="font-heading font-bold text-xs uppercase tracking-[0.1em] text-blue-700 mb-2">{cat.category}</h4>
                  <ul className="space-y-1.5">
                    {cat.items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                        <span className="text-blue-500 font-bold flex-shrink-0 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Box League ────────────────────────────────────────────── */}
        <section id="box-league" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-2">
            <ArrowUpDown className="w-6 h-6 text-violet-600" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Box League</h2>
            <span className="ml-auto text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full hidden sm:inline-flex">Promotion · Relegation</span>
          </div>
          <p className="text-gray-500 text-sm mb-6 max-w-2xl">
            Players grouped by skill into boxes of ~6. Play everyone in your box, then move up or down based on where you finish.
          </p>

          {/* Promo/relegate visual */}
          <div className="grid grid-cols-3 gap-3 mb-6 text-center">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4">
              <p className="text-2xl font-black font-heading text-emerald-700 mb-1">Top 2</p>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Promoted ↑</p>
              <p className="text-xs text-emerald-700 mt-1">Next higher division</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4">
              <p className="text-2xl font-black font-heading text-gray-700 mb-1">Mid</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stay</p>
              <p className="text-xs text-gray-500 mt-1">Same division next season</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4">
              <p className="text-2xl font-black font-heading text-red-700 mb-1">Bottom 2</p>
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Relegated ↓</p>
              <p className="text-xs text-red-700 mt-1">Lower division next season</p>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-200 overflow-hidden" data-testid="format-box-league">
            <div className="bg-violet-600 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-heading font-black text-lg">Box League — How It Works</h3>
                <span className="ml-auto text-xs font-semibold text-violet-100 bg-violet-700/50 px-2.5 py-0.5 rounded-full">Promotion/Relegation</span>
              </div>
              <p className="text-violet-100 text-xs">Finish top, move up. Finish bottom, move down.</p>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-6 bg-white">
              {BOX_LEAGUE_RULES.map((cat) => (
                <div key={cat.category}>
                  <h4 className="font-heading font-bold text-xs uppercase tracking-[0.1em] text-violet-700 mb-2">{cat.category}</h4>
                  <ul className="space-y-1.5">
                    {cat.items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                        <span className="text-violet-500 font-bold flex-shrink-0 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Challenge Ladder ──────────────────────────────────────── */}
        <section id="ladder" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6 text-amber-500" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Challenge Ladder</h2>
            <span className="ml-auto text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full hidden sm:inline-flex">Always-on</span>
          </div>
          <p className="text-gray-500 text-sm mb-6 max-w-2xl">
            A permanent ranked list per city and division. Join any time, challenge anyone above you. Win and you take their rank.
          </p>

          {/* How a challenge works */}
          <div className="grid grid-cols-3 gap-3 mb-6 text-center text-sm">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
              <p className="font-black font-heading text-amber-700 text-lg mb-1">1</p>
              <p className="font-semibold text-gray-800 text-xs">Send challenge</p>
              <p className="text-xs text-gray-500 mt-1">Pick anyone ranked above you</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
              <p className="font-black font-heading text-amber-700 text-lg mb-1">2</p>
              <p className="font-semibold text-gray-800 text-xs">Play the match</p>
              <p className="text-xs text-gray-500 mt-1">72h to accept · arrange + play</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
              <p className="font-black font-heading text-amber-700 text-lg mb-1">3</p>
              <p className="font-semibold text-gray-800 text-xs">Ranks update</p>
              <p className="text-xs text-gray-500 mt-1">Win = swap ranks · Lose = no change</p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 overflow-hidden" data-testid="format-ladder">
            <div className="bg-amber-500 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-heading font-black text-lg">Challenge Ladder — How It Works</h3>
                <span className="ml-auto text-xs font-semibold text-amber-100 bg-amber-600/50 px-2.5 py-0.5 rounded-full">Always-on</span>
              </div>
              <p className="text-amber-100 text-xs">Climb the ranks one challenge at a time.</p>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-6 bg-white">
              {LADDER_RULES.map((cat) => (
                <div key={cat.category}>
                  <h4 className="font-heading font-bold text-xs uppercase tracking-[0.1em] text-amber-700 mb-2">{cat.category}</h4>
                  <ul className="space-y-1.5">
                    {cat.items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                        <span className="text-amber-500 font-bold flex-shrink-0 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tennis */}
        <section id="tennis" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-3xl">🎾</span>
            <div>
              <h2 className="font-heading font-black text-2xl text-gray-900">Tennis Rules</h2>
              <p className="text-xs text-gray-400 mt-0.5">Flex League + Playoffs · Primary Format</p>
            </div>
            <span className="ml-auto text-xs text-gray-400 font-medium hidden sm:block">Fast-4 Flex Format</span>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {TENNIS_RULES.map((g) => (
              <div
                key={g.title}
                className="bg-gray-50 border border-gray-100 rounded-2xl p-5"
                data-testid={`tennis-rule-${g.title.toLowerCase().replace(/[^a-z]/g, "-")}`}
              >
                <h3 className="font-heading font-bold text-base text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  {g.title}
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 leading-relaxed">
                  {g.items.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-500 font-bold flex-shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Divisions */}
        <section id="divisions" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <Target className="w-6 h-6 text-emerald-500" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Player Divisions & Ratings</h2>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden mb-5">
            <table className="w-full text-sm" data-testid="divisions-table">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700">Division</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700">Rating Range</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700 hidden sm:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {TENNIS_DIVISIONS.map((d, i) => (
                  <tr key={d.level} className={i === 3 ? "bg-emerald-50" : ""} data-testid={`division-${d.level.toLowerCase()}`}>
                    <td className="px-5 py-3 font-heading font-bold text-gray-900">{d.level}</td>
                    <td className="px-5 py-3 font-mono text-emerald-700 font-semibold">{d.range}</td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">{d.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="font-heading font-bold text-base text-gray-900 mb-3">Rating Model</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Hybrid rating: self-rating on entry, updated after every match.
              Factors weighted: <strong>match result</strong>, <strong>opponent strength</strong>, <strong>margin of victory</strong>, and <strong>recent form</strong>.
              Staged K-factor — aggressive updates for new players, conservative for veterans.
              Ratings are individual and separate for Tennis and Pickleball.
            </p>
          </div>
        </section>

        {/* Standings & Points Formula */}
        <section id="standings" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-blue-500" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Standings & Points</h2>
          </div>

          {/* Formula callout */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6" data-testid="points-formula">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Points Formula</p>
            <p className="font-mono text-emerald-700 text-base sm:text-lg font-bold mb-5 leading-relaxed break-words">
              {POINTS_FORMULA.formula}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {POINTS_FORMULA.legend.map((l) => (
                <div key={l.sym} className="flex gap-3 text-sm">
                  <span className="font-mono text-emerald-700 font-bold w-20 flex-shrink-0">{l.sym}</span>
                  <span className="text-gray-600">{l.def}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tiebreakers */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5" data-testid="standings-tiebreakers">
            <h3 className="font-heading font-bold text-base text-blue-900 mb-3 flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-500" />
              Tiebreaker Order (when points are equal)
            </h3>
            <ol className="space-y-1.5">
              {POINTS_FORMULA.tiebreakers.map((t, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-blue-800">
                  <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Playoffs */}
        <section id="playoffs" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="w-6 h-6 text-amber-500" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Playoffs</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {TENNIS_PLAYOFFS.map((g) => (
              <div
                key={g.title}
                className="bg-amber-50 border border-amber-100 rounded-2xl p-5"
                data-testid={`playoff-${g.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <h3 className="font-heading font-bold text-base text-amber-900 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  {g.title}
                </h3>
                <ul className="space-y-2 text-sm text-amber-800 leading-relaxed">
                  {g.items.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-500 font-bold flex-shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Pickleball */}
        <section id="pickleball" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🏓</span>
            <h2 className="font-heading font-black text-2xl text-gray-900">Pickleball Rules</h2>
            <span className="ml-auto text-xs text-gray-400 font-medium hidden sm:block">Standard Pickleball Rules</span>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {PICKLEBALL_RULES.map((g) => (
              <div
                key={g.title}
                className="bg-gray-50 border border-gray-100 rounded-2xl p-5"
                data-testid={`pickleball-rule-${g.title.toLowerCase().replace(/[^a-z]/g, "-")}`}
              >
                <h3 className="font-heading font-bold text-base text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-500" />
                  {g.title}
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 leading-relaxed">
                  {g.items.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-orange-500 font-bold flex-shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Ratings */}
        <section id="ratings" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <Scale className="w-6 h-6 text-purple-500" />
            <h2 className="font-heading font-black text-2xl text-gray-900">How Ratings Work</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {RATINGS.map((r) => (
              <div
                key={r.sport}
                className="bg-purple-50 border border-purple-100 rounded-2xl p-5"
                data-testid={`rating-${r.sport.toLowerCase()}`}
              >
                <h3 className="font-heading font-bold text-base text-purple-900 mb-2">{r.sport}</h3>
                <p className="text-sm text-purple-800 leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Code of Conduct */}
        <section id="conduct" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-sky-500" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Code of Conduct</h2>
          </div>
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-6">
            <ul className="space-y-3 text-sm text-sky-900 leading-relaxed">
              {CODE_OF_CONDUCT.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-sky-500 font-bold flex-shrink-0">{i + 1}.</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Player resolution notice */}
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-2xl p-5 flex gap-3">
            <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Player-Governed League</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                VENLAX is a self-governed competitive platform. All line calls, disputes, and conduct matters are resolved directly between players.
                Players are responsible for their own conduct, agreed scores, and scheduling decisions.
              </p>
            </div>
          </div>
        </section>

        <div className="text-center pt-6">
          <Link
            to="/leagues"
            className="inline-flex items-center gap-2 text-sm font-semibold bg-emerald-500 text-white px-6 py-3 rounded-xl hover:bg-emerald-600 transition-colors"
            data-testid="rules-cta-leagues"
          >
            <Trophy className="w-4 h-4" /> Find a league to join
          </Link>
        </div>

      </div>
    </div>
  );
}
