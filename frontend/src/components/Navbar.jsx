import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { ChevronDown, Menu, X, LogOut, LayoutDashboard, Shield, Sun, Moon } from "lucide-react";
import { activeSports } from "../config/platformConfig";
import Logo from "./Logo";

const SPORTS = activeSports.map((s) => ({
  id: s.id,
  label: s.label,
  color: s.color,
  bg: s.bg,
  icon: s.icon,
}));

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef(null);
  const isActive = (path) => location.pathname === path;

  const NAV_TEXT    = isDark ? "#c9d1d9" : "#374151";
  const NAV_MUTED   = isDark ? "#8b949e" : "#6B7280";
  const NAV_HOVER_BG = isDark ? "#1c2128" : "#F9FAFB";
  const ORANGE_PALE = isDark ? "rgba(201,87,42,0.18)" : "#FEF2EE";

  useEffect(() => {
    const handler = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <nav
      className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 transition-colors duration-200"
      data-testid="navbar"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-28">

          {/* Logo */}
          <Link to="/" data-testid="nav-logo" className="flex-shrink-0">
            <Logo size="md" variant="dark" testId="nav-logo-mark" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {SPORTS.map((s) => (
              <Link
                key={s.id}
                to={`/sport/${s.id}`}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                data-testid={`nav-sport-${s.id}`}
              >
                <span className="text-base leading-none">{s.icon}</span>
                {s.label}
              </Link>
            ))}

            <Link
              to="/join"
              className="px-3 py-2 text-sm font-semibold rounded-lg transition-colors"
              style={isActive("/join") ? { color: "#C9572A", background: ORANGE_PALE } : { color: NAV_TEXT }}
              onMouseEnter={e => { e.currentTarget.style.color = "#C9572A"; e.currentTarget.style.background = ORANGE_PALE; }}
              onMouseLeave={e => { e.currentTarget.style.color = isActive("/join") ? "#C9572A" : NAV_TEXT; e.currentTarget.style.background = isActive("/join") ? ORANGE_PALE : "transparent"; }}
              data-testid="nav-join"
            >
              Find a League
            </Link>

            <Link
              to="/ladders"
              className="px-3 py-2 text-sm font-medium rounded-lg transition-colors"
              style={isActive("/ladders") ? { color: "#C9572A", background: ORANGE_PALE } : { color: NAV_MUTED }}
              onMouseEnter={e => { if (!isActive("/ladders")) { e.currentTarget.style.color = NAV_TEXT; e.currentTarget.style.background = NAV_HOVER_BG; } }}
              onMouseLeave={e => { if (!isActive("/ladders")) { e.currentTarget.style.color = NAV_MUTED; e.currentTarget.style.background = "transparent"; } }}
              data-testid="nav-ladders"
            >
              Ladders
            </Link>

            <Link
              to="/rules"
              className="px-3 py-2 text-sm font-medium rounded-lg transition-colors"
              style={isActive("/rules") ? { color: "#C9572A", background: ORANGE_PALE } : { color: NAV_MUTED }}
              onMouseEnter={e => { if (!isActive("/rules")) { e.currentTarget.style.color = NAV_TEXT; e.currentTarget.style.background = NAV_HOVER_BG; } }}
              onMouseLeave={e => { if (!isActive("/rules")) { e.currentTarget.style.color = NAV_MUTED; e.currentTarget.style.background = "transparent"; } }}
              data-testid="nav-rules"
            >
              Rules
            </Link>

            {user?.role === "admin" && (
              <Link
                to="/admin"
                className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                data-testid="nav-admin"
              >
                Admin
              </Link>
            )}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              data-testid="theme-toggle"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {user ? (
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserOpen(!userOpen)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  data-testid="nav-user-menu"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: "#C9572A" }}
                  >
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="max-w-[120px] truncate">{user.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                {userOpen && (
                  <div className="absolute top-full right-0 mt-1.5 w-52 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg shadow-gray-900/5 p-1.5 z-50">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500">Signed in as</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user.email}</p>
                    </div>
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                      data-testid="nav-dashboard"
                    >
                      <LayoutDashboard className="w-4 h-4 text-gray-400" /> My Dashboard
                    </Link>
                    {user.role === "admin" && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                        data-testid="nav-admin-panel"
                      >
                        <Shield className="w-4 h-4 text-gray-400" /> Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg w-full"
                      data-testid="nav-logout"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  data-testid="nav-login"
                >
                  Log In
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="px-4 py-2 text-sm font-bold rounded-lg text-white transition-colors"
                  style={{ background: "#C9572A" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#B04823"}
                  onMouseLeave={e => e.currentTarget.style.background = "#C9572A"}
                  data-testid="nav-register"
                >
                  Sign Up Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="nav-mobile-toggle"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 space-y-1">
          <Link
            to="/join"
            className="block px-3 py-2.5 text-sm font-semibold rounded-lg"
            style={{ color: "#C9572A", background: "#FEF2EE" }}
            data-testid="nav-join-mobile"
          >
            Find a League
          </Link>
          {SPORTS.map((s) => (
            <Link
              key={s.id}
              to={`/sport/${s.id}`}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              data-testid={`mobile-sport-${s.id}`}
            >
              <span>{s.icon}</span> {s.label}
            </Link>
          ))}
          <Link
            to="/ladders"
            className="block px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
            data-testid="nav-ladders-mobile"
          >
            Ladders
          </Link>
          <Link
            to="/rules"
            className="block px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
            data-testid="nav-rules-mobile"
          >
            Rules
          </Link>

          <div className="pt-2 mt-2 border-t border-gray-100 space-y-1">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="block px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  My Dashboard
                </Link>
                {user.role === "admin" && (
                  <Link
                    to="/admin"
                    className="block px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
                  >
                    Admin Panel
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  to="/auth"
                  className="px-3 py-2.5 text-sm font-medium text-gray-600 text-center border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Log In
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="px-3 py-2.5 text-sm font-bold text-white text-center rounded-lg"
                  style={{ background: "#C9572A" }}
                  data-testid="nav-register-mobile"
                >
                  Sign Up Free
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
