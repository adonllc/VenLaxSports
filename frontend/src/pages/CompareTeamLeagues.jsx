import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import RelatedLinks from "../components/RelatedLinks";
import useDocumentMeta from "../hooks/useDocumentMeta";

const INK = "#3D3D3D";
const BODY = "#5C5C5C";
const GREEN = "#008F70";
const AMBER = "#F2A922";

// Facts about ALTA were read on altatennis.org on 2026-10-25. Do not add a competitor fact that is not
// on its own site, and re-check this table before each season. Prices we could not find are said as such.
const CHECKED = "October 25, 2026";
const ALTA_HOME = "https://altatennis.org";
const ALTA_RULES = "https://altatennis.org/media/2345/adultrules2025rev10224.pdf";

const ROWS = [
  ["How you join", "You sign up on your own. We put you in a league with players near your level.", "Captain-led teams. ALTA says it does not place members on rosters, so you find a team or a captain."],
  ["Who you play", "Singles: one opponent per match. Doubles: you and one partner.", "Your team plays another team. A mixed doubles roster needs at least six men and six women."],
  ["Match times", "The home player proposes a time and court, the away player confirms. You agree it between you.", "Set by the league. For example, its winter mixed doubles matches are Sundays at 1:00 pm."],
  ["Season", "5 to 7 matches over 6 to 8 weeks, then playoffs for the top players.", "Its winter 2027 mixed doubles season runs January 2 to February 14, then playoffs and City Finals."],
  ["Cost", "Singles $9.99 per player. Doubles $19.99 per team, one payment covers both players.", "Dues are required, but the amount is not listed on the ALTA pages we checked. Ask ALTA or your captain."],
  ["Your rating", "Your skill rating updates after every match, and you get a shareable match card.", "Teams are grouped into levels (AA, A, B and C) in the adult rulebook."],
  ["Club membership", "Not needed.", "Not stated on the pages we checked."],
];

export default function CompareTeamLeagues() {
  useDocumentMeta({
    title: "VENLAX vs team leagues in Atlanta (like ALTA) | Which fits you?",
    description: "An honest comparison of VENLAX Sports individual leagues with captain-led team leagues like ALTA in Atlanta: how you join, match times, season length and cost.",
    canonicalPath: "/compare/team-leagues-atlanta",
  });

  return (
    <div className="bg-white" data-testid="compare-page">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-16 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: GREEN }}>Atlanta</p>
        <h1 className="font-bold italic text-4xl md:text-5xl leading-[1.05]" style={{ color: INK }}>VENLAX or a team league?</h1>
        <p className="mt-4 text-lg" style={{ color: BODY }}>
          Atlanta has a long-running team league system, the Atlanta Lawn Tennis Association (ALTA). VENLAX is different: you sign up on your own, with no team and no captain. Here is how they compare, so you can pick the one that fits how you like to play.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full text-left border-collapse" data-testid="compare-table">
            <caption className="sr-only">VENLAX Sports compared with a team league such as ALTA</caption>
            <thead>
              <tr>
                <th scope="col" className="py-3 pr-4 text-xs font-bold uppercase tracking-wider" style={{ color: BODY }}> </th>
                <th scope="col" className="py-3 pr-4 text-sm font-bold" style={{ color: GREEN }}>VENLAX Sports</th>
                <th scope="col" className="py-3 text-sm font-bold" style={{ color: INK }}>Team league (ALTA)</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, venlax, team]) => (
                <tr key={label} style={{ borderTop: "1px solid #E4E4E4" }}>
                  <th scope="row" className="py-4 pr-4 align-top text-sm font-bold" style={{ color: INK }}>{label}</th>
                  <td className="py-4 pr-4 align-top" style={{ color: BODY }}>{venlax}</td>
                  <td className="py-4 align-top" style={{ color: BODY }}>{team}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <section aria-labelledby="pick-venlax">
            <h2 id="pick-venlax" className="font-bold text-2xl" style={{ color: INK }}>VENLAX fits if</h2>
            <ul className="mt-3 space-y-2" style={{ color: BODY }}>
              {["You want to play on your own, without finding a team or a captain.", "You want to agree match times with your opponent.", "You like seeing your rating move after every match.", "You want a short season with a low price."].map((t) => (
                <li key={t} className="flex gap-3"><span className="mt-2.5 w-2 h-2 shrink-0" style={{ background: AMBER }} aria-hidden="true" />{t}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="pick-team">
            <h2 id="pick-team" className="font-bold text-2xl" style={{ color: INK }}>A team league fits if</h2>
            <ul className="mt-3 space-y-2" style={{ color: BODY }}>
              {["You want to belong to a team with a captain and teammates.", "You like set match times that the league decides.", "You already have a team, or want to join one at your club."].map((t) => (
                <li key={t} className="flex gap-3"><span className="mt-2.5 w-2 h-2 shrink-0" style={{ background: AMBER }} aria-hidden="true" />{t}</li>
              ))}
            </ul>
          </section>
        </div>
        <p className="mt-6" style={{ color: BODY }}>Many players do both. They are different ways to play, not rivals.</p>

        <div className="mt-10">
          <Link
            to="/leagues?city=Atlanta"
            className="inline-flex items-center gap-2 px-6 py-3 font-bold"
            style={{ background: AMBER, color: INK }}
            data-testid="compare-cta"
          >
            See Atlanta leagues <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>
        </div>

        <p className="mt-10 text-sm" style={{ color: BODY }} data-testid="compare-sources">
          About ALTA: read on {" "}
          <a href={ALTA_HOME} className="underline" rel="noopener noreferrer" target="_blank">altatennis.org</a> and in its{" "}
          <a href={ALTA_RULES} className="underline" rel="noopener noreferrer" target="_blank">2025 adult rules</a> on {CHECKED}.
          Their season dates, fees and rules change, so check them before you decide. VENLAX Sports is not affiliated with or endorsed by ALTA.
        </p>
      </div>

      <RelatedLinks links={[
        { to: "/tennis-pickleball-leagues", label: "How VENLAX leagues work" },
        { to: "/leagues?city=Atlanta", label: "Atlanta leagues" },
        { to: "/rules", label: "League rules" },
      ]} />
    </div>
  );
}
