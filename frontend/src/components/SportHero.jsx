import { useNavigate } from "react-router-dom";
import { ChevronRight, Trophy, Check } from "lucide-react";
import platformConfig, { activeSportIds } from "../config/platformConfig";
import PhotoSlot from "./PhotoSlot";

const INK = "#1D1D1F";
const MUTED = "#6E6E73";

/**
 * SportHero — Apple-style hero for the sport landing pages: centered headline,
 * photo, then a light founding-members tile.
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
    <section className="px-4 sm:px-6 pt-16 md:pt-24 text-center bg-white">
      <p className="text-lg md:text-xl font-semibold mb-3" style={{ color: "#C2410C" }}>
        {sportMeta.label} leagues, now open
      </p>
      <h1 className="font-semibold text-5xl md:text-[80px] leading-[1.04] max-w-4xl mx-auto" style={{ color: INK, letterSpacing: "-0.035em" }}>
        Elevate your<br />{sportMeta.label}.
      </h1>
      <p className="mt-6 max-w-2xl mx-auto text-xl md:text-2xl leading-snug" style={{ color: MUTED }}>
        {sportMeta.tagline}
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:gap-8 items-center justify-center">
        <button
          onClick={handlePrimary}
          className="px-7 py-3 rounded-full text-white font-medium text-lg transition-colors hover:bg-[#065F46]"
          style={{ background: "#047857" }}
          data-testid="sport-hero-join"
        >
          Join {sportMeta.label}
        </button>
        <button
          onClick={handleSecondary}
          className="inline-flex items-center gap-0.5 text-lg font-medium hover:underline"
          style={{ color: "#047857" }}
          data-testid="sport-hero-learn-more"
        >
          Learn more <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="max-w-[1200px] mx-auto mt-14 md:mt-20">
        <PhotoSlot src={sportMeta.image} alt={`${sportMeta.label} league play`} tone="ink" overlay={false} className="rounded-[28px] aspect-[16/9] md:aspect-[21/9]" />

        <div className="mt-4 rounded-[28px] p-8 md:p-10 text-left grid grid-cols-1 md:grid-cols-3 gap-8 items-center" style={{ background: "#F5F5F7" }}>
          <div className="flex items-center gap-4">
            <Trophy className="h-8 w-8" style={{ color: "#047857" }} aria-hidden="true" />
            <div>
              <div className="text-4xl font-semibold" style={{ color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{foundingStats.count}</div>
              <div className="text-sm" style={{ color: MUTED }}>Founding members</div>
            </div>
          </div>

          {foundingStats.limit > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: MUTED }}>Founding spots claimed</span>
                <span className="font-semibold" style={{ color: INK, fontFamily: "'IBM Plex Mono', monospace" }}>{foundingStats.count}/{foundingStats.limit}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "#D2D2D7" }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${spotsPercent}%`, background: "#047857" }} />
              </div>
              <p className="mt-3 text-sm" style={{ color: MUTED }}>
                {platformConfig.featuredCities.length}+ cities · {activeSportIds.length} sports{sportMeta.rating ? ` · ${sportMeta.rating}` : ""}
              </p>
            </div>
          )}

          {sportMeta.features?.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 text-sm" style={{ color: INK }}>
              {sportMeta.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" style={{ color: "#047857" }} aria-hidden="true" /> {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
