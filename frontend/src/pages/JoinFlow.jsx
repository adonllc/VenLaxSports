import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { activeSports } from "../config/platformConfig";
import { ChevronRight, ChevronLeft, Users, Calendar, MapPin, Trophy } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LEAGUE_TYPES = [
  {
    id: "flex",
    label: "Flex League",
    icon: "🗓️",
    desc: "Schedule matches at your convenience. Play ~5 matches over 6 weeks. Self-paced.",
  },
  {
    id: "round_robin",
    label: "Round Robin",
    icon: "🔄",
    desc: "Every matchup pre-assigned a week. Auto-scheduled. No coordination needed.",
  },
];

const DIVISIONS = [
  { id: "singles", label: "Singles", icon: "👤", desc: "1 vs 1" },
  { id: "doubles", label: "Doubles", icon: "👥", desc: "2 vs 2" },
];

const STEPS = ["Sport", "Format", "Division", "Pick League"];

function ProgressBar({ step }) {
  return (
    <div className="flex items-center gap-1 mb-8 justify-center">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`h-1.5 rounded-full transition-[width,background-color] ${i <= step ? "bg-black w-8" : "bg-gray-200 w-5"}`} />
        </div>
      ))}
      <span className="text-xs text-gray-400 ml-2">{STEPS[step]}</span>
    </div>
  );
}

export default function JoinFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [sport, setSport] = useState("");
  const [leagueType, setLeagueType] = useState("");
  const [division, setDivision] = useState("");
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate("/auth?mode=register");
  }, [user, navigate]);

  useEffect(() => {
    if (step === 3 && sport && leagueType) {
      fetchLeagues();
    }
  }, [step]);

  const fetchLeagues = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sport, status: "registration", limit: "20" });
      if (division) params.set("format", division);
      const endpoint = leagueType === "round_robin" ? `${API}/round-robin?${params}` : `${API}/leagues?${params}`;
      const { data } = await axios.get(endpoint);
      setLeagues(data);
    } catch {
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-10 px-4" data-testid="join-flow-page">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600 mb-1">Find your league</p>
          <h1 className="font-heading font-black text-3xl text-gray-900">Let's get you competing</h1>
        </div>

        <ProgressBar step={step} />

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          {/* Step 0 — Sport */}
          {step === 0 && (
            <>
              <h2 className="font-heading font-bold text-xl text-gray-900 mb-6">Which sport?</h2>
              <div className="space-y-3 mb-8">
                {activeSports.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSport(s.id); setStep(1); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition text-left hover:border-gray-400 ${sport === s.id ? "border-black bg-gray-50" : "border-gray-200"}`}
                    data-testid={`pick-sport-${s.id}`}
                  >
                    <span className="text-3xl">{s.icon}</span>
                    <span className="font-semibold text-gray-900">{s.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 1 — League Type */}
          {step === 1 && (
            <>
              <h2 className="font-heading font-bold text-xl text-gray-900 mb-6">What format?</h2>
              <div className="space-y-3 mb-8">
                {LEAGUE_TYPES.map((lt) => (
                  <button
                    key={lt.id}
                    onClick={() => { setLeagueType(lt.id); setStep(2); }}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition text-left hover:border-gray-400 ${leagueType === lt.id ? "border-black bg-gray-50" : "border-gray-200"}`}
                    data-testid={`pick-type-${lt.id}`}
                  >
                    <span className="text-2xl mt-0.5">{lt.icon}</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{lt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{lt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={back} className="flex items-center gap-1 text-sm text-gray-500 hover:text-black transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </>
          )}

          {/* Step 2 — Division */}
          {step === 2 && (
            <>
              <h2 className="font-heading font-bold text-xl text-gray-900 mb-6">Singles or Doubles?</h2>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {DIVISIONS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { setDivision(d.id); setStep(3); }}
                    className={`flex flex-col items-center gap-2 p-6 rounded-xl border-2 transition hover:border-gray-400 ${division === d.id ? "border-black bg-gray-50" : "border-gray-200"}`}
                    data-testid={`pick-division-${d.id}`}
                  >
                    <span className="text-3xl">{d.icon}</span>
                    <p className="font-semibold text-gray-900 text-sm">{d.label}</p>
                    <p className="text-xs text-gray-400">{d.desc}</p>
                  </button>
                ))}
              </div>
              <button onClick={back} className="flex items-center gap-1 text-sm text-gray-500 hover:text-black transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </>
          )}

          {/* Step 3 — Pick League */}
          {step === 3 && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading font-bold text-xl text-gray-900">Choose a league</h2>
                <button onClick={back} className="flex items-center gap-1 text-sm text-gray-500 hover:text-black transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : leagues.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="font-semibold text-gray-700 mb-1">No leagues open right now</p>
                  <p className="text-sm text-gray-400">Check back soon — new seasons drop regularly.</p>
                  <button
                    onClick={() => navigate("/leagues")}
                    className="mt-4 text-sm font-semibold text-black underline"
                  >
                    Browse all leagues
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {leagues.map((lg) => {
                    const spotsLeft = (lg.rr_config?.max_players || lg.max_players) - (lg.current_players || 0);
                    const detailPath = leagueType === "round_robin" ? `/round-robin/${lg.id}` : `/leagues/${lg.id}`;
                    return (
                      <button
                        key={lg.id}
                        onClick={() => navigate(detailPath)}
                        className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-black hover:-translate-y-0.5 hover:shadow-md transition"
                        data-testid={`league-option-${lg.id}`}
                      >
                        <p className="font-semibold text-gray-900 text-sm mb-1">{lg.name}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lg.city}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{spotsLeft} spots left</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{lg.start_date}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
