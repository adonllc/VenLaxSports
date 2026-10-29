import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const AMBER = "#F2A922";
const INK = "#3D3D3D";

/**
 * Phone-only "Join a league" bar. Shows once the page's own join buttons have scrolled away, and hides again when one
 * of them (or the footer) is on screen, so it never doubles up. Sits under the cookie banner (z-40 vs z-50) so it can
 * never cover the consent buttons.
 *
 * `watch`: CSS selectors for elements that make the bar unnecessary while they are on screen.
 * `hideWhilePresent`: CSS selectors for elements that may appear at any time (like the cookie banner); the bar stays
 * hidden for as long as one is in the page.
 */
export default function StickyJoinBar({ watch, hideWhilePresent = [], label, to }) {
  const navigate = useNavigate();
  const [covered, setCovered] = useState(true);   // starts hidden: the hero button is on screen at load
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const check = () => setBlocked(hideWhilePresent.some((sel) => document.querySelector(sel)));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [hideWhilePresent]);

  useEffect(() => {
    const seen = new Map();
    const update = () => setCovered([...seen.values()].some(Boolean));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting));
      update();
    });
    watch.forEach((sel) => document.querySelectorAll(sel).forEach((el) => { seen.set(el, true); io.observe(el); }));
    return () => io.disconnect();
  }, [watch]);

  return (
    <AnimatePresence>
      {!covered && !blocked && (
        <motion.div
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 bg-white"
          style={{ borderTop: "1px solid #E4E4E4", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          data-testid="sticky-join-bar"
        >
          <button
            onClick={() => navigate(to)}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 text-sm font-bold uppercase tracking-wider"
            style={{ background: AMBER, color: INK }}
            data-testid="sticky-join-cta"
          >
            {label} <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
