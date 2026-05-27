import { Link } from "react-router-dom";
import platformConfig, { activeSports } from "../config/platformConfig";
import BRAND from "../config/brandConfig";
import Logo from "./Logo";

const NAVY = "#1F0A03";
const NAVY_MID = "#2C1206";
const LIME = "#C5D600";

const SPORT_DOT = {
  tennis:     "#C5D600",
  pickleball: "#00B4A4",
  cricket:    "#E86010",
};

export default function Footer() {
  return (
    <footer style={{ background: NAVY, borderTop: `3px solid ${LIME}` }} data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3">
              <Logo size="md" variant="light" testId="footer-logo" />
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              {BRAND.tagline_short}
            </p>
            <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
              {platformConfig.footerTagline}
            </p>
          </div>

          {/* Sports */}
          <div>
            <h3
              className="font-heading font-bold text-sm uppercase tracking-widest mb-4"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Sports
            </h3>
            <ul className="space-y-2">
              {activeSports.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/sport/${s.id}`}
                    className="text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                    onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.55)"}
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform */}
          <div>
            <h3
              className="font-heading font-bold text-sm uppercase tracking-widest mb-4"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Platform
            </h3>
            <ul className="space-y-2">
              {[
                { to: "/leagues", label: "Browse Leagues" },
                { to: "/rules",   label: "Rules & Conduct" },
                { to: "/terms",   label: "Terms & Conditions" },
                { to: "/dashboard", label: "My Dashboard" },
                { to: "/auth",    label: "Sign Up" },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                    onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.55)"}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cities */}
          <div>
            <h3
              className="font-heading font-bold text-sm uppercase tracking-widest mb-4"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Cities
            </h3>
            <ul className="space-y-2">
              {platformConfig.featuredCities.slice(0, 4).map((city) => (
                <li key={city.name}>
                  <Link
                    to={`/leagues?city=${encodeURIComponent(city.name)}`}
                    className="text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                    onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.55)"}
                  >
                    {city.icon} {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: `1px solid rgba(255,255,255,0.08)` }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
            &copy; {new Date().getFullYear()} {BRAND.full_name} ({BRAND.domain}). All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {activeSports.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: SPORT_DOT[s.id] || LIME }}
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
