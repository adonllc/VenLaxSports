import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Trophy, ChevronDown, Menu, X, User, LogOut, LayoutDashboard, Shield } from "lucide-react";
import { activeSports } from "../config/platformConfig";

// PHASE-DRIVEN: only sports in the active phase are shown in the nav.
// PHASE 2 unlocks Cricket — controlled by REACT_APP_PHASE env var.
const SPORTS = activeSports.map((s) => ({
  id: s.id,
  label: s.label,
  color: s.color,
  bg: s.bg,
  icon: s.icon,
}));

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sportsOpen, setSportsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const sportsRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (sportsRef.current && !sportsRef.current.contains(e.target)) setSportsOpen(false);
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
    <nav className="sticky top-0 z-50 glass-nav border-b border-gray-200" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center group-hover:bg-gray-800 transition-colors">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-black text-xl text-gray-900 tracking-tight">
              VEN<span className="text-emerald-500">LAX</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {/* Sports Dropdown */}
            <div className="relative" ref={sportsRef}>
              <button
                onClick={() => setSportsOpen(!sportsOpen)}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                data-testid="nav-sports-dropdown"
              >
                Sports <ChevronDown className={`w-4 h-4 transition-transform ${sportsOpen ? "rotate-180" : ""}`} />
              </button>
              {sportsOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50">
                  {SPORTS.map((s) => (
                    <Link
                      key={s.id}
                      to={`/sport/${s.id}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${s.color} ${s.bg} transition-colors`}
                      data-testid={`nav-sport-${s.id}`}
                    >
                      <span>{s.icon}</span> {s.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              to="/leagues"
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              data-testid="nav-leagues"
            >
              Leagues
            </Link>

            {user?.role === "admin" && (
              <Link
                to="/admin"
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                data-testid="nav-admin"
              >
                Admin
              </Link>
            )}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserOpen(!userOpen)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  data-testid="nav-user-menu"
                >
                  <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{user.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <span className="max-w-[120px] truncate">{user.name}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {userOpen && (
                  <div className="absolute top-full right-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50">
                    <div className="px-3 py-2 border-b border-gray-100 mb-1">
                      <p className="text-xs text-gray-500">Signed in as</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.email}</p>
                    </div>
                    <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 rounded-lg" data-testid="nav-dashboard">
                      <LayoutDashboard className="w-4 h-4" /> My Dashboard
                    </Link>
                    {user.role === "admin" && (
                      <Link to="/admin" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 rounded-lg" data-testid="nav-admin-panel">
                        <Shield className="w-4 h-4" /> Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-red-600 rounded-lg w-full"
                      data-testid="nav-logout"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/auth" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors" data-testid="nav-login">
                  Log In
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="px-4 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  data-testid="nav-register"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="nav-mobile-toggle"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 px-4 py-4 space-y-2">
          {SPORTS.map((s) => (
            <Link key={s.id} to={`/sport/${s.id}`} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${s.color}`} data-testid={`mobile-sport-${s.id}`}>
              <span>{s.icon}</span> {s.label}
            </Link>
          ))}
          <Link to="/leagues" className="block px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">Leagues</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="block px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">My Dashboard</Link>
              {user.role === "admin" && <Link to="/admin" className="block px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">Admin Panel</Link>}
              <button onClick={handleLogout} className="block w-full text-left px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50">Sign Out</button>
            </>
          ) : (
            <>
              <Link to="/auth" className="block px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">Log In</Link>
              <Link to="/auth?mode=register" className="block px-3 py-2 text-sm font-semibold bg-black text-white rounded-lg text-center">Sign Up Free</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
