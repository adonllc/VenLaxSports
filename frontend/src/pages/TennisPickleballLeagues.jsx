import { Link } from "react-router-dom";
import useDocumentMeta from "../hooks/useDocumentMeta";

const FAQS = [
  {
    q: "How much does it cost to join a tennis or pickleball league?",
    a: "Singles leagues run $9.99 per player. Doubles and mixed doubles run $19.99 per player, since that fee splits court time and match coordination across four players instead of two.",
  },
  {
    q: "How long does a typical tennis or pickleball league season last?",
    a: "VENLAX Flex Leagues run 5–7 matches over 6–8 weeks, and you schedule each match directly with your assigned opponent rather than showing up to a fixed weekly game time.",
  },
  {
    q: "What skill level do I need to join a league?",
    a: "Leagues use a rating scale from 2.0 (beginner) to 5.0+ (elite/semi-professional), and you're matched only against opponents near your rating — no prior tournament experience required.",
  },
  {
    q: "Should I start with tennis or pickleball?",
    a: "Pickleball has a shorter learning curve and shorter matches, usually under an hour, so it's easier for adult beginners to get competitive fast. Tennis takes longer to develop consistent strokes but rewards deeper strategic range over time.",
  },
  {
    q: "How do I know if a league's skill ratings are accurate?",
    a: "Look for a platform that adjusts your rating based on your actual match results after you join, not just a fixed self-reported skill level. Static self-ratings are the main reason lower brackets end up with mismatched, one-sided matches — commonly called sandbagging.",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

const H2 = ({ children }) => (
  <h2
    className="font-black text-2xl sm:text-3xl mt-14 mb-4"
    style={{ color: "#047857", fontFamily: "'Sora', system-ui, sans-serif" }}
  >
    {children}
  </h2>
);

const H3 = ({ children }) => (
  <h3
    className="font-bold text-lg mt-6 mb-2"
    style={{ color: "#1F2937", fontFamily: "'Sora', system-ui, sans-serif" }}
  >
    {children}
  </h3>
);

export default function TennisPickleballLeagues() {
  useDocumentMeta({
    title: "Tennis & Pickleball Leagues Near You | Skill-Matched Play",
    description:
      "Join a rated tennis or pickleball league in your city. See real pricing, season length, and how skill matching actually works before you sign up.",
    canonicalPath: "/tennis-pickleball-leagues",
    jsonLd: JSON_LD,
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b" style={{ borderColor: "#E5E7EB" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p
            className="text-xs font-bold uppercase tracking-[0.14em] mb-2"
            style={{ color: "#EA580C", fontFamily: "'Sora', system-ui, sans-serif" }}
          >
            Guide
          </p>
          <h1
            className="font-black text-2xl sm:text-3xl md:text-4xl leading-tight mb-4"
            style={{ color: "#047857", fontFamily: "'Sora', system-ui, sans-serif" }}
          >
            Tennis &amp; Pickleball Leagues Near You: How They Work, What They Cost, and How to Pick One
          </h1>
          <p className="text-lg" style={{ color: "#374151" }}>
            Tennis and pickleball leagues match players by skill level (typically rated 2.0–5.0) into a season of
            organized matches against local opponents, with results feeding a live ranking. Costs run $9.99–$19.99
            per player depending on format, with singles cheaper than doubles or mixed leagues.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10" style={{ color: "#374151" }}>
        <H2>How Skill-Based League Matching Actually Works</H2>
        <p>
          Every serious league runs on a rating scale, not a gut-feel skill label. VENLAX uses 2.0 through 5.0+:
          2.0–2.5 is new to competitive play, 3.0–3.5 means you can hold a consistent rally, 4.0–4.5 is
          tournament-ready, and 5.0+ is semi-professional.
        </p>

        <H3>How your first few matches set your starting rank</H3>
        <p>
          Your initial rating comes from self-assessment when you join, then adjusts based on your actual match
          results — a strong start against a higher-rated opponent moves you up faster than the number you picked
          at signup.
        </p>

        <H3>What happens when you're rated wrong (sandbagging problem)</H3>
        <p>
          Static self-ratings are the single biggest complaint in amateur leagues — players lowball their own
          rating to dominate a bracket they don't belong in. A platform that recalculates rating from real results
          after every match closes that loophole; one that only asks once at signup doesn't.
        </p>

        <H2>What a Season Actually Looks Like</H2>
        <p>
          A VENLAX Flex League runs 5–7 matches over 6–8 weeks. You get a 7-day window per match, contact your
          opponent within 48 hours, and book the court yourselves — nobody's waiting on an organizer to set a
          fixed weekly time slot.
        </p>

        <H3>Singles vs. doubles vs. mixed doubles formats</H3>
        <p>
          Singles is one-on-one and the cheapest entry point. Doubles and mixed doubles split coordination and
          court costs across four players, which is why they're priced differently — see the cost breakdown below.
        </p>

        <H3>Playoffs, standings, and how winners are decided</H3>
        <p>
          Standings run on a points formula — wins, losses, set differential, and game differential, plus small
          bonuses for playing every match and winning in straight sets. The top 4 players (leagues of 12 or fewer)
          or top 8 (larger leagues) advance to playoffs.
        </p>

        <H2>Real Cost Breakdown: League vs. Club vs. Pickup</H2>
        <p>
          Most league sites make you register before showing a real number. Here's the actual pricing:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Singles league:</strong> $9.99 per player, per season</li>
          <li><strong>Doubles league:</strong> $19.99 per player, per season</li>
          <li><strong>Mixed doubles league:</strong> $19.99 per player, per season</li>
        </ul>

        <H3>Why doubles costs more</H3>
        <p>
          Doubles and mixed doubles split match coordination and court-booking overhead across four players
          instead of two, which is reflected directly in the entry fee.
        </p>

        <H3>Hidden costs at private clubs leagues don't have</H3>
        <p>
          Private club leagues typically require a membership on top of league fees, plus court-time surcharges
          during peak hours. A city-based league with self-scheduled matches avoids both — you're paying for the
          season, not for club access.
        </p>

        <H2>Tennis or Pickleball — Which League Should You Join First?</H2>
        <p>
          They're not really competing sports anymore — most serious players end up in both. But if you're picking
          a starting point:
        </p>

        <H3>Learning curve comparison for adult beginners</H3>
        <p>
          Pickleball's smaller court and slower ball make it far more approachable in your first month. Tennis
          takes longer to build a consistent serve and groundstrokes, but the ceiling on strategic depth is higher
          once you get there.
        </p>

        <H3>Time commitment per match</H3>
        <p>
          A pickleball match usually wraps in under an hour. A best-of-3 tennis set format can run well past 90
          minutes, especially if it goes to a third-set tiebreak.
        </p>

        <H3>Why most serious players end up playing both</H3>
        <p>
          Pickleball's shorter games make it easy to fit in on weeknights; tennis rewards the longer weekend
          block. Players who start with one for the schedule flexibility often pick up the other within a season
          or two once they're hooked on competitive play.
        </p>

        <H2>How to Find a League in Your City</H2>
        <H3>What to check before joining</H3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Does the rating system adjust after real match results, or is it a fixed self-assessment?</li>
          <li>Is pricing shown before you create an account?</li>
          <li>Can you self-schedule matches, or are you locked into a fixed weekly slot?</li>
        </ul>

        <H3>Red flags in league platforms</H3>
        <p>
          No visible ranking methodology, no clear refund or withdrawal policy, and pricing hidden behind a signup
          wall are the three biggest signs a league platform hasn't thought through the player experience.
        </p>

        <H2>Getting Started: Your First 30 Days</H2>
        <p>
          Your first rated match sets the real baseline — expect your rating to move after it, not stay fixed at
          whatever you entered during signup. From there, every reported result recalculates your standing, so the
          leaderboard reflects who's actually playing well this season, not who joined with the highest self-rating.
        </p>

        <div
          className="rounded-lg p-6 mt-10 mb-4"
          style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
        >
          <p className="font-bold mb-2" style={{ color: "#047857", fontFamily: "'Sora', system-ui, sans-serif" }}>
            Ready to find your division?
          </p>
          <p className="mb-4">
            Browse active tennis and pickleball leagues in your city and see real pricing before you sign up.
          </p>
          <Link
            to="/join"
            className="inline-block font-semibold px-6 py-3 rounded-lg text-white"
            style={{ background: "#10B981" }}
            data-testid="seo-page-cta-join"
          >
            Find a League →
          </Link>
        </div>

        <H2>FAQ</H2>
        <div className="space-y-6 mt-4">
          {FAQS.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-bold text-base mb-1" style={{ color: "#1F2937" }}>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
