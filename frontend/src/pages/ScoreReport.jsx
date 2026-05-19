import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, CheckCircle, AlertCircle, Trophy, Clock } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_CONFIG = {
  tennis: {
    label: "Tennis",
    accentClass: "bg-emerald-500",
    ringClass: "ring-emerald-500",
    textClass: "text-emerald-600",
  },
  cricket: {
    label: "Cricket",
    accentClass: "bg-blue-600",
    ringClass: "ring-blue-600",
    textClass: "text-blue-600",
  },
  pickleball: {
    label: "Pickleball",
    accentClass: "bg-orange-500",
    ringClass: "ring-orange-500",
    textClass: "text-orange-500",
  },
};

function buildScoreSummary(sport, scoreData, p1Name, p2Name) {
  if (sport === "tennis") {
    const sets = [];
    let p1Sets = 0;
    let p2Sets = 0;
    for (let i = 1; i <= 3; i++) {
      const a = scoreData[`set${i}_p1`];
      const b = scoreData[`set${i}_p2`];
      if (a !== "" && a !== undefined && b !== "" && b !== undefined) {
        const n1 = parseInt(a, 10);
        const n2 = parseInt(b, 10);
        if (!isNaN(n1) && !isNaN(n2)) {
          sets.push(`${n1}-${n2}`);
          if (n1 > n2) p1Sets++;
          else if (n2 > n1) p2Sets++;
        }
      }
    }
    if (sets.length === 0) return null;
    const inferredWinner = p1Sets > p2Sets ? "p1" : p2Sets > p1Sets ? "p2" : null;
    return { scoreStr: sets.join(", "), p1Sets, p2Sets, inferredWinner };
  }

  if (sport === "pickleball") {
    const games = [];
    let p1Games = 0;
    let p2Games = 0;
    for (let i = 1; i <= 3; i++) {
      const a = scoreData[`game${i}_p1`];
      const b = scoreData[`game${i}_p2`];
      if (a !== "" && a !== undefined && b !== "" && b !== undefined) {
        const n1 = parseInt(a, 10);
        const n2 = parseInt(b, 10);
        if (!isNaN(n1) && !isNaN(n2)) {
          games.push(`${n1}-${n2}`);
          if (n1 > n2) p1Games++;
          else if (n2 > n1) p2Games++;
        }
      }
    }
    if (games.length === 0) return null;
    const inferredWinner = p1Games > p2Games ? "p1" : p2Games > p1Games ? "p2" : null;
    return { scoreStr: games.join(", "), p1Sets: p1Games, p2Sets: p2Games, inferredWinner };
  }

  if (sport === "cricket") {
    const p1r = scoreData.p1_runs;
    const p2r = scoreData.p2_runs;
    if (!p1r && !p2r) return null;
    const fmt = (prefix, name) =>
      scoreData[`${prefix}_runs`]
        ? `${name}: ${scoreData[`${prefix}_runs`]}/${scoreData[`${prefix}_wickets`] || 0} (${scoreData[`${prefix}_overs`] || "0"})`
        : null;
    const parts = [fmt("p1", p1Name), fmt("p2", p2Name)].filter(Boolean);
    return { scoreStr: parts.join(" · "), inferredWinner: null };
  }

  return null;
}

export default function ScoreReport() {
  const { id: matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scoreData, setScoreData] = useState({});
  const [winnerId, setWinnerId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [retired, setRetired] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    fetchMatch();
  }, [matchId, user]);

  const fetchMatch = async () => {
    try {
      const { data } = await axios.get(`${API}/matches/${matchId}`, { withCredentials: true });
      setMatch(data);
    } catch {
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const updateScore = (key, val) => setScoreData((s) => ({ ...s, [key]: val }));

  // Set 3 activates only when Sets 1+2 have scores (prevents phantom entries)
  const set3Enabled = useMemo(() => {
    if (!match || match.sport !== "tennis") return true;
    return (
      scoreData.set1_p1 !== "" && scoreData.set1_p1 !== undefined &&
      scoreData.set1_p2 !== "" && scoreData.set1_p2 !== undefined &&
      scoreData.set2_p1 !== "" && scoreData.set2_p1 !== undefined &&
      scoreData.set2_p2 !== "" && scoreData.set2_p2 !== undefined
    );
  }, [scoreData.set1_p1, scoreData.set1_p2, scoreData.set2_p1, scoreData.set2_p2, match]);

  // Game 3 activates only when Games 1+2 have scores
  const game3Enabled = useMemo(() => {
    if (!match || match.sport !== "pickleball") return true;
    return (
      scoreData.game1_p1 !== "" && scoreData.game1_p1 !== undefined &&
      scoreData.game1_p2 !== "" && scoreData.game1_p2 !== undefined &&
      scoreData.game2_p1 !== "" && scoreData.game2_p1 !== undefined &&
      scoreData.game2_p2 !== "" && scoreData.game2_p2 !== undefined
    );
  }, [scoreData.game1_p1, scoreData.game1_p2, scoreData.game2_p1, scoreData.game2_p2, match]);

  const scoreSummary = useMemo(() => {
    if (!match || retired) return null;
    return buildScoreSummary(match.sport, scoreData, match.player1_name, match.player2_name);
  }, [scoreData, match, retired]);

  const winnerMismatch = useMemo(() => {
    if (!scoreSummary?.inferredWinner || !winnerId || !match) return false;
    const selectedIsP1 = winnerId === match.player1_id;
    return (
      (scoreSummary.inferredWinner === "p1" && !selectedIsP1) ||
      (scoreSummary.inferredWinner === "p2" && selectedIsP1)
    );
  }, [scoreSummary, winnerId, match]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!winnerId) { setMsg("Please select the winner"); return; }
    setSubmitting(true);
    setMsg("");
    const finalScoreData = retired
      ? { retired: true, notes: scoreData.notes || "" }
      : scoreData;
    try {
      await axios.post(
        `${API}/matches/${matchId}/score`,
        { winner_id: winnerId, score_data: finalScoreData },
        { withCredentials: true }
      );
      const winnerName = winnerId === match.player1_id ? match.player1_name : match.player2_name;
      const summary = scoreSummary
        ? scoreSummary.scoreStr
        : retired
        ? "Retired / Walkover"
        : "";
      setSubmittedResult({ winnerName, summary });
      setSubmitted(true);
      setTimeout(() => navigate("/dashboard"), 4000);
    } catch (err) {
      const d = err.response?.data?.detail;
      setMsg(typeof d === "string" ? d : "Failed to report score");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }
  if (!match) return null;

  const sport = match.sport;
  const config = SPORT_CONFIG[sport] || {
    label: sport,
    accentClass: "bg-gray-500",
    ringClass: "ring-gray-500",
    textClass: "text-gray-600",
  };
  const players = [
    { id: match.player1_id, name: match.player1_name },
    { id: match.player2_id, name: match.player2_name },
  ];

  // Success state — shown after submit
  if (submitted && submittedResult) {
    const loserName =
      submittedResult.winnerName === match.player1_name
        ? match.player2_name
        : match.player1_name;
    const sportEmoji = match.sport === "tennis" ? "🎾" : match.sport === "pickleball" ? "🏓" : "🏏";
    const shareText = encodeURIComponent(
      `${sportEmoji} ${submittedResult.winnerName} defeated ${loserName}${submittedResult.summary ? ` ${submittedResult.summary}` : ""}\n` +
      `📍 VenLax Sports · ${match.sport}\n` +
      `👉 https://venlaxsports.com/leagues/${match.league_id}/public?utm_source=venlax&utm_medium=share_card`
    );
    const waUrl = `https://wa.me/?text=${shareText}`;
    const spectatorUrl = `https://venlaxsports.com/leagues/${match.league_id}/public?utm_source=venlax&utm_medium=share_card`;

    return (
      <div className="min-h-screen bg-gray-50" data-testid="score-report-page">
        <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
          {/* Result confirmation */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className={`h-1.5 w-full ${config.accentClass}`} />
            <div className="p-8 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${config.accentClass}`}>
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-heading font-black text-2xl text-gray-900 mb-1">Results Recorded</h2>
              <p className={`text-sm font-medium ${config.textClass} mb-6`}>{config.label} Match</p>
              <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Winner</p>
                <p className="font-heading font-bold text-xl text-gray-900">{submittedResult.winnerName}</p>
                {submittedResult.summary && (
                  <p className="text-sm text-gray-500 mt-1 font-mono">{submittedResult.summary}</p>
                )}
              </div>
              <p className="text-xs text-gray-400">Redirecting to dashboard in a few seconds...</p>
            </div>
          </div>

          {/* Share card */}
          <div className="bg-gray-900 rounded-2xl p-6 text-center" data-testid="share-card">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Share your result</p>
            <div className="text-4xl mb-2">{sportEmoji}</div>
            <p className="text-white font-heading font-black text-xl mb-1">
              {submittedResult.winnerName} won
            </p>
            <p className="text-gray-400 text-sm mb-5">
              {submittedResult.summary && `${submittedResult.summary} · `}
              {match.sport} · VenLax Sports
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-bold transition"
                data-testid="share-wa-btn"
              >
                Share on WhatsApp
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(spectatorUrl);
                }}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition"
                data-testid="share-copy-btn"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Already scored by someone else
  if (match.status === "completed") {
    return (
      <div className="min-h-screen bg-gray-50" data-testid="score-report-page">
        <div className="max-w-xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className={`h-1.5 w-full ${config.accentClass}`} />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.accentClass}`}>
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-heading font-bold text-xl text-gray-900">Match Scored</h1>
                  <p className={`text-sm ${config.textClass}`}>{config.label}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Winner</p>
                <p className="font-heading font-bold text-lg text-gray-900">{match.winner_name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Form
  return (
    <div className="min-h-screen bg-gray-50" data-testid="score-report-page">
      <div className="max-w-xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* Sport accent bar — T5 */}
          <div className={`h-1.5 w-full ${config.accentClass}`} />

          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.accentClass}`}>
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-xl text-gray-900">Report Match Score</h1>
                <p className={`text-sm ${config.textClass}`}>{config.label} Match</p>
              </div>
            </div>

            {/* Match info */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1 min-w-0 px-2">
                  <p className="font-heading font-bold text-base text-gray-900 truncate">{match.player1_name}</p>
                  <p className="text-xs text-gray-500">Player 1</p>
                </div>
                <div className="text-gray-400 font-bold text-sm px-2 shrink-0">VS</div>
                <div className="text-center flex-1 min-w-0 px-2">
                  <p className="font-heading font-bold text-base text-gray-900 truncate">{match.player2_name}</p>
                  <p className="text-xs text-gray-500">Player 2</p>
                </div>
              </div>
              {match.scheduled_date && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  {new Date(match.scheduled_date).toLocaleDateString()}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* 1. WINNER — primary action at top — T1 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                  Who Won? *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {players.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setWinnerId(p.id)}
                      aria-label={`Select ${p.name} as winner`}
                      className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ring-offset-2 ${
                        winnerId === p.id
                          ? `border-black bg-black text-white ring-2 ${config.ringClass}`
                          : "border-gray-200 text-gray-700 hover:border-gray-400"
                      }`}
                      data-testid={`winner-${p.id}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Retired / Walkover toggle — T3 */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRetired((r) => !r)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black ${
                    retired ? "bg-gray-700" : "bg-gray-200"
                  }`}
                  data-testid="retired-flag"
                  aria-label="Mark as retired or walkover"
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ${
                      retired ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-600">Retired / Walkover</span>
              </div>

              {/* 2. SCORE ENTRY — below winner — T2, T6, T9 */}
              {!retired && sport === "tennis" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Set Scores
                    </label>
                    <span className="text-xs text-gray-400">e.g. 6-4 / 3-6 / 7-5</span>
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3].map((set) => {
                      const disabled = set === 3 && !set3Enabled;
                      return (
                        <div
                          key={set}
                          className={`flex items-center gap-3 transition-opacity duration-200 ${disabled ? "opacity-40" : ""}`}
                        >
                          <span className="text-xs text-gray-500 w-24 shrink-0">
                            {set === 3 && !set3Enabled ? "Set 3 — if needed" : `Set ${set}`}
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="7"
                            placeholder={match.player1_name.split(" ")[0]}
                            value={scoreData[`set${set}_p1`] || ""}
                            onChange={(e) => updateScore(`set${set}_p1`, e.target.value)}
                            disabled={disabled}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:cursor-not-allowed"
                            data-testid={`set${set}-p1`}
                          />
                          <span className="text-gray-400 font-bold shrink-0">-</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="7"
                            placeholder={match.player2_name.split(" ")[0]}
                            value={scoreData[`set${set}_p2`] || ""}
                            onChange={(e) => updateScore(`set${set}_p2`, e.target.value)}
                            disabled={disabled}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:cursor-not-allowed"
                            data-testid={`set${set}-p2`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!retired && sport === "pickleball" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Game Scores
                    </label>
                    <span className="text-xs text-gray-400">e.g. 11-7 / 8-11 / 11-9</span>
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3].map((game) => {
                      const disabled = game === 3 && !game3Enabled;
                      return (
                        <div
                          key={game}
                          className={`flex items-center gap-3 transition-opacity duration-200 ${disabled ? "opacity-40" : ""}`}
                        >
                          <span className="text-xs text-gray-500 w-24 shrink-0">
                            {game === 3 && !game3Enabled ? "Game 3 — if needed" : `Game ${game}`}
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="30"
                            placeholder="0"
                            value={scoreData[`game${game}_p1`] || ""}
                            onChange={(e) => updateScore(`game${game}_p1`, e.target.value)}
                            disabled={disabled}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:cursor-not-allowed"
                            data-testid={`game${game}-p1`}
                          />
                          <span className="text-gray-400 font-bold shrink-0">-</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="30"
                            placeholder="0"
                            value={scoreData[`game${game}_p2`] || ""}
                            onChange={(e) => updateScore(`game${game}_p2`, e.target.value)}
                            disabled={disabled}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:cursor-not-allowed"
                            data-testid={`game${game}-p2`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!retired && sport === "cricket" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                    Cricket Score
                  </label>
                  <div className="space-y-4">
                    {[
                      { label: match.player1_name, prefix: "p1" },
                      { label: match.player2_name, prefix: "p2" },
                    ].map((team) => (
                      <div key={team.prefix} className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-700 mb-3 truncate">{team.label}</p>
                        {/* T6 — 2-col mobile, 3-col sm+ */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Runs</label>
                            <input
                              type="number"
                              min="0"
                              value={scoreData[`${team.prefix}_runs`] || ""}
                              onChange={(e) => updateScore(`${team.prefix}_runs`, e.target.value)}
                              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black"
                              data-testid={`${team.prefix}-runs`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Wickets</label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={scoreData[`${team.prefix}_wickets`] || ""}
                              onChange={(e) => updateScore(`${team.prefix}_wickets`, e.target.value)}
                              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black"
                              data-testid={`${team.prefix}-wickets`}
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <label className="text-xs text-gray-500 block mb-1">Overs</label>
                            <input
                              type="text"
                              value={scoreData[`${team.prefix}_overs`] || ""}
                              onChange={(e) => updateScore(`${team.prefix}_overs`, e.target.value)}
                              placeholder="20.0"
                              className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-black"
                              data-testid={`${team.prefix}-overs`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live score preview — T4 */}
              {!retired && scoreSummary && (
                <div
                  className={`rounded-xl p-3 ${
                    winnerMismatch
                      ? "bg-amber-50 border border-amber-200"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  {winnerMismatch ? (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700">Score suggests a different winner</p>
                        <p className="text-xs text-amber-600 mt-0.5 font-mono">{scoreSummary.scoreStr}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      <p className="text-xs text-gray-700 font-mono">{scoreSummary.scoreStr}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Notes {retired ? "" : "(optional)"}
                </label>
                <input
                  type="text"
                  value={scoreData.notes || ""}
                  onChange={(e) => updateScore("notes", e.target.value)}
                  placeholder={
                    retired
                      ? "e.g. Player retired at 4-3 in first set"
                      : "e.g. Great match, tiebreak in third set"
                  }
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  data-testid="score-notes"
                />
              </div>

              {msg && (
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200"
                  data-testid="score-message"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {msg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !winnerId}
                className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-60 text-sm"
                data-testid="submit-score-btn"
              >
                {submitting ? "Submitting..." : "Submit Score"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
