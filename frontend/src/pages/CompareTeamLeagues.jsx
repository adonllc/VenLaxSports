import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import RelatedLinks from "../components/RelatedLinks";
import useDocumentMeta from "../hooks/useDocumentMeta";

const INK = "#3D3D3D";
const BODY = "#5C5C5C";
const GREEN = "#008F70";
const AMBER = "#F2A922";

// No competitor is named on this page. Describe team leagues in general terms only, and keep every line to
// something that is true of captain-led team leagues as a category. Never add a competitor's price or dates.

const ROWS = [
  ["How you join", "You sign up on your own. We put you in a league with players near your level.", "You join a team, usually through a captain, or you find one that needs players."],
  ["Who you play", "Singles: one opponent per match. Doubles: you and one partner.", "Your team plays another team."],
  ["Match times", "The home player proposes a time and court, the away player confirms. You agree it between you.", "Usually set by the league or your captain."],
  ["Season", "5 to 7 matches over 6 to 8 weeks, then playoffs for the top players.", "Set by each league. Check its calendar."],
  ["Cost", "Singles $9.99 per player. Doubles $19.99 per team, one payment covers both players.", "Varies by league. Ask the league or your captain what dues and fees apply."],
  ["Your rating", "Your skill rating updates after every match, and you get a shareable match card.", "Varies by league."],
  ["Club membership", "Not needed.", "Check each league's rules."],
];

export default function CompareTeamLeagues() {
  useDocumentMeta({
    title: "VENLAX vs team leagues in Atlanta | Which fits you?",
    description: "An honest comparison of VENLAX Sports individual leagues with captain-led team leagues in Atlanta: how you join, match times, season length and cost.",
    canonicalPath: "/compare/team-leagues-atlanta",
  });

  return (
    <div className="bg-white" data-testid="compare-page">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-16 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: GREEN }}>Atlanta</p>
        <h1 className="font-bold italic text-4xl md:text-5xl leading-[1.05]" style={{ color: INK }}>VENLAX or a team league?</h1>
        <p className="mt-4 text-lg" style={{ color: BODY }}>
          Atlanta also has team leagues, where you play for a team with a captain. VENLAX is different: you sign up on your own, with no team and no captain. Here is how they compare, so you can pick the one that fits how you like to play.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full text-left border-collapse" data-testid="compare-table">
            <caption className="sr-only">VENLAX Sports compared with team leagues</caption>
            <thead>
              <tr>
                <th scope="col" className="py-3 pr-4 text-xs font-bold uppercase tracking-wider" style={{ color: BODY }}> </th>
                <th scope="col" className="py-3 pr-4 text-sm font-bold" style={{ color: GREEN }}>VENLAX Sports</th>
                <th scope="col" className="py-3 text-sm font-bold" style={{ color: INK }}>Other league platforms</th>
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
              {["You want to belong to a team with a captain and teammates.", "You like match times that the league or your captain decides.", "You already have a team, or want to join one at your club."].map((t) => (
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
          Team leagues differ from one another. Check each league's own rules, dates and fees before you decide.
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
