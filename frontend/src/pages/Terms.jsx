import { Link } from "react-router-dom";
import { FileText, AlertCircle, Lock, DollarSign, Scale, Shield, CheckCircle, Users } from "lucide-react";

const TERMS_SECTIONS = [
  {
    id: "platform",
    title: "Platform Status",
    icon: FileText,
    content: [
      "VenLax is an independent sports platform that provides scheduling, standings, and rating tools.",
      "VenLax does not supervise matches, provide courts, or employ organizers.",
    ],
  },
  {
    id: "risk",
    title: "Assumption of Risk",
    icon: AlertCircle,
    content: [
      "By participating in any VenLax league, ladder, or event, players acknowledge that:",
      "Racquet and paddle sports involve inherent risks.",
      "Injuries may occur due to weather, court conditions, equipment, or other players.",
      "VenLax is not responsible for injuries, accidents, or damages.",
      "Players participate voluntarily and assume full responsibility for their own safety.",
    ],
  },
  {
    id: "organizer",
    title: "Organizer Independence",
    icon: Users,
    content: [
      "Local organizers are independent coordinators, not employees or agents of VenLax.",
      "VenLax is not liable for:",
      "• Organizer decisions",
      "• Scheduling or communication issues",
      "• Court selection",
      "• Organizer behavior",
    ],
  },
  {
    id: "court",
    title: "Court & Facility Disclaimer",
    icon: Shield,
    content: [
      "VenLax does not inspect, maintain, or guarantee the safety of any court or facility.",
      "Players are responsible for:",
      "• Checking court conditions",
      "• Confirming weather suitability",
      "• Stopping play if unsafe",
    ],
  },
  {
    id: "refund",
    title: "Refund & Cancellation Policy",
    icon: DollarSign,
    content: [
      "Unless otherwise stated:",
      "• All fees are non-refundable",
      "• No refunds for injuries, withdrawals, scheduling conflicts, or weather",
      "• Credits may be issued at VenLax's discretion",
      "• If a league is canceled before starting, full refunds are issued",
      "• Chargebacks may result in account suspension.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy & Data Use",
    icon: Lock,
    content: [
      "VenLax collects: match results, ratings, and basic profile information.",
      "Data is used for: standings, scheduling, and rating updates.",
      "VenLax does not sell personal data.",
      "Players consent to their name, division, and match results being publicly visible.",
    ],
  },
  {
    id: "arbitration",
    title: "Arbitration & Dispute Resolution",
    icon: Scale,
    content: [
      "To the fullest extent permitted by law:",
      "• All disputes with VenLax must be resolved through binding arbitration",
      "• No class actions or group claims",
      "• Claims must be filed individually",
      "• This applies in all 50 U.S. states.",
    ],
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    icon: AlertCircle,
    content: [
      "To the maximum extent allowed by law, VenLax is not liable for:",
      "• Injuries",
      "• Lost or stolen property",
      "• Court or facility conditions",
      "• Organizer actions",
      "• Weather",
      "• Scheduling issues",
      "• Rating changes",
      "• Match disputes",
      "Total liability is limited to the amount paid for the season.",
    ],
  },
  {
    id: "acceptance",
    title: "Acceptance of Terms",
    icon: CheckCircle,
    content: [
      "By registering, players agree to:",
      "• All rules",
      "• All safety and conduct policies",
      "• All liability waivers",
      "• All arbitration terms",
      "Participation = full acceptance.",
    ],
  },
];

export default function Terms() {
  return (
    <div style={{ background: "#FFFFFF" }} data-testid="terms-page">
      <section className="py-16 sm:py-20 px-6" style={{ background: "#C24A1D" }}>
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
               style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.30)", color: "#FAF0E6" }}>
            <FileText className="w-3.5 h-3.5" />
            Terms & Conditions v1.0
          </div>
          <h1 className="font-heading font-black text-4xl sm:text-5xl mb-4 leading-tight text-white">
            Terms &<br /><span style={{ color: "rgba(255,255,255,0.9)" }}>Conditions</span>
          </h1>
          <p className="text-sm sm:text-base max-w-2xl" style={{ color: "rgba(255,255,255,0.80)" }}>
            Legal terms governing your use of VenLax. By registering, you agree to all terms below.
          </p>
        </div>
      </section>

      <div className="border-b sticky top-0 z-10 backdrop-blur" style={{ borderColor: "#E5E7EB", background: "rgba(253,246,238,0.92)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-1 text-xs font-semibold overflow-x-auto">
          {TERMS_SECTIONS.map(({ id, title }) => (
            <a key={id} href={`#${id}`} className="px-3 py-1.5 rounded-full transition-colors whitespace-nowrap" style={{ color: "#374151" }}
               onMouseEnter={e => e.currentTarget.style.background="#F3F4F6"}
               onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              {title}
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 space-y-12">
        {TERMS_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <div className="flex items-center gap-3 mb-6">
                <Icon className="w-6 h-6 text-gray-700" />
                <h2 className="font-heading font-black text-2xl text-gray-900">{section.title}</h2>
              </div>
              <div className="space-y-3">
                {section.content.map((line, i) => (
                  <p key={i} className={`text-sm ${line.startsWith("•") ? "ml-4 text-gray-700" : "text-gray-700 leading-relaxed"}`}>
                    {line}
                  </p>
                ))}
              </div>
            </section>
          );
        })}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mt-12">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-2">Legal Notice</p>
              <p className="text-xs text-amber-800 leading-relaxed">
                These Terms, Liability Waiver, and Player Handbook form the complete agreement. If you do not agree, do not register.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-4">
            Related: <Link to="/handbook" className="text-emerald-600 font-semibold hover:underline">Handbook</Link> · <Link to="/waiver" className="text-emerald-600 font-semibold hover:underline">Waiver</Link>
          </p>
          <Link
            to="/leagues"
            className="inline-flex items-center gap-2 text-sm font-semibold bg-emerald-500 text-white px-6 py-3 rounded-xl hover:bg-emerald-600 transition-colors"
            data-testid="terms-cta-leagues"
          >
            Find a league
          </Link>
        </div>
      </div>
    </div>
  );
}
