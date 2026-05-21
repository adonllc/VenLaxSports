import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Trophy, ChevronDown, Menu, X, LogOut, LayoutDashboard, Shield } from "lucide-react";
import { activeSports } from "../config/platformConfig";
import Logo from "./Logo";

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
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef(null);
  const isActive = (path) => location.pathname === path;

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
    <nav className="sticky top-0 z-50 glass-nav border-b border-gray-200" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center group-hover:bg-gray-800 transition-colors">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <Logo size="md" variant="default" testId="nav-logo-mark" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {/* Sport Pills */}
            {SPORTS.map((s) => (
              <Link
                key={s.id}
                to={`/sport/${s.id}`}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${s.color} ${s.bg}`}
                data-testid={`nav-sport-${s.id}`}
              >
                <span>{s.icon}</span> {s.label}
              </Link>
            ))}

            <Link
              to="/join"
              className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${isActive("/join") ? "bg-emerald-50 text-emerald-700" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}`}
              data-testid="nav-join"
            >
              Find a League
            </Link>

            <Link
              to="/rules"
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive("/rules") ? "bg-gray-100 text-gray-900 font-semibold" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
              data-testid="nav-rules"
            >
              Rules
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
          <Link to="/join" className="block px-3 py-2 text-sm font-semibold text-emerald-600 rounded-lg hover:bg-emerald-50" data-testid="nav-join-mobile">Find a League</Link>
          {SPORTS.map((s) => (
            <Link key={s.id} to={`/sport/${s.id}`} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${s.color}`} data-testid={`mobile-sport-${s.id}`}>
              <span>{s.icon}</span> {s.label}
            </Link>
          ))}
          <Link to="/rules" className="block px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50" data-testid="nav-rules-mobile">Rules</Link>
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
