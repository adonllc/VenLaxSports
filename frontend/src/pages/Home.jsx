import { useNavigate, Link } from "react-router-dom";
import { motion, MotionConfig } from "framer-motion";
import { Trophy, TrendingUp, Users, Share2, ArrowRight } from "lucide-react";
import { activeSports } from "../config/platformConfig";
import { PHOTOS } from "../config/photos";
import PhotoSlot from "../components/PhotoSlot";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion";

const HEADING = { fontFamily: "'Cabinet Grotesk', system-ui, sans-serif" };
const BODY = { fontFamily: "'Hanken Grotesk', sans-serif" };

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

const FEATURES = [
  { icon: TrendingUp, title: "A rating that moves", body: "Your skill rating rises and falls with every reported match, so your level is always current.", span: "md:col-span-2", tone: "#047857" },
  { icon: Users, title: "Matched by skill", body: "Divisions group you with players at your level. Singles, doubles and mixed formats.", span: "", tone: "#C2410C" },
  { icon: Trophy, title: "Live standings", body: "Wins, losses and rank update as scores come in, through to playoffs.", span: "", tone: "#C2410C" },
  { icon: Share2, title: "Match cards you can share", body: "Every result becomes a card with the score and your rating change, ready to post.", span: "md:col-span-2", tone: "#047857" },
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
      <div className="min-h-screen flex flex-col" style={{ background: "#FAFAFA", ...BODY }}>
        {/* HERO */}
        <section className="px-4 sm:px-6 pt-4 sm:pt-6">
          <PhotoSlot src={PHOTOS.hero} alt="Players competing in a league match" tone="ink" className="max-w-[1320px] mx-auto rounded-3xl min-h-[560px] md:min-h-[680px]">
            <div className="flex flex-col items-center justify-center text-center px-6 py-20 md:py-28 min-h-[560px] md:min-h-[680px]">
              <motion.span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-white mb-6"
                style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.28)", backdropFilter: "blur(12px)" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} aria-hidden="true" />
                Ranked leagues for Tennis &amp; Pickleball
              </motion.span>

              <motion.h1
                className="font-extrabold text-5xl md:text-7xl leading-[1.05] text-white max-w-3xl"
                style={{ ...HEADING, letterSpacing: "-0.02em" }}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.05, ease: "easeOut" }}
              >
                Play ranked.<br />Rise every match.
              </motion.h1>

              <motion.p
                className="mt-6 text-lg md:text-xl max-w-xl leading-relaxed"
                style={{ color: "rgba(255,255,255,0.85)" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 }}
              >
                Skill-matched leagues, live standings and a rating that follows you from match to match.
              </motion.p>

              <motion.div
                className="mt-10 flex flex-col sm:flex-row gap-3 items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <button
                  onClick={() => navigate("/auth")}
                  className="px-8 py-3.5 rounded-full text-white font-bold text-base transition-all hover:-translate-y-0.5 hover:bg-[#065F46]"
                  style={{ background: "#047857" }}
                  aria-label="Sign up for VenLax Sports"
                  data-testid="hero-join-venlax"
                >
                  Join VenLax <ArrowRight className="inline w-4 h-4 ml-1 -mt-0.5" aria-hidden="true" />
                </button>
                {activeSports.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/sport/${s.id}`)}
                    className="px-6 py-3.5 rounded-full text-white font-semibold text-base transition-all hover:-translate-y-0.5"
                    style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.3)", backdropFilter: "blur(12px)" }}
                    aria-label={`Explore ${s.label} leagues`}
                    data-testid={`hero-explore-${s.id}`}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </motion.div>
            </div>
          </PhotoSlot>
        </section>

        {/* FEATURE BENTO */}
        <section className="px-4 sm:px-6 py-20 md:py-28">
          <div className="max-w-[1200px] mx-auto">
            <motion.div {...fadeUp} className="max-w-2xl mb-12">
              <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#047857" }}>Why VenLax</p>
              <h2 className="font-extrabold text-4xl md:text-5xl leading-tight" style={{ ...HEADING, color: "#111827", letterSpacing: "-0.02em" }}>
                Built around your progression.
              </h2>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  {...fadeUp}
                  transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.08 }}
                  className={`${f.span} rounded-3xl bg-white p-8 transition-all hover:-translate-y-1 hover:shadow-lg`}
                  style={{ border: "1px solid #E5E7EB" }}
                >
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-6" style={{ background: `${f.tone}14` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.tone }} aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-2xl mb-2" style={{ ...HEADING, color: "#111827" }}>{f.title}</h3>
                  <p className="leading-relaxed" style={{ color: "#4B5563" }}>{f.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* SPORT PHOTO CARDS */}
        <section className="px-4 sm:px-6 pb-20 md:pb-28">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSports.map((s, i) => (
              <motion.div key={s.id} {...fadeUp} transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.1 }}>
                <Link to={`/sport/${s.id}`} className="block group" data-testid={`home-sport-card-${s.id}`}>
                  <PhotoSlot
                    src={PHOTOS[s.id]}
                    alt={`${s.label} league play`}
                    tone={s.id === "pickleball" ? "orange" : "emerald"}
                    className="rounded-3xl min-h-[380px] md:min-h-[460px]"
                  >
                    <div className="flex flex-col justify-end h-full min-h-[380px] md:min-h-[460px] p-8">
                      <span
                        className="self-start rounded-full px-3.5 py-1 text-xs font-semibold text-white mb-4"
                        style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.3)", backdropFilter: "blur(12px)" }}
                      >
                        {s.icon} {s.label}
                      </span>
                      <h3 className="font-extrabold text-3xl md:text-4xl text-white" style={{ ...HEADING, letterSpacing: "-0.01em" }}>
                        {s.id === "tennis" ? "Climb the tennis ladder." : "Own the pickleball court."}
                      </h3>
                      <span className="mt-3 inline-flex items-center gap-1 text-white font-semibold">
                        Explore {s.label} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </span>
                    </div>
                  </PhotoSlot>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="px-4 sm:px-6 pb-20 md:pb-28">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12">
            <motion.div {...fadeUp}>
              <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#C2410C" }}>How it works</p>
              <h2 className="font-extrabold text-4xl md:text-5xl leading-tight" style={{ ...HEADING, color: "#111827", letterSpacing: "-0.02em" }}>
                From signup to standings in three steps.
              </h2>
            </motion.div>
            <div className="divide-y" style={{ borderColor: "#E5E7EB" }}>
              {STEPS.map((s, i) => (
                <motion.div key={s.n} {...fadeUp} transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.08 }} className="flex gap-6 py-7 first:pt-0">
                  <span className="font-bold text-lg w-8 shrink-0" style={{ color: "#047857", fontFamily: "'IBM Plex Mono', monospace" }}>{s.n}</span>
                  <div>
                    <h3 className="font-bold text-xl mb-1" style={{ ...HEADING, color: "#111827" }}>{s.title}</h3>
                    <p style={{ color: "#4B5563" }}>{s.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 sm:px-6 pb-20 md:pb-28">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12">
            <motion.div {...fadeUp}>
              <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#047857" }}>FAQ</p>
              <h2 className="font-extrabold text-4xl md:text-5xl leading-tight" style={{ ...HEADING, color: "#111827", letterSpacing: "-0.02em" }}>
                Everything you need to know.
              </h2>
              <p className="mt-4" style={{ color: "#4B5563" }}>
                New to leagues?{" "}
                <Link to="/tennis-pickleball-leagues" className="underline font-semibold hover:text-[#047857]" data-testid="home-league-guide-link">
                  Read our Tennis &amp; Pickleball league guide
                </Link>
              </p>
            </motion.div>
            <motion.div {...fadeUp}>
              <Accordion type="single" collapsible className="w-full">
                {FAQ.map((f, i) => (
                  <AccordionItem key={f.q} value={`faq-${i}`} data-testid={`home-faq-${i}`}>
                    <AccordionTrigger className="text-left text-lg font-semibold" style={{ ...HEADING, color: "#111827" }}>{f.q}</AccordionTrigger>
                    <AccordionContent className="text-base leading-relaxed" style={{ color: "#4B5563" }}>{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="px-4 sm:px-6 pb-20">
          <motion.div {...fadeUp}>
            <PhotoSlot src={PHOTOS.community} alt="Players after a match" tone="ink" className="max-w-[1200px] mx-auto rounded-3xl">
              <div className="px-8 py-16 md:py-24 text-center">
                <h2 className="font-extrabold text-4xl md:text-6xl text-white max-w-3xl mx-auto leading-tight" style={{ ...HEADING, letterSpacing: "-0.02em" }}>
                  Your game doesn't end when the match ends.
                </h2>
                <button
                  onClick={() => navigate("/auth")}
                  className="mt-10 px-9 py-4 rounded-full text-white font-bold text-base transition-all hover:-translate-y-0.5 hover:bg-[#065F46]"
                  style={{ background: "#047857" }}
                  data-testid="home-closing-cta"
                >
                  Join VenLax <ArrowRight className="inline w-4 h-4 ml-1 -mt-0.5" aria-hidden="true" />
                </button>
              </div>
            </PhotoSlot>
          </motion.div>
        </section>
      </div>
    </MotionConfig>
  );
}
