import Link from "next/link";
import { ShieldCheck, Clock, RefreshCw, AlertCircle, Hotel, ArrowRight, UserCheck, Sparkles, Key, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export const metadata = {
  title: "Hotel Policies & Stay Standards | Aura Royal Hotel & Suites",
  description:
    "Review our hotel policies: standard check-in (14:00) and check-out (11:00), 48-hour free cancellation, booking deposits, guest registration, and housekeeping in Accra, Ghana.",
};

export default function PoliciesPage() {
  const policies = [
    {
      icon: Clock,
      title: "Standard Check-In & Check-Out Times",
      desc: "Check-in begins at 2:00 PM (14:00) and check-out is by 11:00 AM. Early check-in or late check-out requests are subject to room availability and may incur nominal hourly fees or require booking our Late Check-out extra.",
    },
    {
      icon: RefreshCw,
      title: "48-Hour Free Cancellation & Refunds",
      desc: "Guests may cancel free of charge up to 48 hours prior to the standard check-in time (14:00 on the check-in date) for a 100% refund of any deposit paid. Cancellations made within 48 hours of check-in, or no-shows, incur the configured policy penalty.",
    },
    {
      icon: ShieldCheck,
      title: "Guaranteed Reservation Deposit",
      desc: "To guarantee your suite reservation, an upfront deposit (or full payment) is processed securely via Paystack using Mobile Money or Card. A 10-minute hold is placed while you complete checkout. The remaining balance can be settled in the guest portal or at the front desk.",
    },
    {
      icon: UserCheck,
      title: "Mandatory Photo ID & Guest Registration",
      desc: "In accordance with Ghana Tourism Authority (GTA) regulations and hotel security standards, all adult guests must present a valid government-issued photo ID (Ghana Card, Passport, Driver's License, or ECOWAS Biometric ID) upon arrival.",
    },
    {
      icon: Sparkles,
      title: "Housekeeping & Room Turnover Standards",
      desc: "Our dedicated housekeeping team provides daily cleaning, luxury linen refresh, and turndown service. Suites undergo rigorous inspection before guest handover. Specific housekeeping requests can be coordinated directly with the front desk.",
    },
    {
      icon: Key,
      title: "Smoke-Free Property & Respectful Stay",
      desc: "All indoor guest suites, corridors, and restaurant dining areas are strictly 100% non-smoking. Designated outdoor areas are provided for smokers. A deep cleaning fee will be charged to the guest folio if smoking occurs inside a suite.",
    },
  ];

  return (
    <div className="space-y-10 sm:space-y-14 py-6 sm:py-8 max-w-4xl mx-auto">
      {/* Header */}
      <ScrollReveal variant="fade-up">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
            <Hotel className="w-3.5 h-3.5 text-amber-600" />
            <span>Hospitality & Guest Standards</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-[#1E1E1E] tracking-tight">
            Hotel Stay Policies
          </h1>
          <p className="text-xs sm:text-sm text-[#71717A] max-w-xl mx-auto leading-relaxed">
            Designed to ensure flawless hospitality, supreme privacy, and transparent booking standards for every guest at Aura Royal Hotel.
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
            Have inquiries regarding an upcoming reservation or group booking?
          </h2>
          <p className="text-xs text-[#71717A] max-w-md mx-auto">
            Our 24/7 Front Desk Concierge is available via WhatsApp or telephone to assist with suite selections, special requests, and airport transfers.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/contact">
              <Button variant="blackPill" size="md" className="gap-2 text-xs font-bold shadow-md cursor-pointer">
                <span>Contact Front Desk</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/manage">
              <Button variant="outline" size="md" className="rounded-full text-xs font-bold px-5 cursor-pointer">
                <span>Manage Existing Stay</span>
              </Button>
            </Link>
          </div>
        </Card>
      </ScrollReveal>
    </div>
  );
}
