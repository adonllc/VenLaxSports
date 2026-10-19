import { useNavigate, Link } from "react-router-dom";
import { motion, MotionConfig } from "framer-motion";
import { Trophy, TrendingUp, Users, Share2, ChevronRight } from "lucide-react";
import { activeSports } from "../config/platformConfig";
import { PHOTOS } from "../config/photos";
import PhotoSlot from "../components/PhotoSlot";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion";

const INK = "#1D1D1F";
const MUTED = "#6E6E73";
const TILE = "#F5F5F7";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

const FEATURES = [
  { icon: TrendingUp, title: "A rating that moves.", body: "Your skill rating rises and falls with every reported match, so your level is always current.", span: "md:col-span-2", tone: "#047857" },
  { icon: Users, title: "Matched by skill.", body: "Divisions group you with players at your level. Singles, doubles and mixed formats.", span: "", tone: "#C2410C" },
  { icon: Trophy, title: "Live standings.", body: "Wins, losses and rank update as scores come in, through to playoffs.", span: "", tone: "#C2410C" },
  { icon: Share2, title: "Match cards you can share.", body: "Every result becomes a card with the score and your rating change, ready to post.", span: "md:col-span-2", tone: "#047857" },
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

export default function Home() {
  const navigate = useNavigate();

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-white">
        {/* HERO */}
        <section className="px-4 sm:px-6 pt-16 md:pt-24 text-center">
          <motion.p
            className="text-lg md:text-xl font-semibold mb-3"
            style={{ color: "#C2410C" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Ranked leagues for Tennis &amp; Pickleball
          </motion.p>
          <motion.h1
            className="font-semibold text-5xl md:text-[88px] leading-[1.03] max-w-4xl mx-auto"
            style={{ color: INK, letterSpacing: "-0.035em" }}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: "easeOut" }}
          >
            Play ranked.<br />Rise every match.
          </motion.h1>
          <motion.p
            className="mt-6 text-xl md:text-2xl max-w-2xl mx-auto leading-snug"
            style={{ color: MUTED }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            Skill-matched leagues, live standings and a rating that follows you from match to match.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-col sm:flex-row gap-4 sm:gap-8 items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <button
              onClick={() => navigate("/auth")}
              className="px-7 py-3 rounded-full text-white font-medium text-lg transition-colors hover:bg-[#065F46]"
              style={{ background: "#047857" }}
              aria-label="Sign up for VenLax Sports"
              data-testid="hero-join-venlax"
            >
              Join VenLax
            </button>
            {activeSports.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/sport/${s.id}`)}
                className="inline-flex items-center gap-0.5 text-lg font-medium hover:underline"
                style={{ color: "#047857" }}
                aria-label={`Explore ${s.label} leagues`}
                data-testid={`hero-explore-${s.id}`}
              >
                Explore {s.label} <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            ))}
          </motion.div>

          <motion.div
            className="max-w-[1200px] mx-auto mt-14 md:mt-20"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: "easeOut" }}
          >
            <PhotoSlot src={PHOTOS.hero} alt="Players competing in a league match" tone="ink" overlay={false} className="rounded-[28px] aspect-[16/9] md:aspect-[21/9]" />
          </motion.div>
        </section>

        {/* FEATURE TILES */}
        <section className="px-4 sm:px-6 py-24 md:py-32">
          <div className="max-w-[1200px] mx-auto">
            <motion.h2 {...fadeUp} className="font-semibold text-4xl md:text-6xl leading-[1.08] text-center max-w-3xl mx-auto mb-14" style={{ color: INK, letterSpacing: "-0.03em" }}>
              Built around your progression.
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  {...fadeUp}
                  transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.08 }}
                  className={`${f.span} rounded-[28px] p-8 md:p-10 min-h-[260px] flex flex-col`}
                  style={{ background: TILE }}
                >
                  <f.icon className="w-8 h-8 mb-auto" style={{ color: f.tone }} aria-hidden="true" />
                  <h3 className="font-semibold text-2xl md:text-3xl mt-10 mb-2" style={{ color: INK, letterSpacing: "-0.02em" }}>{f.title}</h3>
                  <p className="text-lg leading-snug" style={{ color: MUTED }}>{f.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* SPORT TILES */}
        <section className="px-4 sm:px-6 pb-24 md:pb-32">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSports.map((s, i) => (
              <motion.div key={s.id} {...fadeUp} transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.1 }}>
                <Link to={`/sport/${s.id}`} className="block group rounded-[28px] overflow-hidden text-center" style={{ background: TILE }} data-testid={`home-sport-card-${s.id}`}>
                  <div className="px-8 pt-12 pb-8">
                    <p className="text-base font-semibold mb-2" style={{ color: s.id === "pickleball" ? "#C2410C" : "#047857" }}>{s.label}</p>
                    <h3 className="font-semibold text-3xl md:text-4xl leading-tight" style={{ color: INK, letterSpacing: "-0.025em" }}>
                      {s.id === "tennis" ? "Climb the tennis ladder." : "Own the pickleball court."}
                    </h3>
                    <span className="mt-3 inline-flex items-center gap-0.5 text-lg font-medium group-hover:underline" style={{ color: "#047857" }}>
                      Explore {s.label} <ChevronRight className="w-5 h-5" aria-hidden="true" />
                    </span>
                  </div>
                  <PhotoSlot src={PHOTOS[s.id]} alt={`${s.label} league play`} tone={s.id === "pickleball" ? "orange" : "emerald"} overlay={false} className="aspect-[16/10]" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="px-4 sm:px-6 py-24 md:py-32" style={{ background: TILE }}>
          <div className="max-w-[980px] mx-auto">
            <motion.h2 {...fadeUp} className="font-semibold text-4xl md:text-6xl leading-[1.08] text-center mb-14" style={{ color: INK, letterSpacing: "-0.03em" }}>
              From signup to standings in three steps.
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {STEPS.map((s, i) => (
                <motion.div key={s.n} {...fadeUp} transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.08 }} className="rounded-[28px] bg-white p-8">
                  <span className="font-semibold text-sm" style={{ color: "#047857", fontFamily: "'IBM Plex Mono', monospace" }}>{s.n}</span>
                  <h3 className="font-semibold text-2xl mt-4 mb-2" style={{ color: INK, letterSpacing: "-0.02em" }}>{s.title}</h3>
                  <p className="text-base leading-snug" style={{ color: MUTED }}>{s.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 sm:px-6 py-24 md:py-32">
          <div className="max-w-[820px] mx-auto">
            <motion.h2 {...fadeUp} className="font-semibold text-4xl md:text-5xl leading-[1.1] text-center mb-4" style={{ color: INK, letterSpacing: "-0.03em" }}>
              Everything you need to know.
            </motion.h2>
            <p className="text-center mb-10" style={{ color: MUTED }}>
              New to leagues?{" "}
              <Link to="/tennis-pickleball-leagues" className="font-medium hover:underline" style={{ color: "#047857" }} data-testid="home-league-guide-link">
                Read our Tennis &amp; Pickleball league guide
              </Link>
            </p>
            <motion.div {...fadeUp}>
              <Accordion type="single" collapsible className="w-full">
                {FAQ.map((f, i) => (
                  <AccordionItem key={f.q} value={`faq-${i}`} data-testid={`home-faq-${i}`}>
                    <AccordionTrigger className="text-left text-lg md:text-xl font-semibold" style={{ color: INK }}>{f.q}</AccordionTrigger>
                    <AccordionContent className="text-base md:text-lg leading-relaxed" style={{ color: MUTED }}>{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="px-4 sm:px-6 pb-24 md:pb-32 text-center">
          <motion.div {...fadeUp}>
            <h2 className="font-semibold text-4xl md:text-6xl leading-[1.08] max-w-3xl mx-auto" style={{ color: INK, letterSpacing: "-0.03em" }}>
              Your game doesn't end when the match ends.
            </h2>
            <button
              onClick={() => navigate("/auth")}
              className="mt-10 px-8 py-3.5 rounded-full text-white font-medium text-lg transition-colors hover:bg-[#065F46]"
              style={{ background: "#047857" }}
              data-testid="home-closing-cta"
            >
              Join VenLax
            </button>
          </motion.div>
        </section>
      </div>
    </MotionConfig>
  );
}
