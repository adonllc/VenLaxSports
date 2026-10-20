import PhotoSlot from "./PhotoSlot";
import { PHOTOS } from "../config/photos";

/**
 * PageHero — dark photo header for content pages (legal, handbook, guides).
 * Italic bold title with a green skewed accent bar, amber eyebrow.
 * title: ReactNode (use <br /> for line breaks). icon: lucide component (optional).
 */
export default function PageHero({ icon: Icon, eyebrow, title, subtitle, src = PHOTOS.community, tone = "ink", testId, compact = false }) {
  return (
    <section data-testid={testId}>
      <PhotoSlot src={src} tone={tone} overlay={false}>
        <div className="absolute inset-0" style={{ background: src ? "rgba(61,61,61,0.62)" : "transparent" }} />
        <div className={`relative max-w-[1100px] mx-auto px-6 ${compact ? "py-12 sm:py-16" : "py-20 sm:py-28"}`}>
          {eyebrow && (
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F2A922" }}>
              {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
              {eyebrow}
            </p>
          )}
          <h1 className={`font-bold italic leading-[1] text-white max-w-3xl ${compact ? "text-4xl sm:text-6xl" : "text-5xl sm:text-7xl"}`}>{title}</h1>
          <div className="mt-6 h-1.5 w-28" style={{ background: "#008F70", transform: "skewX(-20deg)" }} aria-hidden="true" />
          {subtitle && <p className="mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed text-white/90">{subtitle}</p>}
        </div>
      </PhotoSlot>
    </section>
  );
}
