import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Slant from "../components/Slant";
import RelatedLinks from "../components/RelatedLinks";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { FOUNDER, hasFounderPage } from "../config/founderConfig";
import NotFound from "./NotFound";

const INK = "#3D3D3D";
const BODY = "#5C5C5C";
const GREEN = "#008F70";
const AMBER = "#F2A922";

const FACTS = [
  { title: "Tennis and Pickleball", body: "Ranked leagues for both." },
  { title: "No club membership", body: "One fee per season." },
  { title: "Real seasons", body: "A schedule, standings and playoffs." },
];

const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export default function About() {
  useDocumentMeta({
    // no title until the page is real, so the not-found page below keeps its own title
    title: hasFounderPage ? `About ${FOUNDER.name} | VENLAX Sports` : undefined,
    description: hasFounderPage ? "Why VENLAX Sports exists: ranked Tennis and Pickleball leagues for players who want real competition without a club membership." : undefined,
    canonicalPath: hasFounderPage ? "/about" : undefined,
  });

  // Never show a half-empty page: until the owner fills in founderConfig.js this is a 404.
  if (!hasFounderPage) return <NotFound />;

  return (
    <div className="bg-white" data-testid="about-page">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 md:gap-16 items-start">
        <div className="w-full max-w-sm mx-auto md:max-w-none">
          {FOUNDER.photo ? (
            <Slant src={FOUNDER.photo} alt={`${FOUNDER.name}, ${FOUNDER.role}`} dir="right" className="aspect-[4/5]" />
          ) : (
            <div className="aspect-[4/5] flex items-center justify-center" style={{ background: GREEN }} role="img" aria-label={FOUNDER.name}>
              <span className="font-bold italic text-7xl text-white">{initials(FOUNDER.name)}</span>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: GREEN }}>About</p>
          <h1 className="font-bold italic text-4xl md:text-6xl leading-[1.05]" style={{ color: INK }}>Why I built VENLAX</h1>
          <p className="mt-3 text-sm font-medium" style={{ color: BODY }}>{FOUNDER.name}, {FOUNDER.role}</p>

          <div className="mt-6 space-y-4 text-lg leading-relaxed" style={{ color: BODY }}>
            {FOUNDER.story.map((para, i) => <p key={i}>{para}</p>)}
          </div>

          <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 border-t pt-6" style={{ borderColor: "#E4E4E4" }}>
            {FACTS.map((f) => (
              <li key={f.title}>
                <p className="font-bold" style={{ color: INK }}>{f.title}</p>
                <p className="text-sm" style={{ color: BODY }}>{f.body}</p>
              </li>
            ))}
          </ul>

          {FOUNDER.links.length > 0 && (
            <p className="mt-6 text-sm flex flex-wrap gap-x-5 gap-y-1">
              {FOUNDER.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="font-bold underline" style={{ color: "#00765C" }}>{l.label}</a>
              ))}
            </p>
          )}

          <Link
            to="/leagues"
            className="mt-10 inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold uppercase tracking-wider transition-colors hover:bg-[#3D3D3D] hover:text-white"
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
