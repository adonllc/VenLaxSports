import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const FADE = 1.2;     // seconds to crossfade
const HOLD = 6500;    // ms each photo stays

/**
 * Full-bleed hero background: crossfades through the given photos, each with a slow zoom.
 * Photos after the first load only once the page has settled, so the first paint stays as fast as a single image.
 * With reduced motion it shows the first photo, still. Pauses while the tab is hidden.
 */
export default function HeroSlideshow({ photos, label }) {
  const reduce = useReducedMotion();
  const [armed, setArmed] = useState(false);   // later photos may start loading
  const [index, setIndex] = useState(0);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (reduce) return undefined;
    const t = setTimeout(() => setArmed(true), 1500);
    return () => clearTimeout(t);
  }, [reduce]);

  useEffect(() => {
    if (reduce || !armed) return undefined;
    // restarts whenever the photo changes, so picking a dot gives that photo its full time on screen
    const id = setTimeout(() => {
      if (document.hidden) setRetry((n) => n + 1);   // tab hidden: stay on this photo, check again later
      else setIndex((i) => (i + 1) % photos.length);
    }, HOLD);
    return () => clearTimeout(id);
  }, [reduce, armed, photos.length, index, retry]);

  return (
    <div className="absolute inset-0" role="img" aria-label={label} data-testid="hero-slideshow">
      {photos.map((src, i) => {
        if (i > 0 && !armed) return null;
        const active = i === index;
        return (
          <motion.img
            key={src}
            src={src}
            alt=""
            aria-hidden="true"
            width={1600}
            height={894}
            decoding="async"
            fetchPriority={i === 0 ? "high" : "low"}
            className="absolute inset-0 w-full h-full object-cover"
            initial={false}
            animate={active ? { opacity: 1, scale: reduce ? 1 : 1.08 } : { opacity: 0, scale: 1 }}
            transition={active
              ? { opacity: { duration: FADE }, scale: { duration: HOLD / 1000 + FADE, ease: "linear" } }
              : { opacity: { duration: FADE }, scale: { duration: 0, delay: FADE } }}
            style={{ zIndex: active ? 1 : 0 }}
          />
        );
      })}
      {!reduce && armed && (
        <div className="absolute left-0 right-0 bottom-32 md:bottom-28 z-30 flex justify-center gap-2" data-testid="hero-slide-dots">
          {photos.map((src, i) => (
            <button
              key={src}
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1} of ${photos.length}`}
              aria-current={i === index}
              className="h-3 w-8 flex items-end"
              data-testid={`hero-slide-dot-${i}`}
            >
              <span className="block h-1 w-full transition-colors duration-500" style={{ background: i === index ? "#F2A922" : "rgba(255,255,255,0.45)" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
