import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Hotel, MapPin, Clock, Calendar, ShieldCheck, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { ScrollProgressBar } from "@/components/ui/scroll-reveal";

export const metadata: Metadata = {
  title: "Aura Royal Hotel & Suites | Premier Luxury Hotel & Fine Dining in Accra, Ghana",
  description:
    "Experience bespoke luxury at Aura Royal Hotel in Airport Residential Area, Accra. Elegant suites, gourmet restaurant dining, 24/7 concierge, and seamless reservations with Paystack.",
  keywords: [
    "Aura Royal Hotel",
    "luxury hotel Accra",
    "boutique hotel Ghana",
    "hotel Airport Residential Accra",
    "fine dining restaurant Accra",
    "hotel booking Ghana",
    "executive suite Accra",
  ],
  openGraph: {
    title: "Aura Royal Hotel & Suites | Accra, Ghana",
    description: "Bespoke luxury suites and fine dining in Accra. Instant guaranteed reservations.",
    url: "https://auraroyalhotel.gh",
    siteName: "Aura Royal Hotel & Suites",
    locale: "en_GH",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Hotel",
  name: "Aura Royal Hotel & Suites",
  image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1600&auto=format&fit=crop",
  telephone: "+233241112233",
  url: "https://auraroyalhotel.gh",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  address: {
    "@type": "PostalAddress",
    streetAddress: "14 Senchi Street, Airport Residential Area",
    addressLocality: "Accra",
    addressRegion: "Greater Accra",
    postalCode: "GA-123-4567",
    addressCountry: "GH",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 5.6037,
    longitude: -0.1870,
  },
  priceRange: "GH₵ 1,200 - GH₵ 5,500",
  currenciesAccepted: "GHS",
  paymentAccepted: "Mobile Money (MTN, Telecel, AT), Visa, Mastercard, Cash",
};

export default function PublicSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-white text-[#18181B] flex flex-col justify-between selection:bg-black selection:text-white">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Luxury Golden Scroll Progress Indicator */}
      <ScrollProgressBar />

      {/* Dynamic Public Navbar */}
      <Suspense fallback={null}>
        <PublicNavbar />
      </Suspense>

      {/* Main Page Content */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden">{children}</main>

      {/* Ultra-Luxury Obsidian Dark Footer */}
      <footer className="mt-20 w-full max-w-full overflow-x-hidden bg-[#141210] text-[#E4E4E7] pt-16 pb-12 border-t border-zinc-800 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
          {/* Top Row: Brand & VIP Newsletter */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12 border-b border-zinc-800/80 items-start">
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border border-white/30 bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
                  <Hotel className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-widest text-white uppercase leading-none">
                    AURA ROYAL HOTEL
                  </h3>
                  <span className="text-[9px] text-amber-300 uppercase tracking-wider font-bold block mt-0.5">
                    Suites & Restaurant
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                14 Senchi Street, Airport Residential Area, Accra, Ghana
                <br />
                reservations@auraroyalhotel.gh • +233 (0) 24 111 2233
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Guaranteed Reservations • Real-Time Room Hold • Paystack Security</span>
              </div>
            </div>

            <div className="lg:col-span-7 lg:pl-10 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 block">
                VIP Private Guest Club
              </span>
              <p className="text-xs text-zinc-400">
                Subscribe for private suite privileges, seasonal tasting menus, and exclusive member rates.
              </p>
              <div className="flex items-center gap-2 max-w-md w-full">
                <input
                  type="email"
                  placeholder="Enter your email address..."
                  className="bg-zinc-900/90 border border-zinc-800 text-xs text-white rounded-xl px-3.5 h-10 w-full min-w-0 focus:outline-none focus:border-amber-400/60 placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  className="bg-[#FACC15] hover:bg-[#EAB308] text-black font-bold h-10 px-4 rounded-xl text-xs flex items-center justify-center shrink-0 transition-colors shadow-xs"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* Middle Row: Links Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-xs text-zinc-400">
            {/* Col 1 */}
            <div className="space-y-3">
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">
                Suites & Penthouses
              </h4>
              <ul className="space-y-2">
                <li><Link href="/rooms/deluxe-king-suite" className="hover:text-amber-300 transition-colors">Deluxe King Suite</Link></li>
                <li><Link href="/rooms/executive-panoramic-suite" className="hover:text-amber-300 transition-colors">Executive Panoramic Suite</Link></li>
                <li><Link href="/rooms/royal-presidential-penthouse" className="hover:text-amber-300 transition-colors">Royal Presidential Penthouse</Link></li>
                <li><Link href="/rooms" className="hover:text-amber-300 transition-colors">Compare All Suites</Link></li>
                <li><Link href="/book" className="hover:text-amber-300 transition-colors">Live Rate Calendar</Link></li>
              </ul>
            </div>

            {/* Col 2 */}
            <div className="space-y-3">
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">
                Hotel Experience
              </h4>
              <ul className="space-y-2">
                <li><Link href="/rooms" className="hover:text-amber-300 transition-colors">Fine Dining Restaurant</Link></li>
                <li><Link href="/rooms" className="hover:text-amber-300 transition-colors">Airport Chauffeur Transfer</Link></li>
                <li><Link href="/policies" className="hover:text-amber-300 transition-colors">Check-in & Stay Policies</Link></li>
                <li><Link href="/contact" className="hover:text-amber-300 transition-colors">Concierge & Directions</Link></li>
                <li><Link href="/login" className="hover:text-amber-300 transition-colors">Hotel Staff Portal</Link></li>
              </ul>
            </div>

            {/* Col 3 */}
            <div className="space-y-3">
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">
                Guest Services
              </h4>
              <ul className="space-y-2">
                <li><Link href="/manage" className="hover:text-amber-300 transition-colors">Manage Your Stay</Link></li>
                <li><Link href="/manage" className="hover:text-amber-300 transition-colors">Download .ICS Calendar</Link></li>
                <li><Link href="/policies" className="hover:text-amber-300 transition-colors">Cancellation & Refunds</Link></li>
                <li><Link href="/terms" className="hover:text-amber-300 transition-colors">Terms of Hospitality</Link></li>
                <li><Link href="/contact" className="hover:text-amber-300 transition-colors">24/7 Front Desk Help</Link></li>
              </ul>
            </div>

            {/* Col 4 */}
            <div className="space-y-3">
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">
                Payment Partners
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Official Paystack hospitality merchant. Instant MoMo & card authorization with guaranteed room holds.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {["MTN MoMo", "Telecel Cash", "AT Money", "Visa", "Mastercard", "Apple Pay"].map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Row: Legal, Socials, Copyright */}
          <div className="pt-8 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
            <p>© 2026 Aura Royal Hotel & Suites. All rights reserved. Airport Residential, Accra, Ghana.</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-5 gap-y-2 text-zinc-400">
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/policies" className="hover:text-white transition-colors">Guest Policies</Link>
              <Link href="/contact" className="hover:text-white transition-colors">WhatsApp Concierge</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
