import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ChevronDown, Menu, X, LogOut, LayoutDashboard, Shield } from "lucide-react";
import { activeSports } from "../config/platformConfig";
import Logo from "./Logo";

const SPORTS = activeSports.map((s) => ({
  id: s.id,
  label: s.label,
  color: s.color,
  bg: s.bg,
  icon: s.icon,
}));

const NAVY = "#1B2A4A";
const NAVY_MID = "#2A3D66";
const LIME = "#C5D600";
const LIME_HOVER = "#AEBE00";

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
    <nav
      className="sticky top-0 z-50 border-b"
      style={{ background: NAVY, borderColor: NAVY_MID }}
      data-testid="navbar"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
          {/* Logo */}
          <Link to="/" data-testid="nav-logo">
            <Logo size="lg" variant="light" testId="nav-logo-mark" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {SPORTS.map((s) => (
              <Link
                key={s.id}
                to={`/sport/${s.id}`}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors"
                style={{ color: "rgba(255,255,255,0.65)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = NAVY_MID; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.65)"; e.currentTarget.style.background = "transparent"; }}
                data-testid={`nav-sport-${s.id}`}
              >
                <span>{s.icon}</span> {s.label}
              </Link>
            ))}

            <Link
              to="/join"
              className="px-3 py-2 text-sm font-semibold rounded-md transition-colors"
              style={{ color: LIME }}
              onMouseEnter={e => { e.currentTarget.style.color = LIME_HOVER; e.currentTarget.style.background = "rgba(197,214,0,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = LIME; e.currentTarget.style.background = "transparent"; }}
              data-testid="nav-join"
            >
              Find a League
            </Link>

            <Link
              to="/ladders"
              className="px-3 py-2 text-sm font-medium rounded-md transition-colors"
              style={isActive("/ladders") ? { background: NAVY_MID, color: "#fff", fontWeight: 600 } : { color: "rgba(255,255,255,0.55)" }}
              onMouseEnter={e => { if (!isActive("/ladders")) { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = NAVY_MID; } }}
              onMouseLeave={e => { if (!isActive("/ladders")) { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.background = "transparent"; } }}
              data-testid="nav-ladders"
            >
              Ladders
            </Link>

            <Link
              to="/rules"
              className="px-3 py-2 text-sm font-medium rounded-md transition-colors"
              style={isActive("/rules") ? { background: NAVY_MID, color: "#fff", fontWeight: 600 } : { color: "rgba(255,255,255,0.55)" }}
              onMouseEnter={e => { if (!isActive("/rules")) { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = NAVY_MID; } }}
              onMouseLeave={e => { if (!isActive("/rules")) { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.background = "transparent"; } }}
              data-testid="nav-rules"
            >
              Rules
            </Link>

            {user?.role === "admin" && (
              <Link
                to="/admin"
                className="px-3 py-2 text-sm font-medium rounded-md transition-colors"
                style={{ color: "rgba(255,255,255,0.55)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = NAVY_MID; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.background = "transparent"; }}
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
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                  style={{ color: "rgba(255,255,255,0.8)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = NAVY_MID; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  data-testid="nav-user-menu"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: LIME }}>
                    <span className="text-xs font-bold" style={{ color: NAVY }}>{user.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <span className="max-w-[120px] truncate">{user.name}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {userOpen && (
                  <div className="absolute top-full right-0 mt-1 w-52 bg-white border border-[#CDD5E4] rounded-xl shadow-lg p-2 z-50">
                    <div className="px-3 py-2 border-b border-[#CDD5E4] mb-1">
                      <p className="text-xs text-[#6B7A96]">Signed in as</p>
                      <p className="text-sm font-semibold text-[#0F1D38] truncate">{user.email}</p>
                    </div>
                    <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm text-[#2A3C58] hover:bg-[#EEF1F8] rounded-lg" data-testid="nav-dashboard">
                      <LayoutDashboard className="w-4 h-4" /> My Dashboard
                    </Link>
                    {user.role === "admin" && (
                      <Link to="/admin" className="flex items-center gap-2 px-3 py-2 text-sm text-[#2A3C58] hover:bg-[#EEF1F8] rounded-lg" data-testid="nav-admin-panel">
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
                <Link
                  to="/auth"
                  className="px-4 py-2 text-sm font-medium transition-colors"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
                  data-testid="nav-login"
                >
                  Log In
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="px-4 py-2 text-sm font-bold rounded-lg transition-colors"
                  style={{ background: LIME, color: NAVY }}
                  onMouseEnter={e => e.currentTarget.style.background = LIME_HOVER}
                  onMouseLeave={e => e.currentTarget.style.background = LIME}
                  data-testid="nav-register"
                >
                  Sign Up Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.8)" }}
            onMouseEnter={e => e.currentTarget.style.background = NAVY_MID}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="nav-mobile-toggle"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t px-4 py-4 space-y-2" style={{ background: NAVY_MID, borderColor: NAVY }}>
          <Link to="/join" className="block px-3 py-2 text-sm font-semibold rounded-lg" style={{ color: LIME }} data-testid="nav-join-mobile">
            Find a League
          </Link>
          {SPORTS.map((s) => (
            <Link
              key={s.id}
              to={`/sport/${s.id}`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ color: "rgba(255,255,255,0.75)" }}
              data-testid={`mobile-sport-${s.id}`}
            >
              <span>{s.icon}</span> {s.label}
            </Link>
          ))}
          <Link to="/ladders" className="block px-3 py-2 text-sm font-medium rounded-lg" style={{ color: "rgba(255,255,255,0.65)" }} data-testid="nav-ladders-mobile">Ladders</Link>
          <Link to="/rules" className="block px-3 py-2 text-sm font-medium rounded-lg" style={{ color: "rgba(255,255,255,0.65)" }} data-testid="nav-rules-mobile">Rules</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="block px-3 py-2 text-sm font-medium rounded-lg" style={{ color: "rgba(255,255,255,0.65)" }}>My Dashboard</Link>
              {user.role === "admin" && <Link to="/admin" className="block px-3 py-2 text-sm font-medium rounded-lg" style={{ color: "rgba(255,255,255,0.65)" }}>Admin Panel</Link>}
              <button onClick={handleLogout} className="block w-full text-left px-3 py-2 text-sm font-medium text-red-400 rounded-lg">Sign Out</button>
            </>
          ) : (
            <>
              <Link to="/auth" className="block px-3 py-2 text-sm font-medium rounded-lg" style={{ color: "rgba(255,255,255,0.65)" }}>Log In</Link>
              <Link
                to="/auth?mode=register"
                className="block px-3 py-2 text-sm font-bold rounded-lg text-center"
                style={{ background: LIME, color: NAVY }}
                data-testid="nav-register-mobile"
              >
                Sign Up Free
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
