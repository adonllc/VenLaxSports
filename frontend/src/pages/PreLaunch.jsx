import React, { useState } from "react";
import Logo from "../components/Logo";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://api.venlaxsports.com";

const NAVY = "#1B2B4B";
const NAVY_MID = "#1B2B4B";
const LIME = "#C9572A";
const TEAL = "#0B6E4F";
const BORDER = "#E5E7EB";
const SECTION_BG = "#F3F4F6";

export default function PreLaunch() {
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [sport, setSport] = useState("tennis");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [skillLevel, setSkillLevel] = useState("intermediate");
  const [waitlistId, setWaitlistId] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [openFaq, setOpenFaq] = useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setReferredBy(ref);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !city) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          city: city.trim(),
          sport,
          skill_level: skillLevel,
          referred_by: referredBy,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWaitlistId(data.waitlist_id || "");
        setSubmitted(true);
      } else {
        setError(data.detail || "Something went wrong. Try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const features = [
    {
      icon: "🎯",
      title: "Smart Matchmaking",
      body: "No more sandbaggers. No more mismatches. We match you with players at your exact level in your city — every time.",
      reverse: false,
      mockup: (
        <div className="flex-1 rounded-2xl p-6 space-y-3" style={{ background: "#1B2B4B", border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#6B7A96" }}>Opponent Found</p>
          {[
            { name: "Marcus T.", rating: 1847, record: "12W 3L" },
            { name: "Sarah K.", rating: 1823, record: "9W 4L" },
            { name: "James R.", rating: 1801, record: "7W 5L" },
          ].map((player) => (
            <div key={player.name} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between" style={{ border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: "#EDF7F3", color: "#065F46" }}>
                  {player.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: NAVY }}>{player.name}</p>
                  <p className="text-xs" style={{ color: "#6B7A96" }}>{player.record}</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ color: "#065F46", background: "#EDF7F3" }}>{player.rating}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: "📈",
      title: "Live City Rankings",
      body: "Every match counts. Every win moves you up. Your VENLAX ranking is the official record of where you stand.",
      reverse: true,
      mockup: (
        <div className="flex-1 rounded-2xl p-6" style={{ background: "#1B2B4B", border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#6B7A96" }}>Austin TX — Tennis Singles</p>
          <div className="space-y-2">
            {[
              { rank: 1, name: "Alex M.", rating: 2103, delta: "+12" },
              { rank: 2, name: "Jordan P.", rating: 1984, delta: "+5" },
              { rank: 3, name: "Taylor S.", rating: 1947, delta: "-3" },
              { rank: 4, name: "Casey R.", rating: 1901, delta: "+8" },
              { rank: 5, name: "Riley D.", rating: 1876, delta: "+2" },
            ].map((row) => (
              <div
                key={row.rank}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={row.rank === 3
                  ? { background: "#EDF7F3", border: `1px solid ${TEAL}20` }
                  : { background: "white", border: `1px solid ${BORDER}` }
                }
              >
                <span className="text-xs font-bold w-4" style={{ color: "#6B7A96" }}>{row.rank}</span>
                <span className="text-sm font-medium flex-1" style={{ color: NAVY }}>{row.name}</span>
                <span className="text-xs" style={{ color: "#6B7A96" }}>{row.rating}</span>
                <span className="text-xs font-medium" style={{ color: row.delta.startsWith("+") ? "#065F46" : "#C04A00" }}>{row.delta}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: "📅",
      title: "Flexible League Formats",
      body: "Singles, Doubles, Mixed Doubles, or Casual — pick the format that fits your game. Round-robin or bracket. You choose the intensity, we handle the rest.",
      reverse: false,
      mockup: (
        <div className="flex-1 rounded-2xl p-6 space-y-3" style={{ background: "#1B2B4B", border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#6B7A96" }}>Choose Your Format</p>
          {[
            { name: "Singles League", sub: "Round Robin · 6 matches", badge: "Most Popular", badgeStyle: { color: "#065F46", background: "#EDF7F3" }, icon: "🎾" },
            { name: "Doubles League", sub: "Round Robin · 6 matches", badge: "Team Play", badgeStyle: { color: "#1E40AF", background: "#DBEAFE" }, icon: "🤝" },
            { name: "Mixed Doubles", sub: "Bracket · 4 rounds", badge: "Co-ed", badgeStyle: { color: "#7C3AED", background: "#EDE9FE" }, icon: "🏆" },
            { name: "Casual Division", sub: "Flexible · self-paced", badge: "Beginner Friendly", badgeStyle: { color: "#C04A00", background: "#FEE8D5" }, icon: "⚡" },
          ].map((fmt) => (
            <div key={fmt.name} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between" style={{ border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-3">
                <span className="text-lg">{fmt.icon}</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: NAVY }}>{fmt.name}</p>
                  <p className="text-xs" style={{ color: "#6B7A96" }}>{fmt.sub}</p>
                </div>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-md" style={fmt.badgeStyle}>{fmt.badge}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: "⚡",
      title: "Two Sports. One Profile.",
      body: "Tennis and Pickleball under one account. Switch sports, keep your rankings, build one unified record.",
      reverse: true,
      mockup: (
        <div className="flex-1 rounded-2xl p-6" style={{ background: "#1B2B4B", border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#6B7A96" }}>Your Profile</p>
          <div className="bg-white rounded-xl p-4 mb-3 flex items-center gap-3" style={{ border: `1px solid ${BORDER}` }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ background: NAVY }}>YO</div>
            <div>
              <p className="font-semibold text-sm" style={{ color: NAVY }}>Your Name</p>
              <p className="text-xs" style={{ color: "#6B7A96" }}>Austin, TX · Founding Member</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4 text-center" style={{ background: "#F0FDF4", border: "1px solid #C9572A" }}>
              <p className="text-xs font-medium mb-1" style={{ color: "#065F46" }}>Tennis</p>
              <p className="text-2xl font-bold" style={{ color: "#065F46", fontFamily: "'Barlow Condensed', sans-serif" }}>1847</p>
              <p className="text-xs" style={{ color: "#7A8600" }}>ELO rating</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: "#EDF7F3", border: `1px solid ${TEAL}` }}>
              <p className="text-xs font-medium mb-1" style={{ color: "#065F46" }}>Pickleball</p>
              <p className="text-2xl font-bold" style={{ color: "#065F46", fontFamily: "'Barlow Condensed', sans-serif" }}>1623</p>
              <p className="text-xs" style={{ color: "#065F46" }}>ELO rating</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Barlow', sans-serif", background: "#FFFFFF" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: NAVY, borderColor: NAVY_MID }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="md" variant="light" />
          <a
            href="#early-access"
            className="text-sm font-bold px-4 py-2 rounded-md transition-colors"
            style={{ background: LIME, color: NAVY }}
            onMouseEnter={e => e.currentTarget.style.background = "#AEBE00"}
            onMouseLeave={e => e.currentTarget.style.background = LIME}
          >
            Get Early Access
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: "#C24A1D", color: "white" }} className="py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-8"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.9)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "rgba(255,255,255,0.9)" }}></span>
            Launching in select cities — 2026
          </div>
          <h1
            className="font-black leading-tight mb-6"
            style={{ fontSize: "clamp(2.5rem, 6vw, 3.75rem)", fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Stop Hunting for Good Matches.
            <br />
            <span style={{ color: "rgba(255,255,255,0.95)" }}>Play in a Real League.</span>
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10" style={{ color: "rgba(255,255,255,0.7)" }}>
            VENLAX runs competitive Tennis and Pickleball leagues in your city — real rankings,
            skill-matched opponents, and players who actually show up.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#early-access"
              className="font-semibold px-8 py-4 rounded-md transition-colors text-base"
              style={{ background: LIME, color: NAVY }}
              onMouseEnter={e => e.currentTarget.style.background = "#AEBE00"}
              onMouseLeave={e => e.currentTarget.style.background = LIME}
              data-testid="hero-cta-primary"
            >
              Join the Early Access List
            </a>
            <a
              href="#early-access"
              className="font-medium px-8 py-4 rounded-md transition-colors text-base"
              style={{ border: "1px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.75)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.7)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
              data-testid="hero-cta-secondary"
            >
              Notify Me When My City Opens
            </a>
          </div>
          <p className="text-sm mt-6" style={{ color: "rgba(255,255,255,0.35)" }}>Limited early-access spots per city. No spam, ever.</p>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-b py-5 px-6" style={{ background: SECTION_BG, borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm" style={{ color: "#374151" }}>
            {[
              "Placed by skill — no sandbaggers, no mismatches",
              "Flexible scheduling — you set match times with your opponent",
              "Official VENLAX city ranking after every match",
              "Tennis + Pickleball on one profile",
            ].map((point) => (
              <div key={point} className="flex items-center gap-2">
                <span className="font-bold" style={{ color: TEAL }}>✓</span>
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 px-6" style={{ background: "#FFFFFF" }}>
        <div className="max-w-3xl mx-auto">
          <p className="font-semibold text-sm uppercase tracking-widest mb-4 text-center" style={{ color: TEAL }}>
            Sound familiar?
          </p>
          <h2
            className="font-black text-center mb-12"
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: NAVY, fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Finding competitive play shouldn't be this hard.
          </h2>
          <div className="space-y-5">
            {[
              {
                icon: "😤",
                title: "You're stuck in dead group chats.",
                body: "Coordinating games with strangers is exhausting — no-shows, last-minute cancellations, zero accountability.",
              },
              {
                icon: "📊",
                title: "You have no idea where you actually stand.",
                body: "You play regularly. You're improving. But there's no ranking, no record, no proof — just vibes.",
              },
              {
                icon: "🎾",
                title: "Real competitive leagues in your city? Good luck.",
                body: "Club memberships cost thousands. Pickup courts are chaos. Organized, affordable, skill-matched leagues simply don't exist.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-5 p-6 rounded-lg" style={{ border: `1px solid ${BORDER}` }}>
                <div className="text-3xl flex-shrink-0">{item.icon}</div>
                <div>
                  <p className="font-semibold mb-1" style={{ color: NAVY, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.1rem" }}>
                    {item.title}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-20 px-6" style={{ background: "#C24A1D", color: "white" }}>
        <div className="max-w-4xl mx-auto">
          <p className="font-semibold text-sm uppercase tracking-widest mb-4 text-center" style={{ color: "rgba(255,255,255,0.7)" }}>
            Enter VENLAX Sports
          </p>
          <h2
            className="font-black text-center mb-14"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}
          >
            From scattered to unstoppable.
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { before: "Endless group chats going nowhere", after: "Organized city leagues with confirmed players" },
              { before: "No idea of your actual skill level", after: "An official VENLAX ranking that grows with every win" },
              { before: "Hunting for opponents who match you", after: "Auto-matched by skill, location, and availability" },
              { before: "Playing alone with no community", after: "A city-wide network of players who show up" },
              { before: "Wasted weekends, wasted potential", after: "Scheduled match days you actually look forward to" },
            ].map((item) => (
              <div key={item.before} className="rounded-lg p-5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-sm line-through mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>{item.before}</p>
                <p className="font-medium flex items-start gap-2" style={{ color: "#fff" }}>
                  <span className="mt-0.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.8)" }}>→</span>
                  {item.after}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Zig-Zag */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="font-semibold text-sm uppercase tracking-widest text-center mb-16" style={{ color: TEAL }}>
            Built for players who want more
          </p>
          <div className="space-y-24">
            {features.map((feat) => (
              <div
                key={feat.title}
                className={`flex flex-col md:flex-row items-center gap-12 ${feat.reverse ? "md:flex-row-reverse" : ""}`}
              >
                <div className="flex-1">
                  <div className="text-5xl mb-4">{feat.icon}</div>
                  <h3
                    className="font-black mb-4"
                    style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", color: NAVY, fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {feat.title}
                  </h3>
                  <p className="text-lg leading-relaxed" style={{ color: "#374151" }}>{feat.body}</p>
                </div>
                {feat.mockup}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* League Formats Showcase */}
      <section className="py-20 px-6" style={{ background: SECTION_BG }}>
        <div className="max-w-5xl mx-auto">
          <p className="font-semibold text-sm uppercase tracking-widest text-center mb-4" style={{ color: TEAL }}>
            Choose your format
          </p>
          <h2
            className="font-black text-center mb-4"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: NAVY }}
          >
            Four ways to compete.
          </h2>
          <p className="text-center text-base mb-12 max-w-2xl mx-auto" style={{ color: "#6B7A96" }}>
            Same match rules and ELO rankings across all formats — different structure, different intensity.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {[
              {
                id: "flex",
                label: "Flex League",
                tag: "Self-scheduled",
                tagline: "You set the schedule. We track the results.",
                headerStyle: { background: TEAL },
                borderStyle: { border: `1px solid ${TEAL}40` },
                bullet: TEAL,
                pillStyle: { background: "rgba(0,180,164,0.3)", color: "#EDF7F3" },
                highlights: [
                  "5–7 matches over 6–8 weeks",
                  "You arrange each match with your opponent",
                  "Top 4 or 8 qualify for playoffs",
                  "Points formula rewards wins + margin",
                ],
              },
              {
                id: "rr",
                label: "Round Robin",
                tag: "Auto-scheduled",
                tagline: "Show up. The schedule is already set.",
                headerStyle: { background: "#2563EB" },
                borderStyle: { border: "1px solid #BFDBFE" },
                bullet: "#2563EB",
                pillStyle: { background: "rgba(37,99,235,0.3)", color: "#DBEAFE" },
                highlights: [
                  "Every player faces every other player once",
                  "Rounds pre-assigned — no self-scheduling",
                  "Group leaders advance to playoffs",
                  "Head-to-head carries extra tiebreaker weight",
                ],
              },
              {
                id: "box",
                label: "Box League",
                tag: "Promotion / Relegation",
                tagline: "Finish top, move up. Finish bottom, move down.",
                headerStyle: { background: "#7C3AED" },
                borderStyle: { border: "1px solid #DDD6FE" },
                bullet: "#7C3AED",
                pillStyle: { background: "rgba(124,58,237,0.3)", color: "#EDE9FE" },
                highlights: [
                  "~6 players per box, seeded by ELO",
                  "Play every player in your box",
                  "Top 2 promote · Bottom 2 relegate",
                  "No playoffs — final standings decide",
                ],
              },
              {
                id: "ladder",
                label: "Challenge Ladder",
                tag: "Always-on",
                tagline: "Climb the ranks one challenge at a time.",
                headerStyle: { background: "#C9572A" },
                borderStyle: { border: "1px solid #FEE8D5" },
                bullet: "#C9572A",
                pillStyle: { background: "rgba(232,96,16,0.3)", color: "#FEE8D5" },
                highlights: [
                  "Permanent ranked list per city + division",
                  "Join anytime — ELO-seeded placement",
                  "Challenge anyone ranked above you",
                  "Win = rank swap · 48h cooldown",
                ],
              },
            ].map((f) => (
              <div key={f.id} className="rounded-2xl overflow-hidden" style={f.borderStyle} data-testid={`prelaunch-format-${f.id}`}>
                <div className="px-5 py-4" style={f.headerStyle}>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-semibold text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{f.label}</h3>
                    <span className="ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full" style={f.pillStyle}>{f.tag}</span>
                  </div>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>{f.tagline}</p>
                </div>
                <div className="p-4 bg-white">
                  <ul className="space-y-1.5">
                    {f.highlights.map((h, i) => (
                      <li key={i} className="flex gap-2 text-sm" style={{ color: "#374151" }}>
                        <span className="font-bold flex-shrink-0" style={{ color: f.bullet }}>✓</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto rounded-2xl mb-8" style={{ border: `1px solid ${BORDER}` }}>
            <table className="w-full text-sm min-w-[540px]">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest w-28" style={{ color: "#6B7280", background: "#F3F4F6", borderBottom: `1px solid ${BORDER}` }}></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#065F46", background: "#EDF7F3", borderBottom: `1px solid ${BORDER}`, borderLeft: `1px solid ${BORDER}` }}>Flex</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#1E40AF", background: "#DBEAFE", borderBottom: `1px solid ${BORDER}`, borderLeft: `1px solid ${BORDER}` }}>Round Robin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#7C3AED", background: "#EDE9FE", borderBottom: `1px solid ${BORDER}`, borderLeft: `1px solid ${BORDER}` }}>Box League</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#C04A00", background: "#FEE8D5", borderBottom: `1px solid ${BORDER}`, borderLeft: `1px solid ${BORDER}` }}>Ladder</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: BORDER }}>
                {[
                  { label: "Scheduling", flex: "Self-arranged", rr: "Pre-assigned", box: "Self-arranged", ladder: "Challenge-based" },
                  { label: "End goal", flex: "Win playoffs", rr: "Top of group", box: "Promote to next div", ladder: "Climb the list" },
                  { label: "Playoffs", flex: "Yes — top 4 or 8", rr: "Yes — group leaders", box: "No — standings decide", ladder: "No — rank is live" },
                  { label: "Best for", flex: "Flexible schedules", rr: "Zero friction", box: "Competitive progression", ladder: "Frequent play" },
                ].map((row, i) => (
                  <tr key={row.label} style={{ background: i % 2 === 0 ? "white" : "#FFFFFF" }}>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: "#6B7A96" }}>{row.label}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#374151", borderLeft: `1px solid ${BORDER}` }}>{row.flex}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#374151", borderLeft: `1px solid ${BORDER}` }}>{row.rr}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#374151", borderLeft: `1px solid ${BORDER}` }}>{row.box}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#374151", borderLeft: `1px solid ${BORDER}` }}>{row.ladder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center">
            <p className="text-sm" style={{ color: "#6B7A96" }}>Full rules will be announced shortly.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6" style={{ background: "#FFFFFF" }}>
        <div className="max-w-4xl mx-auto">
          <p className="font-semibold text-sm uppercase tracking-widest mb-4 text-center" style={{ color: TEAL }}>
            Simple by design
          </p>
          <h2
            className="font-black text-center mb-16"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: NAVY }}
          >
            Three steps to your first match.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Join",
                body: "Sign up in 2 minutes. Set your sport, skill level, and city. We handle the rest.",
                dotColor: LIME,
              },
              {
                step: "02",
                title: "Get Matched",
                body: "We place you in the right league, at your level, in your city. No guesswork.",
                dotColor: TEAL,
              },
              {
                step: "03",
                title: "Play & Rise",
                body: "Win matches. Climb the city leaderboard. Your ranking follows you.",
                dotColor: LIME,
              },
            ].map((step) => (
              <div key={step.step} className="text-center">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full font-bold text-xl mb-6"
                  style={{ background: step.dotColor === LIME ? "#F0FDF4" : "#EDF7F3", color: step.dotColor === LIME ? "#065F46" : "#065F46", fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {step.step}
                </div>
                <h3
                  className="font-bold mb-3"
                  style={{ fontSize: "1.25rem", color: NAVY, fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-6" style={{ background: SECTION_BG }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-semibold text-sm uppercase tracking-widest mb-10" style={{ color: TEAL }}>
            Why players are joining VENLAX early
          </p>
          <blockquote className="bg-white rounded-xl p-8 mb-10" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-lg italic leading-relaxed mb-4" style={{ color: "#374151" }}>
              "Finally a league that doesn't require a $2,000 club membership."
            </p>
            <footer className="text-sm" style={{ color: "#6B7A96" }}>— Tennis player, 34, Austin TX</footer>
          </blockquote>
          <div className="grid grid-cols-3 gap-6">
            {[
              { stat: "7 days", label: "per match round, you pick the time" },
              { stat: "ELO-based", label: "ranking system, not vibes" },
            ].map((item) => (
              <div key={item.stat}>
                <div
                  className="text-2xl font-bold mb-1"
                  style={{ color: LIME, fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {item.stat}
                </div>
                <div className="text-xs" style={{ color: "#6B7A96" }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6" style={{ background: "#FFFFFF" }}>
        <div className="max-w-2xl mx-auto">
          <p className="font-semibold text-sm uppercase tracking-widest mb-4 text-center" style={{ color: TEAL }}>
            Common questions
          </p>
          <h2
            className="font-black text-center mb-12"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: NAVY }}
          >
            Everything you need to know.
          </h2>
          <div className="space-y-2">
            {[
              { q: "How are matches scheduled?", a: "You and your opponent coordinate directly. VENLAX gives you 7 days per match round. No mandatory court times — you pick what works." },
              { q: "What skill level is right for me?", a: "We place you by self-reported level, then adjust your ELO ranking after each match. You'll always play people close to your actual level." },
              { q: "What if no one is in my city yet?", a: "You're on the list. When enough players sign up in your city for a division, we open it and notify you first." },
              { q: "Is there a mobile app?", a: "Web-first for now, fully mobile-optimized. A dedicated mobile app is on the roadmap for late 2026." },
              { q: "What's included in a league?", a: "League organization, rankings, scheduling, score tracking, and email coordination for the full season." },
              { q: "Can I play both Tennis and Pickleball?", a: "Yes. One profile, separate rankings per sport. Register for each league individually — your stats stay separate." },
            ].map((item, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                <button
                  type="button"
                  className="w-full text-left px-6 py-4 flex justify-between items-center transition-colors"
                  style={{ background: openFaq === i ? "#F3F4F6" : "white" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
                  onMouseLeave={e => e.currentTarget.style.background = openFaq === i ? "#F3F4F6" : "white"}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  data-testid={`faq-${i}`}
                >
                  <span className="font-medium text-sm" style={{ color: NAVY }}>{item.q}</span>
                  <span className="text-lg flex-shrink-0 ml-4" style={{ color: "#6B7A96" }}>
                    {openFaq === i ? "−" : "+"}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm leading-relaxed pt-3" style={{ borderTop: `1px solid ${BORDER}`, color: "#374151" }}>
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="early-access" className="py-24 px-6" style={{ background: "#C24A1D", color: "white" }}>
        <div className="max-w-xl mx-auto text-center">
          <h2
            className="font-black mb-4"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)" }}
          >
            Your city is opening soon.
          </h2>
          <p className="text-lg mb-10" style={{ color: "rgba(255,255,255,0.65)" }}>
            Early access members get priority city placement and founding member status. Don't wait.
          </p>

          {submitted ? (
            <div className="space-y-6">
              <div className="rounded-xl p-8 text-center" style={{ background: "rgba(201,87,42,0.10)", border: "1px solid rgba(201,87,42,0.25)" }}>
                <p className="font-bold text-xl mb-2" style={{ color: LIME, fontFamily: "'Barlow Condensed', sans-serif" }}>
                  You're on the early access list.
                </p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  We'll notify you the moment {city || "your city"} opens.
                </p>
              </div>

              {waitlistId && (
                <div className="rounded-xl p-6 space-y-4" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <p className="text-white font-semibold text-sm text-center">
                    Move up the list — invite players from your city
                  </p>
                  <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Every friend who joins from your link moves you one spot higher.
                  </p>
                  <div className="rounded-md px-3 py-2.5 text-xs font-mono truncate" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>
                    {`${window.location.origin}/?ref=${waitlistId}`}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?ref=${waitlistId}`); }}
                      className="py-2.5 rounded-md text-sm font-medium transition-colors"
                      style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.75)" }}
                      data-testid="copy-referral-link"
                    >
                      Copy Link
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`I'm getting early access to VENLAX — competitive Tennis/Pickleball leagues in our city. Join me: ${window.location.origin}/?ref=${waitlistId}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 rounded-md text-sm font-medium text-center transition-colors block"
                      style={{ background: "#25D366", color: "white" }}
                      data-testid="share-whatsapp"
                    >
                      Share on WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                required
                className="w-full rounded-md px-4 py-4 text-base focus:outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                onFocus={e => e.currentTarget.style.borderColor = LIME}
                onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}
                data-testid="waitlist-email"
              />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Your city (e.g. Austin, TX)"
                required
                className="w-full rounded-md px-4 py-4 text-base focus:outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                onFocus={e => e.currentTarget.style.borderColor = LIME}
                onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}
                data-testid="waitlist-city"
              />
              <div className="flex gap-3">
                {[
                  { value: "tennis", label: "🎾 Tennis", activeStyle: { background: LIME, border: `1px solid ${LIME}`, color: NAVY } },
                  { value: "pickleball", label: "🏓 Pickleball", activeStyle: { background: TEAL, border: `1px solid ${TEAL}`, color: "white" } },
                  { value: "both", label: "Both", activeStyle: { background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "white" } },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSport(opt.value)}
                    className="flex-1 py-3 rounded-md text-sm font-medium transition-colors"
                    style={sport === opt.value ? opt.activeStyle : { border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }}
                    data-testid={`sport-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>Your level</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "beginner", label: "Beginner" },
                    { value: "intermediate", label: "Intermediate" },
                    { value: "advanced", label: "Advanced" },
                    { value: "competitive", label: "Competitive" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSkillLevel(opt.value)}
                      className="py-2.5 rounded-md text-xs font-medium transition-colors"
                      style={skillLevel === opt.value
                        ? { background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", color: "white" }
                        : { border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }
                      }
                      data-testid={`skill-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {city && (
                <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {city.split(",")[0] || city} is filling fast — be first in line when we open.
                </p>
              )}
              {error && <p className="text-sm" style={{ color: "#FDA4AF" }}>{error}</p>}
              <button
                type="submit"
                disabled={submitting || !email || !city}
                className="w-full font-bold py-4 rounded-md text-base transition-colors disabled:opacity-50"
                style={{ background: LIME, color: NAVY }}
                onMouseEnter={e => { if (!submitting && email && city) e.currentTarget.style.background = "#AEBE00"; }}
                onMouseLeave={e => e.currentTarget.style.background = LIME}
                data-testid="waitlist-submit"
              >
                {submitting ? "Securing your spot..." : "Secure My Early Access Spot"}
              </button>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Limited early-access spots per city. First come, first placed. No spam, ever.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6" style={{ background: NAVY, borderTop: `3px solid ${LIME}` }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="md" variant="light" />
          <div className="flex gap-6 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span>© 2026 VENLAX Sports. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
