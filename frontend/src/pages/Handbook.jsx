import { Link } from "react-router-dom";
import { Shield, AlertCircle, Users, CheckCircle, Heart, AlertTriangle } from "lucide-react";

const HANDBOOK_SECTIONS = [
  {
    id: "about",
    title: "About VenLax",
    icon: Shield,
    color: "text-emerald-600",
    items: [
      "VenLax is a competitive sports platform that provides automated scheduling, standings, ratings, and match-tracking tools for Tennis and Pickleball.",
      "We are not affiliated with USTA, USA Pickleball, DUPR, Universal Tennis, or the ITF.",
      "VenLax does not supervise matches or provide courts.",
      "Players coordinate match logistics and play voluntarily.",
    ],
  },
  {
    id: "safety",
    title: "Player Safety",
    icon: Heart,
    color: "text-red-600",
    items: [
      "Players are responsible for their own safety at all times.",
      "Stop play immediately if conditions are unsafe.",
      "Hydrate properly.",
      "Avoid extreme heat or lightning.",
      "Use proper footwear and equipment.",
      "Seek medical attention when needed.",
      "If a player cannot continue safely, they may retire from the match.",
    ],
  },
  {
    id: "age",
    title: "Age Requirements",
    icon: Users,
    color: "text-blue-600",
    items: [
      "Players must be 18+ to participate independently.",
      "Minors may participate only with written parental consent.",
      "Parents/guardians assume full responsibility for minors.",
    ],
  },
  {
    id: "conduct",
    title: "Code of Conduct",
    icon: CheckCircle,
    color: "text-emerald-600",
    subItems: {
      "All players must:": [
        "Treat opponents with respect",
        "Avoid harassment, discrimination, or intimidation",
        "Avoid profanity, threats, or aggressive behavior",
        "Make fair line calls",
        "Resolve disputes calmly",
      ],
      "Zero tolerance for:": [
        "Violence or threats",
        "Discriminatory language",
        "Harassment (verbal, physical, digital)",
        "Match fixing or score manipulation",
      ],
    },
    footer: "Violations may result in suspension or removal.",
  },
  {
    id: "disputes",
    title: "Match Disputes & Score Confirmation",
    icon: AlertTriangle,
    color: "text-amber-600",
    items: [
      "VenLax does not adjudicate on-court disputes.",
      "Players must resolve: line calls, scoring disagreements, conduct issues, rescheduling conflicts.",
      "Once a match result is confirmed, it is final.",
    ],
  },
  {
    id: "ratings",
    title: "Ratings Policy",
    icon: TrendingUp,
    color: "text-purple-600",
    items: [
      "VenLax uses proprietary ELO-based rating systems.",
      "Ratings are estimates and may fluctuate.",
      "Ratings are not equivalent to USTA NTRP, DUPR, or ITF ratings.",
      "Ratings are provided as-is.",
    ],
  },
  {
    id: "weather",
    title: "Weather Policy",
    icon: AlertCircle,
    color: "text-sky-600",
    subItems: {
      "Stop play immediately for:": [
        "Lightning",
        "Heavy rain",
        "Unsafe surfaces",
        "Extreme heat",
      ],
    },
    footer: "If <30 minutes played → restart. If >30 minutes played → resume from the existing score.",
  },
];

export default function Handbook() {
  return (
    <div style={{ background: "#FFFFFF" }} data-testid="handbook-page">
      {/* Hero */}
      <section className="py-16 sm:py-20 px-6" style={{ background: "#C24A1D" }}>
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
               style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.30)", color: "#FAF0E6" }}>
            <Shield className="w-3.5 h-3.5" />
            Player Handbook v1.0
          </div>
          <h1 className="font-heading font-black text-4xl sm:text-5xl mb-4 leading-tight text-white">
            League Rules &<br /><span style={{ color: "rgba(255,255,255,0.9)" }}>Player Handbook</span>
          </h1>
          <p className="text-sm sm:text-base max-w-2xl" style={{ color: "rgba(255,255,255,0.80)" }}>
            Everything you need to know about playing in a VenLax league.
            Safety, conduct, ratings, disputes — all in one place.
          </p>
        </div>
      </section>

      {/* Quick nav */}
      <div className="border-b sticky top-0 z-10 backdrop-blur" style={{ borderColor: "#E5E7EB", background: "rgba(253,246,238,0.92)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-1 text-xs font-semibold overflow-x-auto">
          {HANDBOOK_SECTIONS.map(({ id, title }) => (
            <a key={id} href={`#${id}`} className="px-3 py-1.5 rounded-full transition-colors whitespace-nowrap" style={{ color: "#374151" }}
               onMouseEnter={e => e.currentTarget.style.background="#F3F4F6"}
               onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              {title}
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 space-y-12">
        {HANDBOOK_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <div className="flex items-center gap-3 mb-6">
                <Icon className={`w-6 h-6 ${section.color}`} />
                <h2 className="font-heading font-black text-2xl text-gray-900">{section.title}</h2>
              </div>

              {section.items && (
                <ul className="space-y-3 mb-6">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                      <span className={`${section.color} font-bold flex-shrink-0 mt-0.5`}>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {section.subItems && (
                <div className="space-y-4 mb-6">
                  {Object.entries(section.subItems).map(([heading, items]) => (
                    <div key={heading}>
                      <h3 className={`font-heading font-bold text-base ${section.color} mb-2`}>{heading}</h3>
                      <ul className="space-y-2 ml-4">
                        {items.map((item, i) => (
                          <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                            <span className={`${section.color} font-bold flex-shrink-0`}>◦</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {section.footer && (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-600 italic">
                  {section.footer}
                </div>
              )}
            </section>
          );
        })}

        <div className="text-center pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-4">
            Have questions? Check the <Link to="/rules" className="text-emerald-600 font-semibold hover:underline">League Rules</Link> for format-specific details.
          </p>
          <Link
            to="/leagues"
            className="inline-flex items-center gap-2 text-sm font-semibold bg-emerald-500 text-white px-6 py-3 rounded-xl hover:bg-emerald-600 transition-colors"
            data-testid="handbook-cta-leagues"
          >
            <Shield className="w-4 h-4" /> Find a league to join
          </Link>
        </div>
      </div>
    </div>
  );
}
