import Link from "next/link";
import { ShieldCheck, Clock, RefreshCw, AlertCircle, Crown, ArrowRight, UserCheck, Sparkles, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export const metadata = {
  title: "Policies & Terms | Becca's Crown Beauty Vault",
  description:
    "Review our transparent studio policies: 30% non-refundable deposit, punctuality rules, solo client policy, hygiene standards, and rescheduling in Accra, Ghana.",
};

export default function PoliciesPage() {
  const policies = [
    {
      icon: ShieldCheck,
      title: "Mandatory 30% Non-Refundable Deposit",
      desc: "All reservations require a non-refundable 30% deposit to lock in your artist, equipment, and time slot. When you select a slot in our booking wizard, it is held while payment is processed securely via Paystack. The remaining 70% balance is payable upon arrival.",
    },
    {
      icon: Clock,
      title: "Punctuality & 30-Minute Cancellation",
      desc: "Clients are required to arrive 10 minutes prior to their scheduled start time to ensure a seamless prep and consultation. If you arrive 30 minutes late, your appointment will be automatically cancelled and your deposit forfeited to protect subsequent client schedules.",
    },
    {
      icon: UserCheck,
      title: "Solo Client Policy (Strictly No Plus-Ones)",
      desc: "To preserve an intimate, tranquil, and hygienic studio atmosphere, only the individual receiving the scheduled service is permitted inside the studio. Friends, partners, and family members not booked for an active service cannot enter the treatment area or waiting lounge.",
    },
    {
      icon: RefreshCw,
      title: "Rescheduling & Deposit Transfer",
      desc: "We understand unexpected schedule shifts occur. You may reschedule your appointment up to 24 hours prior to your scheduled time to transfer your deposit once to a new date within 30 days. Reschedules requested under 24 hours forfeit the deposit.",
    },
    {
      icon: Sparkles,
      title: "Client Preparation & Hygiene Standards",
      desc: "For lash and brow services, please arrive with completely clean, oil-free eyes free of mascara or glue. For hair services, arrive with clean, detangled hair unless instructed otherwise. Please notify your specialist of any allergies or skin sensitivities beforehand.",
    },
    {
      icon: Camera,
      title: "Photography & Media Courtesy",
      desc: "We love capturing and celebrating our artistry! Photos or short videos of your completed glam may be taken for our professional portfolio and social channels. If you prefer not to appear on camera, simply inform your artist at the start of your session.",
    },
  ];

  return (
    <div className="space-y-10 sm:space-y-14 py-6 sm:py-8 max-w-4xl mx-auto">
      {/* Header */}
      <ScrollReveal variant="fade-up">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Fair & Transparent Standards</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-[#1E1E1E] tracking-tight">
            Studio Policies
          </h1>
          <p className="text-xs sm:text-sm text-[#71717A] max-w-xl mx-auto leading-relaxed">
            Our policies are designed to ensure seamless service, zero double-booking, and an exceptional luxury experience for every client.
          </p>
        </div>
      </ScrollReveal>

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {policies.map((p, idx) => {
          const Icon = p.icon;
          return (
            <ScrollReveal key={idx} variant="fade-up" delayMs={idx * 75}>
              <Card
                variant="white"
                className="p-6 sm:p-7 space-y-3 hover:border-black/20 transition-all rounded-[28px] h-full"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#F4F4F6] text-[#1E1E1E] flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-[#1E1E1E]">{p.title}</h2>
                <p className="text-xs text-[#71717A] leading-relaxed">{p.desc}</p>
              </Card>
            </ScrollReveal>
          );
        })}
      </div>

      {/* Questions CTA */}
      <ScrollReveal variant="fade-up">
        <Card variant="glass" className="p-8 text-center space-y-4 rounded-[32px]">
          <h2 className="text-lg sm:text-xl font-black text-[#1E1E1E]">
            Have questions about your upcoming event or booking?
          </h2>
          <p className="text-xs text-[#71717A] max-w-md mx-auto">
            Our studio concierge is available daily via WhatsApp or phone call to assist with group bookings, custom bridal trials, and policy inquiries.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/contact">
              <Button variant="blackPill" size="md" className="gap-2 text-xs font-bold shadow-md cursor-pointer">
                <span>Contact Concierge</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/book">
              <Button variant="outlinePill" size="md" className="text-xs font-semibold bg-white cursor-pointer">
                <span>Proceed to Booking</span>
              </Button>
            </Link>
          </div>
        </Card>
      </ScrollReveal>
    </div>
  );
}
