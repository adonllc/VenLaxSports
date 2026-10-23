import { useNavigate } from "react-router-dom";
import { Trophy, Check } from "lucide-react";
import platformConfig, { activeSportIds, FOUNDING_DISPLAY_FLOOR } from "../config/platformConfig";
import PhotoSlot from "./PhotoSlot";

const GREEN = "#008F70";
const AMBER = "#F2A922";
const INK = "#3D3D3D";

/**
 * SportHero — tennis-club style hero for the sport landing pages: photo with
 * overlay, italic title with a green skewed block, then a green founding-members bar.
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
  const showStats = foundingStats.count >= FOUNDING_DISPLAY_FLOOR;
  const spotsPercent = foundingStats.limit > 0 ? Math.round((foundingStats.count / foundingStats.limit) * 100) : 0;

  return (
    <section>
      <PhotoSlot src={sportMeta.image} alt={`${sportMeta.label} league play`} tone="ink" overlay={false}>
        <div className="absolute inset-0" style={{ background: "rgba(61,61,61,0.42)" }} />
        <div className="relative text-center px-6 pt-24 pb-40 md:pt-32 md:pb-48">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: AMBER }}>
            {sportMeta.label} leagues, now open
          </p>
          <h1 className="font-bold italic text-5xl sm:text-7xl md:text-[110px] leading-[0.98] text-white">
            Elevate your
            <span className="block mt-2">
              <span className="inline-block px-5 md:px-8" style={{ background: GREEN, transform: "skewX(-8deg)" }}>
                <span className="inline-block" style={{ transform: "skewX(8deg)" }}>{sportMeta.label}</span>
              </span>
            </span>
          </h1>
          <p className="mt-8 max-w-2xl mx-auto text-lg md:text-xl text-white/90">{sportMeta.label} on VENLAX is ranked league play: skill-matched opponents, live standings and no club membership. {sportMeta.tagline}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handlePrimary}
              className="px-8 py-3.5 text-sm font-bold uppercase tracking-wider transition-colors hover:bg-[#3D3D3D] hover:text-white"
              style={{ background: AMBER, color: INK }}
              data-testid="sport-hero-join"
            >
              Join {sportMeta.label}
            </button>
            <button
              onClick={handleSecondary}
              className="px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white border-2 border-white transition-colors hover:bg-white hover:text-[#3D3D3D]"
              data-testid="sport-hero-learn-more"
            >
              Learn more
            </button>
          </div>
        </div>
      </PhotoSlot>

      <div className="relative -mt-20 px-4 sm:px-6">
        <div className="max-w-[1100px] mx-auto text-white px-8 md:px-12 py-8 grid grid-cols-1 md:grid-cols-3 gap-8 items-center" style={{ background: GREEN }}>
          <div className="flex items-center gap-4">
            <Trophy className="h-9 w-9" style={{ color: AMBER }} aria-hidden="true" />
            {showStats ? (
              <div>
                <div className="text-4xl font-bold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>{foundingStats.count}</div>
                <div className="text-sm text-white/90 mt-1">Founding members</div>
              </div>
            ) : (
              <p className="text-lg font-bold">
                {platformConfig.featuredCities.length}+ cities · {activeSportIds.length} sports{sportMeta.rating ? ` · ${sportMeta.rating}` : ""}
              </p>
            )}
          </div>

          {showStats && foundingStats.limit > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/90">Founding spots claimed</span>
                <span className="font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{foundingStats.count}/{foundingStats.limit}</span>
              </div>
              <div className="h-2 w-full overflow-hidden" style={{ background: "rgba(255,255,255,0.3)" }}>
                <div className="h-full transition-all duration-700" style={{ width: `${spotsPercent}%`, background: AMBER }} />
              </div>
              <p className="mt-3 text-sm text-white/90">
                {platformConfig.featuredCities.length}+ cities · {activeSportIds.length} sports{sportMeta.rating ? ` · ${sportMeta.rating}` : ""}
              </p>
            </div>
          )}

          {sportMeta.features?.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 text-sm">
              {sportMeta.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" style={{ color: AMBER }} aria-hidden="true" /> {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
