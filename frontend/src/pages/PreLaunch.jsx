import React, { useState } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://api.venlaxsports.com";

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
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Opponent Found</p>
          {[
            { name: "Marcus T.", rating: 1847, record: "12W 3L" },
            { name: "Sarah K.", rating: 1823, record: "9W 4L" },
            { name: "James R.", rating: 1801, record: "7W 5L" },
          ].map((player) => (
            <div key={player.name} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xs">
                  {player.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{player.name}</p>
                  <p className="text-xs text-gray-400">{player.record}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{player.rating}</span>
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
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Austin TX — Tennis Singles</p>
          <div className="space-y-2">
            {[
              { rank: 1, name: "Alex M.", rating: 2103, delta: "+12" },
              { rank: 2, name: "Jordan P.", rating: 1984, delta: "+5" },
              { rank: 3, name: "Taylor S.", rating: 1947, delta: "-3" },
              { rank: 4, name: "Casey R.", rating: 1901, delta: "+8" },
              { rank: 5, name: "Riley D.", rating: 1876, delta: "+2" },
            ].map((row) => (
              <div key={row.rank} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${row.rank === 3 ? "bg-emerald-50 border border-emerald-100" : "bg-white border border-gray-100"}`}>
                <span className="text-xs font-bold text-gray-400 w-4">{row.rank}</span>
                <span className="text-sm font-medium text-gray-900 flex-1">{row.name}</span>
                <span className="text-xs text-gray-500">{row.rating}</span>
                <span className={`text-xs font-medium ${row.delta.startsWith("+") ? "text-emerald-600" : "text-red-400"}`}>{row.delta}</span>
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
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Choose Your Format</p>
          {[
            { name: "Singles League", sub: "Round Robin · 6 matches", badge: "Most Popular", badgeColor: "text-emerald-700 bg-emerald-50 border border-emerald-200", icon: "🎾" },
            { name: "Doubles League", sub: "Round Robin · 6 matches", badge: "Team Play", badgeColor: "text-blue-700 bg-blue-50 border border-blue-200", icon: "🤝" },
            { name: "Mixed Doubles", sub: "Bracket · 4 rounds", badge: "Co-ed", badgeColor: "text-purple-700 bg-purple-50 border border-purple-200", icon: "🏆" },
            { name: "Casual Division", sub: "Flexible · self-paced", badge: "Beginner Friendly", badgeColor: "text-orange-700 bg-orange-50 border border-orange-200", icon: "⚡" },
          ].map((fmt) => (
            <div key={fmt.name} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{fmt.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{fmt.name}</p>
                  <p className="text-xs text-gray-400">{fmt.sub}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-md ${fmt.badgeColor}`}>{fmt.badge}</span>
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
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Your Profile</p>
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-3 flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold">YO</div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Your Name</p>
              <p className="text-xs text-gray-400">Austin, TX · Founding Member</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
              <p className="text-xs text-emerald-600 font-medium mb-1">Tennis</p>
              <p className="text-2xl font-bold text-emerald-700" style={{ fontFamily: "'Outfit', sans-serif" }}>1847</p>
              <p className="text-xs text-emerald-500">ELO rating</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
              <p className="text-xs text-orange-600 font-medium mb-1">Pickleball</p>
              <p className="text-2xl font-bold text-orange-700" style={{ fontFamily: "'Outfit', sans-serif" }}>1623</p>
              <p className="text-xs text-orange-500">ELO rating</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <span className="text-gray-900">VEN</span>
            <span className="text-emerald-500">LAX</span>
            <span className="text-gray-400 text-sm font-normal ml-1">SPORTS</span>
          </div>
          <a
            href="#early-access"
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Get Early Access
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gray-950 text-white py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block"></span>
            Launching in select cities — 2026
          </div>
          <h1
            className="text-5xl md:text-6xl font-bold leading-tight mb-6"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Stop Hunting for Good Matches.
            <br />
            <span className="text-emerald-400">Play in a Real League.</span>
          </h1>
          <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-10">
            VENLAX runs competitive Tennis and Pickleball leagues in your city — real rankings,
            skill-matched opponents, and players who actually show up.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#early-access"
              className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-md transition-colors text-base"
              data-testid="hero-cta-primary"
            >
              Join the Early Access List
            </a>
            <a
              href="#early-access"
              className="border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-medium px-8 py-4 rounded-md transition-colors text-base"
              data-testid="hero-cta-secondary"
            >
              Notify Me When My City Opens
            </a>
          </div>
          <p className="text-gray-500 text-sm mt-6">Limited early-access spots per city. No spam, ever.</p>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-b border-gray-100 py-5 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm text-gray-600">
            {[
              "Placed by skill — no sandbaggers, no mismatches",
              "Flexible scheduling — you set match times with your opponent",
              "Official VENLAX city ranking after every match",
              "Tennis + Pickleball on one profile",
            ].map((point) => (
              <div key={point} className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-widest mb-4 text-center">
            Sound familiar?
          </p>
          <h2
            className="text-4xl font-bold text-gray-900 text-center mb-12"
            style={{ fontFamily: "'Outfit', sans-serif" }}
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
              <div key={item.title} className="flex gap-5 p-6 border border-gray-100 rounded-lg">
                <div className="text-3xl flex-shrink-0">{item.icon}</div>
                <div>
                  <p
                    className="font-semibold text-gray-900 mb-1"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {item.title}
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="bg-gray-950 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-emerald-400 font-semibold text-sm uppercase tracking-widest mb-4 text-center">
            Enter VENLAX Sports
          </p>
          <h2
            className="text-4xl font-bold text-center mb-14"
            style={{ fontFamily: "'Outfit', sans-serif" }}
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
              <div key={item.before} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <p className="text-gray-500 text-sm line-through mb-2">{item.before}</p>
                <p className="text-white font-medium flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                  {item.after}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Zig-Zag */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-widest text-center mb-16">
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
                    className="text-3xl font-bold text-gray-900 mb-4"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {feat.title}
                  </h3>
                  <p className="text-gray-600 text-lg leading-relaxed">{feat.body}</p>
                </div>
                {feat.mockup}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* How It Works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-widest mb-4 text-center">
            Simple by design
          </p>
          <h2
            className="text-4xl font-bold text-gray-900 text-center mb-16"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Three steps to your first match.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Join",
                body: "Sign up in 2 minutes. Set your sport, skill level, and city. We handle the rest.",
                color: "emerald",
              },
              {
                step: "02",
                title: "Get Matched",
                body: "We place you in the right league, at your level, in your city. No guesswork.",
                color: "orange",
              },
              {
                step: "03",
                title: "Play & Rise",
                body: "Win matches. Climb the city leaderboard. Your ranking follows you.",
                color: "emerald",
              },
            ].map((step) => (
              <div key={step.step} className="text-center">
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-full font-bold text-xl mb-6 ${
                    step.color === "emerald"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {step.step}
                </div>
                <h3
                  className="text-xl font-bold text-gray-900 mb-3"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {step.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-widest mb-10">
            Why players are joining VENLAX early
          </p>
          <blockquote className="bg-white border border-gray-100 rounded-xl p-8 mb-10">
            <p className="text-gray-700 text-lg italic leading-relaxed mb-4">
              "Finally a league that doesn't require a $2,000 club membership."
            </p>
            <footer className="text-sm text-gray-400">— Tennis player, 34, Austin TX</footer>
          </blockquote>
          <div className="grid grid-cols-3 gap-6">
            {[
              { stat: "7 days", label: "per match round, you pick the time" },
              { stat: "ELO-based", label: "ranking system, not vibes" },
            ].map((item) => (
              <div key={item.stat}>
                <div
                  className="text-2xl font-bold text-emerald-500 mb-1"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {item.stat}
                </div>
                <div className="text-xs text-gray-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-widest mb-4 text-center">
            Common questions
          </p>
          <h2
            className="text-4xl font-bold text-gray-900 text-center mb-12"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Everything you need to know.
          </h2>
          <div className="space-y-2">
            {[
              {
                q: "How are matches scheduled?",
                a: "You and your opponent coordinate directly. VENLAX gives you 7 days per match round. No mandatory court times — you pick what works.",
              },
              {
                q: "What skill level is right for me?",
                a: "We place you by self-reported level, then adjust your ELO ranking after each match. You'll always play people close to your actual level.",
              },
              {
                q: "What if no one is in my city yet?",
                a: "You're on the list. When enough players sign up in your city for a division, we open it and notify you first.",
              },
              {
                q: "Is there a mobile app?",
                a: "Web-first for now, fully mobile-optimized. A dedicated mobile app is on the roadmap for late 2026.",
              },
              {
                q: "What's included in a league?",
                a: "League organization, rankings, scheduling, score tracking, and email coordination for the full season.",
              },
              {
                q: "Can I play both Tennis and Pickleball?",
                a: "Yes. One profile, separate rankings per sport. Register for each league individually — your stats stay separate.",
              },
            ].map((item, i) => (
              <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  className="w-full text-left px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  data-testid={`faq-${i}`}
                >
                  <span className="font-medium text-gray-900 text-sm">{item.q}</span>
                  <span className="text-gray-400 text-lg flex-shrink-0 ml-4">
                    {openFaq === i ? "−" : "+"}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="early-access" className="bg-gray-950 text-white py-24 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h2
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Your city is opening soon.
          </h2>
          <p className="text-gray-300 text-lg mb-10">
            Early access members get priority city placement and founding member status. Don't wait.
          </p>

          {submitted ? (
            <div className="space-y-6">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-8 text-center">
                <p
                  className="font-bold text-xl text-emerald-400 mb-2"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  You're on the early access list.
                </p>
                <p className="text-gray-400 text-sm">
                  We'll notify you the moment {city || "your city"} opens.
                </p>
              </div>

              {waitlistId && (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
                  <p className="text-white font-semibold text-sm text-center">
                    Move up the list — invite players from your city
                  </p>
                  <p className="text-gray-400 text-xs text-center">
                    Every friend who joins from your link moves you one spot higher.
                  </p>
                  <div className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2.5 text-gray-300 text-xs font-mono truncate">
                    {`${window.location.origin}/?ref=${waitlistId}`}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?ref=${waitlistId}`);
                      }}
                      className="py-2.5 rounded-md border border-gray-600 text-gray-300 text-sm font-medium hover:border-gray-400 transition-colors"
                      data-testid="copy-referral-link"
                    >
                      Copy Link
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`I'm getting early access to VENLAX — competitive Tennis/Pickleball leagues in our city. Join me: ${window.location.origin}/?ref=${waitlistId}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-sm font-medium text-center transition-colors block"
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
                className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-md px-4 py-4 text-base focus:outline-none focus:border-emerald-500 transition-colors"
                data-testid="waitlist-email"
              />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Your city (e.g. Austin, TX)"
                required
                className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-md px-4 py-4 text-base focus:outline-none focus:border-emerald-500 transition-colors"
                data-testid="waitlist-city"
              />
              <div className="flex gap-3">
                {[
                  { value: "tennis", label: "🎾 Tennis", active: "bg-emerald-500 border-emerald-500 text-white" },
                  { value: "pickleball", label: "🏓 Pickleball", active: "bg-orange-500 border-orange-500 text-white" },
                  { value: "both", label: "Both", active: "bg-gray-600 border-gray-500 text-white" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSport(opt.value)}
                    className={`flex-1 py-3 rounded-md text-sm font-medium border transition-colors ${
                      sport === opt.value
                        ? opt.active
                        : "border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}
                    data-testid={`sport-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-2">Your level</p>
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
                      className={`py-2.5 rounded-md text-xs font-medium border transition-colors ${
                        skillLevel === opt.value
                          ? "bg-gray-600 border-gray-500 text-white"
                          : "border-gray-700 text-gray-400 hover:border-gray-500"
                      }`}
                      data-testid={`skill-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {city && (
                <p className="text-emerald-400 text-xs text-center">
                  {city.split(",")[0] || city} is filling fast — be first in line when we open.
                </p>
              )}
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !email || !city}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-4 rounded-md text-base transition-colors disabled:opacity-50"
                data-testid="waitlist-submit"
              >
                {submitting ? "Securing your spot..." : "Secure My Early Access Spot"}
              </button>
              <p className="text-gray-500 text-xs">
                Limited early-access spots per city. First come, first placed. No spam, ever.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 border-t border-gray-800 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
            VEN<span className="text-emerald-500">LAX</span>{" "}
            <span className="text-gray-500 font-normal text-sm">SPORTS</span>
          </div>
          <div className="flex gap-6 text-xs text-gray-500">
            <a href="/terms" className="hover:text-gray-300 transition-colors">
              Privacy Policy
            </a>
            <a href="/rules" className="hover:text-gray-300 transition-colors">
              Rules
            </a>
            <span>© 2026 VENLAX Sports. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
