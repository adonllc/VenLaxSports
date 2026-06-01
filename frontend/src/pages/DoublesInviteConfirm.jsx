import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function DoublesInviteConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [state, setState] = useState("loading"); // "loading" | "pending" | "accepted" | "declined" | "expired" | "error"
  const [inviteData, setInviteData] = useState(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("Invalid invite link — no token found.");
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/doubles-invite/status?token=${token}`,
          { credentials: "include" }
        );
        if (res.status === 404) {
          setState("error");
          setErrorMsg("This invite link is invalid or does not exist.");
          return;
        }
        if (res.status === 410) {
          setState("expired");
          return;
        }
        const data = await res.json();
        if (data.already_accepted) {
          setState("accepted");
          return;
        }
        if (data.declined) {
          setState("declined");
          return;
        }
        if (data.pending) {
          setInviteData(data);
          if (!data.is_logged_in) {
            // Save token, redirect to register
            localStorage.setItem("doubles_invite_token", token);
            navigate(`/auth?mode=register&invite_token=${token}`);
            return;
          }
          setState("pending");
        }
      } catch (err) {
        setState("error");
        setErrorMsg("Network error. Please try again.");
      }
    };

    checkStatus();
  }, [token, navigate]);

  const handleAction = async (action) => {
    if (action === "accept" && !waiverAccepted) {
      setErrorMsg("Please accept the rules and waiver to confirm.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/doubles-invite/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token, action, waiver_accepted: waiverAccepted }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.detail || "Something went wrong. Please try again.");
        return;
      }
      if (action === "decline") {
        setState("declined");
      } else if (data.requires_payment && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setState("accepted");
      }
    } catch (err) {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Loading invite...</p>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">&#128336;</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invite Expired</h1>
          <p className="text-sm text-gray-600">This invite link expired after 72 hours. Ask your partner to send a new invite.</p>
        </div>
      </div>
    );
  }

  if (state === "accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">You're Registered!</h1>
          <p className="text-sm text-gray-600 mb-4">
            {inviteData
              ? `You and ${inviteData.initiator_name} are confirmed for ${inviteData.league_name}.`
              : "Both partners are confirmed for the league."}
          </p>
          <button
            onClick={() => navigate("/")}
            className="bg-[#1B2B4B] text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-[#142040] transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (state === "declined") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">&#10007;</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invite Declined</h1>
          <p className="text-sm text-gray-600">The invite has been declined. Your partner has been notified.</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">&#9888;</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invite</h1>
          <p className="text-sm text-gray-600">{errorMsg || "This invite link is invalid."}</p>
        </div>
      </div>
    );
  }

  // state === "pending"
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Doubles Partner Invite</h1>
        {inviteData && (
          <p className="text-sm text-gray-600 mb-6">
            <span className="font-medium">{inviteData.initiator_name}</span> invited you to join{" "}
            <span className="font-medium">{inviteData.league_name}</span> as their doubles partner.
          </p>
        )}

        <div className="flex items-start gap-2 mb-6">
          <input
            type="checkbox"
            id="waiver-confirm"
            checked={waiverAccepted}
            onChange={(e) => setWaiverAccepted(e.target.checked)}
            className="mt-0.5"
            data-testid="waiver-checkbox-confirm"
          />
          <label htmlFor="waiver-confirm" className="text-xs text-gray-600">
            I accept the{" "}
            <a href="/rules" className="text-emerald-600 underline">
              rules and waiver
            </a>{" "}
            and confirm my participation as a doubles partner.
          </label>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-600 mb-3">{errorMsg}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleAction("accept")}
            disabled={submitting || !waiverAccepted}
            className="flex-1 bg-[#1B2B4B] text-white rounded-md py-2 text-sm font-medium disabled:opacity-50 hover:bg-[#142040] transition-colors"
            data-testid="accept-btn"
          >
            {submitting ? "Confirming..." : "Accept & Join"}
          </button>
          <button
            onClick={() => handleAction("decline")}
            disabled={submitting}
            className="flex-1 border border-gray-200 text-gray-700 rounded-md py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            data-testid="decline-btn"
          >
            Decline
          </button>
        </div>

        {inviteData?.expires_at && (
          <p className="text-xs text-gray-400 mt-4 text-center">
            Invite expires {new Date(inviteData.expires_at).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
