import { Link } from "react-router-dom";
import { Check, ArrowRight, Users, User, CalendarDays, Trophy } from "lucide-react";
import useDocumentMeta from "../hooks/useDocumentMeta";
import PageHero from "../components/PageHero";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion";

const GREEN = "#008F70";
const AMBER = "#F2A922";
const INK = "#3D3D3D";
const BODY = "#5C5C5C";
const GREY = "#F1F1F1";

// ---------------------------------------------------------------- content
const QUICK_FACTS = [
  { big: "5–7", small: "matches per season" },
  { big: "6–8", small: "weeks per season" },
  { big: "2.0–5.0+", small: "skill rating scale" },
  { big: "$9.99", small: "singles, per player" },
];

const STEPS = [
  { icon: User, title: "Join", body: "Pick your sport, city and format. Choose your starting skill level." },
  { icon: CalendarDays, title: "Schedule", body: "You and your opponent agree a time and book a court. No fixed weekly slot." },
  { icon: Trophy, title: "Play and report", body: "Play your match, then report the score. Your rating updates after every result." },
  { icon: Users, title: "Climb", body: "Standings update live. The top players go to the playoffs." },
];

const LEVELS = [
  { level: "Beginner", rating: "2.0 – 2.5", who: "New to competitive play." },
  { level: "Intermediate", rating: "3.0 – 3.5", who: "You can hold a consistent rally." },
  { level: "Advanced", rating: "4.0 – 4.5", who: "Tournament-ready." },
  { level: "Elite", rating: "5.0+", who: "Semi-professional." },
];

const FORMATS = [
  { format: "Singles", players: "1 player", price: "$9.99", unit: "per player, per season", note: "One-on-one. The simplest way in." },
  { format: "Doubles", players: "Team of 2", price: "$19.99", unit: "per team, per season", note: "You and a partner. One partner pays and the other joins at no extra charge." },
  { format: "Mixed doubles", players: "Team of 2", price: "$19.99", unit: "per team, per season", note: "One man and one woman per team. Same team fee as doubles." },
];

const STRUCTURES = [
  { name: "Flex League", line: "You arrange your own match times.", points: ["5–7 matches over 6–8 weeks", "You book courts and agree times", "Top players qualify for playoffs"] },
  { name: "Round Robin", line: "A fixed schedule where everyone plays everyone once.", points: ["Organizer books courts", "Calendar set upfront", "Top players advance to playoffs"] },
  { name: "Box League", line: "Small groups of 6 players.", points: ["Top 2 move up, bottom 2 move down each cycle", "Tight-knit groups", "No season-end playoffs"] },
  { name: "Challenge Ladder", line: "An ongoing ranked list.", points: ["Challenge anyone above you", "Win to swap ranks", "Join any time and climb year-round"] },
];

const MATCH_TIMELINE = [
  { when: "Within 48 hours", what: "Contact your opponent. No reply in 48 hours means a walkover to the other player." },
  { when: "Within 7 days", what: "Play your match. Each match has a 7-day window." },
  { when: "24 hours before", what: "Confirm the time and court. The higher seed books the court and provides the balls." },
  { when: "Match day", what: "Arrive on time. 15+ minutes late, or cancelling less than 2 hours before, is a forfeit." },
  { when: "Within 24 hours after", what: "The winner reports the score. Your opponent confirms within 24 hours, or it is confirmed automatically." },
];

const POINTS = [
  { for: "Each match win", pts: "3 points" },
  { for: "Each match loss", pts: "1 point" },
  { for: "Sets won minus sets lost", pts: "0.5 per set" },
  { for: "Games won minus games lost", pts: "0.1 per game" },
  { for: "Play every match", pts: "+2 bonus" },
  { for: "Win in straight sets", pts: "+1 bonus" },
  { for: "Lose a close 3-set match", pts: "+0.5 bonus" },
];

const COMPARE = [
  { row: "Court size", tennis: "Larger court, longer rallies", pickle: "Smaller court, quicker points" },
  { row: "Learning curve", tennis: "Takes longer to build consistent strokes", pickle: "Easier to get competitive in your first month" },
  { row: "Typical match length", tennis: "Often 90 minutes or more over best of 3 sets", pickle: "Usually under an hour" },
  { row: "Great if you want", tennis: "Strategic depth and a long-term challenge", pickle: "A fast, social game that fits a weeknight" },
];

const CHECKLIST = [
  "Choose the rating that honestly matches how you play. It adjusts after your results.",
  "Check the league's city, format and start date before you pay.",
  "Message your opponent within 48 hours of being matched.",
  "Offer at least 3 time slots to make scheduling easy.",
  "Read the Rules page once so the score reporting is no surprise.",
];

const FAQS = [
  {
    q: "How much does it cost to join a tennis or pickleball league?",
    a: "Singles leagues are $9.99 per player. Doubles and mixed doubles are $19.99 for the team of two — one payment covers both partners.",
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
    q: "Do I need a partner for doubles?",
    a: "Yes, doubles and mixed doubles are played as a team of two. You invite your partner by email when you register. One partner pays the $19.99 team fee and the other joins at no extra charge.",
  },
  {
    q: "What if my opponent doesn't reply?",
    a: "You should contact your opponent within 48 hours. If they don't respond within 48 hours, the match is a walkover to you.",
  },
  {
    q: "Can I get a refund?",
    a: "Entry fees are non-refundable once the league starts.",
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

// ---------------------------------------------------------------- layout bits
const Section = ({ id, tint, children }) => (
  <section id={id} className="px-4 sm:px-6 py-14 md:py-20" style={{ background: tint ? GREY : "#fff" }}>
    <div className="max-w-[1000px] mx-auto">{children}</div>
  </section>
);

const H2 = ({ eyebrow, children, lead }) => (
  <div className="mb-8">
    {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: GREEN }}>{eyebrow}</p>}
    <h2 className="font-bold text-3xl md:text-5xl leading-[1.05]" style={{ color: INK }}>{children}</h2>
    {lead && <p className="mt-4 text-lg max-w-2xl" style={{ color: BODY }}>{lead}</p>}
  </div>
);

const Table = ({ head, children, minWidth = 560 }) => (
  <div className="overflow-x-auto bg-white border" style={{ borderColor: "#E4E4E4" }}>
    <table className="w-full text-left text-base" style={{ minWidth }}>
      <thead>
        <tr style={{ background: GREEN }}>
          {head.map((h) => (
            <th key={h} scope="col" className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-white">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y" style={{ borderColor: "#E4E4E4" }}>{children}</tbody>
    </table>
  </div>
);

const Td = ({ children, strong }) => (
  <td className={`px-5 py-4 align-top ${strong ? "font-bold" : ""}`} style={{ color: strong ? INK : BODY }}>{children}</td>
);

// ---------------------------------------------------------------- page
export default function TennisPickleballLeagues() {
  useDocumentMeta({
    title: "Tennis & Pickleball Leagues Near You | Skill-Matched Play",
    description:
      "Join a rated tennis or pickleball league in your city. See real pricing, season length, and how skill matching actually works before you sign up.",
    canonicalPath: "/tennis-pickleball-leagues",
    jsonLd: JSON_LD,
  });

  return (
    <div className="min-h-screen bg-white" style={{ color: BODY }}>
      <PageHero
        eyebrow="League guide"
        title={<>Tennis &amp; Pickleball<br />leagues, explained</>}
        subtitle="Everything you need to join your first league: levels, formats, prices, how a season works and how winners are decided."
      />

      {/* QUICK FACTS */}
      <section className="px-4 sm:px-6 -mt-10 relative z-10">
        <div className="max-w-[1000px] mx-auto grid grid-cols-2 md:grid-cols-4 text-white" style={{ background: GREEN }}>
          {QUICK_FACTS.map((f) => (
            <div key={f.small} className="px-6 py-6 text-center border-white/20 [&:not(:last-child)]:md:border-r">
              <div className="font-bold text-3xl md:text-4xl leading-none">{f.big}</div>
              <div className="mt-2 text-sm text-white/90">{f.small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <Section id="how-it-works">
        <H2 eyebrow="The basics" lead="A season is a handful of matches you arrange yourself, with your rating and the standings updating after every result.">
          How a league works
        </H2>
        <ol className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="p-6 border-t-4" style={{ borderColor: AMBER, background: GREY }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 flex items-center justify-center font-bold text-white" style={{ background: GREEN }}>{i + 1}</span>
                <s.icon className="w-5 h-5" style={{ color: GREEN }} aria-hidden="true" />
              </div>
              <h3 className="font-bold text-xl mb-1" style={{ color: INK }}>{s.title}</h3>
              <p className="text-base">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* LEVELS */}
      <Section id="levels" tint>
        <H2 eyebrow="Step 1" lead="You pick a starting level when you join. After your first few matches your rating moves based on real results, so it settles on your true level.">
          Find your level
        </H2>
        <Table head={["Level", "Rating", "Who it's for"]} minWidth={420}>
          {LEVELS.map((l) => (
            <tr key={l.level}>
              <Td strong>{l.level}</Td>
              <Td><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{l.rating}</span></Td>
              <Td>{l.who}</Td>
            </tr>
          ))}
        </Table>
        <p className="mt-4 text-sm">Not sure? Pick the level that honestly matches how you play. You are matched against players near your rating, and it keeps adjusting after your results.</p>
      </Section>

      {/* FORMATS + PRICING */}
      <Section id="pricing">
        <H2 eyebrow="Step 2" lead="Singles is one player. Doubles and mixed doubles are a team of two with one fee that covers both of you.">
          Pick your format and see the price
        </H2>
        <Table head={["Format", "Who plays", "Price", "Good to know"]} minWidth={620}>
          {FORMATS.map((f) => (
            <tr key={f.format}>
              <Td strong>{f.format}</Td>
              <Td>{f.players}</Td>
              <Td>
                <div className="font-bold text-xl" style={{ color: INK }}>{f.price}</div>
                <div className="text-sm">{f.unit}</div>
              </Td>
              <Td>{f.note}</Td>
            </tr>
          ))}
        </Table>
        <ul className="mt-5 grid gap-2 text-base">
          <li className="flex gap-2"><Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: GREEN }} aria-hidden="true" /> The price is for the whole season, with no club membership needed.</li>
          <li className="flex gap-2"><Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: GREEN }} aria-hidden="true" /> Entry fees are non-refundable once the league starts.</li>
        </ul>
      </Section>

      {/* SEASON FORMATS */}
      <Section id="formats" tint>
        <H2 eyebrow="Step 3" lead="Leagues come in four shapes. Each one is shown on its league page before you join.">
          Choose how your season runs
        </H2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STRUCTURES.map((s) => (
            <div key={s.name} className="bg-white p-7">
              <h3 className="font-bold text-2xl mb-1 flex items-center gap-3" style={{ color: INK }}>
                <span className="w-3 h-3 shrink-0" style={{ background: GREEN, transform: "skewX(-20deg)" }} aria-hidden="true" />
                {s.name}
              </h3>
              <p className="mb-4">{s.line}</p>
              <ul className="grid gap-2 text-base">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2"><Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: GREEN }} aria-hidden="true" /> {p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* MATCH TIMELINE */}
      <Section id="match">
        <H2 eyebrow="Playing" lead="Here is what happens for each match in a Flex League, in order.">
          Your match, step by step
        </H2>
        <Table head={["When", "What happens"]} minWidth={460}>
          {MATCH_TIMELINE.map((m) => (
            <tr key={m.when}>
              <Td strong>{m.when}</Td>
              <Td>{m.what}</Td>
            </tr>
          ))}
        </Table>
        <p className="mt-4 text-sm">
          Full scoring and conduct rules are on the <Link to="/rules" className="font-bold underline" style={{ color: GREEN }}>Rules page</Link>.
        </p>
      </Section>

      {/* STANDINGS */}
      <Section id="standings" tint>
        <H2 eyebrow="Winning" lead="Every match earns points. The more you play and the cleaner you win, the higher you climb.">
          How standings and playoffs work
        </H2>
        <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6 items-start">
          <Table head={["You get points for", "Points"]} minWidth={340}>
            {POINTS.map((p) => (
              <tr key={p.for}>
                <Td>{p.for}</Td>
                <Td strong>{p.pts}</Td>
              </tr>
            ))}
          </Table>
          <div className="text-white p-7" style={{ background: GREEN }}>
            <h3 className="font-bold text-2xl mb-3">Playoffs</h3>
            <ul className="grid gap-3 text-base">
              <li><strong>12 players or fewer:</strong> the top 4 advance.</li>
              <li><strong>More than 12 players:</strong> the top 8 advance.</li>
              <li>If players tie on points, the tiebreakers are sets, then games, then head-to-head, then opponent strength.</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* TENNIS vs PICKLEBALL */}
      <Section id="tennis-or-pickleball">
        <H2 eyebrow="Choosing a sport" lead="Many players end up in both. If you are picking a starting point, this is how they differ.">
          Tennis or pickleball first?
        </H2>
        <Table head={["", "Tennis", "Pickleball"]} minWidth={560}>
          {COMPARE.map((c) => (
            <tr key={c.row}>
              <Td strong>{c.row}</Td>
              <Td>{c.tennis}</Td>
              <Td>{c.pickle}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* CHECKLIST */}
      <Section id="first-match" tint>
        <H2 eyebrow="Ready to play" lead="Five things that make your first season smooth.">
          Before your first match
        </H2>
        <ul className="grid gap-3">
          {CHECKLIST.map((c) => (
            <li key={c} className="bg-white px-6 py-4 flex gap-3">
              <Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: GREEN }} aria-hidden="true" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <H2 eyebrow="Questions">Frequently asked questions</H2>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-lg font-bold" style={{ color: INK }}>{f.q}</AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed" style={{ color: BODY }}>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>

      {/* CTA */}
      <section className="px-4 sm:px-6 py-16 text-center text-white" style={{ background: GREEN }}>
        <h2 className="font-bold text-3xl md:text-5xl leading-[1.05] mb-4">Ready to find your division?</h2>
        <p className="text-lg text-white/90 mb-8 max-w-xl mx-auto">Browse active tennis and pickleball leagues in your city and see real pricing before you sign up.</p>
        <Link
          to="/join"
          className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold uppercase tracking-wider transition-colors hover:bg-[#3D3D3D] hover:text-white"
          style={{ background: AMBER, color: INK }}
          data-testid="tp-leagues-cta"
        >
          Find a League <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
