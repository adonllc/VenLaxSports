const TONES = {
  ink: "#0F1F1A",
  emerald: "#065F46",
  orange: "#C2410C",
};

/**
 * Full-bleed photo block. Renders the photo with a dark readability overlay,
 * or a branded colour fallback (with the three-ring mark) when no src is set.
 * Children render on top, so text/chips can be layered over either state.
 */
export default function PhotoSlot({ src, alt = "", tone = "ink", overlay = true, className = "", children }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: TONES[tone] || TONES.ink }}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 52 48"
          className="absolute -right-10 -bottom-10 w-[60%] max-w-md opacity-[0.12]"
          fill="none"
          stroke="#fff"
          strokeWidth="1.2"
        >
          <circle cx="26" cy="13" r="12" />
          <circle cx="14" cy="34" r="12" />
          <circle cx="38" cy="34" r="12" />
        </svg>
      )}
      {src && overlay && (
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.32) 100%)" }} />
      )}
      <div className="relative h-full">{children}</div>
    </div>
  );
}
