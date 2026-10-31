import Link from "next/link";
import { Scale, Clock, RefreshCw, ShieldCheck, AlertCircle, ArrowLeft, UserCheck, Sparkles, Camera } from "lucide-react";

export const metadata = {
  title: "Terms of Service | Becca's Crown Beauty Vault",
  description:
    "Terms of Service, non-refundable deposit terms, punctuality rules, solo client policy, and studio guidelines for Becca's Crown Beauty Vault in Accra, Ghana.",
};

export default function TermsOfServicePage() {
  return (
    <div className="py-8 sm:py-12 max-w-4xl mx-auto space-y-10 text-[#1E1E1E]">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
          <Scale className="w-3.5 h-3.5 text-black" />
          <span>Transparent Terms of Agreement</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#1E1E1E] tracking-tight">
          Terms of Service
        </h1>
        <p className="text-xs sm:text-sm text-[#71717A] max-w-xl mx-auto leading-relaxed">
          Please review these terms carefully before booking your beauty appointment with Becca&apos;s Crown Beauty Vault.
        </p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#E4E4E7] shadow-xs space-y-8 text-xs sm:text-sm leading-relaxed text-[#3F3F46]">
        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>1. Mandatory 30% Non-Refundable Booking Deposit</span>
          </h2>
          <p>
            To confirm and hold any appointment on our calendar, a <strong>mandatory 30% non-refundable deposit</strong> of the total service fee is required at the time of reservation. 
          </p>
          <p>
            When you select a time slot on our online booking system, your slot is temporarily held while payment is processed via Paystack (Mobile Money or Card). Appointments are officially booked only upon payment verification. The remaining <strong>70% balance</strong> is payable at the studio prior to commencement of your appointment.
          </p>
          <p className="text-amber-800 bg-amber-50/80 border border-amber-200/60 rounded-xl p-3 text-xs">
            <strong>Deposit Policy Notice:</strong> Booking deposits are strictly non-refundable under all circumstances, as reserved appointment slots prevent other clients from scheduling that dedicated artist and workstation.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>2. Punctuality & 30-Minute Cancellation Window</span>
          </h2>
          <p>
            We pride ourselves on punctuality and providing every client an unhurried, luxury experience.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#71717A]">
            <li><strong>10-Minute Early Arrival:</strong> Clients are required to arrive at the studio <strong>10 minutes before</strong> their scheduled appointment time. This ensures adequate time for check-in, sanitization, and consultation.</li>
            <li><strong>30-Minute Late Cancellation:</strong> If you arrive <strong>30 minutes or more past</strong> your scheduled appointment time, your appointment is <strong>automatically cancelled</strong>.</li>
            <li><strong>Deposit Forfeiture:</strong> Cancelled appointments due to 30-minute late arrivals forfeit the entire 30% booking deposit. Rebooking will require a new appointment and deposit.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>3. Solo Client Policy (Strictly No Plus-Ones)</span>
          </h2>
          <p>
            To guarantee absolute privacy, relaxation, sanitation, and focus for our beauty specialists, <strong>only the individual booked for an appointment is permitted inside the studio</strong>.
          </p>
          <p className="text-[#71717A]">
            Friends, relatives, partners, and children who are not receiving an active service cannot accompany you into the treatment area or waiting lounge. We respectfully ask that you make external arrangements for accompanying guests prior to arrival.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            <span>4. Rescheduling Window</span>
          </h2>
          <p>
            Should you need to reschedule your appointment, we require a minimum of <strong>24 hours advance notice</strong>.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#71717A]">
            <li><strong>With 24+ Hours Notice:</strong> Your 30% deposit may be transferred one time to an alternate open slot within 30 calendar days.</li>
            <li><strong>Under 24 Hours Notice or No-Shows:</strong> The deposit is completely forfeited, and any future booking will require a fresh deposit.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>5. Client Preparation, Health & Hygiene</span>
          </h2>
          <p>
            Clients must arrive with areas to be treated properly cleaned (e.g. clean, oil-free lashes and brows without mascara residue; clean, detangled hair). Please inform our artists of any allergies, skin conditions, ocular sensitivities, or medical conditions prior to your treatment.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-600" />
            <span>6. Photography & Media Consent</span>
          </h2>
          <p>
            We take pride in our craft and often document finished work for our creative portfolio and social media showcases. If you do not wish to be photographed or filmed, simply inform your stylist upon arrival.
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
