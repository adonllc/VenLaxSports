import { Link } from "react-router-dom";
import platformConfig, { activeSports } from "../config/platformConfig";
import BRAND from "../config/brandConfig";
import Logo from "./Logo";

const SPORT_HOVER = {
  tennis: "hover:text-emerald-400",
  cricket: "hover:text-blue-400",
  pickleball: "hover:text-orange-400",
};
const SPORT_DOT = {
  tennis: "bg-emerald-500",
  cricket: "bg-blue-500",
  pickleball: "bg-orange-500",
};

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 mt-auto" data-testid="footer">
      {/* Accent top strip */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3">
              <Logo size="md" variant="default" testId="footer-logo" />
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {BRAND.tagline_short}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {platformConfig.footerTagline}
            </p>
          </div>

          {/* Sports */}
          <div>
            <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Sports</h3>
            <ul className="space-y-2">
              {activeSports.map((s) => (
                <li key={s.id}>
                  <Link to={`/sport/${s.id}`} className={`text-sm text-gray-600 hover:text-gray-900 transition-colors`}>
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Leagues */}
          <div>
            <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Platform</h3>
            <ul className="space-y-2">
              <li><Link to="/leagues" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Browse Leagues</Link></li>
              <li><Link to="/rules" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Rules &amp; Conduct</Link></li>
              <li><Link to="/terms" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Terms &amp; Conditions</Link></li>
              <li><Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">My Dashboard</Link></li>
              <li><Link to="/auth" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Sign Up</Link></li>
            </ul>
          </div>

          {/* Cities */}
          <div>
            <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Cities</h3>
            <ul className="space-y-2">
              {platformConfig.featuredCities.slice(0, 4).map((city) => (
                <li key={city.name}>
                  <Link
                    to={`/leagues?city=${encodeURIComponent(city.name)}`}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {city.icon} {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} {BRAND.full_name} ({BRAND.domain}). All rights reserved.</p>
          <div className="flex items-center gap-4">
            {activeSports.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${SPORT_DOT[s.id] || "bg-gray-400"} inline-block`}></span>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
