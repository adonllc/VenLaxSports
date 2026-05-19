import { Link } from "react-router-dom";

const SECTIONS = [
  {
    id: "registration",
    title: "1. League Registration & Entry Fees",
    body: [
      "Entry fees are clearly displayed before payment. By completing checkout you agree to pay the stated amount.",
      "All entry fees are denominated in US Dollars (USD) and processed via Stripe, Inc., a PCI-DSS Level 1 certified payment processor. VENLAX Sports never stores, transmits, or has access to your full card number, CVV, or expiry date.",
      "Entry fees are non-refundable once the league registration period has closed or after the league has started, whichever comes first.",
      "If a league is cancelled by VENLAX Sports before it starts, participants will receive a full refund to the original payment method within 5-10 business days.",
    ],
  },
  {
    id: "refunds",
    title: "2. Refund & Cancellation Policy",
    body: [
      "No refunds are issued after the league start date.",
      "Withdrawal requests made before the league start date will be reviewed on a case-by-case basis. Contact support@venlaxsports.com with your name, league name, and reason.",
      "VENLAX Sports reserves the right to apply a processing fee of up to $5.00 USD on approved pre-start refunds.",
      "Zelle payments are subject to the same refund policy. Because Zelle is a bank-to-bank transfer, refunds are processed as separate Zelle transfers and may take 3-5 business days.",
    ],
  },
  {
    id: "payment-processing",
    title: "3. Payment Processing",
    body: [
      "Card payments are processed exclusively by Stripe, Inc. (stripe.com). Your card details are entered directly on Stripe's secure servers and are never transmitted to VENLAX Sports.",
      "Apple Pay and Google Pay are not yet available. These options are reserved for a future release.",
      "Zelle payments require admin verification before your registration is confirmed. After submitting your Zelle confirmation number, your spot will be held for up to 72 hours pending deposit verification. If the deposit cannot be verified, your spot will be released.",
      "VENLAX Sports uses industry-standard TLS encryption for all data in transit.",
    ],
  },
  {
    id: "conduct",
    title: "4. League Rules & Conduct",
    body: [
      "All participants must follow the VENLAX Sports Rules & Conduct policy available at /rules.",
      "Players are solely responsible for scheduling matches, reserving court time, and arranging their own transportation.",
      "VENLAX Sports and its administrators are not responsible for court availability, court conditions, weather, injuries, scheduling conflicts, or any disputes between players.",
      "Unsportsmanlike behavior, harassment, or abuse of any kind may result in immediate removal from the league without a refund.",
    ],
  },
  {
    id: "data",
    title: "5. Data & Privacy",
    body: [
      "We collect only the data necessary to operate the platform: your name, email address, and payment confirmation status.",
      "We do not sell, rent, or share your personal information with third parties for marketing purposes.",
      "Match results and standings are displayed publicly within the platform.",
      "To request deletion of your account and associated data, contact support@venlaxsports.com.",
    ],
  },
  {
    id: "disputes",
    title: "6. Disputes",
    body: [
      "Score disputes must be submitted within 24 hours of the reported score via the match detail page.",
      "VENLAX Sports administrators will review disputes and may request photo evidence or written accounts from both parties.",
      "Administrator decisions on disputes are final.",
      "For billing disputes, contact support@venlaxsports.com before initiating a chargeback. We are committed to resolving billing issues promptly.",
    ],
  },
  {
    id: "changes",
    title: "7. Changes to These Terms",
    body: [
      "VENLAX Sports may update these Terms at any time. Material changes will be communicated via email to registered users at least 7 days before taking effect.",
      "Continued use of the platform after changes take effect constitutes acceptance of the updated Terms.",
    ],
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-gray-50 border-b border-gray-200 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Legal</p>
          <h1 className="font-heading font-black text-4xl text-gray-900">Terms &amp; Conditions</h1>
          <p className="mt-3 text-gray-600">
            Last updated: May 2026. These terms govern your use of VENLAX Sports and any league
            registrations made on the platform.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Questions? Email{" "}
            <a href="mailto:support@venlaxsports.com" className="underline hover:text-gray-700">
              support@venlaxsports.com
            </a>
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id}>
            <h2 className="font-heading font-bold text-xl text-gray-900 mb-4">{s.title}</h2>
            <ul className="space-y-3">
              {s.body.map((para, i) => (
                <li key={i} className="text-gray-700 text-sm leading-relaxed pl-4 border-l-2 border-gray-100">
                  {para}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="border-t border-gray-200 pt-8 text-sm text-gray-500 space-y-1">
          <p>VENLAX Sports is operated by VENLAX LLC.</p>
          <p>Payments processed by <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">Stripe, Inc.</a> — PCI-DSS Level 1 certified.</p>
          <p className="mt-4">
            <Link to="/" className="underline hover:text-gray-700">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
