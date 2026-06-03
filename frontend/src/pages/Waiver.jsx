import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle } from "lucide-react";

const WAIVER_SECTIONS = [
  {
    title: "1. Assumption of Risk",
    content: [
      "I understand that racquet and paddle sports involve inherent risks, including but not limited to:",
      "• Slips, falls, collisions",
      "• Dehydration, heat exhaustion",
      "• Errant balls, racquets, or paddles",
      "• Uneven surfaces or unsafe court conditions",
      "I voluntarily assume all risks associated with participation.",
    ],
  },
  {
    title: "2. Court & Facility Disclaimer",
    content: [
      "I understand that VenLax:",
      "• Does not inspect courts",
      "• Does not guarantee safety",
      "• Does not provide medical supervision",
      "I am responsible for checking court conditions and stopping play if unsafe.",
    ],
  },
  {
    title: "3. Player Safety",
    content: [
      "I agree to:",
      "• Hydrate properly",
      "• Avoid extreme weather",
      "• Use proper footwear and equipment",
      "• Stop play if I feel unsafe",
      "I am solely responsible for my own safety.",
    ],
  },
  {
    title: "4. Age Requirement",
    content: [
      "I confirm that:",
      "• I am 18 or older, OR",
      "• I am a parent/guardian providing consent for a minor participant",
      "Parents assume full responsibility for minors.",
    ],
  },
  {
    title: "5. Limitation of Liability",
    content: [
      "I agree that VenLax is not liable for:",
      "• Injuries",
      "• Property damage",
      "• Court conditions",
      "• Organizer actions",
      "• Weather",
      "• Scheduling issues",
      "Total liability is limited to the amount I paid for the season.",
    ],
  },
  {
    title: "6. Binding Agreement",
    content: [
      "By completing registration, I agree to:",
      "• This Liability Waiver",
      "• The VenLax Terms & Conditions",
      "• The League Rules & Player Handbook",
      "My participation confirms my acceptance.",
    ],
  },
];

export default function Waiver() {
  return (
    <div style={{ background: "#FFFFFF" }} data-testid="waiver-page">
      {/* Hero */}
      <section className="py-16 sm:py-20 px-6" style={{ background: "#C24A1D" }}>
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
               style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.30)", color: "#FAF0E6" }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            Liability Waiver v1.0
          </div>
          <h1 className="font-heading font-black text-4xl sm:text-5xl mb-4 leading-tight text-white">
            Liability Waiver &<br /><span style={{ color: "rgba(255,255,255,0.9)" }}>Participation Agreement</span>
          </h1>
          <p className="text-sm sm:text-base max-w-2xl" style={{ color: "rgba(255,255,255,0.80)" }}>
            Required before registration. Please read all sections carefully.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 space-y-8">
        {/* Warning banner */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-900 mb-2">Important: Please Read Carefully</p>
              <p className="text-sm text-red-800 leading-relaxed">
                By registering to participate in VenLax, you are agreeing to assume full responsibility for your own safety and to release VenLax from liability for injuries or damages. This is a legally binding document.
              </p>
            </div>
          </div>
        </div>

        {/* Content sections */}
        {WAIVER_SECTIONS.map((section, i) => (
          <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg p-6">
            <h2 className="font-heading font-bold text-lg text-gray-900 mb-4">{section.title}</h2>
            <ul className="space-y-2">
              {section.content.map((line, j) => (
                <li key={j} className={`text-sm ${line.startsWith("•") ? "ml-4 text-gray-700" : "text-gray-700 leading-relaxed font-medium"}`}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Final agreement */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex gap-3">
            <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-2">Your Agreement</p>
              <p className="text-sm text-blue-800 leading-relaxed mb-3">
                By completing registration and paying your entry fee, you acknowledge that you have read this waiver, understand all terms, and voluntarily agree to participate in VenLax at your own risk.
              </p>
              <p className="text-xs text-blue-700 font-mono">
                This waiver is binding and enforceable to the maximum extent permitted by law.
              </p>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="text-center pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-4">
            Related documents: <Link to="/handbook" className="text-emerald-600 font-semibold hover:underline">Handbook</Link> · <Link to="/terms" className="text-emerald-600 font-semibold hover:underline">Terms</Link>
          </p>
          <Link
            to="/leagues"
            className="inline-flex items-center gap-2 text-sm font-semibold bg-emerald-500 text-white px-6 py-3 rounded-xl hover:bg-emerald-600 transition-colors"
            data-testid="waiver-cta-leagues"
          >
            <CheckCircle className="w-4 h-4" /> I Agree & Continue
          </Link>
        </div>
      </div>
    </div>
  );
}
