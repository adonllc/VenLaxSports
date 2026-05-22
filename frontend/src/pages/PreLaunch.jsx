import React, { useState } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://api.venlaxsports.com";

export default function PreLaunch() {
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [sport, setSport] = useState("tennis");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !city) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), city: city.trim(), sport }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.detail || "Something went wrong. Try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

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
            Play Ranked. Rise Fast.
            <br />
            <span className="text-emerald-400">Own Your City's Courts.</span>
          </h1>
          <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-10">
            VENLAX Sports brings competitive Tennis and Pickleball leagues to your city — real rankings,
            smart matchmaking, and players who actually show up.
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
              "Built for busy adult players",
              "Skill-matched — no mismatches",
              "Flexible weekly scheduling",
              "Real city-wide rankings",
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
            {[
              {
                icon: "🎯",
                title: "Smart Matchmaking",
                body: "No more sandbaggers. No more mismatches. We match you with players at your exact level in your city — every time.",
                sport: "tennis",
                reverse: false,
              },
              {
                icon: "📈",
                title: "Live City Rankings",
                body: "Every match counts. Every win moves you up. Your VENLAX ranking is the official record of where you stand.",
                sport: "pickleball",
                reverse: true,
              },
              {
                icon: "📅",
                title: "Flexible League Formats",
                body: "Round-robin, singles, doubles. Weekly or bi-weekly. You choose your intensity. We handle the scheduling.",
                sport: "tennis",
                reverse: false,
              },
              {
                icon: "⚡",
                title: "Two Sports. One Profile.",
                body: "Tennis and Pickleball under one account. Switch sports, keep your rankings, build one unified record.",
                sport: "pickleball",
                reverse: true,
              },
            ].map((feat) => (
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
                <div
                  className={`flex-1 rounded-xl h-56 flex items-center justify-center text-7xl ${
                    feat.sport === "tennis"
                      ? "bg-emerald-50 border border-emerald-100"
                      : "bg-orange-50 border border-orange-100"
                  }`}
                >
                  {feat.sport === "tennis" ? "🎾" : "🏓"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20 px-6">
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
                body: "Win matches. Climb the city rankings. Build your VENLAX legacy.",
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
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-widest mb-10">
            Why players are joining VENLAX early
          </p>
          <blockquote className="bg-gray-50 border border-gray-100 rounded-xl p-8 mb-10">
            <p className="text-gray-700 text-lg italic leading-relaxed mb-4">
              "I've been playing pickleball for three years and never had a real ranking. Structured city leagues with actual matchmaking? I signed up the moment I saw it."
            </p>
            <footer className="text-sm text-gray-400">Early access member, Austin TX</footer>
          </blockquote>
          <div className="grid grid-cols-3 gap-6">
            {[
              { stat: "2 Sports", label: "Tennis + Pickleball" },
              { stat: "City-Based", label: "Local rankings + leagues" },
              { stat: "2026", label: "First cities launching" },
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
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-10">
              <div className="text-5xl mb-4">🎾</div>
              <p
                className="font-bold text-xl text-emerald-400 mb-2"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                You're on the list.
              </p>
              <p className="text-gray-400 text-sm">
                We'll notify you the moment your city opens. Watch your inbox.
              </p>
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
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !email || !city}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-4 rounded-md text-base transition-colors disabled:opacity-50"
                data-testid="waitlist-submit"
              >
                {submitting ? "Claiming your spot..." : "Claim My Early Access"}
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
