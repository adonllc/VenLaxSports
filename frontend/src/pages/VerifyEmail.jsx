import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle, RefreshCw } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VerifyEmail() {
  const { user, fetchMe } = useAuth();
  const navigate = useNavigate();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const inputs = useRef([]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (user.email_verified) { navigate("/profile-setup"); }
  }, [user, navigate]);

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    setError("");
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      inputs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp = digits.join("");
    if (otp.length < 6) { setError("Enter the full 6-digit code"); return; }
    setLoading(true); setError("");
    try {
      await axios.post(`${API}/auth/verify-otp`, { otp }, { withCredentials: true });
      await fetchMe();
      navigate("/profile-setup");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true); setResent(false); setError("");
    try {
      await axios.post(`${API}/auth/send-otp`, {}, { withCredentials: true });
      setResent(true);
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } catch {
      setError("Could not resend code. Try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-gray-50" data-testid="verify-email-page">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <h1 className="font-heading font-black text-2xl text-gray-900 mb-2">Verify your email</h1>
          <p className="text-sm text-gray-500">
            We sent a 6-digit code to <strong className="text-gray-800">{user?.email}</strong>
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5" data-testid="otp-error">
            {error}
          </div>
        )}

        {resent && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-5">
            New code sent — check your inbox.
          </div>
        )}

        <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black transition-colors"
              data-testid={`otp-digit-${i}`}
              autoFocus={i === 0}
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || digits.some((d) => !d)}
          className="w-full py-3.5 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm mb-4"
          data-testid="verify-btn"
        >
          {loading ? "Verifying..." : "Verify Email"}
        </button>

        <button
          onClick={handleResend}
          disabled={resending}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-black transition-colors"
          data-testid="resend-btn"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
          {resending ? "Sending..." : "Resend code"}
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          <button onClick={() => navigate("/profile-setup")} className="underline hover:text-gray-600">
            Skip for now
          </button>
        </p>
      </div>
    </div>
  );
}
