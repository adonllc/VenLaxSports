import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion, MotionConfig } from "framer-motion";
import {
  Target, LayoutGrid, Users, CalendarCheck, Trophy, UserCircle, Share2, Gift, ShieldCheck,
  ArrowRight, Check, Smartphone, MessageCircle, CreditCard, CircleDot, Sparkles, UserPlus, Swords,
} from "lucide-react";
import { activeSports, FOUNDING_DISPLAY_FLOOR } from "../config/platformConfig";
import { PHOTOS } from "../config/photos";
import PhotoSlot from "../components/PhotoSlot";
import Slant from "../components/Slant";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const GREEN = "#008F70";
const AMBER = "#F2A922";
const INK = "#3D3D3D";
const BODY = "#5C5C5C";
const GREY = "#F1F1F1";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

// ---------------------------------------------------------------- content
const FEATURES = [
  { slug: "skill", icon: Target, title: "Skill-matched leagues", body: "Your rating matches you with players at your level and updates every match.", to: "/tennis-pickleball-leagues" },
  { slug: "types", icon: LayoutGrid, title: "Four league types", body: "Flex, Round Robin, Box and Challenge Ladder. Pick the rhythm for your week.", to: "/leagues" },
  { slug: "formats", icon: Users, title: "Singles, doubles and mixed", body: "Play solo or with a partner. Invite them by email or find them in the app.", to: "/leagues" },
  { slug: "scoring", icon: CalendarCheck, title: "Easy scheduling and scoring", body: "Agree a time, play, then report the score. Disputes have a clear process.", to: "/rules" },
  { slug: "standings", icon: Trophy, title: "Live standings and playoffs", body: "Points update as scores come in. Top players advance to a playoff bracket.", to: "/leagues" },
  { slug: "profile", icon: UserCircle, title: "Your rating and profile", body: "Track your rating history, follow players and share a public profile.", to: "/auth" },
  { slug: "cards", icon: Share2, title: "Shareable match cards", body: "Every result becomes a card with the score and rating change, ready to post.", to: "/auth" },
  { slug: "rewards", icon: Gift, title: "Rewards and referrals", body: "Bring a friend and you both get $5 credit toward your next league.", to: "/rewards" },
  { slug: "safe", icon: ShieldCheck, title: "Safe and fair play", body: "Digital waiver, parental consent for minors, 2FA sign-in and fair disputes.", to: "/terms" },
];

// The three problems players told us about, in their words
const PAINS = [
  { title: "You're stuck in dead group chats.", body: "Flaky players. Last-minute cancellations. No accountability. You waste hours organizing matches that fall apart." },
  { title: "You have no proof of your progress.", body: "You keep winning. But nobody knows. No ranking. No record. No way to track how good you've actually become." },
  { title: "Real competitive leagues? They don't exist.", body: "Expensive clubs gatekeep the game. Pickup courts are chaos. There's nothing between Sunday league and the club." },
];

const LEAGUE_TYPES = [
  { id: "flex", name: "Flex League", line: "You arrange your own match times.", points: ["5–7 matches over 6–8 weeks", "You and your opponent book the court", "Top players qualify for playoffs"], best: "Best for busy schedules." },
  { id: "rr", name: "Round Robin", line: "A fixed schedule where everyone plays everyone once.", points: ["Organizer books the courts", "Calendar is set upfront", "Top players advance to playoffs"], best: "Best if you like a set plan." },
  { id: "box", name: "Box League", line: "Small groups of 6 players.", points: ["Top 2 move up each cycle", "Bottom 2 move down", "No season-end playoffs"], best: "Best for steady, close competition." },
  { id: "ladder", name: "Challenge Ladder", line: "An ongoing ranked list.", points: ["Challenge anyone above you", "Win to swap ranks", "Join any time and climb year-round"], best: "Best for year-round play." },
];

const PRICING = [
  { format: "Singles", who: "1 player", price: "$9.99", unit: "per player, per season" },
  { format: "Doubles", who: "Team of 2", price: "$19.99", unit: "per team, per season" },
  { format: "Mixed doubles", who: "1 man + 1 woman", price: "$19.99", unit: "per team, per season" },
];

const SEASON = [
  { step: "Join", body: "Pick your sport, city, format and level." },
  { step: "Get matched", body: "You are placed in a league with players near your rating." },
  { step: "Schedule", body: "Home proposes a date, time and court before the play-by date. Away confirms or suggests another time." },
  { step: "Play", body: "Play by the date shown on your match." },
  { step: "Report", body: "The winner reports the score. Your rating updates." },
  { step: "Playoffs", body: "Top 4 (or top 8 in bigger leagues) go to the playoffs." },
];

const SAFETY = [
  { title: "Waiver and Terms", body: "A digital waiver and clear Terms before you play." },
  { title: "Players under 18", body: "Parental consent is required. The minimum age is 13." },
  { title: "Fair results", body: "Both players confirm scores. Disputes go to an organizer, with an appeal." },
  { title: "Account security", body: "Two-factor sign-in and Google sign-in are available." },
];

const GROW = [
  { slug: "referral", icon: Gift, title: "Share your code", body: "Get your referral code on the Rewards page. You both get $5 credit when your friend joins.", cta: "Get my code", to: "/rewards" },
  { slug: "partner", icon: UserPlus, title: "Bring a doubles partner", body: "Register for doubles and invite your partner by email. One team fee covers both of you.", cta: "Play doubles", to: "/leagues" },
  { slug: "challenge", icon: Swords, title: "Challenge a friend", body: "Join a ladder and challenge anyone above you. Win to swap ranks.", cta: "See ladders", to: "/ladders" },
  { slug: "share", icon: Share2, title: "Share your result", body: "Post your match card with the score and your rating change, and let your friends chase it.", cta: "Join to share", to: "/auth" },
];

const COMING_SOON = [
  { icon: CreditCard, title: "Apple Pay and Google Pay", body: "One-tap checkout." },
  { icon: MessageCircle, title: "WhatsApp match reminders", body: "Schedule and score nudges in WhatsApp." },
  { icon: Smartphone, title: "iOS and Android apps", body: "Play and report scores from your phone." },
  { icon: CircleDot, title: "Cricket", body: "T10 and T20 leagues with powerplay rules and net run rate standings." },
  { icon: Sparkles, title: "TYPTI", body: "A fast-paced hybrid racket sport with foam ball." },
];

const FAQ = [
  { q: "How does the skill rating work?", a: "It is an ELO-style rating. You gain points for beating higher-rated players and lose fewer when you lose to them, so it settles on your real level." },
  { q: "How much does it cost?", a: "Singles is $9.99 per player. Doubles and mixed doubles are $19.99 for the team of two, with one payment covering both partners." },
  { q: "Do I need a partner?", a: "Not for singles. For doubles and mixed leagues you register with a partner and invite them by email. One partner pays the team fee." },
  { q: "How do I report a score?", a: "After the match, open it from your dashboard and submit the result. Your opponent confirms, and standings and ratings update automatically." },
  { q: "What if there is a score dispute?", a: "Either player can raise a dispute. The process and timelines are in the League Rules and Terms." },
  { q: "Can I get a refund?", a: "Entry fees are non-refundable once the league starts." },
  { q: "Is there an age limit?", a: "The minimum age is 13. Players under 18 need parental consent." },
  { q: "Where can I find the rules?", a: "The Rules page and Player Handbook cover formats, scheduling, conduct and playoffs." },
];

// Machine-readable copies of the visible FAQ and pricing cards (kept in sync by building them from the same arrays)
const HOME_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@type": "Product",
      name: "VENLAX Sports league entry",
      description: "Entry to a ranked Tennis or Pickleball league season: skill-matched opponents, live standings and playoffs.",
      brand: { "@type": "Brand", name: "VENLAX Sports" },
      offers: PRICING.map((p) => ({
        "@type": "Offer",
        name: `${p.format} (${p.who})`,
        price: p.price.replace("$", ""),
        priceCurrency: "USD",
        description: p.unit,
        url: "https://venlaxsports.com/#pricing",
        availability: "https://schema.org/InStock",
      })),
    },
  ],
};

// ---------------------------------------------------------------- bits
function AmberButton({ children, onClick, testId, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold uppercase tracking-wider transition-colors hover:bg-[#3D3D3D] hover:text-white ${className}`}
      style={{ background: AMBER, color: INK }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

const Section = ({ tint, children, className = "", id }) => (
  <section id={id} className={`px-4 sm:px-6 py-20 md:py-28 ${className}`} style={{ background: tint ? GREY : "#fff" }}>
    <div className="max-w-[1100px] mx-auto">{children}</div>
  </section>
);

const Heading = ({ eyebrow, title, lead, center }) => (
  <motion.div {...fadeUp} className={`mb-12 ${center ? "text-center mx-auto" : ""} max-w-3xl`}>
    {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: GREEN }}>{eyebrow}</p>}
    <h2 className="font-bold text-4xl md:text-6xl leading-[1.05]" style={{ color: INK }}>{title}</h2>
    {lead && <p className="mt-4 text-lg" style={{ color: BODY }}>{lead}</p>}
  </motion.div>
);

// Sample rating chart (illustrative shape only)
function SampleChart() {
  const pts = [3.0, 3.1, 3.05, 3.2, 3.3, 3.28, 3.4, 3.5];
  const w = 260, h = 90, min = 2.9, max = 3.6;
  const path = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - ((v - min) / (max - min)) * h}`).join(" ");
  return (
    <svg viewBox={`-6 -6 ${w + 12} ${h + 12}`} className="w-full" role="img" aria-label="Sample rating history chart trending upward">
      <polyline points={path} fill="none" stroke={GREEN} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((v, i) => (
        <circle key={i} cx={(i / (pts.length - 1)) * w} cy={h - ((v - min) / (max - min)) * h} r="3.5" fill={AMBER} />
      ))}
    </svg>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  useDocumentMeta({
    title: "Ranked Tennis & Pickleball Leagues | VENLAX Sports",
    description: "Ranked Tennis and Pickleball leagues across the USA. No club membership. Singles $9.99 a season, doubles $19.99 per team. Skill-matched opponents, live standings and playoffs.",
    canonicalPath: "/",
    jsonLd: HOME_JSON_LD,
  });
  // Nav "Pricing" link: scroll to the pricing section, also when arriving from another page
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView();
  }, [hash]);
  const [typeId, setTypeId] = useState("flex");
  const type = LEAGUE_TYPES.find((t) => t.id === typeId);
  const [founding, setFounding] = useState(null);

  // Real founding-member numbers only; the strip stays hidden if the API fails
  useEffect(() => {
    axios.get(`${API}/founding-members`).then((r) => setFounding(r.data)).catch(() => {});
  }, []);
  const showFounding = founding && founding.limit > 0 && founding.spots_left > 0 && founding.count >= FOUNDING_DISPLAY_FLOOR;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-white" style={{ color: BODY }}>
        {/* 1. HERO */}
        <section className="relative">
          <PhotoSlot src={PHOTOS.hero} alt="Players competing in a league match" tone="ink" overlay={false} className="min-h-[620px] md:min-h-[760px]">
            <div className="absolute inset-0" style={{ background: "rgba(61,61,61,0.38)" }} />
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
              <motion.p className="mt-8 text-lg md:text-2xl font-medium text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.2 }}>
                Ranked leagues for Tennis &amp; Pickleball
              </motion.p>
              <motion.p className="mt-2 text-base md:text-lg text-white/90" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.25 }}>
                Find a league. Play. Rise.
              </motion.p>
              <motion.p className="mt-4 text-base md:text-xl font-bold text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.28 }} data-testid="hero-offer-line">
                Competitive leagues in your city. No club membership. $9.99 a season.
              </motion.p>
              <motion.div className="mt-8 flex flex-col items-center gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}>
                <AmberButton onClick={() => navigate("/auth")} testId="hero-join-venlax">Join a league</AmberButton>
                <p className="text-sm text-white/90">
                  Or see{" "}
                  {activeSports.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && " · "}
                      <Link to={`/sport/${s.id}`} className="font-bold underline underline-offset-2 hover:text-white" aria-label={`Explore ${s.label} leagues`} data-testid={`hero-explore-${s.id}`}>
                        {s.label}
                      </Link>
                    </span>
                  ))}
                </p>
              </motion.div>
            </div>
          </PhotoSlot>

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

        {/* 1b. THE PROBLEM, IN PLAYERS' WORDS */}
        <Section>
          <Heading eyebrow="Why leagues" title="Sound familiar?" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PAINS.map((p, i) => (
              <motion.div key={p.title} {...fadeUp} transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.08 }} className="p-6 border-t-4" style={{ background: GREY, borderColor: AMBER }} data-testid={`home-pain-${i + 1}`}>
                <h3 className="font-bold text-xl leading-tight mb-2" style={{ color: INK }}>{p.title}</h3>
                <p className="text-base">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* 2. EVERYTHING IN ONE PLACE */}
        <Section tint>
          <Heading eyebrow="The platform" title="Everything you need, in one place" lead="From finding a league to sharing your result, here is what VenLax gives every player." />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div key={f.slug} {...fadeUp} transition={{ duration: 0.5, ease: "easeOut", delay: (i % 3) * 0.08 }}>
                <Link to={f.to} className="group flex flex-col h-full bg-white p-6 transition-shadow hover:shadow-lg" data-testid={`home-feature-${f.slug}`}>
                  <div className="flex items-center gap-3.5 mb-3">
                    <div className="w-11 h-11 shrink-0 flex items-center justify-center" style={{ background: GREEN }}>
                      <f.icon className="w-5 h-5 text-white" aria-hidden="true" />
                    </div>
                    <h3 className="font-bold text-xl leading-tight" style={{ color: INK }}>{f.title}</h3>
                  </div>
                  <p className="text-[15px] leading-snug flex-grow">{f.body}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold" style={{ color: "#00765C" }}>
                    Learn more <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* 3. LEAGUE TYPES (tabs) */}
        <Section>
          <Heading eyebrow="Formats" title="Pick how you want to play" lead="Four ways to compete. Choose the one that fits your week." />
          <div role="tablist" aria-label="League types" className="flex flex-wrap gap-2 mb-6">
            {LEAGUE_TYPES.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={typeId === t.id}
                aria-controls={`panel-${t.id}`}
                id={`tab-${t.id}`}
                onClick={() => setTypeId(t.id)}
                className="px-5 py-3 text-sm font-bold uppercase tracking-wider transition-colors"
                style={typeId === t.id ? { background: GREEN, color: "#fff" } : { background: GREY, color: INK }}
                data-testid={`home-type-${t.id}`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${type.id}`} aria-labelledby={`tab-${type.id}`} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-0">
            <div className="p-8 md:p-10" style={{ background: GREY }}>
              <h3 className="font-bold text-3xl mb-2" style={{ color: INK }}>{type.name}</h3>
              <p className="text-lg mb-6">{type.line}</p>
              <ul className="grid gap-3">
                {type.points.map((p) => (
                  <li key={p} className="flex gap-2"><Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: GREEN }} aria-hidden="true" /> {p}</li>
                ))}
              </ul>
            </div>
            <div className="p-8 md:p-10 text-white flex flex-col justify-between" style={{ background: GREEN }}>
              <p className="font-bold text-2xl">{type.best}</p>
              <Link to={type.id === "ladder" ? "/ladders" : type.id === "rr" ? "/leagues/round-robin" : "/leagues"} className="mt-8 inline-flex items-center gap-2 font-bold uppercase tracking-wider text-sm" style={{ color: AMBER }}>
                See {type.name}s <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Section>

        {/* 4. PRICING */}
        <Section tint className="scroll-mt-16" id="pricing">
          <Heading eyebrow="Pricing" title="Simple pricing" lead="One fee per season. No club membership. Doubles is one fee for the whole team." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRICING.map((p, i) => (
              <motion.div
                key={p.format}
                {...fadeUp}
                className={`bg-white p-8 border-t-4 relative ${i === 0 ? "ring-2 ring-[#008F70]" : ""}`}
                style={{ borderColor: AMBER }}
                data-testid={`home-price-${p.format.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {i === 0 && (
                  <span className="absolute -top-3 left-6 px-3 py-1 text-xs font-bold uppercase tracking-wider" style={{ background: GREEN, color: "#fff" }} data-testid="home-price-popular-badge">Popular</span>
                )}
                <h3 className="font-bold text-xl" style={{ color: INK }}>{p.format}</h3>
                <p className="text-sm mb-5">{p.who}</p>
                <div className="font-bold text-5xl leading-none" style={{ color: GREEN }}>{p.price}</div>
                <p className="mt-2 text-sm">{p.unit}</p>
                {i === 0 && <p className="mt-4 text-sm font-bold" style={{ color: INK }}>Most players start here.</p>}
              </motion.div>
            ))}
          </div>
          <p className="mt-5 text-base font-medium" style={{ color: INK }}>Less than one court-rental split, for a whole season.</p>
          <p className="mt-2 text-sm">Entry fees are non-refundable once the league starts. Payments are processed by Stripe. See the <Link to="/tennis-pickleball-leagues" className="font-bold underline" style={{ color: GREEN }}>League Guide</Link> for details.</p>
        </Section>

        {/* 5. SEASON AT A GLANCE */}
        <Section>
          <Heading eyebrow="Your season" title="Your season at a glance" lead="Most seasons run 5–7 matches over 6–8 weeks." />
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SEASON.map((s, i) => (
              <motion.li key={s.step} {...fadeUp} transition={{ duration: 0.5, ease: "easeOut", delay: (i % 3) * 0.08 }} className="p-6 flex gap-4" style={{ background: GREY }}>
                <span className="w-10 h-10 shrink-0 flex items-center justify-center font-bold text-white" style={{ background: GREEN }}>{i + 1}</span>
                <div>
                  <h3 className="font-bold text-lg" style={{ color: INK }}>{s.step}</h3>
                  <p className="text-base">{s.body}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </Section>

        {/* 6. PROFILE PREVIEW */}
        <Section tint>
          <Heading eyebrow="Your progress" title="See your game improve" lead="Your rating, your results and your standing, all in one profile. The previews below use sample data." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div {...fadeUp} className="bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: GREEN }}>Rating history</p>
              <p className="font-bold text-3xl mb-3" style={{ color: INK }}>3.5 <span className="text-base font-medium" style={{ color: BODY }}>sample</span></p>
              <SampleChart />
            </motion.div>
            <motion.div {...fadeUp} className="p-6 text-white" style={{ background: GREEN }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: AMBER }}>Match card · sample</p>
              <div className="flex items-center justify-between font-bold text-lg"><span>You</span><span>Opponent</span></div>
              <div className="flex items-center justify-between font-bold text-4xl my-3" style={{ fontVariantNumeric: "tabular-nums" }}><span>6 · 6</span><span className="text-white/70">3 · 4</span></div>
              <p className="text-sm text-white/90">Rating change: +0.1</p>
              <p className="mt-4 text-sm font-bold uppercase tracking-wider" style={{ color: AMBER }}>Share your result</p>
            </motion.div>
            <motion.div {...fadeUp} className="bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: GREEN }}>Standings · sample</p>
              <ol className="divide-y" style={{ borderColor: "#E4E4E4" }}>
                {["Player A", "Player B", "You", "Player D"].map((n, i) => (
                  <li key={n} className="flex items-center gap-3 py-3" style={n === "You" ? { background: "#E8F6F2", margin: "0 -8px", padding: "12px 8px" } : undefined}>
                    <span className="w-6 font-bold" style={{ color: INK }}>{i + 1}</span>
                    <span className={n === "You" ? "font-bold" : ""} style={{ color: INK }}>{n}</span>
                  </li>
                ))}
              </ol>
            </motion.div>
          </div>
          <p className="mt-5 text-sm">You can also follow other players, see an activity feed and share a public profile.</p>
        </Section>

        {/* 7. FAIR AND SAFE */}
        <Section>
          <Heading eyebrow="Trust" title="Fair and safe for everyone" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SAFETY.map((s) => (
              <motion.div key={s.title} {...fadeUp} className="p-6" style={{ background: GREY }}>
                <ShieldCheck className="w-7 h-7 mb-4" style={{ color: GREEN }} aria-hidden="true" />
                <h3 className="font-bold text-lg mb-1" style={{ color: INK }}>{s.title}</h3>
                <p className="text-base">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* GROW FASTER TOGETHER */}
        <Section tint>
          <Heading eyebrow="Grow faster together" title="Invite friends, climb the ranks." lead="Every friend who joins with your code earns you both $5 in credit toward your next league. Play with people you know and the season gets better." />
          {showFounding && (
            <motion.div {...fadeUp} className="mb-8 p-6 text-white flex flex-col md:flex-row md:items-center gap-4 md:gap-8" style={{ background: GREEN }} data-testid="home-founding-strip">
              <div className="font-bold text-xl md:text-2xl">Founding member spots are limited</div>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/90">Claimed</span>
                  <span className="font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{founding.count}/{founding.limit}</span>
                </div>
                <div className="h-2 w-full overflow-hidden" style={{ background: "rgba(255,255,255,0.3)" }}>
                  <div className="h-full" style={{ width: `${Math.min(100, Math.round((founding.count / founding.limit) * 100))}%`, background: AMBER }} />
                </div>
              </div>
              <div className="text-sm text-white/90">{founding.spots_left} left</div>
            </motion.div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {GROW.map((g, i) => (
              <motion.div key={g.slug} {...fadeUp} transition={{ duration: 0.5, ease: "easeOut", delay: (i % 2) * 0.08 }}>
                <Link to={g.to} className="group flex gap-5 h-full bg-white p-7 transition-shadow hover:shadow-lg" data-testid={`home-grow-${g.slug}`}>
                  <div className="w-12 h-12 shrink-0 flex items-center justify-center" style={{ background: GREEN }}>
                    <g.icon className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl mb-1" style={{ color: INK }}>{g.title}</h3>
                    <p className="text-base leading-snug">{g.body}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold" style={{ color: GREEN }}>
                      {g.cta} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* SPORT CHOICE (green) */}
        <section className="px-4 sm:px-6 py-20 md:py-28 text-white" style={{ background: GREEN }}>
          <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
            <motion.div {...fadeUp}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: AMBER }}>Choose your sport</p>
              <h2 className="font-bold text-4xl md:text-6xl leading-[1.05] mb-6" style={{ color: "#fff" }}>Find your league. Start climbing.</h2>
              <p className="text-lg text-white/90 mb-8">Join a league near you and start climbing the standings.</p>
              <AmberButton onClick={() => navigate("/auth")} testId="home-closing-cta">Join a league <ArrowRight className="w-4 h-4" aria-hidden="true" /></AmberButton>
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

        {/* 8. COMING SOON */}
        <Section tint className="!py-14 md:!py-16">
          <div className="grid grid-cols-1 gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: GREEN }}>Coming soon</p>
              <h2 className="font-bold text-2xl md:text-3xl" style={{ color: INK }}>What we are adding next</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {COMING_SOON.map((c) => (
                <div key={c.title} className="bg-white p-5 flex gap-4 items-start">
                  <c.icon className="w-6 h-6 shrink-0" style={{ color: GREEN }} aria-hidden="true" />
                  <div>
                    <h3 className="font-bold" style={{ color: INK }}>{c.title}</h3>
                    <p className="text-sm">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 9. FAQ */}
        <Section>
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
        </Section>
      </div>
    </MotionConfig>
  );
}
