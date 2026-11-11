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
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  CreditCard,
  Clock,
  Sparkles,
  Phone,
  User,
  Mail,
  FileText,
  AlertCircle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPesewas } from "@/lib/money";

interface RoomTypeOption {
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
  availableQuantity?: number;
  isAvailable?: boolean;
}

interface RoomExtraOption {
  id: string;
  name: string;
  pricePesewas: number;
  pricing: "PER_STAY" | "PER_NIGHT" | "PER_PERSON";
}

interface NightlyRate {
  date: string;
  pricePesewas: number;
  rateLabel?: string | null;
  isOverridden: boolean;
}

interface TaxBreakdown {
  id: string;
  name: string;
  percentage: number;
  taxPesewas: number;
}

interface PricingResult {
  nights: number;
  quantity: number;
  roomSubtotalPesewas: number;
  extrasSubtotalPesewas: number;
  subtotalPesewas: number;
  taxTotalPesewas: number;
  totalPesewas: number;
  depositRequiredPesewas: number;
  nightlyRates: NightlyRate[];
  taxes: TaxBreakdown[];
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

export default function HotelBookingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen py-24 text-center text-muted-foreground flex items-center justify-center">
          Loading booking wizard...
        </div>
      }
    >
      <HotelBookingContent />
    </React.Suspense>
  );
}

function HotelBookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Step state (1: Dates & Room, 2: Extras, 3: Guest Info, 4: Review, 5: Payment Hold)
  const [step, setStep] = React.useState<number>(1);

  // Search/Stay inputs
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
  const [selectedRoomTypeId, setSelectedRoomTypeId] = React.useState<string>(
    searchParams.get("roomTypeId") || ""
  );

  // Catalog data
  const [roomTypes, setRoomTypes] = React.useState<RoomTypeOption[]>([]);
  const [extras, setExtras] = React.useState<RoomExtraOption[]>([]);
  const [selectedExtras, setSelectedExtras] = React.useState<Record<string, number>>({});

  // Guest details inputs
  const [guestName, setGuestName] = React.useState("");
  const [guestPhone, setGuestPhone] = React.useState("+233");
  const [guestEmail, setGuestEmail] = React.useState("");
  const [nationality, setNationality] = React.useState("Ghanaian");
  const [idType, setIdType] = React.useState("GHANA_CARD");
  const [idNumber, setIdNumber] = React.useState("");
  const [specialRequests, setSpecialRequests] = React.useState("");

  // Hold & Reservation state
  const [pricing, setPricing] = React.useState<PricingResult | null>(null);
  const [holdToken, setHoldToken] = React.useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = React.useState<Date | null>(null);
  const [holdRemainingSeconds, setHoldRemainingSeconds] = React.useState<number>(0);
  const [createdReservation, setCreatedReservation] = React.useState<{
    id: string;
    reference: string;
    totalPesewas: number;
    depositRequiredPesewas: number;
  } | null>(null);

  // Loading & error states
  const [loading, setLoading] = React.useState(true);
  const [calculatingPrice, setCalculatingPrice] = React.useState(false);
  const [holdLoading, setHoldLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [payUrl, setPayUrl] = React.useState<string | null>(null);

  // 1. Initial catalog fetch (rooms & extras)
  React.useEffect(() => {
    async function loadCatalog() {
      try {
        const [roomsRes, extrasRes] = await Promise.all([
          fetch("/api/hotel/rooms"),
          fetch("/api/hotel/extras"),
        ]);
        const roomsJson = await roomsRes.json();
        const extrasJson = await extrasRes.json();

        if (roomsJson.success && Array.isArray(roomsJson.data)) {
          setRoomTypes(roomsJson.data);
          // If no room selected yet, pick first available
          if (!selectedRoomTypeId && roomsJson.data.length > 0) {
            setSelectedRoomTypeId(roomsJson.data[0].id);
          }
        }
        if (extrasJson.success && Array.isArray(extrasJson.data)) {
          setExtras(extrasJson.data);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load hotel catalog");
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, [selectedRoomTypeId]);

  // 2. Fetch live availability for selected dates
  React.useEffect(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return;

    fetch(
      `/api/hotel/availability?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(
        checkOut
      )}&adults=${adults}&children=${children}`
    )
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          const availMap = new Map<string, { availableQuantity: number; isAvailable: boolean }>();
          for (const item of json.data) {
            availMap.set(item.roomTypeId, item);
          }

          setRoomTypes((prev) =>
            prev.map((r) => {
              const av = availMap.get(r.id);
              return av
                ? { ...r, availableQuantity: av.availableQuantity, isAvailable: av.isAvailable }
                : r;
            })
          );
        }
      })
      .catch(() => {
        // Silently retain current availability
      });
  }, [checkIn, checkOut, adults, children]);

  // 3. Recalculate price whenever room, dates, or extras change
  React.useEffect(() => {
    if (!selectedRoomTypeId || !checkIn || !checkOut || checkOut <= checkIn) {
      setPricing(null);
      return;
    }

    setCalculatingPrice(true);
    const extrasPayload = Object.entries(selectedExtras)
      .filter(([_, qty]) => qty > 0)
      .map(([extraId, quantity]) => ({ extraId, quantity }));

    fetch("/api/hotel/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomTypeId: selectedRoomTypeId,
        checkIn,
        checkOut,
        quantity: 1,
        adults,
        children,
        extras: extrasPayload,
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setPricing(json.data);
        }
      })
      .catch(() => {
        // Silently ignore preview failures
      })
      .finally(() => {
        setCalculatingPrice(false);
      });
  }, [selectedRoomTypeId, checkIn, checkOut, adults, children, selectedExtras]);

  // 4. Hold countdown timer
  React.useEffect(() => {
    if (!holdExpiresAt) return;

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((holdExpiresAt.getTime() - Date.now()) / 1000));
      setHoldRemainingSeconds(diff);
      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  // Toggle or update extra quantity
  const handleExtraToggle = (extraId: string) => {
    setSelectedExtras((prev) => {
      const current = prev[extraId] || 0;
      return {
        ...prev,
        [extraId]: current > 0 ? 0 : 1,
      };
    });
  };

  // Step transitions
  const handleProceedToExtras = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkOut <= checkIn) {
      setError("Check-out date must be after check-in date.");
      return;
    }
    const selectedRoom = roomTypes.find((r) => r.id === selectedRoomTypeId);
    if (!selectedRoom || selectedRoom.isAvailable === false) {
      setError("Please select an available room suite.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleProceedToGuestInfo = () => {
    setError(null);
    setStep(3);
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setError("Guest name is required.");
      return;
    }
    if (!guestPhone.trim() || guestPhone.trim().length < 9) {
      setError("A valid phone number (E.164 format, e.g. +233...) is required.");
      return;
    }
    setError(null);
    setStep(4);
  };

  // Create Hold & Initialize Payment
  const handleAcquireHoldAndPay = async () => {
    setError(null);
    setHoldLoading(true);

    try {
      // 1. Acquire atomic RoomHold (10 minutes)
      const holdRes = await fetch("/api/hotel/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomTypeId: selectedRoomTypeId,
          checkIn,
          checkOut,
          quantity: 1,
          holdMinutes: 10,
        }),
      });

      const holdJson = await holdRes.json();
      if (!holdRes.ok || !holdJson.success) {
        throw new Error(holdJson.error?.message || "Selected suite is no longer available.");
      }

      const holdData = holdJson.data;
      setHoldToken(holdData.token);
      const expires = new Date(holdData.expiresAt);
      setHoldExpiresAt(expires);
      setHoldRemainingSeconds(Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000)));

      // 2. Create Reservation in PENDING_PAYMENT status
      const extrasPayload = Object.entries(selectedExtras)
        .filter(([_, qty]) => qty > 0)
        .map(([extraId, quantity]) => ({ extraId, quantity }));

      const resRes = await fetch("/api/hotel/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdToken: holdData.token,
          guest: {
            name: guestName.trim(),
            phone: guestPhone.trim(),
            email: guestEmail.trim() || undefined,
            nationality: nationality.trim() || undefined,
            idType: idType || undefined,
            idNumber: idNumber.trim() || undefined,
          },
          adults,
          children,
          extras: extrasPayload,
          notes: specialRequests.trim() || undefined,
          source: "WEBSITE",
          initialStatus: "PENDING_PAYMENT",
        }),
      });

      const resJson = await resRes.json();
      if (!resRes.ok || !resJson.success) {
        throw new Error(resJson.error?.message || "Failed to create reservation from hold.");
      }

      const resData = resJson.data;
      setCreatedReservation(resData);

      // 3. Initialize Paystack payment session
      const payRes = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: resData.id,
          paymentType: "DEPOSIT",
        }),
      });

      const payJson = await payRes.json();
      if (!payRes.ok || !payJson.success) {
        throw new Error(payJson.error?.message || "Failed to initialize Paystack payment session.");
      }

      setPayUrl(payJson.data.authorizationUrl);
      setStep(5);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to lock in suite.");
    } finally {
      setHoldLoading(false);
    }
  };

  const selectedRoom = roomTypes.find((r) => r.id === selectedRoomTypeId);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0C0A] py-24 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-neutral-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Wizard Steps Header */}
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guaranteed Direct Booking</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Reserve Your Hotel Stay
          </h1>

          {/* Stepper Dots */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  step === s
                    ? "w-8 bg-amber-500"
                    : step > s
                    ? "w-2.5 bg-emerald-500"
                    : "w-2.5 bg-neutral-800"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 1: Dates & Suite Selection */}
        {/* ------------------------------------------------------------- */}
        {step === 1 && (
          <form onSubmit={handleProceedToExtras} className="space-y-6">
            <Card className="p-6 bg-neutral-900 border-neutral-800 rounded-3xl space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                1. Select Stay Dates & Guests
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">Check-In</label>
                  <input
                    type="date"
                    value={checkIn}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
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
                    className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">Adults</label>
                  <select
                    value={adults}
                    onChange={(e) => setAdults(Number.parseInt(e.target.value, 10))}
                    className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
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
                    className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value={0}>0 Children</option>
                    <option value={1}>1 Child</option>
                    <option value={2}>2 Children</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Room Selection Cards */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bed className="w-5 h-5 text-amber-400" />
                Choose Your Suite
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {roomTypes.map((rt) => {
                  const isSelected = selectedRoomTypeId === rt.id;
                  const isSoldOut = rt.isAvailable === false;

                  return (
                    <div
                      key={rt.id}
                      onClick={() => !isSoldOut && setSelectedRoomTypeId(rt.id)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10"
                          : isSoldOut
                          ? "border-neutral-800 bg-neutral-950/40 opacity-60 cursor-not-allowed"
                          : "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-950">
                          <Image
                            src={rt.imageUrls[0] || "/images/salon_interior_accra.jpg"}
                            alt={rt.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base">{rt.name}</h3>
                          <div className="text-xs text-neutral-400">{rt.bedConfiguration}</div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-neutral-800/80 flex items-center justify-between mt-3">
                        <div>
                          <div className="text-sm font-black text-amber-400">
                            {formatPesewas(rt.basePricePesewas)}
                          </div>
                          <div className="text-[10px] text-neutral-400">per night</div>
                        </div>
                        {isSoldOut ? (
                          <span className="text-[11px] font-bold text-rose-400">Sold Out</span>
                        ) : (
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? "border-amber-500 bg-amber-500 text-black" : "border-neutral-700"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 rounded-2xl shadow-xl shadow-amber-500/20"
            >
              Continue to Hotel Extras
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 2: Hotel Extras Selection */}
        {/* ------------------------------------------------------------- */}
        {step === 2 && (
          <div className="space-y-6">
            <Card className="p-6 bg-neutral-900 border-neutral-800 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">2. Enhance Your Stay</h2>
                  <p className="text-xs text-neutral-400">
                    Customise your stay with exclusive dining, wellness, and private chauffeur options.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Change Suite
                </Button>
              </div>

              {extras.length === 0 ? (
                <p className="text-sm text-neutral-400 py-4">No additional extras are available at this time.</p>
              ) : (
                <div className="space-y-3">
                  {extras.map((extra) => {
                    const isChecked = (selectedExtras[extra.id] || 0) > 0;
                    return (
                      <div
                        key={extra.id}
                        onClick={() => handleExtraToggle(extra.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isChecked
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                              isChecked ? "border-amber-500 bg-amber-500 text-black" : "border-neutral-700"
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-semibold text-white text-sm">{extra.name}</div>
                            <div className="text-xs text-neutral-400">
                              Pricing type: {extra.pricing.replace("_", " ").toLowerCase()}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-amber-400 text-sm">
                            +{formatPesewas(extra.pricePesewas)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="w-1/3 border-neutral-700 text-neutral-300 h-12 rounded-2xl"
              >
                Back
              </Button>
              <Button
                onClick={handleProceedToGuestInfo}
                className="w-2/3 bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 rounded-2xl shadow-xl shadow-amber-500/20"
              >
                Continue to Guest Details
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 3: Guest Details Form */}
        {/* ------------------------------------------------------------- */}
        {step === 3 && (
          <form onSubmit={handleProceedToReview} className="space-y-6">
            <Card className="p-6 bg-neutral-900 border-neutral-800 rounded-3xl space-y-6">
              <div className="border-b border-neutral-800 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-400" />
                  3. Primary Guest Information
                </h2>
                <p className="text-xs text-neutral-400">
                  Please provide your contact details for instant SMS reservation confirmations and keycard check-in.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">
                    Full Name <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Kwame Mensah"
                    className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">
                    Phone (E.164 with Country Code) <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+233241234567"
                    className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">
                    SMS booking confirmations and management OTPs will be sent here.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="kwame.mensah@example.gh"
                    className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="Ghanaian"
                    className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">ID Type (Optional)</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="GHANA_CARD">Ghana Card</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVERS_LICENSE">Driver's License</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">ID Number (Optional)</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="GHA-123456789-0"
                    className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">Special Requests & Notes</label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="e.g. Early check-in requested, high floor, quiet room, dietary preferences..."
                  rows={3}
                  className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </Card>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
                className="w-1/3 border-neutral-700 text-neutral-300 h-12 rounded-2xl"
              >
                Back
              </Button>
              <Button
                type="submit"
                className="w-2/3 bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 rounded-2xl shadow-xl shadow-amber-500/20"
              >
                Review Stay & Pricing
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 4: Review with Full Price Breakdown */}
        {/* ------------------------------------------------------------- */}
        {step === 4 && (
          <div className="space-y-6">
            <Card className="p-6 bg-neutral-900 border-neutral-800 rounded-3xl space-y-6">
              <div className="border-b border-neutral-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">4. Review Stay & Charges</h2>
                  <p className="text-xs text-neutral-400">
                    Verify stay details before acquiring your exclusive 10-minute checkout room hold.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(3)}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  Edit Details
                </Button>
              </div>

              {/* Stay Summary Card */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <div className="text-neutral-400 font-semibold">Suite</div>
                  <div className="text-white font-bold text-sm mt-0.5">{selectedRoom?.name}</div>
                </div>
                <div>
                  <div className="text-neutral-400 font-semibold">Dates</div>
                  <div className="text-white font-bold text-sm mt-0.5">{checkIn} → {checkOut}</div>
                </div>
                <div>
                  <div className="text-neutral-400 font-semibold">Guests</div>
                  <div className="text-white font-bold text-sm mt-0.5">
                    {adults} Adult{adults > 1 ? "s" : ""}, {children} Child{children !== 1 ? "ren" : ""}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-400 font-semibold">Guest Name</div>
                  <div className="text-white font-bold text-sm mt-0.5">{guestName}</div>
                </div>
              </div>

              {/* Full Itemized Price Breakdown */}
              {calculatingPrice ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  Computing night rates, overrides, and taxes...
                </div>
              ) : pricing ? (
                <div className="space-y-4">
                  <h3 className="font-bold text-white text-sm">Itemized Price Breakdown</h3>

                  <div className="space-y-2 text-xs">
                    {/* Per-Night Breakdown */}
                    {pricing.nightlyRates.map((night, idx) => (
                      <div key={idx} className="flex justify-between text-neutral-300 py-1 border-b border-neutral-800/50">
                        <span>
                          Night {idx + 1} ({night.date})
                          {night.isOverridden && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400">
                              {night.rateLabel}
                            </span>
                          )}
                        </span>
                        <span className="font-semibold text-white">{formatPesewas(night.pricePesewas)}</span>
                      </div>
                    ))}

                    {/* Extras */}
                    {pricing.extrasSubtotalPesewas > 0 && (
                      <div className="flex justify-between text-neutral-300 py-1 border-b border-neutral-800/50">
                        <span>Selected Hotel Extras</span>
                        <span className="font-semibold text-white">{formatPesewas(pricing.extrasSubtotalPesewas)}</span>
                      </div>
                    )}

                    {/* Taxes */}
                    {pricing.taxes.map((t) => (
                      <div key={t.id} className="flex justify-between text-neutral-400 py-1">
                        <span>
                          {t.name} ({t.percentage}%)
                        </span>
                        <span className="font-semibold text-neutral-300">{formatPesewas(t.taxPesewas)}</span>
                      </div>
                    ))}

                    {/* Grand Total */}
                    <div className="pt-3 border-t border-neutral-700 flex justify-between text-base font-black text-white">
                      <span>Total Stay Price</span>
                      <span className="text-amber-400">{formatPesewas(pricing.totalPesewas)}</span>
                    </div>

                    {/* Deposit Due Today */}
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex justify-between items-center text-xs text-amber-300 font-semibold">
                      <span>Deposit Payable Now to Confirm Stay:</span>
                      <span className="text-sm font-black text-amber-400">{formatPesewas(pricing.depositRequiredPesewas)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(3)}
                className="w-1/3 border-neutral-700 text-neutral-300 h-12 rounded-2xl"
              >
                Back
              </Button>
              <Button
                onClick={handleAcquireHoldAndPay}
                disabled={holdLoading || calculatingPrice}
                className="w-2/3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black h-12 rounded-2xl shadow-xl shadow-amber-500/20"
              >
                {holdLoading ? "Acquiring 10-Min Hold..." : "Lock In Room & Proceed to Payment"}
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 5: RoomHold Live Countdown & Paystack Checkout */}
        {/* ------------------------------------------------------------- */}
        {step === 5 && (
          <div className="space-y-6">
            {/* Live Hold Countdown Banner */}
            <div className="p-6 rounded-3xl bg-neutral-900 border border-amber-500/40 shadow-2xl space-y-4 text-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Clock className="w-4 h-4 animate-pulse" />
                <span>Room Held Exclusively For You</span>
              </div>

              <div>
                <div className="text-4xl sm:text-6xl font-black text-amber-400 font-mono tracking-tight">
                  {formatCountdown(holdRemainingSeconds)}
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Time remaining to complete payment before this suite is released back to inventory.
                </p>
              </div>

              {createdReservation && (
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs max-w-md mx-auto text-left space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Reservation Reference:</span>
                    <span className="font-mono font-bold text-white">{createdReservation.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Suite:</span>
                    <span className="font-bold text-white">{selectedRoom?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Deposit Due Today:</span>
                    <span className="font-black text-amber-400">{formatPesewas(createdReservation.depositRequiredPesewas)}</span>
                  </div>
                </div>
              )}

              {/* Paystack Checkout Button */}
              {payUrl && (
                <div className="pt-2">
                  <a href={payUrl} className="block w-full">
                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black text-base h-14 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      Pay with Paystack (Card / Mobile Money)
                    </Button>
                  </a>
                </div>
              )}

              {/* Test mode instant confirmation shortcut */}
              {createdReservation && (
                <div className="pt-2">
                  <Link href={`/booking/confirmation?ref=${createdReservation.reference}`}>
                    <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white text-xs">
                      View Reservation Pass
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
