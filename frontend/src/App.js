import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import Rules from "./pages/Rules";
import Leagues from "./pages/Leagues";
import LeagueDetail from "./pages/LeagueDetail";
import RoundRobinLeagues from "./pages/RoundRobinLeagues";
import RoundRobinDetail from "./pages/RoundRobinDetail";
import RoundRobinInvite from "./pages/RoundRobinInvite";
import PlayerDashboard from "./pages/PlayerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import SportLanding from "./pages/SportLanding";
import ScoreReport from "./pages/ScoreReport";
import Standings from "./pages/Standings";
import Terms from "./pages/Terms";
import LeagueSpectator from "./pages/LeagueSpectator";
import CityLeaderboard from "./pages/CityLeaderboard";
import PublicProfile from "./pages/PublicProfile";
import VerifyEmail from "./pages/VerifyEmail";
import ProfileSetup from "./pages/ProfileSetup";
import JoinFlow from "./pages/JoinFlow";
import "./App.css";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function AppRouter() {
  const location = useLocation();
  // Synchronous check — process OAuth session_id BEFORE any protected route runs
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/sport/:sport" element={<SportLanding />} />
      <Route path="/leagues" element={<Leagues />} />
      <Route path="/leagues/round-robin" element={<RoundRobinLeagues />} />
      <Route path="/leagues/:id" element={<LeagueDetail />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/dashboard" element={<PlayerDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/matches/:id/score" element={<ScoreReport />} />
      <Route path="/leagues/:id/standings" element={<Standings />} />
      <Route path="/round-robin/invite/:token" element={<RoundRobinInvite />} />
      <Route path="/round-robin/:id" element={<RoundRobinDetail />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/leagues/:id/public" element={<LeagueSpectator />} />
      <Route path="/city/:city/sport/:sport" element={<CityLeaderboard />} />
      <Route path="/players/:id" element={<PublicProfile />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/profile-setup" element={<ProfileSetup />} />
      <Route path="/join" element={<JoinFlow />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-white flex flex-col font-body">
          <Navbar />
          <main className="flex-1">
            <AppRouter />
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
