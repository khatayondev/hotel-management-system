"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  CreditCard,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Crown,
  Search,
  ArrowRight,
  ArrowUpRight,
  Check,
  X,
  Phone,
  User,
  Mail,
  FileText,
  Star,
  Gift,
  Sparkles,
} from "lucide-react";
import { formatPesewas } from "@/lib/money";

async function parseJsonSafely(res: Response) {
  try {
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: {
        message: res.status >= 500 ? "Service temporarily unavailable. Please retry in a moment." : "An unexpected response was received.",
      },
    };
  }
}

function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface ServiceAddon {
  id: string;
  name: string;
  durationMin: number;
  pricePesewas: number;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  durationMin: number;
  bufferMin: number;
  pricePesewas: number;
  depositType: string;
  depositValue: number;
  imageUrl?: string;
  addons: ServiceAddon[];
  staffServices: Array<{ staff: { id: string; name: string } }>;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  services: Service[];
}

interface AvailabilitySlot {
  startUtc: string;
  endUtc: string;
  staffId: string;
  staffName: string;
}

interface SlotHoldData {
  token: string;
  expiresAt: string;
  extendedCount: number;
}

interface BookingResultData {
  bookingId: string;
  reference: string;
  manageToken: string;
  status: string;
  subtotalPesewas: number;
  totalPesewas: number;
  depositRequiredPesewas: number;
  amountToPayPesewas: number;
  paymentType: "DEPOSIT" | "FULL";
  customer: {
    name: string;
    phone: string;
    email?: string | null;
  };
}

const STORAGE_KEY = "beccascrown_booking_wizard_state";

const STEP_BACKGROUNDS: Record<number, { image: string; title: string; subtitle: string }> = {
  1: {
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=2400&q=85",
    title: "Signature Artistry",
    subtitle: "Select your treatments and add-ons.",
  },
  2: {
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=2400&q=85",
    title: "Prime Appointments",
    subtitle: "Pick your preferred date and time slot.",
  },
  3: {
    image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=2400&q=85",
    title: "Guest Details",
    subtitle: "Instant SMS booking updates to your phone.",
  },
  4: {
    image: "/images/hero_bridal_glam.jpg",
    title: "Confirm & Pay",
    subtitle: "MoMo and Card encrypted checkout.",
  },
};

function resolveServiceFromCatalog(
  identifier: string | null | undefined,
  categories: Category[]
): Service | null {
  if (!identifier) return null;
  const cleanId = identifier.trim().toLowerCase();
  const allServices: Service[] = categories.flatMap((c) => c.services || []);
  if (allServices.length === 0) return null;

  // 1. Direct ID match (case-insensitive)
  const exact = allServices.find((s) => s.id.toLowerCase() === cleanId);
  if (exact) return exact;

  // 2. Comprehensive legacy UUID & slug aliases
  const legacyAliases: Record<string, string[]> = {
    // Frontal / Lace installs
    "a80c50b6-6f94-4aaa-8cff-d7558ffce78d": ["full frontal", "frontal", "lace"],
    "svc-frontal": ["full frontal", "frontal", "lace"],
    "full-frontal": ["full frontal", "frontal", "lace"],
    // Bridal Soft Glam
    "fbfb4850-4a54-43f1-97ef-f6833a296bc4": ["bridal soft glam", "bridal", "soft glam", "glam"],
    "svc-bridal": ["bridal soft glam", "bridal", "soft glam", "glam"],
    "bridal-glam": ["bridal soft glam", "bridal", "soft glam", "glam"],
    // Lashes / Volume
    "9731e67c-88bf-4124-ac04-3b3a1a1140d4": ["hybrid volume", "russian", "lashes", "classic lashes"],
    "svc-volume-lashes": ["hybrid volume", "russian", "lashes", "classic lashes"],
    "volume-lashes": ["hybrid volume", "russian", "lashes", "classic lashes"],
    // Braids
    "834b6107-a2b3-4742-ab1f-fa6e4a6e3d10": ["knotless", "goddess", "braid"],
    "svc-goddess-braids": ["knotless", "goddess", "braid"],
    // Pedicure
    "c0292917-7f05-4de9-956e-41130a586b7f": ["pedicure", "jelly", "spa"],
    // Ponytail
    "a0c6bda1-c2bb-45db-a5df-6f527e977f6b": ["frontal pony", "pony", "ponytail"],
    // Gown / Dress
    "svc-emerald-gown": ["gown", "emerald", "velvet", "dress"],
    // Silk press
    "svc-silk-press": ["silk press", "press", "treatment"],
  };

  const aliases = legacyAliases[cleanId];
  if (aliases) {
    for (const alias of aliases) {
      const match = allServices.find((s) => s.name.toLowerCase().includes(alias));
      if (match) return match;
    }
  }

  // 3. Name or substring match
  const nameMatch = allServices.find(
    (s) =>
      s.name.toLowerCase() === cleanId ||
      cleanId.includes(s.name.toLowerCase()) ||
      s.name.toLowerCase().includes(cleanId)
  );
  if (nameMatch) return nameMatch;

  // 4. Token-level partial match
  const tokens = cleanId.split(/[-_\s]+/).filter((t) => t.length >= 3);
  if (tokens.length > 0) {
    const tokenMatch = allServices.find((s) => {
      const sName = s.name.toLowerCase();
      return tokens.some((token) => sName.includes(token));
    });
    if (tokenMatch) return tokenMatch;
  }

  return null;
}

function BookingWizardContent() {
  const searchParams = useSearchParams();
  const initialServiceId = searchParams.get("serviceId");
  const initialDate = searchParams.get("date");
  const initialStep = searchParams.get("step");

  // Catalog State
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [catalogLoading, setCatalogLoading] = React.useState(true);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);

  // Active Category filter tab on Step 1
  const [activeCategoryFilter, setActiveCategoryFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Wizard Step (1 to 4 in Solo Shop mode)
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);

  // Selection States
  const [selectedServiceIds, setSelectedServiceIds] = React.useState<string[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = React.useState<string[]>([]);
  const [selectedStaffId, setSelectedStaffId] = React.useState<string>("any");
  const [selectedDate, setSelectedDate] = React.useState<string>(getTomorrowDate);
  const [selectedSlot, setSelectedSlot] = React.useState<AvailabilitySlot | null>(null);

  // Availability Slots Fetching
  const [slotsLoading, setSlotsLoading] = React.useState(true);
  const [slotsError, setSlotsError] = React.useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = React.useState<AvailabilitySlot[]>([]);

  // Customer Details (No Account)
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [customerBirthdayMonth, setCustomerBirthdayMonth] = React.useState<number | "">("");
  const [customerBirthdayDay, setCustomerBirthdayDay] = React.useState<number | "">("");
  const [showBirthdayPicker, setShowBirthdayPicker] = React.useState(false);
  const [customerNotes, setCustomerNotes] = React.useState("");
  const [phoneError, setPhoneError] = React.useState<string | null>(null);

  const daysInSelectedMonth = React.useMemo(() => {
    if (!customerBirthdayMonth) return 31;
    if (customerBirthdayMonth === 2) return 29;
    if ([4, 6, 9, 11].includes(Number(customerBirthdayMonth))) return 30;
    return 31;
  }, [customerBirthdayMonth]);

  // Hold State (Backdoor concurrency protection)
  const [hold, setHold] = React.useState<SlotHoldData | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = React.useState<number | null>(null);
  const [holdExpired, setHoldExpired] = React.useState(false);

  // Review & Payment
  const [paymentType, setPaymentType] = React.useState<"DEPOSIT" | "FULL">("DEPOSIT");
  const [policyAgreed, setPolicyAgreed] = React.useState(false);
  const [submittingBooking, setSubmittingBooking] = React.useState(false);
  const [bookingResult, setBookingResult] = React.useState<BookingResultData | null>(null);
  const [bookingError, setBookingError] = React.useState<string | null>(null);

  // 1. Fetch Catalog on Mount
  React.useEffect(() => {
    async function loadCatalog() {
      try {
        setCatalogLoading(true);
        const res = await fetch("/api/catalog");
        const json = await parseJsonSafely(res);
        if (json.success && json.data) {
          const fetchedCategories: Category[] = json.data.categories || [];
          setCategories(fetchedCategories);

          const allValidServices: Service[] = fetchedCategories.flatMap((c) => c.services || []);

          // If coming from search bar or card with a pre-selected service, prioritize and resolve it
          if (initialServiceId) {
            const matched = resolveServiceFromCatalog(initialServiceId, fetchedCategories);
            if (matched) {
              setSelectedServiceIds([matched.id]);
              if (initialDate) {
                setSelectedDate(initialDate);
              }
              setSelectedSlot(null);
              setSlotsLoading(true);
              setSlotsError(null);
              if (initialStep === "2" || !initialStep) {
                setStep(2);
              }
            } else {
              // Unrecognized serviceId in URL: fallback safely to step 1 so user can select
              console.warn("Unrecognized serviceId in URL:", initialServiceId);
              if (allValidServices.length > 0) {
                setSelectedServiceIds([allValidServices[0].id]);
              }
              setStep(1);
            }
          } else {
            // Restore saved state from localStorage
            const savedStr = localStorage.getItem(STORAGE_KEY);
            if (savedStr) {
              try {
                const saved = JSON.parse(savedStr);
                // Sanitize saved service IDs against current database catalog!
                if (saved.selectedServiceIds?.length) {
                  const validIds = saved.selectedServiceIds.filter((id: string) =>
                    allValidServices.some((s) => s.id === id)
                  );
                  if (validIds.length > 0) {
                    setSelectedServiceIds(validIds);
                  } else {
                    // Stale cache from another DB: reset cleanly
                    setSelectedServiceIds(allValidServices.length > 0 ? [allValidServices[0].id] : []);
                    setStep(1);
                  }
                }
                if (saved.selectedAddonIds) setSelectedAddonIds(saved.selectedAddonIds);
                if (saved.selectedStaffId) setSelectedStaffId(saved.selectedStaffId);
                if (saved.selectedDate) setSelectedDate(saved.selectedDate);
                if (saved.selectedSlot) setSelectedSlot(saved.selectedSlot);
                if (saved.customerName) setCustomerName(saved.customerName);
                if (saved.customerPhone) setCustomerPhone(saved.customerPhone);
                if (saved.customerEmail) setCustomerEmail(saved.customerEmail);
                if (saved.customerBirthdayMonth) setCustomerBirthdayMonth(saved.customerBirthdayMonth);
                if (saved.customerBirthdayDay) setCustomerBirthdayDay(saved.customerBirthdayDay);
                if (saved.customerNotes) setCustomerNotes(saved.customerNotes);
                if (saved.step && saved.step >= 1 && saved.step <= 4) {
                  // Only allow step 2 if valid services exist
                  if (saved.step === 2 && (!saved.selectedServiceIds?.length || !allValidServices.some((s) => saved.selectedServiceIds.includes(s.id)))) {
                    setStep(1);
                  } else {
                    setStep(saved.step as 1 | 2 | 3 | 4);
                  }
                }

                // Check hold validity
                if (saved.hold?.expiresAt) {
                  const expires = new Date(saved.hold.expiresAt).getTime();
                  const now = Date.now();
                  if (expires > now) {
                    setHold(saved.hold);
                    setHoldSecondsLeft(Math.floor((expires - now) / 1000));
                  } else {
                    setHoldExpired(true);
                  }
                }
              } catch (e) {
                console.warn("Could not parse saved booking state", e);
              }
            }
          }
        } else {
          setCatalogError(json.error?.message || "Failed to load studio catalogue");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error loading catalogue";
        setCatalogError(msg);
      } finally {
        setCatalogLoading(false);
      }
    }

    loadCatalog();
  }, [initialServiceId, initialDate, initialStep]);

  // 2. Persist State to LocalStorage on changes
  React.useEffect(() => {
    if (bookingResult) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const stateToSave = {
      step,
      selectedServiceIds,
      selectedAddonIds,
      selectedStaffId,
      selectedDate,
      selectedSlot,
      customerName,
      customerPhone,
      customerEmail,
      customerBirthdayMonth,
      customerBirthdayDay,
      customerNotes,
      hold,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // quota or private browsing
    }
  }, [
    step,
    selectedServiceIds,
    selectedAddonIds,
    selectedStaffId,
    selectedDate,
    selectedSlot,
    customerName,
    customerPhone,
    customerEmail,
    customerBirthdayMonth,
    customerBirthdayDay,
    customerNotes,
    hold,
    bookingResult,
  ]);

  // 3. Hold Countdown Timer
  React.useEffect(() => {
    if (!hold || !hold.expiresAt) return;

    const timer = setInterval(() => {
      const diff = Math.floor((new Date(hold.expiresAt).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setHoldSecondsLeft(0);
        setHoldExpired(true);
        clearInterval(timer);
      } else {
        setHoldSecondsLeft(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [hold]);

  // Services lookup & calculations (declared before slot fetching effect)
  const allServicesList = React.useMemo(() => {
    const list: Service[] = [];
    categories.forEach((c) => {
      c.services.forEach((s) => list.push(s));
    });
    return list;
  }, [categories]);

  const selectedServices = React.useMemo(() => {
    return allServicesList.filter((s) => selectedServiceIds.includes(s.id));
  }, [allServicesList, selectedServiceIds]);

  const selectedAddons = React.useMemo(() => {
    const addons: ServiceAddon[] = [];
    selectedServices.forEach((s) => {
      s.addons?.forEach((a) => {
        if (selectedAddonIds.includes(a.id)) {
          addons.push(a);
        }
      });
    });
    return addons;
  }, [selectedServices, selectedAddonIds]);

  const subtotalPesewas = React.useMemo(() => {
    const svcSum = selectedServices.reduce((acc, s) => acc + s.pricePesewas, 0);
    const addonSum = selectedAddons.reduce((acc, a) => acc + a.pricePesewas, 0);
    return svcSum + addonSum;
  }, [selectedServices, selectedAddons]);

  const totalDurationMin = React.useMemo(() => {
    const svcDur = selectedServices.reduce((acc, s) => acc + s.durationMin + s.bufferMin, 0);
    const addonDur = selectedAddons.reduce((acc, a) => acc + a.durationMin, 0);
    return svcDur + addonDur;
  }, [selectedServices, selectedAddons]);

  const depositPesewas = React.useMemo(() => {
    return Math.round(subtotalPesewas * 0.3);
  }, [subtotalPesewas]);

  // Fetch Slots when Date, Services, or Staff changes on Step 2
  React.useEffect(() => {
    if (step !== 2) {
      return;
    }

    if (selectedServices.length === 0) {
      if (!catalogLoading && allServicesList.length > 0) {
        // If on step 2 with no valid services, redirect to step 1
        setStep(1);
      }
      setSlotsLoading(false);
      setAvailableSlots([]);
      setSlotsError(null);
      return;
    }

    if (!selectedDate) {
      setSlotsLoading(false);
      return;
    }

    let cancelled = false;

    setSlotsLoading(true);
    setAvailableSlots([]);
    setSlotsError(null);

    const params = new URLSearchParams();
    selectedServices.forEach((s) => params.append("serviceIds", s.id));
    selectedAddonIds.forEach((id) => params.append("addonIds", id));
    params.set("startDate", selectedDate);
    params.set("endDate", selectedDate);
    if (selectedStaffId && selectedStaffId !== "any") {
      params.set("staffId", selectedStaffId);
    }

    fetch(`/api/availability?${params.toString()}`)
      .then((res) => parseJsonSafely(res))
      .then((json) => {
        if (!cancelled) {
          if (json.success && json.data) {
            setAvailableSlots(json.data.slots || []);
          } else {
            setSlotsError(json.error?.message || "Could not fetch slots");
          }
          setSlotsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to connect to availability service";
          setSlotsError(msg);
          setSlotsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [step, selectedServices, selectedAddonIds, selectedDate, selectedStaffId, catalogLoading, allServicesList.length]);

  // Generate 14 Upcoming Days for the Horizontal Day Selector (Matching Reference Design)
  const upcomingDays = React.useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const isToday = i === 0;
      const isTomorrow = i === 1;
      const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum = d.getDate();
      days.push({
        dateStr,
        weekday,
        dayNum,
        label: isToday ? "Today" : isTomorrow ? "Tmrw" : weekday,
      });
    }
    return days;
  }, []);

  // Validation
  const validatePhone = (phone: string) => {
    const clean = phone.replace(/[\s\-()]/g, "");
    if (!clean) {
      setPhoneError("Ghana phone number is required");
      return false;
    }
    const digits = clean.replace(/\D/g, "");
    if (clean.startsWith("+")) {
      if (!digits.startsWith("233") || digits.length !== 12) {
        setPhoneError("Must be +233 followed by 9 digits (e.g. +233241234567)");
        return false;
      }
    } else if (digits.startsWith("233") && digits.length === 12) {
      // valid
    } else if (digits.startsWith("0") && digits.length === 10) {
      // valid
    } else if (digits.length === 9) {
      // valid
    } else {
      setPhoneError("Provide a 10-digit Ghana number (e.g. 0241234567) or +233 format");
      return false;
    }

    setPhoneError(null);
    return true;
  };

  // Create slot hold
  const createHoldForSlot = async (slot: AvailabilitySlot) => {
    try {
      const res = await fetch("/api/availability/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds: selectedServiceIds,
          addonIds: selectedAddonIds,
          staffId: slot.staffId,
          startUtc: slot.startUtc,
          endUtc: slot.endUtc,
          holdDurationMin: 10,
          customerPhone: customerPhone || undefined,
        }),
      });

      const json = await parseJsonSafely(res);
      if (json.success && json.data) {
        setHold({
          token: json.data.token,
          expiresAt: json.data.expiresAt,
          extendedCount: 0,
        });
        setHoldExpired(false);
        const sec = Math.floor(
          (new Date(json.data.expiresAt).getTime() - Date.now()) / 1000
        );
        setHoldSecondsLeft(sec > 0 ? sec : 600);
      } else {
        console.warn("Slot hold creation failed:", json.error?.message);
      }
    } catch (e) {
      console.error("Hold request error", e);
    }
  };

  // Submit Final Booking
  const handleFinalSubmit = async () => {
    if (!selectedSlot || selectedServiceIds.length === 0) return;
    if (!customerName || !customerPhone) {
      setStep(3);
      return;
    }
    if (!policyAgreed) {
      setBookingError("Please accept the cancellation policy to proceed.");
      return;
    }
    if (holdExpired) {
      setBookingError("Your selected time slot has timed out. Please select an available slot to continue.");
      setStep(2);
      return;
    }

    try {
      setSubmittingBooking(true);
      setBookingError(null);

      const res = await fetch("/api/bookings/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds: selectedServiceIds,
          addonIds: selectedAddonIds,
          staffId: selectedSlot.staffId,
          startUtc: selectedSlot.startUtc,
          endUtc: selectedSlot.endUtc,
          holdToken: hold?.token,
          customer: {
            name: customerName,
            phone: customerPhone,
            email: customerEmail || undefined,
            notes: customerNotes || undefined,
            birthdayMonth: customerBirthdayMonth ? Number(customerBirthdayMonth) : undefined,
            birthdayDay: customerBirthdayDay ? Number(customerBirthdayDay) : undefined,
          },
          paymentType,
          policyAgreed: true,
        }),
      });

      const json = await parseJsonSafely(res);
      if (json.success && json.data) {
        localStorage.removeItem(STORAGE_KEY);

        // Initiate Paystack
        try {
          const payRes = await fetch("/api/payments/initialize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookingId: json.data.bookingId,
              paymentType,
            }),
          });
          const payJson = await parseJsonSafely(payRes);
          if (payJson.success && payJson.data?.authorizationUrl) {
            window.location.href = payJson.data.authorizationUrl;
            return;
          }
        } catch (payErr) {
          console.warn("Paystack initialize redirect failed, falling back to summary", payErr);
        }

        setBookingResult(json.data);
      } else {
        setBookingError(json.error?.message || "Booking reservation failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initiate booking";
      setBookingError(msg);
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Reset wizard
  const handleReset = () => {
    if (confirm("Reset your booking progress and start over?")) {
      localStorage.removeItem(STORAGE_KEY);
      setSelectedServiceIds([]);
      setSelectedAddonIds([]);
      setSelectedStaffId("any");
      setSelectedSlot(null);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setCustomerNotes("");
      setHold(null);
      setHoldSecondsLeft(null);
      setHoldExpired(false);
      setBookingResult(null);
      setStep(1);
    }
  };

  // Navigation handlers
  const handleNext = () => {
    if (step === 1) {
      if (selectedServiceIds.length === 0) {
        alert("Please select at least one treatment to continue");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedSlot) {
        alert("Please select an available appointment slot");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!customerName.trim()) {
        alert("Please enter your name");
        return;
      }
      if (!validatePhone(customerPhone)) {
        return;
      }
      setStep(4);
    }
  };

  // Format month and year from selected date for Step 2
  const selectedDateObj = React.useMemo(() => {
    try {
      return new Date(selectedDate);
    } catch {
      return new Date();
    }
  }, [selectedDate]);

  const monthYearLabel = React.useMemo(() => {
    return selectedDateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [selectedDateObj]);

  // Filtered services for Step 1
  const filteredCategories = React.useMemo(() => {
    let base = categories;
    if (activeCategoryFilter !== "ALL") {
      base = base.filter((c) => c.slug.toLowerCase().includes(activeCategoryFilter.toLowerCase()));
    }
    if (!searchQuery.trim()) return base;

    const q = searchQuery.toLowerCase().trim();
    return base
      .map((cat) => ({
        ...cat,
        services: cat.services.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.description && s.description.toLowerCase().includes(q))
        ),
      }))
      .filter((cat) => cat.services.length > 0);
  }, [categories, activeCategoryFilter, searchQuery]);

  // CONFIRMATION VIEW
  if (bookingResult) {
    return (
      <div className="fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden bg-[#0B0A09] flex items-center justify-center p-3 sm:p-6">
        <div className="relative z-10 w-full max-w-lg rounded-[28px] sm:rounded-[36px] bg-white border border-zinc-200/90 p-6 sm:p-8 text-zinc-900 shadow-2xl space-y-5 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">
              Appointment Reserved
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950">
              You&apos;re Booked!
            </h1>
            <p className="text-xs text-zinc-500">
              Booking Ref: <strong className="text-zinc-900 font-mono tracking-wider">{bookingResult.reference}</strong>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-left text-xs space-y-2">
            <div className="flex justify-between text-zinc-500">
              <span>Client Name:</span>
              <span className="text-zinc-900 font-bold">{bookingResult.customer.name}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Contact Phone:</span>
              <span className="text-zinc-900 font-bold">{bookingResult.customer.phone}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Appointment Date:</span>
              <span className="text-zinc-900 font-bold">{selectedDate}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Deposit Required:</span>
              <span className="text-zinc-900 font-bold">{formatPesewas(bookingResult.depositRequiredPesewas)}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <Link href={`/manage/${bookingResult.manageToken}`}>
              <button
                type="button"
                className="w-full h-12 rounded-full bg-zinc-950 hover:bg-black text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                Proceed to Pay & Manage Booking
              </button>
            </Link>
            <Link href="/">
              <button
                type="button"
                className="w-full h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Return to Home
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden bg-[#0B0A09] flex items-center justify-center p-0 sm:p-4 md:p-6 lg:p-8 select-none">
      {/* Background canvas */}
      <div className="fixed inset-0 z-0 bg-[#0B0A09] pointer-events-none" />

      {/* The Booking Form Card - Fixed & Fitting Every Screen Perfectly */}
      <div className="relative z-10 w-full sm:max-w-xl md:max-w-2xl h-full sm:h-[92dvh] sm:max-h-[780px] sm:min-h-[580px] rounded-none sm:rounded-[36px] bg-white sm:border border-zinc-200/90 p-4 sm:p-5 lg:p-6 shadow-2xl text-zinc-900 flex flex-col justify-between overflow-hidden transition-all duration-300">
        {/* Top Bar inside the Card: Studio Brand Capsule & Step Indicator */}
        <div className="flex items-center justify-between pb-2.5 sm:pb-3.5 border-b border-zinc-200/80 shrink-0">
          {/* Studio Capsule */}
          <Link
            href="/"
            className="flex items-center gap-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 pl-1.5 pr-3 py-1 rounded-full transition-colors"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 text-zinc-950 font-black text-[10px] sm:text-[11px] flex items-center justify-center shadow-xs">
              BC
                </div>
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold block leading-none text-zinc-900">
                    Becca&apos;s Crown
                  </span>
                  <span className="text-[8px] sm:text-[9px] text-zinc-500 block leading-tight font-medium">
                    Beauty Vault
                  </span>
                </div>
              </Link>

              {/* Step indicator & Return to Home Button */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700">
                  Step <span className="font-poppins font-bold">{step}</span> of <span className="font-poppins font-bold">4</span>
                </span>
                <Link
                  href="/"
                  title="Return to Home"
                  className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Dynamic Step Header inside Card */}
            <div className="pt-2 sm:pt-3 pb-1 space-y-0.5 sm:space-y-1 shrink-0">
              <h2 className="text-lg sm:text-2xl font-black text-zinc-950 tracking-tight leading-snug">
                {step === 1 && "Book Your Crown Experience"}
                {step === 2 && "Choose Your Date & Time"}
                {step === 3 && "Your Contact Details"}
                {step === 4 && "Review & Confirm Slot"}
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-500 line-clamp-1 sm:line-clamp-2 font-medium">
                {step === 1 && "Select the signature treatments you wish to reserve today."}
                {step === 2 && "Pick your day and live time slot. Instant 10-minute calendar lock."}
                {step === 3 && "No password needed. SMS confirmations sent straight to your phone."}
                {step === 4 && "Choose your deposit option and lock in your reservation."}
              </p>
            </div>

            {/* Smart Search Bar (Only shown on Step 1 for maximum mobile height) */}
            {step === 1 && (
              <div className="my-1.5 sm:my-2 space-y-1 shrink-0">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                    }}
                    placeholder="Smart Search treatments (e.g. frontal, soft glam, lashes)..."
                    className="w-full h-9 sm:h-10 pl-9 pr-8 rounded-xl sm:rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 focus:bg-white transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 text-zinc-400 hover:text-zinc-900 p-0.5 rounded-full cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* =====================================================================
                STEP CONTENT CONTAINER (Dynamically fits available height)
            ===================================================================== */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 my-2 scrollbar-thin scrollbar-thumb-zinc-300">
              {/* ---------------------------------------------------------------
                  STEP 1: TREATMENT SELECTOR
              --------------------------------------------------------------- */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {["ALL", "hair", "bridal", "lashes", "pedicure", "facials"].map((slug) => (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => setActiveCategoryFilter(slug)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                          activeCategoryFilter === slug
                            ? "bg-zinc-950 text-white font-black shadow-xs"
                            : "bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 border border-zinc-200"
                        }`}
                      >
                        {slug === "ALL" ? "All Services" : slug}
                      </button>
                    ))}
                  </div>

                  {catalogLoading ? (
                    <div className="space-y-2.5">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="h-16 rounded-2xl bg-zinc-100 animate-pulse" />
                      ))}
                    </div>
                  ) : catalogError ? (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                      {catalogError}
                    </div>
                  ) : filteredCategories.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-center space-y-2">
                      <Search className="w-6 h-6 text-zinc-400 mx-auto" />
                      <p className="text-xs font-bold text-zinc-900">No treatments found</p>
                      <p className="text-[10px] text-zinc-500">
                        No treatments match &ldquo;{searchQuery}&rdquo;. Try another term or clear filter.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setActiveCategoryFilter("ALL");
                        }}
                        className="mt-1 px-3 py-1 rounded-full bg-zinc-200 hover:bg-zinc-300 text-[10px] text-zinc-800 font-bold transition-colors cursor-pointer"
                      >
                        Clear Search & Filters
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredCategories.map((cat) =>
                        cat.services.map((svc) => {
                          const isSelected = selectedServiceIds.includes(svc.id);
                          return (
                            <div
                              key={svc.id}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedServiceIds(selectedServiceIds.filter((id) => id !== svc.id));
                                } else {
                                  setSelectedServiceIds([...selectedServiceIds, svc.id]);
                                }
                              }}
                              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? "bg-amber-50/70 border-zinc-950 ring-1 ring-zinc-950 shadow-sm"
                                  : "bg-zinc-50/70 hover:bg-zinc-100/80 border-zinc-200/80"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected
                                      ? "bg-zinc-950 text-white border-zinc-950"
                                      : "border-zinc-300 bg-white"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-xs font-bold text-zinc-900 truncate">
                                    {svc.name}
                                  </h3>
                                  <span className="text-[10px] text-zinc-500 font-medium">
                                    <span className="font-poppins">{svc.durationMin}</span> mins
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs font-black text-zinc-950 shrink-0 font-poppins">
                                {formatPesewas(svc.pricePesewas)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ---------------------------------------------------------------
                  STEP 2: DATE & TIME
              --------------------------------------------------------------- */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Selected service preview tag */}
                  {selectedServices.length > 0 && (
                    <div className="flex items-center justify-between p-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-[11px]">
                      <div className="flex items-center gap-2 truncate">
                        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate font-semibold text-zinc-800">
                          {selectedServices.map((s) => s.name).join(", ")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-[10px] text-zinc-900 hover:underline shrink-0 font-bold ml-2 cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {/* Horizontal Day Selector */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-900 px-1">
                      <span>{monthYearLabel}</span>
                      <label className="text-[10px] text-zinc-500 flex items-center gap-1 cursor-pointer hover:text-zinc-900">
                        <CalendarIcon className="w-3 h-3" />
                        <span>Other Date</span>
                        <input
                          type="date"
                          value={selectedDate}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => {
                            setSelectedDate(e.target.value);
                            setSelectedSlot(null);
                            setAvailableSlots([]);
                            setSlotsLoading(true);
                          }}
                          className="sr-only"
                        />
                      </label>
                    </div>

                    {/* Day Pill Buttons */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {upcomingDays.slice(0, 5).map((d) => {
                        const isSelectedDay = selectedDate === d.dateStr;
                        return (
                          <button
                            key={d.dateStr}
                            type="button"
                            onClick={() => {
                              setSelectedDate(d.dateStr);
                              setSelectedSlot(null);
                              setAvailableSlots([]);
                              setSlotsLoading(true);
                            }}
                            className={`py-2 px-1 rounded-2xl text-center transition-all cursor-pointer ${
                              isSelectedDay
                                ? "bg-zinc-950 text-white font-black shadow-md scale-102"
                                : "bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 border border-zinc-200"
                            }`}
                          >
                            <span className="text-[9px] uppercase tracking-wider block opacity-75">
                              {d.weekday}
                            </span>
                            <span className="text-xs font-extrabold block font-poppins">
                              {d.label === "Today" ? "Today" : d.dayNum}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Slots 4-Column Grid */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1 font-medium">
                      <span>Available Time Slots</span>
                      <span>{totalDurationMin} min appointment</span>
                    </div>

                    {slotsLoading ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <div key={n} className="h-11 rounded-xl bg-zinc-100 animate-pulse" />
                        ))}
                      </div>
                    ) : slotsError ? (
                      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-medium">
                        {slotsError}
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="p-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-center space-y-1">
                        <Clock className="w-6 h-6 text-zinc-400 mx-auto" />
                        <p className="text-xs font-bold text-zinc-900">No slots open on this date</p>
                        <p className="text-[10px] text-zinc-500">Please choose another day above.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {availableSlots.map((slot, idx) => {
                          const isSelectedSlot =
                            selectedSlot?.startUtc === slot.startUtc &&
                            selectedSlot?.staffId === slot.staffId;

                          const slotTime = new Date(slot.startUtc).toLocaleTimeString("en-GB", {
                            timeZone: "Africa/Accra",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          });

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={async () => {
                                setSelectedSlot(slot);
                                await createHoldForSlot(slot);
                              }}
                              className={`h-11 min-h-[44px] rounded-xl text-center text-xs font-bold font-poppins transition-all cursor-pointer flex items-center justify-center ${
                                isSelectedSlot
                                  ? "bg-zinc-950 text-white font-black shadow-md ring-2 ring-zinc-950 scale-102"
                                  : "bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 border border-zinc-200"
                              }`}
                            >
                              {slotTime}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------------------
                  STEP 3: GUEST CLIENT INFORMATION (Minimalist Luxury Form)
              --------------------------------------------------------------- */}
              {step === 3 && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold tracking-wide text-zinc-700 flex items-center justify-between">
                      <span>Full Name</span>
                      <span className="text-[10px] text-zinc-400 font-normal">Required</span>
                    </label>
                    <div className="relative flex items-center rounded-xl bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus-within:border-zinc-950 focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-950/10 transition-all">
                      <User className="w-4 h-4 text-zinc-400 shrink-0 ml-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="Ama Mensah"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full h-11 pl-2.5 pr-4 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Ghana Phone Number */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold tracking-wide text-zinc-700 flex items-center justify-between">
                      <span>Ghana Mobile Number</span>
                      <span className="text-[10px] text-zinc-400 font-normal">MTN • Telecel • AT</span>
                    </label>
                    <div className={`relative flex items-center rounded-xl bg-zinc-50 border transition-all ${
                      phoneError
                        ? "border-rose-400 bg-rose-50/50 focus-within:ring-2 focus-within:ring-rose-500/20"
                        : "border-zinc-200 hover:border-zinc-300 focus-within:border-zinc-950 focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-950/10"
                    }`}>
                      <Phone className="w-4 h-4 text-zinc-400 shrink-0 ml-3.5" />
                      <span className="text-xs font-semibold text-zinc-500 pl-2 shrink-0 select-none">🇬🇭</span>
                      <input
                        type="tel"
                        required
                        placeholder="024 123 4567"
                        value={customerPhone}
                        onChange={(e) => {
                          setCustomerPhone(e.target.value);
                          if (phoneError) validatePhone(e.target.value);
                        }}
                        onBlur={() => validatePhone(customerPhone)}
                        className="w-full h-11 pl-2 pr-4 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
                      />
                    </div>
                    {phoneError ? (
                      <p className="text-[10px] text-rose-600 font-medium pl-1">{phoneError}</p>
                    ) : (
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1.5 pl-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>Instant SMS appointment reminder sent here</span>
                      </p>
                    )}
                  </div>

                  {/* Email Address */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold tracking-wide text-zinc-700 flex items-center justify-between">
                      <span>Email Address</span>
                      <span className="text-[10px] text-zinc-400 font-normal">Optional</span>
                    </label>
                    <div className="relative flex items-center rounded-xl bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus-within:border-zinc-950 focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-950/10 transition-all">
                      <Mail className="w-4 h-4 text-zinc-400 shrink-0 ml-3.5" />
                      <input
                        type="email"
                        placeholder="ama@example.com (for calendar pass)"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full h-11 pl-2.5 pr-4 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Luxury VIP Birthday Crown Perk Card */}
                  <div className="rounded-2xl bg-amber-50/60 border border-amber-200/80 p-3.5 space-y-2.5 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-200/60 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 shadow-xs">
                          <Gift className="w-4 h-4 text-amber-700" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-zinc-900">VIP Birthday Perk</span>
                          </div>
                          <p className="text-[11px] text-zinc-600 leading-tight">
                            Unlock complimentary birthday styling perks and gifts.
                          </p>
                        </div>
                      </div>

                      {customerBirthdayMonth && customerBirthdayDay ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerBirthdayMonth("");
                            setCustomerBirthdayDay("");
                          }}
                          className="text-[10px] text-zinc-500 hover:text-rose-600 underline cursor-pointer shrink-0 font-medium"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>

                    {/* Active Selected Birthday Pill */}
                    {customerBirthdayMonth && customerBirthdayDay && !showBirthdayPicker && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-100/70 border border-amber-300/80 text-xs">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="font-bold text-zinc-900">
                            {MONTH_NAMES[customerBirthdayMonth - 1]} {customerBirthdayDay}
                          </span>
                          <span className="text-[10px] text-amber-700 font-semibold">• Birthday Perk Active 👑</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowBirthdayPicker(true)}
                          className="text-[10px] font-bold text-zinc-900 hover:underline cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    )}

                    {/* Trigger Button if not selected and not open */}
                    {(!customerBirthdayMonth || !customerBirthdayDay) && !showBirthdayPicker && (
                      <button
                        type="button"
                        onClick={() => setShowBirthdayPicker(true)}
                        className="w-full h-9 rounded-xl bg-white hover:bg-zinc-50 border border-amber-200 text-xs font-semibold text-zinc-800 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                      >
                        <CalendarIcon className="w-3.5 h-3.5 text-amber-600" />
                        <span>Tap to Pick Birthday Month &amp; Day</span>
                      </button>
                    )}

                    {/* Interactive Visual UI Picker */}
                    {showBirthdayPicker && (
                      <div className="pt-2 border-t border-amber-200/60 space-y-3 animate-in fade-in duration-200">
                        {/* Step A: Month Pills */}
                        <div>
                          <div className="flex items-center justify-between pb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              1. Birth Month:
                            </span>
                            {customerBirthdayMonth ? (
                              <span className="text-[10px] font-bold text-amber-700">
                                {MONTH_NAMES[customerBirthdayMonth - 1]}
                              </span>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                            {MONTH_NAMES.map((name, idx) => {
                              const mNum = idx + 1;
                              const isSelected = customerBirthdayMonth === mNum;
                              return (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => {
                                    setCustomerBirthdayMonth(mNum);
                                    if (customerBirthdayDay && customerBirthdayDay > 28) {
                                      if (mNum === 2 && customerBirthdayDay > 29) setCustomerBirthdayDay(29);
                                      if ([4, 6, 9, 11].includes(mNum) && customerBirthdayDay > 30) setCustomerBirthdayDay(30);
                                    }
                                  }}
                                  className={`h-8 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center ${
                                    isSelected
                                      ? "bg-zinc-950 text-white font-bold shadow-xs"
                                      : "bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200"
                                  }`}
                                >
                                  {name.slice(0, 3)}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Step B: Day Grid */}
                        <div>
                          <div className="flex items-center justify-between pb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              2. Day:
                            </span>
                            {customerBirthdayDay ? (
                              <span className="text-[10px] font-bold text-amber-700">
                                Day {customerBirthdayDay}
                              </span>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((d) => {
                              const isSelected = customerBirthdayDay === d;
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => {
                                    if (!customerBirthdayMonth) {
                                      setCustomerBirthdayMonth(new Date().getMonth() + 1);
                                    }
                                    setCustomerBirthdayDay(d);
                                  }}
                                  className={`h-7 rounded-md text-[10px] font-medium transition-all cursor-pointer flex items-center justify-center ${
                                    isSelected
                                      ? "bg-zinc-950 text-white font-bold shadow-xs scale-105"
                                      : "bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200"
                                  }`}
                                >
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Done / Collapse Action */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/60">
                          <button
                            type="button"
                            onClick={() => setShowBirthdayPicker(false)}
                            className="px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-black text-xs font-bold text-white transition-all cursor-pointer"
                          >
                            {customerBirthdayMonth && customerBirthdayDay ? "Save & Close" : "Cancel"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Styling Notes */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold tracking-wide text-zinc-700 flex items-center justify-between">
                      <span>Styling Notes &amp; Special Requests</span>
                      <span className="text-[10px] text-zinc-400 font-normal">Optional</span>
                    </label>
                    <div className="relative flex items-start rounded-xl bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus-within:border-zinc-950 focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-950/10 transition-all">
                      <FileText className="w-4 h-4 text-zinc-400 shrink-0 mt-3 ml-3.5" />
                      <textarea
                        rows={2}
                        placeholder="Hair texture, lash length, allergies, or styling preferences..."
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        className="w-full p-2.5 pl-2.5 pr-4 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------------------
                  STEP 4: SUMMARY & PAYMENT (Review & Confirm)
              --------------------------------------------------------------- */}
              {step === 4 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {bookingError && (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                      {bookingError}
                    </div>
                  )}

                  {/* Receipt Summary */}
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2.5 text-xs text-zinc-900">
                    <div className="border-b border-zinc-200 pb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Selected Treatments
                      </p>
                      {selectedServices.map((s) => (
                        <div key={s.id} className="flex justify-between items-center pt-1">
                          <span className="font-bold text-zinc-900">{s.name}</span>
                          <span className="font-poppins font-bold text-zinc-900">{formatPesewas(s.pricePesewas)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1 text-zinc-600 text-[11px]">
                      <div className="flex justify-between">
                        <span>Appointment Time:</span>
                        <span className="font-bold text-zinc-900 font-poppins">
                          {selectedDate} at{" "}
                          {selectedSlot &&
                            new Date(selectedSlot.startUtc).toLocaleTimeString("en-GB", {
                              timeZone: "Africa/Accra",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Client:</span>
                        <span className="font-bold text-zinc-900">{customerName} (<span className="font-poppins">{customerPhone}</span>)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span className="font-bold text-zinc-900"><span className="font-poppins">{totalDurationMin}</span> minutes</span>
                      </div>
                      {customerBirthdayMonth && customerBirthdayDay && (
                        <div className="flex justify-between items-center text-amber-700 font-medium">
                          <span className="flex items-center gap-1">
                            <Gift className="w-3 h-3" /> VIP Birthday Perk:
                          </span>
                          <span className="font-bold text-zinc-900 font-poppins">
                            {MONTH_NAMES[customerBirthdayMonth - 1]} {customerBirthdayDay}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-zinc-200 pt-2 flex justify-between items-center text-sm font-black">
                      <span className="text-zinc-900">Total Amount:</span>
                      <span className="text-zinc-950 font-black text-base font-poppins">{formatPesewas(subtotalPesewas)}</span>
                    </div>
                  </div>

                  {/* Payment Type Selection (30% Deposit vs Full) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                      Choose Payment Amount
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentType("DEPOSIT")}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentType === "DEPOSIT"
                            ? "bg-zinc-950 text-white border-zinc-950 shadow-md font-bold"
                            : "bg-zinc-100 text-zinc-800 border-zinc-200 hover:bg-zinc-200/80"
                        }`}
                      >
                        <span className="text-[10px] uppercase block opacity-75">Pay 30% Deposit</span>
                        <span className="text-xs font-black block mt-0.5 font-poppins">
                          {formatPesewas(depositPesewas)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentType("FULL")}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentType === "FULL"
                            ? "bg-zinc-950 text-white border-zinc-950 shadow-md font-bold"
                            : "bg-zinc-100 text-zinc-800 border-zinc-200 hover:bg-zinc-200/80"
                        }`}
                      >
                        <span className="text-[10px] uppercase block opacity-75">Pay Full Amount</span>
                        <span className="text-xs font-black block mt-0.5 font-poppins">
                          {formatPesewas(subtotalPesewas)}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Cancellation Policy Checkbox */}
                  <label className="flex items-start gap-2.5 cursor-pointer text-[11px] text-zinc-600 pt-1">
                    <input
                      type="checkbox"
                      checked={policyAgreed}
                      onChange={(e) => setPolicyAgreed(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950 cursor-pointer"
                    />
                    <span>
                      I agree to the{" "}
                      <Link href="/policies" target="_blank" className="text-zinc-950 underline font-bold">
                        Studio Policies
                      </Link>
                      , including the 30% non-refundable deposit, 10-min early arrival requirement, and solo client policy.
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* =====================================================================
                BOTTOM ACTION BAR (Sticky & Visible at all times with Live Cart Total)
            ===================================================================== */}
            <div className="pt-2.5 sm:pt-3 border-t border-zinc-200/80 flex items-center gap-2 shrink-0 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
                  className="h-11 sm:h-12 px-4 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shrink-0 border border-zinc-200"
                >
                  Back
                </button>
              )}

              {step === 1 && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={selectedServiceIds.length === 0}
                  className={`flex-1 h-11 sm:h-12 rounded-full font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 flex items-center justify-between px-4 sm:px-5 cursor-pointer ${
                    selectedServiceIds.length > 0
                      ? "bg-zinc-950 text-white hover:bg-black"
                      : "bg-zinc-200 text-zinc-400 cursor-not-allowed opacity-60"
                  }`}
                >
                  <span className="font-bold text-[11px] sm:text-xs truncate mr-2">
                    {selectedServiceIds.length === 0 ? (
                      "Select treatment to continue"
                    ) : (
                      <>
                        <span className="font-poppins font-bold">{selectedServiceIds.length}</span> selected •{" "}
                        <span className="font-poppins font-bold">{formatPesewas(subtotalPesewas)}</span>
                      </>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span>Date & Time</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!selectedSlot}
                  className={`flex-1 h-11 sm:h-12 rounded-full font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 flex items-center justify-between px-4 sm:px-5 cursor-pointer ${
                    selectedSlot
                      ? "bg-zinc-950 text-white hover:bg-black"
                      : "bg-zinc-200 text-zinc-400 cursor-not-allowed opacity-60"
                  }`}
                >
                  <span className="font-bold text-[11px] sm:text-xs truncate mr-2 font-poppins">
                    {selectedSlot
                      ? new Date(selectedSlot.startUtc).toLocaleTimeString("en-GB", {
                          timeZone: "Africa/Accra",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "Choose a time slot"}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span>Client Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 h-11 sm:h-12 rounded-full bg-zinc-950 hover:bg-black text-white font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Review Booking</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {step === 4 && (
                <button
                  type="button"
                  disabled={submittingBooking || !policyAgreed}
                  onClick={handleFinalSubmit}
                  className="flex-1 h-11 sm:h-12 rounded-full bg-zinc-950 hover:bg-black text-white font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {submittingBooking ? (
                      "Locking Slot..."
                    ) : (
                      <>
                        Confirm &amp; Pay{" "}
                        <span className="font-poppins font-bold">
                          {formatPesewas(paymentType === "DEPOSIT" ? depositPesewas : subtotalPesewas)}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
}

export default function BookingWizardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden bg-[#0B0A09] flex items-center justify-center p-4">
          <div className="w-full max-w-xl h-[90dvh] max-h-[760px] rounded-[36px] bg-white border border-zinc-200 animate-pulse" />
        </div>
      }
    >
      <BookingWizardContent />
    </React.Suspense>
  );
}
