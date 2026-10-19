import { useNavigate } from "react-router-dom";
import { ArrowRight, Trophy, Crown, Star, Check } from "lucide-react";
import platformConfig, { activeSportIds } from "../config/platformConfig";
import PhotoSlot from "./PhotoSlot";

const HEADING = { fontFamily: "'Cabinet Grotesk', system-ui, sans-serif" };
const GLASS = { background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.28)", backdropFilter: "blur(12px)" };

/**
 * SportHero — Produck-style photo hero for the sport landing pages.
 *
 * Props:
 *   sportMeta      — { id, label, image, tagline, features, rating }
 *   foundingStats  — { count, limit, spots_left } from /api/founding-members
 *   onPrimary      — primary CTA (default: /join?sport=<id>)
 *   onSecondary    — secondary CTA (default: /auth?mode=register)
 */
export default function SportHero({
  sportMeta,
  foundingStats = { count: 0, limit: 200, spots_left: 200 },
  onPrimary = null,
  onSecondary = null,
}) {
  const navigate = useNavigate();
  const handlePrimary = onPrimary ?? (() => navigate(`/join?sport=${sportMeta.id}`));
  const handleSecondary = onSecondary ?? (() => navigate("/auth?mode=register"));
  const spotsPercent = foundingStats.limit > 0 ? Math.round((foundingStats.count / foundingStats.limit) * 100) : 0;

  return (
    <section className="px-4 sm:px-6 pt-4 sm:pt-6">
      <PhotoSlot src={sportMeta.image} alt={`${sportMeta.label} league play`} tone="ink" className="max-w-[1320px] mx-auto rounded-3xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-6 sm:px-10 py-16 md:py-24 items-center">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-white mb-6" style={GLASS}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} aria-hidden="true" />
              {sportMeta.label} leagues, now open
            </span>
            <h1 className="font-extrabold text-5xl md:text-7xl leading-[1.05] text-white" style={{ ...HEADING, letterSpacing: "-0.02em" }}>
              Elevate your<br />{sportMeta.label}.
            </h1>
            <p className="mt-6 max-w-xl text-lg md:text-xl leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
              {sportMeta.tagline}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handlePrimary}
                className="group inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#065F46]"
                style={{ background: "#047857" }}
                data-testid="sport-hero-join"
              >
                Join {sportMeta.label}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </button>
              <button
                onClick={handleSecondary}
                className="inline-flex items-center justify-center rounded-full px-8 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5"
                style={GLASS}
                data-testid="sport-hero-learn-more"
              >
                Learn more
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-3xl p-7 text-white" style={GLASS}>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.14)" }}>
                  <Trophy className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-3xl font-extrabold" style={{ ...HEADING, fontVariantNumeric: "tabular-nums" }}>{foundingStats.count}</div>
                  <div className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Founding members</div>
                </div>
              </div>

              {foundingStats.limit > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: "rgba(255,255,255,0.7)" }}>Founding spots claimed</span>
                    <span className="font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{foundingStats.count}/{foundingStats.limit}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.18)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${spotsPercent}%`, background: "#10B981" }} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-center py-5 border-y" style={{ borderColor: "rgba(255,255,255,0.18)" }}>
                <div>
                  <div className="text-2xl font-extrabold" style={HEADING}>{platformConfig.featuredCities.length}+</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.65)" }}>Cities</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold" style={HEADING}>{activeSportIds.length}</div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.65)" }}>Sports</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={GLASS}>Season 1 live</span>
                {foundingStats.spots_left > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={GLASS}>
                    <Crown className="w-3 h-3" aria-hidden="true" /> Founding members
                  </span>
                )}
                {sportMeta.rating && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={GLASS}>
                    <Star className="w-3 h-3" aria-hidden="true" /> {sportMeta.rating}
                  </span>
                )}
              </div>

              {sportMeta.features?.length > 0 && (
                <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {sportMeta.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" style={{ color: "#10B981" }} aria-hidden="true" /> {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </PhotoSlot>
    </section>
  );
}
