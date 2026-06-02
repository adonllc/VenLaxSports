import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import "./App.css";
import ConsentBanner from "./components/ConsentBanner";

// Eagerly loaded — always needed on first paint
import Home from "./pages/Home";
import PreLaunch from "./pages/PreLaunch";

// Route-split — loaded only when navigated to
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Rules = lazy(() => import("./pages/Rules"));
const Leagues = lazy(() => import("./pages/Leagues"));
const LeagueDetail = lazy(() => import("./pages/LeagueDetail"));
const RoundRobinLeagues = lazy(() => import("./pages/RoundRobinLeagues"));
const RoundRobinDetail = lazy(() => import("./pages/RoundRobinDetail"));
const RoundRobinInvite = lazy(() => import("./pages/RoundRobinInvite"));
const PlayerDashboard = lazy(() => import("./pages/PlayerDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const SportLanding = lazy(() => import("./pages/SportLanding"));
const ScoreReport = lazy(() => import("./pages/ScoreReport"));
const Standings = lazy(() => import("./pages/Standings"));
const Terms = lazy(() => import("./pages/Terms"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const LeagueSpectator = lazy(() => import("./pages/LeagueSpectator"));
const CityLeaderboard = lazy(() => import("./pages/CityLeaderboard"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const JoinFlow = lazy(() => import("./pages/JoinFlow"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
const DoublesInviteConfirm = lazy(() => import("./pages/DoublesInviteConfirm"));
const Ladders = lazy(() => import("./pages/Ladders"));
const LadderDetail = lazy(() => import("./pages/LadderDetail"));

const IS_PRELAUNCH = import.meta.env.VITE_PRELAUNCH === "true";
const IS_LAUNCH_LIVE = import.meta.env.VITE_LAUNCH_LIVE === "true";

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
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
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/leagues/:id/public" element={<LeagueSpectator />} />
        <Route path="/city/:city/sport/:sport" element={<CityLeaderboard />} />
        <Route path="/players/:id" element={<PublicProfile />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/profile-setup" element={<ProfileSetup />} />
        <Route path="/join" element={<JoinFlow />} />
        <Route path="/auth/callback" element={<OAuthCallback />} />
        <Route path="/doubles-invite/confirm" element={<DoublesInviteConfirm />} />
        <Route path="/ladders" element={<Ladders />} />
        <Route path="/ladders/:id" element={<LadderDetail />} />
      </Routes>
    </Suspense>
  );
}

function AppShell() {
  const location = useLocation();
  if (IS_PRELAUNCH && !IS_LAUNCH_LIVE && location.pathname === "/") {
    return <PreLaunch />;
  }
  return (
    <div className="min-h-screen bg-[var(--vl-bg)] flex flex-col font-body">
      <Navbar />
      <main className="flex-1">
        <AppRouter />
      </main>
      <Footer />
      <ConsentBanner />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
