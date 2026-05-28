import { Link } from "react-router-dom";
import platformConfig, { activeSports } from "../config/platformConfig";
import BRAND from "../config/brandConfig";
import Logo from "./Logo";

const SPORT_DOT = {
  tennis:     "#10B981",
  pickleball: "#F97316",
  cricket:    "#2563EB",
};

export default function Footer() {
  return (
    <footer
      className="bg-gray-950 border-t-[3px]"
      style={{ borderTopColor: "#C9572A" }}
      data-testid="footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
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
                { to: "/terms",     label: "Terms & Conditions" },
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
        </div>

        <div className="mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-800">
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} {BRAND.full_name} ({BRAND.domain}). All rights reserved.
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
  );
}
