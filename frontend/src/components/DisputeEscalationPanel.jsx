import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function DisputeEscalationPanel({ leagueId, isOrganizerView = false }) {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [decision, setDecision] = useState("");
  const [penalty, setPenalty] = useState("");

  useEffect(() => {
    if (!leagueId) return;
    loadDisputes();
  }, [leagueId]);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/legal/disputes?league_id=${leagueId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setDisputes(data || []);
    } catch (err) {
      console.error("Failed to load disputes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueDecision = async (disputeId) => {
    if (!decision.trim()) {
      alert("Decision description required");
      return;
    }

    try {
      await axios.post(
        `${API}/legal/disputes/${disputeId}/decision`,
        {
          decision,
          ruling_type: "upheld",
          penalty: penalty || null,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setDecision("");
      setPenalty("");
      setSelectedDispute(null);
      await loadDisputes();
    } catch (err) {
      alert(`Error: ${err.response?.data?.detail || "Failed to issue decision"}`);
    }
  };

  const statusColor = {
    pending: "text-amber-600 bg-amber-50",
    investigating: "text-blue-600 bg-blue-50",
    resolved: "text-green-600 bg-green-50",
    appealed: "text-purple-600 bg-purple-50",
    closed: "text-gray-600 bg-gray-50",
  };

  const statusIcon = {
    pending: <Clock className="w-4 h-4" />,
    investigating: <AlertCircle className="w-4 h-4" />,
    resolved: <CheckCircle className="w-4 h-4" />,
    appealed: <AlertCircle className="w-4 h-4" />,
    closed: <XCircle className="w-4 h-4" />,
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading disputes...</div>;
  }

  if (!isOrganizerView && disputes.length === 0) {
    return <div className="text-center py-8 text-gray-500">No disputes reported</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-heading font-bold text-lg text-gray-900">
        {isOrganizerView ? "Dispute Escalation Queue" : "My Disputes"}
      </h3>

      {disputes.length === 0 ? (
        <p className="text-sm text-gray-500">No disputes to display</p>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div
              key={d.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{d.dispute_type}</p>
                  <p className="text-xs text-gray-500 mt-1">{d.description}</p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${statusColor[d.status]}`}>
                  {statusIcon[d.status]}
                  {d.status}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                <span>Reported by: {d.reported_by_name}</span>
                {d.reported_against_name && <span>Against: {d.reported_against_name}</span>}
              </div>

              {isOrganizerView && d.status === "pending" && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedDispute(d.id)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Review & Issue Decision →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Decision Modal */}
      {selectedDispute && isOrganizerView && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="font-heading font-bold text-lg mb-4">Issue Decision</h2>

            <textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              placeholder="Describe your ruling and decision..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4"
              rows={4}
            />

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Penalty (optional)</label>
              <select
                value={penalty}
                onChange={(e) => setPenalty(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">None</option>
                <option value="warning">Warning</option>
                <option value="point_penalty">Point Penalty</option>
                <option value="game_penalty">Game Penalty</option>
                <option value="match_default">Match Default</option>
                <option value="suspension">Suspension</option>
                <option value="removal">Permanent Removal</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedDispute(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-sm font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleIssueDecision(selectedDispute)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700"
              >
                Issue Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
