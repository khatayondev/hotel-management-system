"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Bed,
  ArrowRight,
  ShieldCheck,
  Star,
  Sparkles,
  UtensilsCrossed,
  Wifi,
  Coffee,
  Waves,
  MapPin,
  Clock,
  Phone,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { formatPesewas } from "@/lib/money";

const FEATURED_SUITES = [
  {
    title: "Deluxe King Suite",
    slug: "deluxe-king-suite",
    category: "EXECUTIVE LUXURY",
    pricePerNight: "GH₵ 1,200.00",
    bedConfig: "1 California King Bed",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
    description: "Ocean-facing balcony, marble soaking tub, espresso machine, and pillowtop mattress.",
    amenities: ["Ocean View", "Private Balcony", "Marble Bath", "24/7 Room Service"],
  },
  {
    title: "Executive Panoramic Suite",
    slug: "executive-panoramic-suite",
    category: "UPPER EXECUTIVE",
    pricePerNight: "GH₵ 1,850.00",
    bedConfig: "1 King Bed + 1 Daybed",
    image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
    description: "Floor-to-ceiling skyline glass, separate executive salon, workstation, and lounge privileges.",
    amenities: ["Skyline Views", "Executive Lounge", "Workstation", "Cocktail Bar"],
  },
  {
    title: "Royal Presidential Penthouse",
    slug: "royal-presidential-penthouse",
    category: "CROWN RESIDENCE",
    pricePerNight: "GH₵ 4,500.00",
    bedConfig: "2 King Master Suites",
    image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
    description: "Dual master suites, private rooftop terrace with heated plunge pool and dedicated butler.",
    amenities: ["Rooftop Plunge Pool", "Personal Butler", "Formal Dining", "Airport Chauffeur"],
  },
];

const HOTEL_EXPERIENCES = [
  {
    title: "Aura Signature Dining",
    subtitle: "Pan-African & French Fusion",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
    description: "Curated seasonal tasting menus, fresh Atlantic seafood, and bespoke cellar pairings.",
  },
  {
    title: "The Horizon Rooftop Bar",
    subtitle: "Sunset Cocktails & Vistas",
    image: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=800&q=80",
    description: "Panoramic views of the Accra coastline with handcrafted botanical cocktails and live jazz.",
  },
  {
    title: "Heated Infinity Pool",
    subtitle: "Cabanas & Garden Oasis",
    image: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=800&q=80",
    description: "Daybed butler service, refreshing fruit skewers, and ambient underwater soundscapes.",
  },
];

function getTomorrowDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getThreeDaysDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

export default function HotelHomePage() {
  const router = useRouter();

  const [checkIn, setCheckIn] = React.useState<string>(getTomorrowDateStr());
  const [checkOut, setCheckOut] = React.useState<string>(getThreeDaysDateStr());
  const [adults, setAdults] = React.useState<number>(2);
  const [children, setChildren] = React.useState<number>(0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkOut <= checkIn) {
      alert("Check-out date must be after check-in date.");
      return;
    }
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      adults: adults.toString(),
      children: children.toString(),
    });
    router.push(`/rooms?${params.toString()}`);
  };

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO SECTION WITH EMBEDDED SEARCH ENGINE */}
      {/* ------------------------------------------------------------- */}
      <section className="relative min-h-[90vh] flex flex-col justify-between pt-12 pb-16 px-4 sm:px-6 lg:px-8 bg-neutral-950 text-white overflow-hidden">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2400&q=85"
            alt="Aura Royal Hotel & Restaurant Accra"
            fill
            priority
            className="object-cover opacity-35 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-neutral-950/30" />
        </div>

        <div className="max-w-7xl mx-auto w-full relative z-10 my-auto py-12 space-y-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Accra&apos;s Premier Boutique Hotel &amp; Restaurant</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.08]">
            An Oasis of Refinement, Culinary Art &amp; Luxury Stays.
          </h1>

          <p className="text-base sm:text-lg text-neutral-300 max-w-2xl leading-relaxed">
            Experience world-class hospitality nestled in Airport Residential Area. Ocean-view master suites, fine-dining gastronomy, and seamless mobile payments.
          </p>

          {/* Real-time Hotel Availability Search Bar */}
          <Card className="p-4 sm:p-6 bg-neutral-900/90 border-neutral-800 rounded-3xl shadow-2xl backdrop-blur-xl max-w-4xl">
            <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Check-In
                </label>
                <input
                  type="date"
                  value={checkIn}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Check-Out
                </label>
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn || new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Adults
                </label>
                <select
                  value={adults}
                  onChange={(e) => setAdults(Number.parseInt(e.target.value, 10))}
                  className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value={1}>1 Adult</option>
                  <option value={2}>2 Adults</option>
                  <option value={3}>3 Adults</option>
                  <option value={4}>4 Adults</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Children
                </label>
                <select
                  value={children}
                  onChange={(e) => setChildren(Number.parseInt(e.target.value, 10))}
                  className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value={0}>0 Children</option>
                  <option value={1}>1 Child</option>
                  <option value={2}>2 Children</option>
                </select>
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold h-11 rounded-xl shadow-lg shadow-amber-500/20 text-sm"
                >
                  Search Available Suites
                </Button>
              </div>
            </form>
          </Card>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 pt-2 text-xs text-neutral-400 font-medium">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Best Direct Rate Guarantee
            </span>
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-amber-400" />
              Paystack Card &amp; Mobile Money
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              10-Minute Checkout Hold Lock
            </span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 2. SIGNATURE SUITES SHOWCASE */}
      {/* ------------------------------------------------------------- */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-amber-600 font-bold">
              Unrivalled Comfort
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1E1E1E] tracking-tight">
              Featured Luxury Suites
            </h2>
            <p className="text-sm text-[#71717A] max-w-xl">
              Each residence combines bespoke Ghanaian hardwood accents, Italian marble bathrooms, and panoramic balcony views.
            </p>
          </div>
          <Link href="/rooms">
            <Button variant="outline" className="border-black/10 text-xs font-bold gap-1 rounded-xl">
              <span>View All Suites</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {FEATURED_SUITES.map((suite, idx) => (
            <div
              key={idx}
              className="group bg-white rounded-3xl border border-black/10 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
                  <Image
                    src={suite.image}
                    alt={suite.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white">
                    {suite.category}
                  </div>
                </div>

                <div className="p-6 space-y-3">
                  <h3 className="text-xl font-bold text-[#1E1E1E] group-hover:text-amber-700 transition-colors">
                    {suite.title}
                  </h3>
                  <div className="text-xs text-[#71717A] flex items-center gap-1.5 font-medium">
                    <Bed className="w-3.5 h-3.5 text-amber-600" />
                    {suite.bedConfig}
                  </div>
                  <p className="text-xs text-[#71717A] leading-relaxed line-clamp-2">
                    {suite.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {suite.amenities.map((am, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-neutral-100 text-[11px] font-medium text-neutral-700"
                      >
                        {am}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0 border-t border-neutral-100 flex items-center justify-between mt-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-neutral-400">Nightly Rate</div>
                  <div className="text-xl font-black text-[#1E1E1E]">{suite.pricePerNight}</div>
                </div>
                <Link href={`/rooms/${suite.slug}`}>
                  <Button size="sm" className="bg-[#1E1E1E] hover:bg-black text-white text-xs font-bold rounded-xl h-9">
                    Explore Suite
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. RESTAURANT & LEISURE EXPERIENCES */}
      {/* ------------------------------------------------------------- */}
      <section className="bg-neutral-900 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold tracking-wider uppercase">
              <UtensilsCrossed className="w-3.5 h-3.5" /> Gastronomy &amp; Leisure
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Culinary Artistry at Aura
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              From our morning champagne buffet to evening rooftop jazz and 24-hour in-suite dining, indulge in Accra&apos;s finest epicurean journeys.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOTEL_EXPERIENCES.map((exp, idx) => (
              <div
                key={idx}
                className="bg-neutral-950 rounded-3xl border border-neutral-800 overflow-hidden shadow-lg flex flex-col justify-between"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image src={exp.image} alt={exp.title} fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
                </div>
                <div className="p-6 space-y-2">
                  <div className="text-xs uppercase tracking-wider font-bold text-amber-400">
                    {exp.subtitle}
                  </div>
                  <h3 className="text-xl font-bold text-white">{exp.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">{exp.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. HOTEL AMENITIES GRID */}
      {/* ------------------------------------------------------------- */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-[#1E1E1E]">
            Curated Hotel Services
          </h2>
          <p className="text-xs sm:text-sm text-[#71717A]">
            Designed to exceed the expectations of modern global travelers.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/60 text-center space-y-2">
            <Wifi className="w-6 h-6 mx-auto text-amber-600" />
            <div className="font-bold text-sm text-[#1E1E1E]">Gigabit Fiber Wi-Fi</div>
            <div className="text-xs text-[#71717A]">Unlimited throughout the property</div>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/60 text-center space-y-2">
            <MapPin className="w-6 h-6 mx-auto text-amber-600" />
            <div className="font-bold text-sm text-[#1E1E1E]">Airport Chauffeur</div>
            <div className="text-xs text-[#71717A]">10 minutes from Kotoka (ACC)</div>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/60 text-center space-y-2">
            <Waves className="w-6 h-6 mx-auto text-amber-600" />
            <div className="font-bold text-sm text-[#1E1E1E]">Heated Pool &amp; Spa</div>
            <div className="text-xs text-[#71717A]">Full wellness treatment center</div>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/60 text-center space-y-2">
            <Clock className="w-6 h-6 mx-auto text-amber-600" />
            <div className="font-bold text-sm text-[#1E1E1E]">24/7 Front Desk</div>
            <div className="text-xs text-[#71717A]">Express check-in and concierge</div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. CALL TO ACTION BANNER */}
      {/* ------------------------------------------------------------- */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-neutral-900 to-black text-white border border-neutral-800 text-center space-y-6 relative overflow-hidden shadow-2xl">
          <div className="max-w-2xl mx-auto space-y-3 relative z-10">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Ready for an Unforgettable Stay in Accra?
            </h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Book directly online for guaranteed lowest rates, instant mobile money confirmation, and complimentary airport chauffeur on multi-night stays.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <Link href="/rooms">
              <Button className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold px-8 h-12 rounded-xl text-sm shadow-xl shadow-amber-500/20">
                Browse All Suites
              </Button>
            </Link>
            <Link href="/manage">
              <Button variant="outline" className="border-neutral-700 text-neutral-200 hover:text-white px-8 h-12 rounded-xl text-sm">
                Manage Existing Stay
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
