import Link from "next/link";
import { Scale, Clock, RefreshCw, ShieldCheck, AlertCircle, ArrowLeft, UserCheck, Sparkles, Hotel, Key } from "lucide-react";

export const metadata = {
  title: "Terms of Hospitality & Stay | Aura Royal Hotel & Suites",
  description:
    "Terms of Hospitality, room reservations, deposit terms, check-in/out policies, cancellation rules, and guest guidelines for Aura Royal Hotel in Accra, Ghana.",
};

export default function TermsOfServicePage() {
  return (
    <div className="py-8 sm:py-12 max-w-4xl mx-auto space-y-10 text-[#1E1E1E]">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
          <Scale className="w-3.5 h-3.5 text-black" />
          <span>Transparent Hospitality Agreement</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#1E1E1E] tracking-tight">
          Terms of Service
        </h1>
        <p className="text-xs sm:text-sm text-[#71717A] max-w-xl mx-auto leading-relaxed">
          Please review these terms and conditions before confirming your reservation at Aura Royal Hotel & Suites.
        </p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#E4E4E7] shadow-xs space-y-8 text-xs sm:text-sm leading-relaxed text-[#3F3F46]">
        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>1. Guaranteed Reservations & Booking Deposits</span>
          </h2>
          <p>
            To confirm and guarantee any suite reservation on our property calendar, an <strong>advance deposit (or full payment)</strong> is required at the time of reservation. 
          </p>
          <p>
            When selecting dates and suites on our website, a temporary <strong>10-minute room hold</strong> is placed while checkout is conducted securely via Paystack (Mobile Money or Card). Reservations are officially confirmed only upon successful payment verification. Any remaining balance is payable prior to check-in or upon arrival at the front desk.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>2. Standard Check-In (14:00) & Check-Out (11:00)</span>
          </h2>
          <p>
            To allow our housekeeping and maintenance teams to inspect and sanitize suites to five-star standards:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#71717A]">
            <li><strong>Check-in Time:</strong> Guaranteed suite access begins at <strong>2:00 PM (14:00)</strong> local time. Early arrivals may store luggage with the concierge at no charge.</li>
            <li><strong>Check-out Time:</strong> Guests must vacate their suites by <strong>11:00 AM</strong> on the day of departure.</li>
            <li><strong>Late Check-Out:</strong> Unscheduled late check-outs after 12:00 PM may incur a late check-out fee or an additional night&apos;s base charge.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            <span>3. 48-Hour Cancellation & Refund Policy</span>
          </h2>
          <p>
            We recognize that travel itineraries may shift due to unforeseen circumstances:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#71717A]">
            <li><strong>Free Cancellation Window:</strong> Cancellations completed at least <strong>48 hours prior</strong> to the 14:00 check-in time receive a <strong>100% full refund</strong> of all payments made.</li>
            <li><strong>Late Cancellations & No-Shows:</strong> Cancellations requested within 48 hours of check-in, or failure to arrive on the check-in date without notice, incur the configured policy penalty percentage.</li>
            <li><strong>Modifications:</strong> Date changes are permitted through the Manage Stay portal subject to rate differences and suite availability.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>4. Mandatory Guest Registration & Legal Identification</span>
          </h2>
          <p>
            Under Ghana Tourism Authority (GTA) hospitality regulations and Ghanaian law, all adult guests occupying a room must be registered at the front desk and present a valid government-issued photographic ID (Ghana Card, International Passport, or Driver&apos;s License). Failure to provide valid identification may result in denial of check-in without refund.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-600" />
            <span>5. Property Care, Key Cards & Non-Smoking Clause</span>
          </h2>
          <p>
            All indoor hotel facilities, suites, and common lounges are strictly 100% smoke-free. A dedicated deep cleaning fee of GH₵ 1,500 will be added to the folio if smoking occurs inside guest quarters. Guests are responsible for any damages caused to hotel property or furnishings during their stay.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <Hotel className="w-4 h-4 text-emerald-600" />
            <span>6. Hospitality Standards & Conduct</span>
          </h2>
          <p>
            We take pride in our tranquil luxury atmosphere. Guests are required to respect the quiet enjoyment of other patrons, particularly between 10:00 PM and 7:00 AM.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-3 border-t border-[#E4E4E7] pt-6">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E]">
            7. Governing Law
          </h2>
          <p className="text-[#71717A]">
            These terms and conditions are governed by and construed in accordance with the laws of the Republic of Ghana. Any disputes arising shall be subject to the exclusive jurisdiction of the courts of Ghana.
          </p>
        </section>
      </div>

      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#71717A] hover:text-[#1E1E1E] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
}
