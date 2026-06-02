import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { MapPin, Users, Calendar, Trophy, ArrowLeft, CheckCircle, AlertCircle, Clock, TrendingUp } from "lucide-react";
import PaymentMethodModal from "../components/PaymentMethodModal";
import PartnerSearch from "../components/PartnerSearch";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const SPORT_CONFIG = {
  tennis: { badge: "sport-badge-tennis", color: "text-tennis", accent: "#10B981", icon: "🎾", label: "Tennis" },
  cricket: { badge: "sport-badge-cricket", color: "text-cricket", accent: "#2563EB", icon: "🏏", label: "Cricket" },
  pickleball: { badge: "sport-badge-pickleball", color: "text-pickleball", accent: "#F97316", icon: "🏓", label: "Pickleball" },
};

export default function LeagueDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [league, setLeague] = useState(null);
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [doublesInviteToken, setDoublesInviteToken] = useState(null);
  const [doublesEmailInvite, setDoublesEmailInvite] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [boxStandings, setBoxStandings] = useState(null);
  const [activeBox, setActiveBox] = useState("A");

  // Check for payment session return
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    fetchLeague();
  }, [id]);

  useEffect(() => {
    if (sessionId && user) {
      pollPaymentStatus(sessionId);
    }
  }, [sessionId, user]);

  useEffect(() => {
    if (tab === "matches") fetchMatches();
    if (tab === "standings") fetchStandings();
  }, [tab]);


  const fetchLeague = async () => {
    try {
      const { data } = await axios.get(`${API}/leagues/${id}`, { withCredentials: true });
      setLeague(data);
      if (data.is_registered) setIsRegistered(true);
      if (data.league_type === "box_league") {
        axios.get(`${API}/box-leagues/${id}/standings`, { withCredentials: true })
          .then(({ data: boxData }) => {
            setBoxStandings(boxData);
            if (boxData.boxes?.length > 0) setActiveBox(boxData.boxes[0].box_id);
          })
          .catch(() => {});
      }
    } catch {
      navigate("/leagues");
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    try {
      const { data } = await axios.get(`${API}/leagues/${id}/matches`);
      setMatches(data);
    } catch (e) { console.error(e); }
  };

  const fetchStandings = async () => {
    try {
      const { data } = await axios.get(`${API}/leagues/${id}/standings`);
      setStandings(data);
    } catch (e) { console.error(e); }
  };

  const pollPaymentStatus = async (sid, attempts = 0) => {
    if (attempts >= 6) {
      setPaymentStatus({ status: "timeout" });
      return;
    }
    try {
      const { data } = await axios.get(`${API}/payments/status/${sid}`, { withCredentials: true });
      setPaymentStatus(data);
      if (data.payment_status === "paid") {
        if (data.invite_pending) {
          setJoinMsg("Payment complete! Invite sent — registration finalizes when your partner confirms.");
        } else {
          setIsRegistered(true);
          setJoinMsg("Payment successful! You have joined the league.");
          fetchLeague();
        }
        return;
      }
      if (data.status === "expired") return;
      setTimeout(() => pollPaymentStatus(sid, attempts + 1), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    setPromoResult(null);
    try {
      const { data } = await axios.get(
        `${API}/payments/promo/${promoCode.trim()}?league_id=${id}`,
        { withCredentials: true }
      );
      setPromoResult(data);
    } catch (err) {
      setPromoError(err.response?.data?.detail || "Invalid or expired promo code");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleDoublesJoin = async () => {
    if (!user) { navigate("/auth"); return; }
    setJoining(true);
    try {
      const body = { waiver_accepted: waiverAccepted };
      if (selectedPartner) {
        body.partner_id = selectedPartner.id;
      } else {
        body.partner_email = partnerEmail.trim().toLowerCase();
      }
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/leagues/${league.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Failed to register. Please try again.");
        return;
      }
      if (data.requires_payment) {
        setDoublesInviteToken(data.invite_token || null);
        if (data.pending_partner) setDoublesEmailInvite(true);
        if (data.invite_existed) {
          setJoinMsg("Resuming your pending team registration — complete payment to confirm your spot.");
        } else if (data.has_pending_invite) {
          setJoinMsg(`Pending invite found for ${data.partner_email}. Complete payment to confirm your spot.`);
        }
        setPaymentModalOpen(true);
      } else if (data.registered) {
        setIsRegistered(true);
        setJoinMsg("Team registered successfully!");
        fetchLeague();
      } else if (data.pending_partner) {
        setInviteSent(true);
        setInviteToken(data.invite_token || null);
      } else if (data.has_pending_invite) {
        setJoinMsg(`Pending invite already sent to ${data.partner_email}. Ask your partner to check their email.`);
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const requestPushNotificationAfterJoin = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      try {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          await registerPushSubscription();
        }
      } catch (e) {
        console.warn("Push permission request failed", e);
      }
    }
  };

  const registerPushSubscription = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const subJson = sub.toJSON();
      await axios.post(`${API}/notifications/push-subscription`, {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      }, { withCredentials: true });
    } catch (e) {
      console.warn("Push registration failed", e);
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
  };

  const handleJoin = async () => {
    if (!user) { navigate("/auth"); return; }
    setJoining(true);
    setJoinMsg("");
    try {
      // If a free-entry promo is validated, call checkout directly
      if (promoResult && promoResult.final_fee === 0) {
        const { data } = await axios.post(`${API}/payments/checkout`, {
          league_id: id,
          origin_url: window.location.origin,
          promo_code: promoCode.trim().toUpperCase(),
        }, { withCredentials: true });
        if (data.free) {
          setJoinMsg("Promo applied — you're registered!");
          setIsRegistered(true);
          fetchLeague();
          requestPushNotificationAfterJoin();
          return;
        }
      }
      const { data } = await axios.post(`${API}/leagues/${id}/join`, { waiver_accepted: waiverAccepted }, { withCredentials: true });
      if (data.requires_payment) {
        setPaymentModalOpen(true);
      } else {
        setJoinMsg(data.message || "Joined successfully!");
        setIsRegistered(true);
        fetchLeague();
        requestPushNotificationAfterJoin();
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setJoinMsg(typeof detail === "string" ? detail : "Failed to join league");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  if (!league) return null;

  const config = SPORT_CONFIG[league.sport] || {};
  const isFree = !league.entry_fee || league.entry_fee === 0;
  const spotsLeft = league.max_players - (league.current_players || 0);
  const fillPct = Math.round(((league.current_players || 0) / league.max_players) * 100);
  const SPORT_HEADER_BG = { tennis: "bg-tennis-bg", pickleball: "bg-pickleball-bg", cricket: "bg-cricket-bg" };
  const headerBg = SPORT_HEADER_BG[league.sport] || "bg-white";

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "players", label: "Players" },
    { id: "matches", label: "Matches" },
    { id: "standings", label: "Standings" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }} data-testid="league-detail-page">
      {/* Header Banner */}
      <div className={`${headerBg}`} style={{ borderBottom: "1px solid #E5E7EB" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button onClick={() => navigate("/leagues")} className="flex items-center gap-1.5 text-sm mb-5 transition-colors" style={{ color: "#6B7280" }} data-testid="back-to-leagues">
            <ArrowLeft className="w-4 h-4" /> Back to Leagues
          </button>

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${config.badge}`}>
                  {config.icon} {config.label}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={league.status === "registration" ? { background: "#FAE0D5", color: "#C24A1D" } : { background: "#F3F4F6", color: "#6B7280" }}>
                  {league.status?.charAt(0).toUpperCase() + league.status?.slice(1)}
                </span>
                {league.format === "mixed_doubles" && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium" style={{ background: "#EDF7F3", color: "#065F46", border: "1px solid #0B6E4F" }}>
                    Mixed Doubles
                  </span>
                )}
                {isRegistered && (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#C24A1D", color: "white" }} data-testid="registered-pill">
                    <CheckCircle className="w-3 h-3" /> Registered
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h1 className="font-heading font-semibold text-lg" style={{ color: "#111827" }}>{league.name}</h1>
                {league.division_label && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium" style={{ background: "#F3F4F6", color: "#C24A1D", border: "1px solid #E5E7EB" }} data-testid="league-division-badge">
                    {league.division_label}
                    {league.division_ntrp_min && (
                      <span className="ml-1 font-normal" style={{ color: "#6B7280" }}>
                        {league.division_ntrp_min}–{league.division_ntrp_max || "+"}{" "}
                        {league.sport === "pickleball" ? "DUPR" : "NTRP"}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: "#6B7280" }}>
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {league.city}</span>
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {formatDate(league.start_date)} to {formatDate(league.end_date)}</span>
                <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {league.current_players || 0}/{league.max_players} players</span>
              </div>
            </div>

            {/* Join Card */}
            <div className="bg-white rounded-2xl p-5 w-full lg:w-auto lg:min-w-[240px]" style={{ border: "1px solid #E5E7EB" }}>
              {(league.status === "completed" || league.status === "cancelled") ? (
                <div className="text-center py-4">
                  <Trophy className="w-8 h-8 mx-auto mb-2" style={{ color: "#E5E7EB" }} />
                  <p className="font-semibold text-sm" style={{ color: "#374151" }}>Season Ended</p>
                  <p className="text-xs mt-1" style={{ color: "#6B7280" }}>This league is no longer active.</p>
                </div>
              ) : (
                <>
                  {/* Spots bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1" style={{ color: "#6B7280" }}>
                      <span>{spotsLeft} spots remaining</span>
                      <span>{fillPct}% filled</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                      <div className="h-full rounded-full transition-[width]" style={{ width: `${fillPct}%`, background: "#C24A1D" }} />
                    </div>
                  </div>

                  {/* Payment/join status */}
                  {sessionId && !paymentStatus && (
                    <div className="flex items-center gap-2 text-sm mb-3 justify-center" style={{ color: "#374151" }}>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: "#C24A1D" }} />
                      Checking payment...
                    </div>
                  )}

                  {paymentStatus?.payment_status === "paid" && (
                    <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2 mb-3" style={{ color: "#C24A1D", background: "#FAE0D5", border: "1px solid #E5A885" }}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0" /> Payment confirmed!
                    </div>
                  )}

                  {joinMsg && (
                    <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2 mb-3" style={joinMsg.includes("success") || joinMsg.includes("joined") ? { background: "#FAE0D5", color: "#C24A1D", border: "1px solid #E5A885" } : { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }} data-testid="join-message">
                      {joinMsg.includes("success") || joinMsg.includes("joined") ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {joinMsg}
                    </div>
                  )}

                  {!isRegistered && league.status === "registration" && (
                    <>
                      {league.format === "doubles" ? (
                        /* Doubles registration flow */
                        <>
                          {!inviteSent ? (
                            <div className="space-y-3">
                              <PartnerSearch
                                onPartnerSelect={(p) => { setSelectedPartner(p); setPartnerEmail(""); }}
                                onEmailChange={(e) => { setPartnerEmail(e); setSelectedPartner(null); }}
                              />
                              {league.format === "mixed_doubles" && (
                                <p className="text-xs text-gray-400 mt-2">
                                  Mixed Doubles requires one male and one female player. Gender shown as (M) or (F) in search results.
                                </p>
                              )}
                              <label className="flex items-start gap-2.5 cursor-pointer bg-amber-50 border border-amber-200 rounded-xl px-3 py-3" data-testid="waiver-checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={waiverAccepted}
                                  onChange={(e) => setWaiverAccepted(e.target.checked)}
                                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-black flex-shrink-0"
                                  data-testid="waiver-checkbox"
                                />
                                <span className="text-[11px] text-amber-900 leading-relaxed">
                                  I accept the{" "}
                                  <a href="/rules" className="underline font-semibold hover:text-amber-700">
                                    rules and waiver
                                  </a>
                                </span>
                              </label>
                              <button
                                onClick={handleDoublesJoin}
                                disabled={(!selectedPartner && !partnerEmail) || !waiverAccepted || joining}
                                className="w-full text-white rounded-md py-2 text-sm font-medium disabled:opacity-50 transition-colors"
                                style={{ background: "#1B2B4B" }}
                                data-testid="send-doubles-invite-btn"
                              >
                                {joining
                                  ? "Registering…"
                                  : selectedPartner
                                  ? `Register Team with ${selectedPartner.name}`
                                  : "Send Partner Invite"}
                              </button>
                            </div>
                          ) : (
                            <div className="rounded-md p-4 space-y-2" style={{ background: "#FAE0D5", border: "1px solid #E5A885" }}>
                              <p className="text-sm font-medium" style={{ color: "#C24A1D" }}>
                                Invite sent to {partnerEmail}
                              </p>
                              <p className="text-xs" style={{ color: "#374151" }}>
                                Registration completes once your partner confirms. Invite expires in 72 hours.
                              </p>
                              {inviteToken && (
                                <div className="mt-2">
                                  <p className="text-xs mb-1" style={{ color: "#6B7280" }}>Share confirm link directly:</p>
                                  <div className="flex gap-2 items-center">
                                    <input
                                      readOnly
                                      value={`${window.location.origin}/doubles-invite/confirm?token=${inviteToken}`}
                                      className="flex-1 text-xs rounded px-2 py-1 bg-white" style={{ border: "1px solid #E5E7EB" }}
                                    />
                                    <button
                                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/doubles-invite/confirm?token=${inviteToken}`)}
                                      className="text-xs rounded px-2 py-1 transition-colors" style={{ color: "#C24A1D", border: "1px solid #E5A885" }}
                                    >
                                      Copy
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        /* Singles registration flow */
                        <>
                          {/* Waiver checkbox — required for all leagues, free or paid */}
                          <label className="flex items-start gap-2.5 cursor-pointer mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-3" data-testid="waiver-checkbox-label">
                            <input
                              type="checkbox"
                              checked={waiverAccepted}
                              onChange={(e) => setWaiverAccepted(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-black flex-shrink-0"
                              data-testid="waiver-checkbox"
                            />
                            <span className="text-[11px] text-amber-900 leading-relaxed">
                              I have read and agree to the{" "}
                              <a href="/terms#waiver" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-amber-700">
                                Liability Waiver & Assumption of Risk
                              </a>
                              . I understand that matches are unsupervised, courts are player-selected, and I participate at my own risk.
                            </span>
                          </label>
                          {/* Promo code input — only for paid leagues */}
                          {!isFree && (
                            <div className="mb-3">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={promoCode}
                                  onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); setPromoError(""); }}
                                  placeholder="Promo code"
                                  className="flex-1 px-3 py-2 text-xs rounded-lg focus:outline-none uppercase font-mono bg-white" style={{ border: "1px solid #E5E7EB", color: "#111827" }}
                                  data-testid="promo-code-input"
                                />
                                <button
                                  onClick={validatePromo}
                                  disabled={promoLoading || !promoCode.trim()}
                                  className="px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: "#1B2B4B" }}
                                  data-testid="apply-promo-btn"
                                >
                                  {promoLoading ? "..." : "Apply"}
                                </button>
                              </div>
                              {promoResult && (
                                <p className="text-xs font-semibold mt-1.5" style={{ color: "#C24A1D" }} data-testid="promo-success">
                                  ✓ {promoResult.final_fee === 0 ? "Free entry applied!" : `Save $${promoResult.savings.toFixed(2)} — $${promoResult.final_fee.toFixed(2)} total`}
                                </p>
                              )}
                              {promoError && (
                                <p className="text-xs text-red-600 mt-1.5" data-testid="promo-error">{promoError}</p>
                              )}
                            </div>
                          )}
                          <button
                            onClick={handleJoin}
                            disabled={joining || spotsLeft <= 0 || !waiverAccepted}
                            className="w-full py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm" style={{ background: "#1B2B4B" }}
                            data-testid="join-league-btn"
                          >
                            {joining ? "Processing..." : spotsLeft <= 0 ? "League Full" : (promoResult && promoResult.final_fee === 0) ? "Join Free" : isFree ? "Join Free" : "Register Now"}
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {isRegistered && (
                    <div className="rounded-xl px-4 py-4 text-center" style={{ background: "#FAE0D5", border: "1px solid #E5A885" }} data-testid="registered-badge">
                      <CheckCircle className="w-6 h-6 mx-auto mb-1.5" style={{ color: "#C24A1D" }} />
                      <p className="font-bold text-sm" style={{ color: "#111827" }}>You're registered</p>
                      <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>Check your email for details.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white" style={{ borderBottom: "1px solid #E5E7EB" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-5 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap"
                style={tab === t.id ? { borderColor: "#C24A1D", color: "#C24A1D" } : { borderColor: "transparent", color: "#6B7280" }}
                data-testid={`tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tab === "overview" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E5E7EB" }}>
              <h3 className="font-heading font-bold text-lg mb-4" style={{ color: "#111827" }}>League Details</h3>
              <dl className="space-y-3">
                {[
                  ["Sport", `${config.icon} ${config.label}`],
                  ["Format", league.format?.charAt(0).toUpperCase() + league.format?.slice(1)],
                  ["Season", league.season],
                  ["Venue", league.venue || "TBD"],
                  ["City", league.city],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-sm" style={{ color: "#6B7280" }}>{k}</dt>
                    <dd className="text-sm font-medium text-right" style={{ color: "#111827" }}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E5E7EB" }}>
              <h3 className="font-heading font-bold text-lg mb-4" style={{ color: "#111827" }}>About This League</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{league.description || "No description provided."}</p>
              {league.rules && (
                <div className="mt-4 p-3 rounded-xl" style={{ background: "#FFFFFF" }}>
                  <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "#374151" }}>Rules</p>
                  <p className="text-sm" style={{ color: "#374151" }}>{league.rules}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "players" && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
            <div className="p-5" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <h3 className="font-heading font-bold text-lg">Registered Players</h3>
            </div>
            <div className="text-center py-16 px-6">
              <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "#E5E7EB" }} />
              <p className="font-semibold mb-1" style={{ color: "#374151" }}>Player roster is private</p>
              <p className="text-sm" style={{ color: "#6B7280" }}>Roster is not publicly visible.</p>
            </div>
          </div>
        )}

        {tab === "matches" && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-heading font-bold text-lg" style={{ color: "#111827" }}>Matches ({matches.length})</h3>
              {user && (
                <Link to="/dashboard" className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors" style={{ color: "#1B2B4B", border: "1px solid #1B2B4B" }} data-testid="schedule-match-link">
                  Schedule Match
                </Link>
              )}
            </div>
            {matches.length === 0 ? (
              <div className="text-center py-12" style={{ color: "#6B7280" }}>No matches scheduled yet</div>
            ) : (
              <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                {matches.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-5 py-4 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "#111827" }}>{m.player1_name} vs {m.player2_name}</p>
                      <p className="text-xs" style={{ color: "#6B7280" }}>{m.scheduled_date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.status === "completed" && m.winner_name && (
                        <span className="text-xs font-medium" style={{ color: "#C24A1D" }}>{m.winner_name} won</span>
                      )}
                      <span className="text-xs px-2 py-1 rounded-full" style={m.status === "completed" ? { background: "#F3F4F6", color: "#6B7280" } : m.status === "scheduled" ? { background: "#EDF7F3", color: "#065F46" } : { background: "#F3F4F6", color: "#6B7280" }}>
                        {m.status}
                      </span>
                      {user && m.status === "scheduled" && (user._id === m.player1_id || user.id === m.player1_id || user._id === m.player2_id || user.id === m.player2_id) && (
                        <Link to={`/matches/${m.id}/score`} className="text-xs font-semibold text-white px-2.5 py-1 rounded-lg transition-colors" style={{ background: "#1B2B4B" }} data-testid={`report-score-${m.id}`}>
                          Report Score
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "standings" && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
            <div className="p-5" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <h3 className="font-heading font-bold text-lg">Standings</h3>
            </div>
            {standings.length === 0 ? (
              <div className="text-center py-12" style={{ color: "#6B7280" }}>No standings yet — matches haven't been played</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#FFFFFF", borderBottom: "1px solid #F3F4F6" }}>
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>#</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Player</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>W</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>L</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>MP</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                    {standings.map((s, i) => (
                      <tr key={i} style={i === 0 ? { background: "#FFFFFF" } : {}}>
                        <td className="px-5 py-3 font-heading font-bold" style={{ color: "#E5E7EB" }}>{i + 1}</td>
                        <td className="px-5 py-3 font-medium" style={{ color: "#111827" }}>
                          {i === 0 && <Trophy className="inline w-3.5 h-3.5 mr-1" style={{ color: "#C24A1D" }} />}
                          {s.player_name}
                        </td>
                        <td className="px-3 py-3 text-center font-semibold" style={{ color: "#C24A1D" }}>{s.wins}</td>
                        <td className="px-3 py-3 text-center text-red-600">{s.losses}</td>
                        <td className="px-3 py-3 text-center" style={{ color: "#6B7280" }}>{s.matches_played}</td>
                        <td className="px-3 py-3 text-center font-heading font-bold" style={{ color: "#111827" }}>{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {league?.league_type === "box_league" && boxStandings && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#111827" }}>Box Standings</h3>
            {/* Box tab pills */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {boxStandings.boxes.map((box) => (
                <button
                  key={box.box_id}
                  data-testid={`box-tab-${box.box_id}`}
                  onClick={() => setActiveBox(box.box_id)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium border transition-colors"
                  style={activeBox === box.box_id
                    ? { background: "#1B2B4B", color: "white", borderColor: "#1B2B4B" }
                    : { background: "white", color: "#374151", borderColor: "#E5E7EB" }}
                >
                  Box {box.box_id}
                </button>
              ))}
            </div>

            {/* Active box standings table */}
            {boxStandings.boxes.filter((b) => b.box_id === activeBox).map((box) => (
              <div key={box.box_id} className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
                <table className="w-full text-sm">
                  <thead style={{ background: "#FFFFFF", borderBottom: "1px solid #F3F4F6" }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "#6B7280" }}>Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "#6B7280" }}>Player</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: "#6B7280" }}>W</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: "#6B7280" }}>L</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase" style={{ color: "#6B7280" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                    {box.players.map((p, idx) => {
                      const isPromote = idx < boxStandings.box_promote;
                      const isRelegate = idx >= box.players.length - boxStandings.box_relegate;
                      return (
                        <tr key={p.player_id} style={isPromote ? { background: "#FAE0D5" } : isRelegate ? { background: "#FEF2F2" } : {}}>
                          <td className="px-4 py-3 font-semibold" style={{ color: "#6B7280" }}>#{p.rank}</td>
                          <td className="px-4 py-3 font-medium" style={{ color: "#111827" }}>{p.name}</td>
                          <td className="px-4 py-3 text-center" style={{ color: "#374151" }}>{p.wins}</td>
                          <td className="px-4 py-3 text-center" style={{ color: "#374151" }}>{p.losses}</td>
                          <td className="px-4 py-3 text-right">
                            {isPromote && <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ color: "#C24A1D", background: "#FAE0D5" }}>Promoting ↑</span>}
                            {isRelegate && <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">Relegating ↓</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      <PaymentMethodModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        league={league}
        promoCode={promoResult ? promoCode.trim().toUpperCase() : undefined}
        inviteToken={doublesInviteToken}
        onSuccess={() => {
          if (doublesEmailInvite) {
            setInviteSent(true);
            setInviteToken(doublesInviteToken);
            setDoublesEmailInvite(false);
          } else {
            setIsRegistered(true);
            fetchLeague();
            setJoinMsg("Registration complete!");
            requestPushNotificationAfterJoin();
          }
          setPaymentModalOpen(false);
        }}
      />
    </div>
  );
}
