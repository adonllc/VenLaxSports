import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle, FileText, ShieldAlert } from "lucide-react";

export default function Terms() {
  return (
    <div style={{ background: "#FFFFFF" }} data-testid="terms-page">

      {/* Hero */}
      <section className="py-16 sm:py-20 px-6" style={{ background: "#C24A1D" }}>
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
               style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.30)", color: "#FAF0E6" }}>
            <FileText className="w-3.5 h-3.5" />
            Legal Terms & Conditions
          </div>
          <h1 className="font-heading font-black text-4xl sm:text-5xl mb-4 leading-tight text-white">
            Terms of Service<br /><span style={{ color: "rgba(255,255,255,0.9)" }}>& Legal Disclaimers</span>
          </h1>
          <p className="text-sm sm:text-base max-w-2xl" style={{ color: "rgba(255,255,255,0.80)" }}>
            Participation in VENLAX sports leagues involves inherent risks.
            This document defines your rights, responsibilities, and releases.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 space-y-12">

        {/* 1. Waiver of Liability */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <ShieldAlert className="w-6 h-6 text-red-600" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Waiver of Liability & Assumption of Risk</h2>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-4">
            <p className="text-sm text-red-900 font-semibold">
              By registering and participating in VENLAX Sports leagues, you acknowledge and assume all risks.
            </p>
            <div className="bg-white rounded-lg p-4 border border-red-100 font-mono text-xs sm:text-sm text-gray-700 leading-relaxed">
              <p className="mb-3 font-semibold">YOU ASSUME ALL RISKS OF PERSONAL INJURY, DEATH, PROPERTY DAMAGE, OR LOSS ARISING FROM:</p>
              <ul className="space-y-2 ml-4">
                <li>• Playing competitive tennis or pickleball</li>
                <li>• Court or facility conditions (weather, hazards, maintenance)</li>
                <li>• Contact with opponents, spectators, or facility staff</li>
                <li>• Travel to and from match venues</li>
                <li>• Use of personal equipment (racquets, shoes, clothing)</li>
                <li>• Heat-related illness, dehydration, or medical emergencies</li>
              </ul>

              <p className="mt-4 mb-3 font-semibold">YOU WAIVE AND RELEASE ALL CLAIMS AGAINST:</p>
              <ul className="space-y-2 ml-4">
                <li>• VENLAX Sports and its employees, agents, and successors</li>
                <li>• League organizers, administrators, and referees</li>
                <li>• Match opponents</li>
                <li>• Facility owners and operators</li>
                <li>• Other league participants and spectators</li>
              </ul>

              <p className="mt-4">
                You waive all claims for negligence, breach of contract, gross negligence, assumption of risk,
                comparative negligence, or any other legal theory, to the maximum extent permitted by law.
              </p>

              <p className="mt-4 font-semibold">THIS WAIVER SURVIVES:</p>
              <ul className="space-y-2 ml-4">
                <li>• League withdrawal or cancellation</li>
                <li>• Season end</li>
                <li>• Account deactivation</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 2. Medical & Emergency Contact */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-orange-600" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Emergency Contact & Medical Information</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-base text-orange-900 mb-3">Registration Requirements</h3>
              <ul className="space-y-2 text-sm text-orange-800">
                <li className="flex gap-3">
                  <CheckCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Emergency Contact (Required):</strong> Name and phone number of person to contact if injured or unresponsive.</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Medical Conditions (Optional but Recommended):</strong> Known allergies, asthma, heart conditions, or other relevant health information. This information is confidential and provided only to organizers.</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Authorization:</strong> You authorize VENLAX organizers to call 911 and notify your emergency contact if you are injured or unresponsive on court.</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-base text-gray-900 mb-3">Medical Emergency Protocol</h3>
              <ol className="space-y-2 text-sm text-gray-700 ml-4">
                <li><strong>1. Immediate Response:</strong> If a player is injured or unresponsive, organizer immediately assesses situation.</li>
                <li><strong>2. Emergency Services:</strong> If medical attention is needed, organizer calls 911 immediately.</li>
                <li><strong>3. Contact Notification:</strong> Organizer notifies emergency contact and league administrator.</li>
                <li><strong>4. Documentation:</strong> Incident is documented (date, time, player name, injury type, response action).</li>
                <li><strong>5. No Liability:</strong> VENLAX is not liable for medical outcomes. You are responsible for your own medical care and health decisions.</li>
              </ol>
            </div>
          </div>
        </section>

        {/* 3. Age & Parental Consent */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Age Requirements & Parental Consent</h2>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-2">Minimum Age: 13 Years Old</p>
              <p className="text-sm text-blue-800">Players under 18 must have parental/legal guardian consent on registration.</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <p className="text-xs font-semibold text-blue-900 mb-2 uppercase">Parental Consent Declaration (Required for Players Under 18)</p>
              <p className="text-sm text-gray-700 italic leading-relaxed">
                "I am the parent/legal guardian of [Player Name]. I consent to their participation in VENLAX sports leagues.
                I understand the risks of competitive tennis and pickleball. I have read and agree to the Terms of Service,
                including the Waiver of Liability. I assume full responsibility for my child's safety and medical care.
                I authorize VENLAX organizers to call 911 if my child is injured or unresponsive."
              </p>
            </div>
            <p className="text-xs text-blue-600">
              Parental consent is collected via digital signature at account creation.
              Organizers may request ID/DOB verification if consent is disputed.
            </p>
          </div>
        </section>

        {/* 4. Refund Policy */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Refund Policy</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-base text-emerald-900 mb-4">Standard Refund Rules</h3>
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border border-emerald-100">
                  <p className="text-sm font-semibold text-emerald-900">✓ Full Refund</p>
                  <p className="text-xs text-emerald-700 mt-1">League canceled before start. Organizer fails to reach minimum player count (announced pre-season).</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-emerald-100">
                  <p className="text-sm font-semibold text-emerald-900">✗ No Refund</p>
                  <p className="text-xs text-emerald-700 mt-1">Player-initiated withdrawal after registration closes (48 hours before league start). Removal due to conduct violation.</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-emerald-100">
                  <p className="text-sm font-semibold text-emerald-900">⟳ Partial Refund (50%)</p>
                  <p className="text-xs text-emerald-700 mt-1">Withdrawal within first 2 matches played (at organizer discretion).</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-emerald-100">
                  <p className="text-sm font-semibold text-emerald-900">⟳ Prorated Refund</p>
                  <p className="text-xs text-emerald-700 mt-1">Organizer cancellation mid-season: (remaining matches ÷ total matches) × fee.</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-base text-gray-900 mb-3">Stripe Dispute Process</h3>
              <p className="text-sm text-gray-700 mb-3">
                All refund disputes are adjudicated via Stripe. VENLAX responds with match evidence, league records, and refund policy documentation.
              </p>
              <p className="text-xs text-gray-500">
                Stripe dispute window: 120 days from charge date. Player disputes must be initiated via their Stripe payment statement.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Dispute Resolution & Arbitration */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-purple-600" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Dispute Resolution & Escalation</h2>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="font-heading font-bold text-base text-purple-900 mb-2">Score Disputes</h3>
              <ol className="space-y-2 text-sm text-purple-800 ml-4">
                <li><strong>1. Initial Resolution (24h window):</strong> Players communicate directly and submit agreed score with photographic evidence.</li>
                <li><strong>2. Organizer Review (24h):</strong> If no agreement, organizer reviews evidence (scorecard photo, timestamps, match location).</li>
                <li><strong>3. Final Decision:</strong> Organizer rules final within 24 hours. Decision is binding.</li>
              </ol>
            </div>

            <div className="border-t border-purple-200 pt-4">
              <h3 className="font-heading font-bold text-base text-purple-900 mb-2">Conduct Violations</h3>
              <ol className="space-y-2 text-sm text-purple-800 ml-4">
                <li><strong>1. Report:</strong> Opponent or witness submits complaint with specific evidence (incident description, witness contact, photo if applicable).</li>
                <li><strong>2. Investigation:</strong> Organizer interviews both parties, reviews match history.</li>
                <li><strong>3. Notification:</strong> If violation is substantiated, organizer issues written notice with specific charge and evidence.</li>
                <li><strong>4. Response Period:</strong> Player has 7 days to respond in writing.</li>
                <li><strong>5. Final Decision:</strong> Organizer issues final ruling. Player may appeal within 7 days to league commissioner.</li>
                <li><strong>6. Penalties:</strong> Match fixing (1st) = season suspension; (2nd) = permanent removal. Sportsmanship (1st) = warning; (2nd) = point penalty; (3rd+) = escalation to match default.</li>
              </ol>
            </div>

            <div className="border-t border-purple-200 pt-4">
              <h3 className="font-heading font-bold text-base text-purple-900 mb-2">Playoff Seeding Disputes</h3>
              <p className="text-sm text-purple-800">
                If final standings are contested, organizer adjudicates within 48 hours of playoff start.
                Playoff bracket is locked 24 hours before first match.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Facility Safety & Liability */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-amber-600" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Facility Safety & Home Player Responsibility</h2>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
            <p className="text-sm text-amber-900 font-semibold">
              Home player is responsible for venue selection and safety verification. VENLAX does not provide facility insurance or facility management.
            </p>
            <div className="bg-white rounded-lg p-4 border border-amber-100 space-y-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">Court Approval</p>
                <p className="text-xs text-amber-700 mt-1">Hard, clay, turf, or indoor carpet courts only. Court must be hazard-free and have functioning lights (if evening match).</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">Home Player Responsibility</p>
                <p className="text-xs text-amber-700 mt-1">Verifies court safety before match day. If unsafe, reschedules within 7 days or forfeits (opponent awarded walkover).</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">Facility Liability</p>
                <p className="text-xs text-amber-700 mt-1">Home player confirms facility is insured. Any on-court injuries are between player and facility owner. Players should verify their own liability insurance on private courts.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Photography & Recording Rights */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-indigo-600" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Photography & Video Recording</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-base text-indigo-900 mb-3">Still Photography</h3>
              <p className="text-sm text-indigo-800 mb-2">
                Still photography by spectators, opponents, and organizers is permitted and encouraged.
              </p>
              <p className="text-xs text-indigo-700">
                Players may request no photography; photographers must honor request. Player names and ratings are public on league standings.
              </p>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-base text-indigo-900 mb-3">Live Streaming & Video Recording</h3>
              <p className="text-sm text-indigo-800 mb-2">
                Recording and streaming requires written consent from BOTH players and the organizer.
              </p>
              <ul className="space-y-2 text-xs text-indigo-700 ml-4">
                <li>• Organizer-authorized official recordings for league documentation are permitted with advance notice.</li>
                <li>• Third-party spectators may NOT record or stream without both players' explicit consent.</li>
                <li>• Players own their likeness in recordings. VENLAX does not own or profit from player recordings.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 8. Indemnification & Insurance */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <ShieldAlert className="w-6 h-6 text-red-600" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Indemnification & Insurance</h2>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-4 text-sm text-red-900">
            <p className="font-semibold">
              You agree to indemnify, defend, and hold harmless VENLAX Sports, its owners, employees, agents, and successors from any claims, damages, liabilities, costs, or expenses (including legal fees) arising from your participation.
            </p>
            <p>
              VENLAX provides no liability insurance. You are responsible for obtaining personal injury liability insurance if desired.
            </p>
            <p className="text-xs text-red-700">
              This indemnification applies to all claims arising from your participation, including injury, property damage, or contractual disputes with opponents or organizers.
            </p>
          </div>
        </section>

        {/* 9. Governing Law */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-gray-600" />
            <h2 className="font-heading font-black text-2xl text-gray-900">Governing Law & Jurisdiction</h2>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-sm text-gray-700 space-y-3">
            <p>
              These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles.
            </p>
            <p>
              Any disputes arising from your participation are subject to binding arbitration under the American Arbitration Association rules,
              conducted in Delaware or the player's home state (at player's election).
            </p>
            <p className="text-xs text-gray-500">
              Class action waiver: You agree not to pursue class action or representative claims. Disputes must be pursued on an individual basis.
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="border-t pt-8 mt-8 flex flex-col sm:flex-row gap-4">
          <Link
            to="/rules"
            className="inline-flex items-center gap-2 text-sm font-semibold bg-emerald-500 text-white px-6 py-3 rounded-xl hover:bg-emerald-600 transition-colors text-center"
            data-testid="terms-cta-rules"
          >
            ← Back to Rules
          </Link>
          <Link
            to="/leagues"
            className="inline-flex items-center gap-2 text-sm font-semibold bg-gray-900 text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors text-center"
            data-testid="terms-cta-leagues"
          >
            Browse Leagues →
          </Link>
        </div>

      </div>
    </div>
  );
}
