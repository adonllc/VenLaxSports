import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import platformConfig, { activeSports } from "../config/platformConfig";
import BRAND from "../config/brandConfig";

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
    <footer className="bg-gray-950 text-white mt-auto" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <Trophy className="w-5 h-5 text-black" />
              </div>
              <span className="font-heading font-black text-xl">
                {BRAND.full_logo.prefix}<span className="text-emerald-400">{BRAND.full_logo.accent}</span>
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {BRAND.tagline_short}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {platformConfig.footerTagline}
            </p>
          </div>

          {/* Sports */}
          <div>
            <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Sports</h3>
            <ul className="space-y-2">
              {activeSports.map((s) => (
                <li key={s.id}>
                  <Link to={`/sport/${s.id}`} className={`text-sm text-gray-300 ${SPORT_HOVER[s.id] || "hover:text-white"} transition-colors`}>
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
              <li><Link to="/leagues" className="text-sm text-gray-300 hover:text-white transition-colors">Browse Leagues</Link></li>
              <li><Link to="/rules" className="text-sm text-gray-300 hover:text-white transition-colors">Rules &amp; Conduct</Link></li>
              <li><Link to="/dashboard" className="text-sm text-gray-300 hover:text-white transition-colors">My Dashboard</Link></li>
              <li><Link to="/auth" className="text-sm text-gray-300 hover:text-white transition-colors">Sign Up</Link></li>
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
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    {city.icon} {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} {BRAND.full_name} ({BRAND.domain}). All rights reserved.</p>
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
