import PhotoSlot from "./PhotoSlot";

const HEADING = { fontFamily: "'Cabinet Grotesk', system-ui, sans-serif" };

/**
 * PageHero — inset dark panel header for content pages (legal, handbook, guides).
 * title: ReactNode (use <br /> for line breaks). icon: lucide component (optional).
 */
export default function PageHero({ icon: Icon, eyebrow, title, subtitle, src, tone = "ink", testId }) {
  return (
    <section className="px-4 sm:px-6 pt-4 sm:pt-6" data-testid={testId}>
      <PhotoSlot src={src} tone={tone} className="max-w-[1200px] mx-auto rounded-3xl">
        <div className="px-6 sm:px-12 py-14 sm:py-20">
          {eyebrow && (
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-white mb-6"
              style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.28)", backdropFilter: "blur(12px)" }}
            >
              {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
              {eyebrow}
            </span>
          )}
          <h1 className="font-extrabold text-4xl sm:text-6xl leading-[1.05] text-white max-w-3xl" style={{ ...HEADING, letterSpacing: "-0.02em" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-5 text-base sm:text-lg max-w-2xl leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </PhotoSlot>
    </section>
  );
}
