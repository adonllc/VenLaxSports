import { useNavigate, Link } from "react-router-dom";
import { motion, MotionConfig } from "framer-motion";
import { Trophy, TrendingUp, Users, Share2, ArrowRight } from "lucide-react";
import { activeSports } from "../config/platformConfig";
import { PHOTOS } from "../config/photos";
import PhotoSlot from "../components/PhotoSlot";
import Slant from "../components/Slant";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion";

const GREEN = "#008F70";
const AMBER = "#F2A922";
const INK = "#1D1D1D";
const BODY = "#4C4C4C";
const GREY = "#F1F1F1";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

const FEATURES = [
  { icon: TrendingUp, title: "A rating that moves", body: "Your skill rating rises and falls with every reported match, so your level is always current." },
  { icon: Users, title: "Matched by skill", body: "Divisions group you with players at your level. Singles, doubles and mixed formats." },
  { icon: Trophy, title: "Live standings", body: "Wins, losses and rank update as scores come in, through to playoffs." },
  { icon: Share2, title: "Match cards you can share", body: "Every result becomes a card with the score and your rating change, ready to post." },
];

const STEPS = [
  { n: "01", title: "Join a league", body: "Pick your sport, city and division. Register solo or with a partner for doubles." },
  { n: "02", title: "Schedule and play", body: "Set up matches with your opponents through the league. Play on your own time." },
  { n: "03", title: "Report the score", body: "Submit the result. Standings and your skill rating update right away." },
];

const FAQ = [
  { q: "How does the skill rating work?", a: "It is an ELO-style rating. You gain points for beating higher-rated players and lose fewer when you lose to them, so it settles on your real level." },
  { q: "Do I need a partner?", a: "Not for singles. For doubles and mixed leagues you can register with a partner and invite them by email." },
  { q: "How do I report a score?", a: "After the match, open it from your dashboard and submit the result. Standings and ratings update automatically." },
  { q: "What if there is a score dispute?", a: "Either player can raise a dispute. The process and timelines are in the League Rules and Terms." },
  { q: "Where can I find the rules?", a: "The Rules page and Player Handbook cover formats, scheduling, conduct and playoffs." },
];

// Amber square button, dark text for contrast (AA)
function AmberButton({ children, onClick, testId, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold uppercase tracking-wider transition-colors hover:bg-[#1D1D1D] hover:text-white ${className}`}
      style={{ background: AMBER, color: INK }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

export default function Home() {
  const navigate = useNavigate();

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-white" style={{ color: BODY }}>
        {/* HERO */}
        <section className="relative">
          <PhotoSlot src={PHOTOS.hero} alt="Players competing in a league match" tone="ink" overlay={false} className="min-h-[620px] md:min-h-[760px]">
            <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.38)" }} />
            <div className="relative flex flex-col items-center justify-center text-center px-6 pt-24 pb-44 min-h-[620px] md:min-h-[760px]">
              <motion.h1
                className="font-bold italic text-6xl sm:text-8xl md:text-[144px] leading-[0.95] text-white"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              >
                Play
                <span className="block mt-2">
                  <span className="inline-block px-5 md:px-8" style={{ background: GREEN, transform: "skewX(-8deg)" }}>
                    <span className="inline-block" style={{ transform: "skewX(8deg)" }}>Ranked</span>
                  </span>
                </span>
              </motion.h1>
              <motion.p
                className="mt-8 text-lg md:text-2xl font-medium text-white"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.2 }}
              >
                Ranked leagues for Tennis &amp; Pickleball
              </motion.p>
              <motion.div className="mt-8 flex flex-wrap gap-3 justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}>
                <AmberButton onClick={() => navigate("/auth")} testId="hero-join-venlax">Join VenLax</AmberButton>
                {activeSports.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/sport/${s.id}`)}
                    className="px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white border-2 border-white transition-colors hover:bg-white hover:text-[#1D1D1D]"
                    aria-label={`Explore ${s.label} leagues`}
                    data-testid={`hero-explore-${s.id}`}
                  >
                    {s.label}
                  </button>
                ))}
              </motion.div>
            </div>
          </PhotoSlot>

          {/* GREEN STANDARDS BAR */}
          <div className="relative -mt-24 md:-mt-20 px-4 sm:px-6">
            <div className="max-w-[1100px] mx-auto text-white px-8 md:px-12 py-8 flex flex-col md:flex-row items-center gap-6 justify-between" style={{ background: GREEN }}>
              <div className="text-center md:text-left">
                <h2 className="font-bold text-2xl md:text-3xl" style={{ color: "#fff" }}>Skill-matched leagues</h2>
                <p className="mt-1 text-white/90">Live standings and a rating that follows you from match to match.</p>
              </div>
              <AmberButton onClick={() => navigate("/leagues")}>Find a league</AmberButton>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section className="px-4 sm:px-6 py-24 md:py-32" style={{ background: GREY }}>
          <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <motion.div {...fadeUp}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GREEN }}>Why VenLax</p>
              <h2 className="font-bold text-4xl md:text-6xl leading-[1.05] mb-6" style={{ color: INK }}>
                Built around your progression
              </h2>
              <p className="text-lg leading-relaxed mb-8">
                Skill-matched divisions, a rating that moves with every result and standings that update as scores come in. Show up, play, and watch your level climb.
              </p>
              <AmberButton onClick={() => navigate("/rules")}>Read the rules</AmberButton>
            </motion.div>
            <motion.div {...fadeUp} className="relative">
              <Slant src={PHOTOS.tennis} alt="Tennis league play" className="w-full aspect-[4/3]" />
              <div className="absolute -bottom-6 left-4 md:-left-6 px-6 py-4 text-white" style={{ background: GREEN }}>
                <div className="font-bold text-3xl leading-none">{activeSports.length}</div>
                <div className="text-xs uppercase tracking-wider mt-1">Sports live</div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FEATURES ACCORDION LIST */}
        <section className="px-4 sm:px-6 py-24 md:py-32 bg-white">
          <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
            <motion.div {...fadeUp}>
              <h2 className="font-bold text-4xl md:text-6xl leading-[1.05]" style={{ color: INK }}>
                Everything a competitive league needs
              </h2>
            </motion.div>
            <motion.div {...fadeUp} className="grid gap-px" style={{ background: "#E4E4E4" }}>
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-white py-5 flex gap-5">
                  <div className="w-12 h-12 shrink-0 flex items-center justify-center" style={{ background: GREEN }}>
                    <f.icon className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl" style={{ color: INK }}>{f.title}</h3>
                    <p className="mt-1">{f.body}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* GREEN CTA BLOCK WITH SLANTED SPORT PHOTOS */}
        <section className="px-4 sm:px-6 py-20 md:py-28 text-white" style={{ background: GREEN }}>
          <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
            <motion.div {...fadeUp}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: AMBER }}>Choose your sport</p>
              <h2 className="font-bold text-4xl md:text-6xl leading-[1.05] mb-6" style={{ color: "#fff" }}>Start building your future today</h2>
              <p className="text-lg text-white/90 mb-8">Join a league near you and start climbing the standings.</p>
              <AmberButton onClick={() => navigate("/auth")} testId="home-closing-cta">Join VenLax <ArrowRight className="w-4 h-4" aria-hidden="true" /></AmberButton>
            </motion.div>
            <div className="grid grid-cols-2 gap-3">
              {activeSports.map((s, i) => (
                <motion.div key={s.id} {...fadeUp} transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.1 }}>
                  <Link to={`/sport/${s.id}`} className="block group" data-testid={`home-sport-card-${s.id}`}>
                    <Slant src={PHOTOS[s.id]} alt={`${s.label} league play`} dir={i % 2 ? "left" : "right"} className="aspect-[3/4] transition-transform group-hover:scale-[1.02]" />
                    <p className="mt-3 font-bold text-lg flex items-center gap-1" style={{ color: "#fff" }}>
                      {s.label} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </p>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="px-4 sm:px-6 py-24 md:py-32" style={{ background: GREY }}>
          <div className="max-w-[1100px] mx-auto">
            <motion.h2 {...fadeUp} className="font-bold text-4xl md:text-6xl leading-[1.05] text-center mb-14" style={{ color: INK }}>
              From signup to standings in three steps
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STEPS.map((s, i) => (
                <motion.div key={s.n} {...fadeUp} transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.08 }} className="bg-white p-8 border-t-4" style={{ borderColor: AMBER }}>
                  <span className="font-bold text-4xl" style={{ color: GREEN }}>{s.n}</span>
                  <h3 className="font-bold text-2xl mt-3 mb-2" style={{ color: INK }}>{s.title}</h3>
                  <p>{s.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 sm:px-6 py-24 md:py-32 bg-white">
          <div className="max-w-[820px] mx-auto">
            <motion.h2 {...fadeUp} className="font-bold text-4xl md:text-5xl leading-[1.1] text-center mb-4" style={{ color: INK }}>
              Everything you need to know
            </motion.h2>
            <p className="text-center mb-10">
              New to leagues?{" "}
              <Link to="/tennis-pickleball-leagues" className="font-bold underline" style={{ color: GREEN }} data-testid="home-league-guide-link">
                Read our Tennis &amp; Pickleball league guide
              </Link>
            </p>
            <motion.div {...fadeUp}>
              <Accordion type="single" collapsible className="w-full">
                {FAQ.map((f, i) => (
                  <AccordionItem key={f.q} value={`faq-${i}`} data-testid={`home-faq-${i}`}>
                    <AccordionTrigger className="text-left text-lg md:text-xl font-bold" style={{ color: INK }}>{f.q}</AccordionTrigger>
                    <AccordionContent className="text-base md:text-lg leading-relaxed" style={{ color: BODY }}>{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>

      </div>
    </MotionConfig>
  );
}
