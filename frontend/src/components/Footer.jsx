import { useState } from "react";
import { Link } from "react-router-dom";
import platformConfig, { activeSports } from "../config/platformConfig";
import BRAND from "../config/brandConfig";
import Logo from "./Logo";
import ContactForm from "./ContactForm";

const SPORT_DOT = {
  tennis:     "#10B981",
  pickleball: "#F97316",
  cricket:    "#2563EB",
};

export default function Footer() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
    <ContactForm isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    <footer
      className="bg-white dark:bg-gray-900 border-t-4 transition-colors duration-200"
      style={{ borderTopColor: "#10B981" }}
      data-testid="footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Main grid: Brand (left, wider) + Links (right, compact) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-20 mb-20">
          {/* Brand Section — Prominent, larger space */}
          <div className="md:col-span-1">
            <div className="mb-8">
              <Logo size="lg" variant="default" testId="footer-logo" />
            </div>
            <p className="text-base leading-relaxed text-gray-600 dark:text-gray-300 mb-3" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {BRAND.tagline_short}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {platformConfig.footerTagline}
            </p>
          </div>

          {/* Links Groups — Compact, 2-column on desktop */}
          <div className="md:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
              {/* Sports */}
              <div>
                <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-gray-900 dark:text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
                  Sports
                </h3>
                <ul className="space-y-3">
                  {activeSports.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/sport/${s.id}`}
                        className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                        style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
                      >
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Platform */}
              <div>
                <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-gray-900 dark:text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
                  Platform
                </h3>
                <ul className="space-y-3">
                  {[
                    { to: "/leagues",   label: "Browse Leagues" },
                    { to: "/rules",     label: "Rules & Conduct" },
                    { to: "/handbook",  label: "Player Handbook" },
                    { to: "/auth",      label: "Sign Up" },
                  ].map(({ to, label }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                        style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal + Support */}
              <div>
                <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-gray-900 dark:text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
                  Legal
                </h3>
                <ul className="space-y-3">
                  {[
                    { to: "/terms",     label: "Terms" },
                    { to: "/privacy",   label: "Privacy" },
                    { to: "/waiver",    label: "Waiver" },
                  ].map(({ to, label }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                        style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button
                      onClick={() => setContactOpen(true)}
                      className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors cursor-pointer"
                      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
                      data-testid="footer-contact-us"
                    >
                      Contact
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Cities — Full width, below main content */}
        <div className="pb-16 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-black text-xs uppercase tracking-widest mb-6 text-gray-900 dark:text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
            Find Leagues
          </h3>
          <div className="flex flex-wrap gap-8">
            {platformConfig.featuredCities.slice(0, 6).map((city) => (
              <Link
                key={city.name}
                to={`/leagues?city=${encodeURIComponent(city.name)}`}
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
              >
                {city.icon} {city.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Footer Bottom — Copyright + Sport indicators */}
        <div className="pt-16 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-xs text-gray-500 dark:text-gray-400" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            © {new Date().getFullYear()} VENLAX Sports. Owned by Cloudy Labs LLC.
          </p>
          <div className="flex items-center gap-6">
            {activeSports.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: SPORT_DOT[s.id] || "#10B981" }}
                />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}
