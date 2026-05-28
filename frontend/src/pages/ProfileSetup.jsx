import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle, ChevronRight } from "lucide-react";
import { activeSports } from "../config/platformConfig";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SKILL_LEVELS = [
  { value: "2.0", label: "2.0", desc: "Beginner" },
  { value: "2.5", label: "2.5", desc: "Beginner+" },
  { value: "3.0", label: "3.0", desc: "Intermediate" },
  { value: "3.5", label: "3.5", desc: "Intermediate+" },
  { value: "4.0", label: "4.0", desc: "Adv. Intermediate" },
  { value: "4.5", label: "4.5", desc: "Advanced" },
  { value: "5.0", label: "5.0", desc: "Expert" },
  { value: "5.5", label: "5.5", desc: "Expert+" },
  { value: "6.0+", label: "6.0+", desc: "Open / Pro" },
];

const STEPS = ["Sports", "Skill Level", "Home Court"];

export default function ProfileSetup() {
  const { user, fetchMe } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sport_preferences: user?.sport_preferences || [],
    skill_level: user?.skill_level || "",
    home_court: user?.home_court || "",
    city: user?.city || "",
  });

  const toggleSport = (id) =>
    setForm((f) => ({
      ...f,
      sport_preferences: f.sport_preferences.includes(id)
        ? f.sport_preferences.filter((s) => s !== id)
        : [...f.sport_preferences, id],
    }));

  const handleFinish = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/users/me/setup`, form, { withCredentials: true });
      await fetchMe();
      navigate("/dashboard");
    } catch (e) {
      console.error(e);
      navigate("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-gray-50" data-testid="profile-setup-page">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-[#1B2B4B] text-white" : "bg-gray-200 text-gray-500"}`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-gray-900" : "text-gray-400"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`w-8 h-px ${i < step ? "bg-emerald-400" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          {/* Step 0: Sports */}
          {step === 0 && (
            <>
              <h2 className="font-heading font-black text-2xl text-gray-900 mb-2">Which sports do you play?</h2>
              <p className="text-sm text-gray-500 mb-6">Select all that apply — you can change this later.</p>
              <div className="space-y-3 mb-8">
                {activeSports.map((s) => {
                  const selected = form.sport_preferences.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSport(s.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition text-left ${selected ? "border-[#1B2B4B] bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}
                      data-testid={`sport-${s.id}`}
                    >
                      <span className="text-2xl">{s.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{s.label}</p>
                      </div>
                      {selected && <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3.5 bg-[#1B2B4B] text-white font-semibold rounded-xl hover:bg-[#142040] transition-colors text-sm flex items-center justify-center gap-2"
                data-testid="next-step-1"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Step 1: Skill Level */}
          {step === 1 && (
            <>
              <h2 className="font-heading font-black text-2xl text-gray-900 mb-2">What's your skill level?</h2>
              <p className="text-sm text-gray-500 mb-6">USTA / USAPA rating. Helps us match you to the right league.</p>
              <div className="grid grid-cols-3 gap-2 mb-8">
                {SKILL_LEVELS.map((sl) => (
                  <button
                    key={sl.value}
                    onClick={() => setForm((f) => ({ ...f, skill_level: sl.value }))}
                    className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 transition ${form.skill_level === sl.value ? "border-[#1B2B4B] bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}
                    data-testid={`skill-${sl.value}`}
                  >
                    <span className="font-heading font-black text-lg text-gray-900">{sl.label}</span>
                    <span className="text-[10px] text-gray-500 mt-0.5 text-center leading-tight">{sl.desc}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="flex-1 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Back
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3.5 bg-[#1B2B4B] text-white font-semibold rounded-xl hover:bg-[#142040] transition-colors text-sm flex items-center justify-center gap-2"
                  data-testid="next-step-2"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* Step 2: Home Court */}
          {step === 2 && (
            <>
              <h2 className="font-heading font-black text-2xl text-gray-900 mb-2">Where do you usually play?</h2>
              <p className="text-sm text-gray-500 mb-6">Your preferred facility or court name — helps with match scheduling.</p>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Home Court / Facility</label>
                  <input
                    type="text"
                    value={form.home_court}
                    onChange={(e) => setForm((f) => ({ ...f, home_court: e.target.value }))}
                    placeholder="e.g. Westside Tennis Club, Central Park Courts"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    data-testid="input-home-court"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Your city"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    data-testid="input-city-setup"
                    autoComplete="address-level2"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-1 py-3.5 bg-[#1B2B4B] text-white font-semibold rounded-xl hover:bg-[#142040] transition-colors disabled:opacity-60 text-sm"
                  data-testid="finish-setup-btn"
                >
                  {saving ? "Saving..." : "Go to Dashboard"}
                </button>
              </div>
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4"
              >
                Skip for now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
