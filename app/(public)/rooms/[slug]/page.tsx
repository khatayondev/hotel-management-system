"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Bed,
  Check,
  ArrowRight,
  ShieldCheck,
  Star,
  ChevronLeft,
  Sparkles,
  Wifi,
  Coffee,
  Tv,
  Bath,
  Wind,
  CreditCard,
  MapPin,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPesewas } from "@/lib/money";

interface RoomDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  maxAdults: number;
  maxChildren: number;
  bedConfiguration: string;
  basePricePesewas: number;
  amenities: string[];
  imageUrls: string[];
  operationalRoomCount: number;
}

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

export default function RoomDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = typeof params.slug === "string" ? params.slug : "";

  const [room, setRoom] = React.useState<RoomDetail | null>(null);
  const [selectedImage, setSelectedImage] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Booking widget form state
  const [checkIn, setCheckIn] = React.useState<string>(
    searchParams.get("checkIn") || getTomorrowDateStr()
  );
  const [checkOut, setCheckOut] = React.useState<string>(
    searchParams.get("checkOut") || getThreeDaysDateStr()
  );
  const [adults, setAdults] = React.useState<number>(
    Number.parseInt(searchParams.get("adults") || "1", 10)
  );
  const [children, setChildren] = React.useState<number>(
    Number.parseInt(searchParams.get("children") || "0", 10)
  );

  const [pricingPreview, setPricingPreview] = React.useState<{
    nights: number;
    subtotalPesewas: number;
    totalPesewas: number;
    depositRequiredPesewas: number;
  } | null>(null);

  // Fetch room details
  React.useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/hotel/rooms/${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setRoom(json.data);
          if (json.data.imageUrls && json.data.imageUrls.length > 0) {
            setSelectedImage(json.data.imageUrls[0]);
          }
        } else {
          setError(json.error?.message || "Room suite not found");
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load suite details");
        setLoading(false);
      });
  }, [slug]);

  // Fetch live pricing calculation when dates change
  React.useEffect(() => {
    if (!room || !checkIn || !checkOut || checkOut <= checkIn) {
      setPricingPreview(null);
      return;
    }

    fetch("/api/hotel/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomTypeId: room.id,
        checkIn,
        checkOut,
        adults,
        children,
        quantity: 1,
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setPricingPreview({
            nights: json.data.nights,
            subtotalPesewas: json.data.subtotalPesewas,
            totalPesewas: json.data.totalPesewas,
            depositRequiredPesewas: json.data.depositRequiredPesewas,
          });
        }
      })
      .catch(() => {
        // Silently ignore preview failures
      });
  }, [room, checkIn, checkOut, adults, children]);

  const handleBookNow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    if (checkOut <= checkIn) {
      alert("Check-out date must be after check-in date.");
      return;
    }

    const bookUrl = `/book?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(
      checkOut
    )}&adults=${adults}&children=${children}&roomTypeId=${encodeURIComponent(room.id)}`;
    router.push(bookUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0C0A] py-24 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-[#0E0C0A] text-neutral-100 py-20 px-4 text-center space-y-4">
        <h1 className="text-2xl font-bold text-white">Suite Not Found</h1>
        <p className="text-sm text-neutral-400">{error || "The requested room suite does not exist."}</p>
        <Link href="/rooms">
          <Button variant="outline" className="border-neutral-700 text-neutral-300">
            Back to Suites
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-neutral-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Link href="/rooms" className="hover:text-amber-400 transition-colors flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            All Suites
          </Link>
          <span>/</span>
          <span className="text-neutral-200">{room.name}</span>
        </div>

        {/* Title Section */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Executive Residence</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            {room.name}
          </h1>
          <p className="text-sm text-neutral-400 flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Bed className="w-4 h-4 text-amber-400" />
              {room.bedConfiguration}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4 text-amber-400" />
              Up to {room.maxAdults + room.maxChildren} Guests ({room.maxAdults} Adults, {room.maxChildren} Children)
            </span>
          </p>
        </div>

        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-[16/9] md:aspect-[21/9] w-full rounded-3xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-2xl">
            <Image
              src={selectedImage || room.imageUrls[0] || "/images/salon_interior_accra.jpg"}
              alt={room.name}
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
          </div>

          {room.imageUrls.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {room.imageUrls.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`relative w-28 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                    selectedImage === img ? "border-amber-500 scale-105" : "border-neutral-800 opacity-70 hover:opacity-100"
                  }`}
                >
                  <Image src={img} alt={`${room.name} photo ${idx + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content & Booking Sidebar Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Main Description & Features (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white border-b border-neutral-800 pb-3">
                About This Residence
              </h2>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
                {room.description}
              </p>
            </div>

            {/* Room Amenities */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white border-b border-neutral-800 pb-3">
                Suite Amenities & Features
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {room.amenities.map((amenity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-200"
                  >
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hotel Signature Standards */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white border-b border-neutral-800 pb-3">
                Included with Every Stay
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Flexible Check-In
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Standard check-in starts at 2:00 PM, with express luggage storage and reception concierge available 24 hours a day.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Free Cancellation Window
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    100% full refund on reservations cancelled at least 48 hours prior to arrival through our self-service portal.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Widget Sidebar (4 cols) */}
          <div className="lg:col-span-4 sticky top-24">
            <Card className="p-6 bg-neutral-900 border-neutral-800 rounded-3xl shadow-2xl space-y-6">
              <div className="flex items-baseline justify-between border-b border-neutral-800 pb-4">
                <div>
                  <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Rate per night
                  </div>
                  <div className="text-3xl font-black text-amber-400">
                    {formatPesewas(room.basePricePesewas)}
                  </div>
                </div>
                <div className="text-xs text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded-full">
                  Best Rate Guaranteed
                </div>
              </div>

              <form onSubmit={handleBookNow} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">Check-In</label>
                    <input
                      type="date"
                      value={checkIn}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">Check-Out</label>
                    <input
                      type="date"
                      value={checkOut}
                      min={checkIn || new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">Adults</label>
                    <select
                      value={adults}
                      onChange={(e) => setAdults(Number.parseInt(e.target.value, 10))}
                      className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                    >
                      {Array.from({ length: room.maxAdults }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} Adult{n > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">Children</label>
                    <select
                      value={children}
                      onChange={(e) => setChildren(Number.parseInt(e.target.value, 10))}
                      className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                    >
                      {Array.from({ length: room.maxChildren + 1 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>
                          {n} Child{n !== 1 ? "ren" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Price Breakdown Calculation */}
                {pricingPreview && (
                  <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2 text-xs">
                    <div className="flex justify-between text-neutral-300">
                      <span>Stay Duration</span>
                      <span className="font-semibold text-white">{pricingPreview.nights} Nights</span>
                    </div>
                    <div className="flex justify-between text-neutral-300">
                      <span>Room Subtotal</span>
                      <span className="font-semibold text-white">{formatPesewas(pricingPreview.subtotalPesewas)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-300">
                      <span>Taxes & Levies</span>
                      <span className="font-semibold text-white">
                        {formatPesewas(pricingPreview.totalPesewas - pricingPreview.subtotalPesewas)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-neutral-800 flex justify-between font-bold text-white text-sm">
                      <span>Grand Total</span>
                      <span className="text-amber-400">{formatPesewas(pricingPreview.totalPesewas)}</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 text-right">
                      Deposit required today: <span className="font-semibold text-white">{formatPesewas(pricingPreview.depositRequiredPesewas)}</span>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold h-12 rounded-2xl shadow-xl shadow-amber-500/20 text-sm"
                >
                  Reserve This Suite
                </Button>
              </form>

              <div className="space-y-2 pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400">
                <div className="flex items-center gap-1.5 text-neutral-300">
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  <span>Instant Paystack Checkout (Card & Mobile Money)</span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exclusive 10-Minute Checkout Hold Guarantee</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

