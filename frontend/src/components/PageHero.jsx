/**
 * PageHero — centered, white page header for content pages (legal, handbook, guides).
 * title: ReactNode (use <br /> for line breaks). icon: lucide component (optional).
 * src/tone are accepted for API compatibility; the Apple-style header is text-only.
 */
export default function PageHero({ icon: Icon, eyebrow, title, subtitle, testId }) {
  return (
    <section className="px-4 sm:px-6 pt-16 md:pt-24 pb-10 md:pb-14 text-center bg-white" data-testid={testId}>
      <div className="max-w-4xl mx-auto">
        {eyebrow && (
          <p className="inline-flex items-center gap-2 text-lg font-semibold mb-3" style={{ color: "#C2410C" }}>
            {Icon && <Icon className="w-5 h-5" aria-hidden="true" />}
            {eyebrow}
          </p>
        )}
        <h1 className="font-semibold text-4xl sm:text-6xl md:text-7xl leading-[1.05]" style={{ color: "#1D1D1F", letterSpacing: "-0.035em" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-5 text-xl md:text-2xl max-w-2xl mx-auto leading-snug" style={{ color: "#6E6E73" }}>
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
