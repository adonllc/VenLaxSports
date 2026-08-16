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
      className="bg-gray-950 border-t-[3px]"
      style={{ borderTopColor: "#C9572A" }}
      data-testid="footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3">
              <Logo size="md" variant="light" testId="footer-logo" />
            </div>
            <p className="text-sm leading-relaxed text-gray-500">
              {BRAND.tagline_short}
            </p>
            <p className="text-xs mt-2 text-gray-600">
              {platformConfig.footerTagline}
            </p>
          </div>

          {/* Sports */}
          <div>
            <h3 className="font-heading font-bold text-xs uppercase tracking-widest mb-4 text-gray-600">
              Sports
            </h3>
            <ul className="space-y-2">
              {activeSports.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/sport/${s.id}`}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform */}
          <div>
            <h3 className="font-heading font-bold text-xs uppercase tracking-widest mb-4 text-gray-600">
              Platform
            </h3>
            <ul className="space-y-2">
              {[
                { to: "/leagues",   label: "Browse Leagues" },
                { to: "/rules",     label: "Rules & Conduct" },
                { to: "/handbook",  label: "Player Handbook" },
                { to: "/terms",     label: "Terms & Conditions" },
                { to: "/waiver",    label: "Liability Waiver" },
                { to: "/privacy",   label: "Privacy Policy" },
                { to: "/dashboard", label: "My Dashboard" },
                { to: "/auth",      label: "Sign Up" },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cities */}
          <div>
            <h3 className="font-heading font-bold text-xs uppercase tracking-widest mb-4 text-gray-600">
              Cities
            </h3>
            <ul className="space-y-2">
              {platformConfig.featuredCities.slice(0, 4).map((city) => (
                <li key={city.name}>
                  <Link
                    to={`/leagues?city=${encodeURIComponent(city.name)}`}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {city.icon} {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-bold text-xs uppercase tracking-widest mb-4 text-gray-600">
              Support
            </h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setContactOpen(true)}
                  className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
                  data-testid="footer-contact-us"
                >
                  Contact Us
                </button>
              </li>
              <li>
                <a
                  href="mailto:feedback@venlaxsports.com"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Feedback
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-800">
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} VENLAX Sports. All rights reserved. Owned and operated by Cloudy Labs LLC.
          </p>
          <div className="flex items-center gap-4">
            {activeSports.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: SPORT_DOT[s.id] || "#C9572A" }}
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
