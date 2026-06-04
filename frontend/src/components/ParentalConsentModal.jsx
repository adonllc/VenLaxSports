import { X, AlertCircle } from "lucide-react";

export default function ParentalConsentModal({ isOpen, onClose, onSubmit, playerName }) {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    onSubmit({
      guardianName: formData.get("guardianName"),
      relationship: formData.get("relationship"),
      consent: formData.get("consent") === "on",
      acknowledge: formData.get("acknowledge") === "on",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" data-testid="parental-consent-modal">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-heading font-black text-xl text-gray-900">Parental Consent Form</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Required for Players Under 18</p>
              <p className="text-xs text-amber-700 mt-1">
                A parent or legal guardian must provide written consent before your child can participate in VENLAX leagues.
              </p>
            </div>
          </div>

          {/* Player Name (read-only) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Player Name</label>
            <input
              type="text"
              value={playerName}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          {/* Guardian Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Parent/Legal Guardian Name *
            </label>
            <input
              type="text"
              name="guardianName"
              required
              placeholder="Full name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Relationship */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Relationship *</label>
            <select
              name="relationship"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Select —</option>
              <option value="parent">Parent</option>
              <option value="legal-guardian">Legal Guardian</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Consent Declaration */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Consent Declaration</p>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              "I am the parent/legal guardian of {playerName}. I consent to their participation in VENLAX sports leagues.
              <br /><br />
              I understand that competitive tennis and pickleball involve risks of personal injury, including but not limited to:
              heat exhaustion, dehydration, falls, contact injuries, and medical emergencies.
              <br /><br />
              I have read and agree to the VENLAX Terms of Service, including the Waiver of Liability and Assumption of Risk.
              <br /><br />
              I assume full responsibility for {playerName}'s safety, medical care, and participation decisions.
              I authorize VENLAX organizers to call 911 if {playerName} is injured or unresponsive on court."
            </p>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="consent"
                required
                className="w-5 h-5 rounded border border-gray-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500 mt-0.5"
              />
              <span className="text-sm text-gray-700">
                I consent to {playerName}'s participation in VENLAX leagues and assume all risks.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="acknowledge"
                required
                className="w-5 h-5 rounded border border-gray-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500 mt-0.5"
              />
              <span className="text-sm text-gray-700">
                I have read and understand the Terms of Service and assume full liability for {playerName}'s participation.
              </span>
            </label>
          </div>

          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-xs text-red-900">
              <strong>Legal Acknowledgment:</strong> This form is a binding waiver of liability.
              By signing, you waive your right to sue VENLAX or any organizers for injury, illness, or death.
              This waiver is enforceable to the maximum extent permitted by law.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
              data-testid="parental-consent-submit"
            >
              I Agree & Consent
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
