"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Bed,
  Check,
  ArrowRight,
  ShieldCheck,
  Star,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPesewas } from "@/lib/money";

interface RoomTypeData {
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
  availableQuantity?: number;
  isAvailable?: boolean;
  stayTotalPesewas?: number;
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

export default function RoomsListPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen py-24 text-center text-muted-foreground flex items-center justify-center">
          Loading suites & rooms...
        </div>
      }
    >
      <RoomsListContent />
    </React.Suspense>
  );
}

function RoomsListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [checkIn, setCheckIn] = React.useState<string>(
    searchParams.get("checkIn") || ""
  );
  const [checkOut, setCheckOut] = React.useState<string>(
    searchParams.get("checkOut") || ""
  );

  React.useEffect(() => {
    if (!checkIn) setCheckIn(getTomorrowDateStr());
    if (!checkOut) setCheckOut(getThreeDaysDateStr());
  }, [checkIn, checkOut]);
  const [adults, setAdults] = React.useState<number>(
    Number.parseInt(searchParams.get("adults") || "1", 10)
  );
  const [children, setChildren] = React.useState<number>(
    Number.parseInt(searchParams.get("children") || "0", 10)
  );

  const [rooms, setRooms] = React.useState<RoomTypeData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchingAvailability, setSearchingAvailability] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch all room types
  const fetchRooms = React.useCallback(async (inDate: string, outDate: string, ad: number, ch: number) => {
    setSearchingAvailability(true);
    setError(null);
    try {
      // 1. Fetch catalog room types
      const res = await fetch("/api/hotel/rooms");
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) {
        throw new Error("Could not load hotel rooms catalog.");
      }

      const allRooms: RoomTypeData[] = json.data;

      // 2. Fetch live availability for selected dates
      if (inDate && outDate && outDate > inDate) {
        try {
          const availRes = await fetch(
            `/api/hotel/availability?checkIn=${encodeURIComponent(inDate)}&checkOut=${encodeURIComponent(
              outDate
            )}&adults=${ad}&children=${ch}`
          );
          const availJson = await availRes.json();
          if (availJson.success && Array.isArray(availJson.data)) {
            const availMap = new Map<string, { availableQuantity: number; isAvailable: boolean; pricingPreview?: { totalPesewas: number } }>();
            for (const item of availJson.data) {
              availMap.set(item.roomTypeId, item);
            }

            for (const r of allRooms) {
              const av = availMap.get(r.id);
              if (av) {
                r.availableQuantity = av.availableQuantity;
                r.isAvailable = av.isAvailable;
                if (av.pricingPreview?.totalPesewas) {
                  r.stayTotalPesewas = av.pricingPreview.totalPesewas;
                }
              }
            }
          }
        } catch {
          // If availability check fails, retain default room types
        }
      }

      setRooms(allRooms);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load rooms");
    } finally {
      setLoading(false);
      setSearchingAvailability(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRooms(checkIn, checkOut, adults, children);
  }, [fetchRooms, checkIn, checkOut, adults, children]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkOut <= checkIn) {
      setError("Check-out date must be after check-in date.");
      return;
    }
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      adults: adults.toString(),
      children: children.toString(),
    });
    router.push(`/rooms?${params.toString()}`);
    fetchRooms(checkIn, checkOut, adults, children);
  };

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-neutral-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="space-y-3 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Luxury Accommodations in Accra</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Suites & Residences
          </h1>
          <p className="text-sm sm:text-base text-neutral-400 max-w-2xl">
            Designed for executive refinement, lavish relaxation, and bespoke hospitality. Every stay includes complimentary high-speed fiber Wi-Fi and 24/7 concierge service.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <Card className="p-4 sm:p-6 bg-neutral-900/90 border-neutral-800 rounded-2xl shadow-xl backdrop-blur-md">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Check-In Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={checkIn}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Check-Out Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn || new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Adults</label>
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
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Children</label>
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
                disabled={searchingAvailability}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold h-11 rounded-xl shadow-lg shadow-amber-500/20"
              >
                {searchingAvailability ? "Updating..." : "Update Search"}
              </Button>
            </div>
          </form>

          {error && <p className="text-xs text-rose-400 mt-2 font-medium">{error}</p>}
        </Card>

        {/* Room List Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-neutral-400 text-sm">Searching suite availability...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-neutral-900/50 rounded-2xl border border-neutral-800 p-8">
            <h3 className="text-xl font-bold text-white">No Suites Found</h3>
            <p className="text-sm text-neutral-400">
              Try adjusting your travel dates or number of guests to explore available rooms.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooms.map((room) => {
              const bookUrl = `/book?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(
                checkOut
              )}&adults=${adults}&children=${children}&roomTypeId=${encodeURIComponent(room.id)}`;

              const isSoldOut = room.isAvailable === false || room.availableQuantity === 0;

              return (
                <div
                  key={room.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden flex flex-col hover:border-neutral-700 transition-all duration-300 group shadow-lg"
                >
                  {/* Image Gallery Preview */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-950">
                    <Image
                      src={room.imageUrls[0] || "/images/salon_interior_accra.jpg"}
                      alt={room.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Badge */}
                    <div className="absolute top-4 left-4">
                      {isSoldOut ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-950/80 text-rose-300 border border-rose-800/80 backdrop-blur-md">
                          Sold Out
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 backdrop-blur-md">
                          {room.availableQuantity !== undefined
                            ? `${room.availableQuantity} Suite${room.availableQuantity > 1 ? "s" : ""} Left`
                            : "Available"}
                        </span>
                      )}
                    </div>

                    {/* Bottom overlay with bed config */}
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-neutral-300 font-medium">
                      <span className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                        <Bed className="w-3.5 h-3.5 text-amber-400" />
                        {room.bedConfiguration}
                      </span>
                      <span className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        Up to {room.maxAdults + room.maxChildren} Guests
                      </span>
                    </div>
                  </div>

                  {/* Room Details */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                    <div className="space-y-3">
                      <Link href={`/rooms/${room.slug}`}>
                        <h2 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                          {room.name}
                        </h2>
                      </Link>
                      <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {room.description}
                      </p>

                      {/* Amenities Pills */}
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {room.amenities.slice(0, 4).map((amenity, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-neutral-800/80 text-neutral-300 border border-neutral-700/50"
                          >
                            {amenity}
                          </span>
                        ))}
                        {room.amenities.length > 4 && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium text-neutral-400">
                            +{room.amenities.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price and CTA */}
                    <div className="pt-4 border-t border-neutral-800 flex items-end justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
                          From
                        </div>
                        <div className="text-2xl font-black text-amber-400">
                          {formatPesewas(room.basePricePesewas)}
                          <span className="text-xs text-neutral-400 font-normal"> / night</span>
                        </div>
                        {room.stayTotalPesewas && (
                          <div className="text-xs text-neutral-400">
                            Stay Total: <span className="font-semibold text-neutral-200">{formatPesewas(room.stayTotalPesewas)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link href={`/rooms/${room.slug}`}>
                          <Button variant="outline" size="sm" className="border-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs h-9">
                            Details
                          </Button>
                        </Link>
                        {isSoldOut ? (
                          <Button size="sm" disabled className="bg-neutral-800 text-neutral-500 rounded-xl text-xs h-9 cursor-not-allowed">
                            Unavailable
                          </Button>
                        ) : (
                          <Link href={bookUrl}>
                            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-xs h-9 shadow-md shadow-amber-500/20">
                              Book Suite
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

