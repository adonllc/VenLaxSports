import { useState, useEffect } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

// Fetches the logged-in player's own referral code so share links can
// carry it (?ref=CODE) and count as a referral when someone signs up.
export default function useReferralCode() {
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    axios
      .get(`${API}/referrals/me/referral-code`, { withCredentials: true })
      .then(({ data }) => setReferralCode(data.referral_code || ""))
      .catch(() => {});
  }, []);

  return referralCode;
}
