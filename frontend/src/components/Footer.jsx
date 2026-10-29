import { useState } from "react";
import { Link } from "react-router-dom";
import { activeSports, indexedCities } from "../config/platformConfig";
import { useSiteSettings } from "../contexts/SiteSettingsContext";
import { cityPath } from "../utils/citySlug";
import CityStatusTag from "./CityStatusTag";
import { hasFounderPage } from "../config/founderConfig";
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
  const { isCityOpen } = useSiteSettings();

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
            <p className="text-sm font-semibold leading-relaxed text-[#3D3D3D] mb-3" style={{ fontFamily: "Rubik, system-ui, sans-serif" }}>
              {BRAND.tagline_short}
            </p>
            <div className="flex items-center gap-4">
              {activeSports.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5C5C]" style={{ fontFamily: "Rubik, sans-serif" }}>
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-7 md:inline-grid md:grid-cols-3 md:gap-x-16 md:gap-y-8">
              {/* Sports */}
              <div aria-label="Sports navigation" className="col-start-2 row-start-1 md:col-auto md:row-auto">
                <h3 className="font-bold text-xs uppercase tracking-widest mb-4 text-[#3D3D3D]" style={{ fontFamily: "Rubik, system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
                  Sports
                </h3>
                <ul className="space-y-2">
                  {activeSports.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/sport/${s.id}`}
                        className="text-[13px] text-[#5C5C5C] hover:text-[#3D3D3D] transition-colors"
                        style={{ fontFamily: "Rubik, sans-serif" }}
                      >
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Platform */}
              <div aria-label="Platform navigation" className="col-start-1 row-start-1 row-span-2 md:col-auto md:row-auto md:row-span-1">
                <h3 className="font-bold text-xs uppercase tracking-widest mb-4 text-[#3D3D3D]" style={{ fontFamily: "Rubik, system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
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
                        className="text-[13px] text-[#5C5C5C] hover:text-[#3D3D3D] transition-colors"
                        style={{ fontFamily: "Rubik, sans-serif" }}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal + Support */}
              <div aria-label="Legal and support navigation" className="col-start-2 row-start-2 md:col-auto md:row-auto">
                <h3 className="font-bold text-xs uppercase tracking-widest mb-4 text-[#3D3D3D]" style={{ fontFamily: "Rubik, system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
                  Legal
                </h3>
                <ul className="space-y-2">
                  {[
                    ...(hasFounderPage ? [{ to: "/about", label: "About" }] : []),
                    { to: "/terms",     label: "Terms" },
                    { to: "/privacy",   label: "Privacy" },
                    { to: "/waiver",    label: "Waiver" },
                  ].map(({ to, label }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        className="text-[13px] text-[#5C5C5C] hover:text-[#3D3D3D] transition-colors"
                        style={{ fontFamily: "Rubik, sans-serif" }}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button
                      onClick={() => setContactOpen(true)}
                      className="text-[13px] text-[#5C5C5C] hover:text-[#3D3D3D] transition-colors cursor-pointer"
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

        {/* Feedback — bug reports and suggestions go straight to the team inbox */}
        <div
          className="mb-8 max-w-4xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-6 p-4 bg-white border border-[#3D3D3D]/10"
          data-testid="footer-feedback"
        >
          <p className="text-sm text-[#5C5C5C]" style={{ fontFamily: "Rubik, sans-serif" }}>
            <span className="font-bold text-[#3D3D3D]">Notice a bug or have a feature suggestion?</span>{" "}
            Drop us a line and let's level up VENLAX Sports together.
          </p>
          <a
            href={`mailto:${BRAND.feedback_email}?subject=${encodeURIComponent("VENLAX Sports feedback")}`}
            className="shrink-0 text-center px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-[#3D3D3D] hover:text-white"
            style={{ background: "#F2A922", color: "#3D3D3D", fontFamily: "Rubik, sans-serif" }}
            data-testid="footer-email-team"
          >
            Email Our Team
          </a>
        </div>

        {/* Featured Cities — Full width, below main content */}
        <div className="pb-6 border-b border-[#3D3D3D]/10">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-4 text-[#3D3D3D]" style={{ fontFamily: "Rubik, system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.12em" }}>
            Browse by City
          </h3>
          <div className="flex flex-wrap gap-5">
            {indexedCities.map((city) => (
              <Link
                key={city.name}
                to={isCityOpen(city.name) ? `/leagues?city=${encodeURIComponent(city.name)}` : cityPath(city.name, city.sports[0].toLowerCase())}
                className="inline-flex items-center gap-2 text-[13px] text-[#5C5C5C] hover:text-[#3D3D3D] transition-colors"
                style={{ fontFamily: "Rubik, sans-serif" }}
                data-testid={`footer-city-${city.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {city.name} <CityStatusTag city={city.name} />
              </Link>
            ))}
          </div>
        </div>

        {/* Footer Bottom — Copyright */}
        <div className="pt-5">
          <p className="text-xs text-[#5C5C5C]" style={{ fontFamily: "Rubik, sans-serif" }}>
            © {new Date().getFullYear()} VENLAX Sports.{" "}
            <a
              href="https://www.instagram.com/venlaxsports/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline hover:text-[#3D3D3D]"
              data-testid="footer-instagram"
            >
              Follow us on Instagram
            </a>
            {" · "}
            <a
              href="https://www.facebook.com/people/VenlaXsports/61592737988462/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline hover:text-[#3D3D3D]"
              data-testid="footer-facebook"
            >
              Follow us on Facebook
            </a>
          </p>
        </div>
      </div>
    </footer>
    </>
  );
}
