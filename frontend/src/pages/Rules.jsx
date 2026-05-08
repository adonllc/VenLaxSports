import { Link } from "react-router-dom";
import { ShieldCheck, Trophy, Scale, Calendar, Users, AlertCircle, FileText } from "lucide-react";

/**
 * VENLAX Rules & Code of Conduct.
 * Tennis rules are aligned with USTA Friend at Court / The Code.
 * Pickleball rules are aligned with USA Pickleball Official Rulebook.
 * Anything VENLAX-specific (entry fees, makeup week, dispute path) is clearly labeled.
 */

const TENNIS_RULES = [
  {
    title: "Match Format",
    items: [
      "Singles & Doubles matches are best of 3 sets.",
      "Each set goes to 6 games. If the score reaches 6-6, a standard 7-point tiebreak is played (win by 2).",
      "If the match is split 1 set each, a 10-point Match Tiebreak (win by 2) decides the third set.",
    ],
  },
  {
    title: "Scoring",
    items: [
      "Points: 0, 15, 30, 40, Game.",
      "At deuce (40-40), the next point is the deciding point — receiver chooses side (no-ad scoring is permitted in VENLAX play).",
      "A let (net cord on serve that lands in) is replayed — only on serve, not in rally.",
    ],
  },
  {
    title: "Court Conduct (USTA 'The Code')",
    items: [
      "Players make calls on their own side of the court — close calls go to the opponent.",
      "If you're not 100% sure the ball is out, call it in.",
      "Audible swearing, racquet abuse, ball abuse, or unsportsmanlike conduct may result in code violation, point penalty, or default.",
      "Coaching during play is not permitted in singles. In doubles, partners may communicate normally.",
    ],
  },
  {
    title: "VENLAX League Specifics",
    items: [
      "Each player gets ~5 matches over 6 weeks, with one built-in makeup week.",
      "Both players must agree on date, time and venue. Default-to-home in case of dispute.",
      "Scores are reported by the winning player; the opponent has 48 hours to dispute via dashboard.",
      "Three no-shows in a season = league removal without refund.",
    ],
  },
];

const PICKLEBALL_RULES = [
  {
    title: "Match Format",
    items: [
      "Singles & Doubles matches are first to 11 points, win by 2 (rally scoring is also allowed in tournament play; VENLAX defaults to traditional side-out).",
      "Best of 3 games per match.",
      "VENLAX tournament finals may be played as 15-point or 21-point games at organizer's discretion.",
    ],
  },
  {
    title: "Scoring & Serving",
    items: [
      "Score is announced as Server-Receiver-Server# (e.g., '5-3-2').",
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
      "Players may enter the kitchen any time — they just can't volley there.",
    ],
  },
  {
    title: "VENLAX League Specifics",
    items: [
      "Each player gets ~5 matches over 6 weeks plus a makeup week.",
      "DUPR rating updates are applied after every reported match.",
      "Mixed doubles uses the same scoring rules as standard doubles.",
      "Default fee: $9.99 singles · $19.99 doubles & mixed.",
    ],
  },
];

const RATINGS = [
  { sport: "Tennis", body: "VENLAX uses an internal NTRP-aligned rating from 1.0 (beginner) to 7.0 (touring pro). Most recreational matches sit between 3.0 and 4.5. Ratings adjust after every reported match." },
  { sport: "Pickleball", body: "VENLAX uses a DUPR-aligned 1.0–7.0 rating. New players self-select an entry rating; the system corrects it within 5–10 matches." },
];

const CODE_OF_CONDUCT = [
  "Be on time. Forfeit clock starts 15 minutes after scheduled match start.",
  "No coaching from the sidelines during recreational singles.",
  "Treat opponents, partners and venue staff with respect — VENLAX reserves the right to remove repeat offenders without refund.",
  "Photography is welcome; live streaming requires opponent consent.",
  "Suspected match fixing or score manipulation results in immediate ban.",
];

export default function Rules() {
  return (
    <div className="bg-white" data-testid="rules-page">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-5">
            <ShieldCheck className="w-3.5 h-3.5" />
            VENLAX Rulebook
          </div>
          <h1 className="font-heading font-black text-4xl sm:text-5xl mb-4 leading-tight">
            Play hard.<br />Play fair.<br /><span className="text-emerald-400">Play VENLAX.</span>
          </h1>
          <p className="text-gray-400 text-base max-w-2xl">
            Our rules are aligned with <strong className="text-white">USTA</strong> (Friend at Court &amp; The Code) for Tennis and <strong className="text-white">USA Pickleball</strong> Official Rulebook for Pickleball. Anything VENLAX-specific is clearly labeled below.
          </p>
        </div>
      </section>

      {/* Quick nav */}
      <div className="border-b border-gray-100 sticky top-0 z-10 bg-white/90 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-3 flex flex-wrap gap-1 text-xs font-semibold">
          <a href="#tennis" className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">🎾 Tennis</a>
          <a href="#pickleball" className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">🏓 Pickleball</a>
          <a href="#ratings" className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">Ratings</a>
          <a href="#conduct" className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">Code of Conduct</a>
          <a href="#disputes" className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100">Disputes</a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-14 space-y-16">
        {/* Tennis */}
        <section id="tennis" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🎾</span>
            <h2 className="font-heading font-black text-2xl text-gray-900">Tennis Rules</h2>
            <span className="ml-auto text-xs text-gray-400 font-medium">Aligned with USTA Friend at Court</span>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {TENNIS_RULES.map((g) => (
              <div key={g.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-5" data-testid={`tennis-rule-${g.title.toLowerCase().replace(/[^a-z]/g, "-")}`}>
                <h3 className="font-heading font-bold text-base text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  {g.title}
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 leading-relaxed">
                  {g.items.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-500 font-bold">•</span>
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
            <span className="ml-auto text-xs text-gray-400 font-medium">Aligned with USA Pickleball Official Rulebook</span>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {PICKLEBALL_RULES.map((g) => (
              <div key={g.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-5" data-testid={`pickleball-rule-${g.title.toLowerCase().replace(/[^a-z]/g, "-")}`}>
                <h3 className="font-heading font-bold text-base text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-500" />
                  {g.title}
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 leading-relaxed">
                  {g.items.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-orange-500 font-bold">•</span>
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
              <div key={r.sport} className="bg-purple-50 border border-purple-100 rounded-2xl p-5" data-testid={`rating-${r.sport.toLowerCase()}`}>
                <h3 className="font-heading font-bold text-base text-purple-900 mb-2">{r.sport}</h3>
                <p className="text-sm text-purple-800 leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Conduct */}
        <section id="conduct" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-sky-500" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Code of Conduct</h2>
          </div>
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-6">
            <ul className="space-y-3 text-sm text-sky-900 leading-relaxed">
              {CODE_OF_CONDUCT.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-sky-500 font-bold">{i + 1}.</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Disputes */}
        <section id="disputes" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Disputes & Appeals</h2>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-sm text-amber-900 leading-relaxed space-y-3">
            <p><strong>Score disputes</strong> must be raised within 48 hours of the result being posted. Open the match on your dashboard and click <em>Dispute</em>; both players will be notified and a VENLAX admin will review evidence within 3 business days.</p>
            <p><strong>Code violations</strong> may be reported via the dashboard with a brief description. Repeated violations escalate from warning → match default → league removal.</p>
            <p><strong>Withdrawals</strong> are full-refund up to 7 days before league start. Inside 7 days, fees are non-refundable but credit toward a future league may be issued case-by-case.</p>
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
