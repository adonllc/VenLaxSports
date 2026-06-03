import { useState } from "react";
import { X, CheckCircle, AlertTriangle } from "lucide-react";

export default function WaiverModal({ isOpen, onAgree, onCancel }) {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="font-heading font-black text-lg text-gray-900">Liability Waiver</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            data-testid="waiver-modal-close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-sm text-gray-700">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="font-semibold text-red-900 mb-1">Please Read Carefully</p>
            <p className="text-red-800 text-xs">
              By registering to participate in VenLax, you acknowledge inherent risks and agree to assume full responsibility for your own safety.
            </p>
          </div>

          {/* Waiver content */}
          <div className="space-y-4 text-xs">
            <div>
              <p className="font-bold text-gray-900 mb-2">1. Assumption of Risk</p>
              <p className="text-gray-700 leading-relaxed">
                You understand that racquet and paddle sports involve inherent risks including slips, falls, collisions, dehydration, heat exhaustion, errant equipment, and unsafe court conditions. You voluntarily assume all risks.
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-900 mb-2">2. Court & Facility Disclaimer</p>
              <p className="text-gray-700 leading-relaxed">
                VenLax does not inspect, maintain, or guarantee court safety. You are responsible for checking court conditions and stopping play if unsafe.
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-900 mb-2">3. Limitation of Liability</p>
              <p className="text-gray-700 leading-relaxed">
                VenLax is not liable for injuries, property damage, court conditions, organizer actions, weather, scheduling issues, or rating changes. Total liability is limited to your season entry fee.
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-900 mb-2">4. Agreement</p>
              <p className="text-gray-700 leading-relaxed">
                By clicking "I Agree," you confirm you have read this waiver, understand all terms, and voluntarily agree to participate in VenLax at your own risk. This waiver is binding to the maximum extent permitted by law.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
              data-testid="waiver-modal-agree-checkbox"
            />
            <span className="text-sm font-medium text-gray-900">
              I acknowledge and agree to this Liability Waiver and Participation Agreement
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              data-testid="waiver-modal-decline"
            >
              Decline
            </button>
            <button
              onClick={() => onAgree(agreed)}
              disabled={!agreed}
              className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                agreed
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
              data-testid="waiver-modal-agree"
            >
              <CheckCircle className="w-4 h-4" />
              I Agree & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
