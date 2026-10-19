import { useState } from "react";
import { Link } from "react-router-dom";
import platformConfig, { activeSports } from "../config/platformConfig";
import BRAND from "../config/brandConfig";
import Logo from "./Logo";
import ContactForm from "./ContactForm";

const SPORT_DOT = {
  tennis:     "#008F70",
  pickleball: "#F2A922",
  cricket:    "#2563EB",
};

export default function Footer() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
    <ContactForm isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    <footer
      className="transition-colors duration-200"
      style={{ background: "#F1F1F1", borderTop: "4px solid #F2A922" }}
      data-testid="footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        {/* Main grid: Brand (left, wider) + Links (right, compact) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8">
          {/* Brand Section */}
          <div className="md:col-span-1">
            <div className="mb-4">
              <Logo size="md" variant="default" testId="footer-logo" />
            </div>
            <p className="text-sm font-semibold leading-relaxed text-[#1D1D1D] mb-2" style={{ fontFamily: "Rubik, system-ui, sans-serif" }}>
              {BRAND.tagline_short}
            </p>
            <p className="text-sm text-gray-300 mb-3" style={{ fontFamily: "Rubik, sans-serif" }}>
              {platformConfig.footerTagline}
            </p>
            <div className="flex items-center gap-4">
              {activeSports.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4C4C4C]" style={{ fontFamily: "Rubik, sans-serif" }}>
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: SPORT_DOT[s.id] || "#008F70" }}
                  />
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Links Groups — Compact, 2-column on desktop */}
          <div className="md:col-span-2 flex md:justify-end">
            <div className="grid grid-cols-2 md:inline-grid md:grid-cols-3 gap-8 md:gap-x-16">
              {/* Sports */}
              <div aria-label="Sports navigation">
                <h3 className="font-bold text-xs uppercase tracking-widest mb-4 text-[#1D1D1D]" style={{ fontFamily: "Rubik, system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
                  Sports
                </h3>
                <ul className="space-y-2">
                  {activeSports.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/sport/${s.id}`}
                        className="text-[13px] text-[#4C4C4C] hover:text-[#1D1D1D] transition-colors"
                        style={{ fontFamily: "Rubik, sans-serif" }}
                      >
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Platform */}
              <div aria-label="Platform navigation">
                <h3 className="font-bold text-xs uppercase tracking-widest mb-4 text-[#1D1D1D]" style={{ fontFamily: "Rubik, system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
                  Platform
                </h3>
                <ul className="space-y-2">
                  {[
                    { to: "/leagues",   label: "Browse Leagues" },
                    { to: "/rules",     label: "Rules & Conduct" },
                    { to: "/handbook",  label: "Player Handbook" },
                    { to: "/tennis-pickleball-leagues", label: "League Guide" },
                    { to: "/auth",      label: "Sign Up" },
                  ].map(({ to, label }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        className="text-[13px] text-[#4C4C4C] hover:text-[#1D1D1D] transition-colors"
                        style={{ fontFamily: "Rubik, sans-serif" }}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal + Support */}
              <div aria-label="Legal and support navigation">
                <h3 className="font-bold text-xs uppercase tracking-widest mb-4 text-[#1D1D1D]" style={{ fontFamily: "Rubik, system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
                  Legal
                </h3>
                <ul className="space-y-2">
                  {[
                    { to: "/terms",     label: "Terms" },
                    { to: "/privacy",   label: "Privacy" },
                    { to: "/waiver",    label: "Waiver" },
                  ].map(({ to, label }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        className="text-[13px] text-[#4C4C4C] hover:text-[#1D1D1D] transition-colors"
                        style={{ fontFamily: "Rubik, sans-serif" }}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button
                      onClick={() => setContactOpen(true)}
                      className="text-[13px] text-[#4C4C4C] hover:text-[#1D1D1D] transition-colors cursor-pointer"
                      style={{ fontFamily: "Rubik, sans-serif" }}
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
        <div className="pb-6 border-b border-black/10">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-4 text-[#1D1D1D]" style={{ fontFamily: "Rubik, system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
            Browse by City
          </h3>
          <div className="flex flex-wrap gap-5">
            {platformConfig.featuredCities.slice(0, 6).map((city) => (
              <Link
                key={city.name}
                to={`/leagues?city=${encodeURIComponent(city.name)}`}
                className="text-[13px] text-[#4C4C4C] hover:text-[#1D1D1D] transition-colors"
                style={{ fontFamily: "Rubik, sans-serif" }}
              >
                {city.icon} {city.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Footer Bottom — Copyright */}
        <div className="pt-5">
          <p className="text-xs text-[#4C4C4C]" style={{ fontFamily: "Rubik, sans-serif" }}>
            © {new Date().getFullYear()} VENLAX Sports. Owned by Cloudy Labs LLC.
          </p>
        </div>
      </div>
    </footer>
    </>
  );
}
