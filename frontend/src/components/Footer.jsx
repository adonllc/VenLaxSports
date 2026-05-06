import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import platformConfig from "../config/platformConfig";

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
                League<span className="text-emerald-400">Pro</span>
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {platformConfig.footerTagline}
            </p>
          </div>

          {/* Sports */}
          <div>
            <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Sports</h3>
            <ul className="space-y-2">
              <li><Link to="/sport/tennis" className="text-sm text-gray-300 hover:text-emerald-400 transition-colors">Tennis</Link></li>
              <li><Link to="/sport/cricket" className="text-sm text-gray-300 hover:text-blue-400 transition-colors">Cricket</Link></li>
              <li><Link to="/sport/pickleball" className="text-sm text-gray-300 hover:text-orange-400 transition-colors">Pickleball</Link></li>
            </ul>
          </div>

          {/* Leagues */}
          <div>
            <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-gray-400 mb-4">Platform</h3>
            <ul className="space-y-2">
              <li><Link to="/leagues" className="text-sm text-gray-300 hover:text-white transition-colors">Browse Leagues</Link></li>
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
          <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} LeaguePro. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              Tennis
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
              Cricket
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
              Pickleball
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
