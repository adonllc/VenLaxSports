import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Slant from "../components/Slant";
import RelatedLinks from "../components/RelatedLinks";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { ABOUT, hasFounderPage } from "../config/founderConfig";
import NotFound from "./NotFound";

const INK = "#3D3D3D";
const BODY = "#5C5C5C";
const GREEN = "#008F70";
const AMBER = "#F2A922";

export default function About() {
  useDocumentMeta({
    // no title until the page is real, so the not-found page below keeps its own title
    title: hasFounderPage ? "About VENLAX Sports | Why we built it" : undefined,
    description: hasFounderPage ? "Why VENLAX Sports exists: ranked Tennis and Pickleball leagues for players who want real competition without a club membership." : undefined,
    canonicalPath: hasFounderPage ? "/about" : undefined,
  });

  // Never show a half-empty page: if founderConfig.js has no story this is a 404.
  if (!hasFounderPage) return <NotFound />;

  return (
    <div className="bg-white" data-testid="about-page">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 md:gap-16 items-start">
        <figure className="w-full max-w-sm mx-auto md:max-w-none" data-testid="about-photo">
          <Slant src={ABOUT.photo} alt={ABOUT.photoAlt} dir="right" className="aspect-[4/5]" />
          <figcaption className="mt-2 font-bold" style={{ color: INK }}>{ABOUT.byline}</figcaption>
        </figure>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: GREEN }}>About</p>
          <h1 className="font-bold italic text-4xl md:text-6xl leading-[1.05]" style={{ color: INK }}>{ABOUT.headline}</h1>
          <p className="mt-4 text-lg font-medium" style={{ color: INK }}>{ABOUT.subhead}</p>

          <div className="mt-6 space-y-4 text-lg leading-relaxed" style={{ color: BODY }}>
            {ABOUT.story.map((para, i) => <p key={i}>{para}</p>)}
          </div>

          <section className="mt-10 pt-6 border-t" style={{ borderColor: "#E4E4E4" }} aria-labelledby="about-mission">
            <h2 id="about-mission" className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: GREEN }}>Our mission</h2>
            <p className="text-2xl font-bold leading-snug" style={{ color: INK }}>{ABOUT.mission}</p>
          </section>

          <section className="mt-8" aria-labelledby="about-beliefs">
            <h2 id="about-beliefs" className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: GREEN }}>What we believe</h2>
            <ul className="space-y-2 text-lg" style={{ color: BODY }}>
              {ABOUT.beliefs.map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="mt-2.5 w-2 h-2 shrink-0" style={{ background: AMBER }} aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-8 text-lg font-bold" style={{ color: INK }}>{ABOUT.closing}</p>

          {ABOUT.links.length > 0 && (
            <p className="mt-4 text-sm flex flex-wrap gap-x-5 gap-y-1">
              {ABOUT.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="font-bold underline" style={{ color: "#00765C" }}>{l.label}</a>
              ))}
            </p>
          )}

          <Link
            to="/leagues"
            className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold uppercase tracking-wider transition-colors hover:bg-[#3D3D3D] hover:text-white"
            style={{ background: AMBER, color: INK }}
            data-testid="about-find-league"
          >
            Find a league <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <RelatedLinks links={[
        { to: "/tennis-pickleball-leagues", label: "Tennis & Pickleball league guide" },
        { to: "/rules", label: "League rules" },
        { to: "/ladders", label: "Challenge ladders" },
      ]} />
    </div>
  );
}
