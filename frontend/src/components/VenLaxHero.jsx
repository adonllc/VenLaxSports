import { useNavigate } from "react-router-dom";
import { ArrowRight, Play, Trophy, Crown, Star } from "lucide-react";
import platformConfig, { activeSports, activeSportIds } from "../config/platformConfig";

const CITY_MARQUEE = [
  ...platformConfig.featuredCities.map((c) => ({ label: c.name, icon: c.icon, sub: c.sports[0] })),
];

function StatItem({ value, label }) {
  return (
    <div className="flex flex-col items-center justify-center transition-transform hover:-translate-y-1 cursor-default">
      <span className="text-xl font-bold text-white sm:text-2xl">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium sm:text-xs">{label}</span>
    </div>
  );
}

/**
 * VenLaxHero — glassmorphism dark hero.
 *
 * Props:
 *   sportMeta      — if provided, hero is sport-specific (SportLanding page)
 *   foundingStats  — { count, limit, spots_left } from /api/founding-members
 *   onPrimary      — override primary CTA click (default: navigate /leagues)
 *   onSecondary    — override secondary CTA click (default: navigate /auth?mode=register)
 */
export default function VenLaxHero({
  sportMeta = null,
  foundingStats = { count: 0, limit: 200, spots_left: 200 },
  onPrimary = null,
  onSecondary = null,
}) {
  const navigate = useNavigate();

  const handlePrimary   = onPrimary   ?? (() => navigate(sportMeta ? `/join?sport=${sportMeta.id}` : "/leagues"));
  const handleSecondary = onSecondary ?? (() => navigate("/auth?mode=register"));

  const bgImage = sportMeta?.image ?? "https://images.unsplash.com/photo-1696661115319-a9b6801e2571?w=1920&q=80";

  const spotsPercent = foundingStats.limit > 0
    ? Math.round((foundingStats.count / foundingStats.limit) * 100)
    : 0;

  const marqueeItems = sportMeta
    ? [
        ...sportMeta.features.map((f) => ({ label: f, icon: "✓", sub: sportMeta.label })),
        ...(sportMeta.features.map((f) => ({ label: f, icon: "✓", sub: sportMeta.label }))),
      ]
    : [...CITY_MARQUEE, ...CITY_MARQUEE, ...CITY_MARQUEE];

  return (
    <div className="relative w-full bg-zinc-950 text-white overflow-hidden">
      <style>{`
        @keyframes vl-fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vl-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .vl-fade-in  { animation: vl-fade-in 0.8s ease-out forwards; opacity: 0; }
        .vl-marquee  { animation: vl-marquee 40s linear infinite; }
        .vl-d1 { animation-delay: 0.1s; }
        .vl-d2 { animation-delay: 0.2s; }
        .vl-d3 { animation-delay: 0.3s; }
        .vl-d4 { animation-delay: 0.4s; }
        .vl-d5 { animation-delay: 0.5s; }
      `}</style>

      {/* Background */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-35"
        style={{
          backgroundImage: `url(${bgImage})`,
          maskImage: "linear-gradient(180deg, transparent, black 5%, black 70%, transparent)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, black 5%, black 70%, transparent)",
        }}
      />

      {/* Orange top rail */}
      <div className="absolute top-0 left-0 right-0 h-[3px] z-20" style={{ background: "#C9572A" }} />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-24 pb-12 sm:px-6 md:pt-32 md:pb-20 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8 items-start">

          {/* ── LEFT ───────────────────────────────────────────────── */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-8 pt-8">

            {/* Badge */}
            <div className="vl-fade-in vl-d1">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md transition-colors hover:bg-white/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                </span>
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {sportMeta ? `${sportMeta.label} Leagues — Now Open` : platformConfig.heroBadge}
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1
              className="vl-fade-in vl-d2 font-heading font-black tracking-tight leading-[0.88] uppercase"
              style={{
                fontSize: "clamp(3.5rem, 9vw, 7rem)",
                maskImage: "linear-gradient(180deg, white 0%, white 80%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(180deg, white 0%, white 80%, transparent 100%)",
              }}
            >
              {sportMeta ? (
                <>
                  <span className="block text-white">ELEVATE</span>
                  <span className="block text-white">YOUR</span>
                  <span
                    className="block bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(135deg, #F97316, #C9572A, #B04823)" }}
                  >
                    {sportMeta.label.toUpperCase()}.
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-white">ONE</span>
                  <span className="block text-white">PASSION.</span>
                  <span
                    className="block bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(135deg, #F97316, #C9572A, #B04823)" }}
                  >
                    THREE
                  </span>
                  <span
                    className="block bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(135deg, #F97316, #C9572A, #B04823)" }}
                  >
                    SPORTS.
                  </span>
                </>
              )}
            </h1>

            {/* Sub */}
            <p className="vl-fade-in vl-d3 max-w-xl text-lg text-zinc-200 leading-relaxed">
              {sportMeta
                ? sportMeta.tagline
                : platformConfig.heroSubtitle}
            </p>

            {/* Sport pills (homepage only) */}
            {!sportMeta && (
              <div className="vl-fade-in vl-d3 flex flex-wrap gap-2">
                {activeSports.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/sport/${s.id}`)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-medium text-zinc-300 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20 cursor-pointer"
                  >
                    <span>{s.icon}</span> {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* CTAs */}
            <div className="vl-fade-in vl-d4 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handlePrimary}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-zinc-950 transition-all hover:scale-[1.02] hover:bg-zinc-200 active:scale-[0.98] cursor-pointer"
              >
                {sportMeta ? `Join ${sportMeta.label}` : "Start Now"}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={handleSecondary}
                className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10 hover:border-white/20 cursor-pointer"
              >
                Learn More
              </button>
            </div>
          </div>

          {/* ── RIGHT ──────────────────────────────────────────────── */}
          <div className="lg:col-span-5 space-y-6 lg:mt-12">

            {/* Stats card */}
            <div className="vl-fade-in vl-d5 relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />
              <div className="relative z-10">

                {/* Headline metric */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold tracking-tight text-white">1,200+</div>
                    <div className="text-sm text-zinc-400">Ranked Players</div>
                  </div>
                </div>

                {/* Founding spots bar */}
                {foundingStats.limit > 0 && (
                  <div className="space-y-3 mb-8">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Founding Spots Claimed</span>
                      <span className="text-white font-medium">{foundingStats.count}/{foundingStats.limit}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/50">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${spotsPercent}%`,
                          background: "linear-gradient(to right, #C9572A, #F97316)",
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="h-px w-full bg-white/10 mb-6" />

                {/* Grid stats */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <StatItem value="80+" label="Leagues" />
                  <div className="w-px bg-white/10" />
                  <StatItem value={platformConfig.featuredCities.length + "+"} label="Cities" />
                  <div className="w-px bg-white/10" />
                  <StatItem value={activeSportIds.length.toString()} label="Sports" />
                </div>

                {/* Tags */}
                <div className="mt-8 flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-300">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    SEASON 1 LIVE
                  </div>
                  {foundingStats.spots_left > 0 && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-300">
                      <Crown className="w-3 h-3 text-yellow-500" />
                      FOUNDING MEMBERS
                    </div>
                  )}
                  {sportMeta && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-zinc-300">
                      <Star className="w-3 h-3 text-orange-400" />
                      {sportMeta.rating}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Marquee card */}
            <div className="vl-fade-in vl-d5 relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 py-8 backdrop-blur-xl">
              <h3 className="mb-6 px-8 text-sm font-medium text-zinc-400">
                {sportMeta ? `${sportMeta.label} Highlights` : "Active in Your City"}
              </h3>
              <div
                className="relative flex overflow-hidden"
                style={{
                  maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
                  WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
                }}
              >
                <div className="vl-marquee flex gap-10 whitespace-nowrap px-4">
                  {[...marqueeItems, ...marqueeItems].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 opacity-50 transition-all hover:opacity-100 hover:scale-105 cursor-default"
                    >
                      <span className="text-lg leading-none">{item.icon}</span>
                      <div>
                        <span className="text-sm font-bold text-white tracking-tight">{item.label}</span>
                        {item.sub && (
                          <span className="ml-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">{item.sub}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
