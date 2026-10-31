import { Suspense } from "react";
import Link from "next/link";
import { Crown, Clock, ArrowRight, Tag } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatPesewas } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export const metadata = {
  title: "Services & Rates | Becca's Crown Beauty Vault",
  description:
    "Explore our full beauty menu: bridal makeup, Russian volume lashes, luxury hairstyling, braids and couture dress rentals. View transparent pricing in GH₵.",
};

interface PublicAddon {
  id: string;
  name: string;
  durationMin: number;
  pricePesewas: number;
}

interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  bufferMin: number;
  pricePesewas: number;
  depositType: string;
  depositValue: number;
  imageUrl?: string | null;
  addons?: PublicAddon[];
}

interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  services: PublicService[];
}

async function OurServicesList({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: activeSlug } = await searchParams;

  let categoriesWithServices: PublicCategory[] = [];

  try {
    categoriesWithServices = (await prisma.serviceCategory.findMany({
      where: { deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        services: {
          where: { deletedAt: null, active: true },
          orderBy: { order: "asc" },
          include: {
            addons: {
              where: { active: true },
              orderBy: { createdAt: "asc" },
            },
            staffServices: {
              include: {
                staff: {
                  select: { id: true, name: true, photoUrl: true },
                },
              },
            },
          },
        },
      },
    })) as unknown as PublicCategory[];
  } catch (err) {
    console.error("Failed to load categories for public site:", err);
  }

  // Fallback data if DB has no categories yet
  if (!categoriesWithServices || categoriesWithServices.length === 0) {
    categoriesWithServices = [
      {
        id: "cat-makeup",
        name: "Makeup & Bridal Glam",
        slug: "makeup",
        description: "Flawless HD makeup tailored for Ghana's tropical climate.",
        services: [
          {
            id: "svc-bridal",
            name: "Luxury Bridal Soft Glam",
            description: "Full facial prep, 24h waterproof airbrush finish, custom lashes and touch-up kit.",
            durationMin: 90,
            bufferMin: 15,
            pricePesewas: 55000,
            imageUrl: "/images/hero_bridal_glam.jpg",
            depositType: "PERCENTAGE",
            depositValue: 30,
            addons: [
              { id: "add-1", name: "Chest & Collarbone Glow Prep", durationMin: 15, pricePesewas: 6000 },
              { id: "add-2", name: "Bridal Party Touch-up Kit", durationMin: 0, pricePesewas: 10000 },
            ],
          },
          {
            id: "svc-soft-glam",
            name: "Studio Editorial & Birthday Glam",
            description: "Radiant soft glam with sculpted brows, neutral or bold lip, and signature lashes.",
            durationMin: 60,
            bufferMin: 15,
            pricePesewas: 35000,
            imageUrl: "/images/hero_bridal_glam.jpg",
            depositType: "PERCENTAGE",
            depositValue: 30,
            addons: [],
          },
        ],
      },
      {
        id: "cat-lashes",
        name: "Lashes & Brow Artistry",
        slug: "lashes",
        description: "Precision lash extensions and architectural brow sculpting.",
        services: [
          {
            id: "svc-volume-lashes",
            name: "Russian Volume Lash Set",
            description: "Custom lightweight handmade fans for maximum drama and fluff.",
            durationMin: 105,
            bufferMin: 15,
            pricePesewas: 28000,
            imageUrl: "/images/lashes_studio.jpg",
            depositType: "PERCENTAGE",
            depositValue: 30,
            addons: [
              { id: "add-3", name: "Lash Cleanser Foam & Brush Kit", durationMin: 0, pricePesewas: 5000 },
            ],
          },
          {
            id: "svc-brow-lam",
            name: "Brow Lamination + Hybrid Tint",
            description: "Semi-permanent lifting and shaping to give full, feathery, runway-ready brows.",
            durationMin: 45,
            bufferMin: 15,
            pricePesewas: 18000,
            imageUrl: "/images/lashes_studio.jpg",
            depositType: "PERCENTAGE",
            depositValue: 30,
            addons: [],
          },
        ],
      },
      {
        id: "cat-rentals",
        name: "Couture Dress Rentals",
        slug: "rentals",
        description: "Exclusive evening gowns and traditional wedding attire for hire.",
        services: [
          {
            id: "svc-emerald-gown",
            name: "Emerald Beaded Evening Gown",
            description: "Hand-beaded corset evening gown with structured train. Dry cleaning included.",
            durationMin: 60,
            bufferMin: 15,
            pricePesewas: 45000,
            imageUrl: "/images/luxury_gown_rental.jpg",
            depositType: "PERCENTAGE",
            depositValue: 30,
            addons: [
              { id: "add-4", name: "Matching Luxury Beaded Clutch", durationMin: 0, pricePesewas: 8000 },
            ],
          },
        ],
      },
      {
        id: "cat-hair",
        name: "Hair Styling & Silk Press",
        slug: "hair",
        description: "Signature silk presses, lace frontal installs, and luxury treatments.",
        services: [
          {
            id: "svc-silk-press",
            name: "Crown Signature Silk Press & Steam Treatment",
            description: "Deep clarifying wash, protein infusion steam treatment, precision trim and glass finish.",
            durationMin: 90,
            bufferMin: 15,
            pricePesewas: 25000,
            imageUrl: "/images/salon_interior_accra.jpg",
            depositType: "PERCENTAGE",
            depositValue: 30,
            addons: [],
          },
        ],
      },
    ];
  }

  // Filter if active tab selected
  const displayedCategories = activeSlug
    ? categoriesWithServices.filter((c) => c.slug === activeSlug || c.id === activeSlug)
    : categoriesWithServices;

  return (
    <div className="space-y-10 sm:space-y-14 py-6 sm:py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 text-[11px] font-bold uppercase tracking-wider text-[#71717A]">
          <Crown className="w-3.5 h-3.5 text-amber-500" />
          <span>Transparent Pricing • Ghana Cedi</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#1E1E1E] tracking-tight">
          Services & Add-ons Menu
        </h1>
        <p className="text-xs sm:text-sm text-[#71717A] leading-relaxed">
          Select any service below to begin your booking. Choose optional add-ons, pick your preferred date and time, and secure your appointment in real time.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 px-2 scrollbar-none">
        <Link href="/our-services">
          <button
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              !activeSlug
                ? "bg-[#1E1E1E] text-white shadow-sm"
                : "bg-white text-[#71717A] hover:text-[#1E1E1E] border border-black/5"
            }`}
          >
            All Services
          </button>
        </Link>
        {categoriesWithServices.map((cat) => {
          const isActive = activeSlug === cat.slug || activeSlug === cat.id;
          return (
            <Link key={cat.id} href={`/our-services?category=${cat.slug || cat.id}`}>
              <button
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-[#1E1E1E] text-white shadow-sm"
                    : "bg-white text-[#71717A] hover:text-[#1E1E1E] border border-black/5"
                }`}
              >
                {cat.name}
              </button>
            </Link>
          );
        })}
      </div>

      {/* Categories & Services List */}
      <div className="space-y-12">
        {displayedCategories.map((category) => (
          <ScrollReveal key={category.id} variant="fade-up">
            <div className="space-y-6">
              <div className="border-b border-black/10 pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-1">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#1E1E1E]">
                    {category.name}
                  </h2>
                  {category.description && (
                    <p className="text-xs text-[#71717A] mt-0.5">{category.description}</p>
                  )}
                </div>
                <span className="text-xs text-[#71717A] font-semibold">
                  {category.services?.length || 0} Available
                </span>
              </div>

              {/* Services Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {category.services?.map((svc, sIdx) => {
                  const priceFormatted = formatPesewas(svc.pricePesewas);

                  return (
                    <ScrollReveal key={svc.id} variant="fade-up" delayMs={sIdx * 80}>
                      <div
                        className="group rounded-[28px] border border-black/5 bg-white p-6 shadow-sm hover:shadow-md hover:border-black/15 transition-all flex flex-col justify-between h-full"
                      >
                    <div className="space-y-4">
                      {/* Top Row: Title, Duration, Price */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-base font-extrabold text-[#1E1E1E] group-hover:text-black">
                            {svc.name}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-[#71717A]">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-3.5 h-3.5 text-[#1E1E1E]" />
                              {svc.durationMin} minutes
                            </span>
                            {svc.bufferMin > 0 && (
                              <span className="text-[11px] text-[#A1A1AA]">
                                +{svc.bufferMin}m buffer
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-base font-black text-[#1E1E1E] block">
                            {priceFormatted}
                          </span>
                          <span className="text-[10px] text-[#71717A] block">
                            {svc.depositType === "PERCENTAGE"
                              ? `${svc.depositValue}% deposit`
                              : svc.depositType === "NONE"
                              ? "No deposit"
                              : "Deposit required"}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {svc.description && (
                        <p className="text-xs text-[#71717A] leading-relaxed">
                          {svc.description}
                        </p>
                      )}

                      {/* Add-ons Available Preview */}
                      {svc.addons && svc.addons.length > 0 && (
                        <div className="pt-2">
                          <span className="text-[11px] font-bold text-[#1E1E1E] flex items-center gap-1 mb-2">
                            <Tag className="w-3 h-3 text-amber-500" />
                            Popular Add-ons Available:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {svc.addons.map((addon) => (
                              <span
                                key={addon.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F4F4F6] text-[11px] text-[#1E1E1E] font-medium"
                              >
                                <span>{addon.name}</span>
                                <span className="font-bold text-[#71717A]">
                                  (+{formatPesewas(addon.pricePesewas)})
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom CTA Button */}
                    <div className="pt-5 mt-4 border-t border-black/5 flex items-center justify-between">
                      <span className="text-[11px] text-[#71717A]">
                        Instant confirmation
                      </span>
                      <Link href={`/book?serviceId=${svc.id}`}>
                        <Button
                          size="sm"
                          className="bg-[#1E1E1E] text-white hover:bg-black rounded-full px-5 text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
                        >
                          <span>Book This Service</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </ScrollReveal>
                );
              })}
            </div>
          </div>
        </ScrollReveal>
        ))}
      </div>

      {/* Bottom Booking Banner */}
      <ScrollReveal variant="fade-up">
        <Card variant="glass" className="p-8 text-center space-y-4 rounded-[32px]">
          <h3 className="text-lg sm:text-xl font-black text-[#1E1E1E]">
            Want to combine multiple services?
          </h3>
          <p className="text-xs text-[#71717A] max-w-md mx-auto">
            Our mobile booking wizard allows you to multi-select hair, lash, makeup, and add-ons in a single visit with synchronized artist scheduling.
          </p>
          <Link href="/book">
            <Button variant="blackPill" size="md" className="gap-2 text-xs font-bold shadow-md cursor-pointer">
              <Crown className="w-4 h-4 text-amber-300" />
              <span>Launch Multi-Service Wizard</span>
            </Button>
          </Link>
        </Card>
      </ScrollReveal>
    </div>
  );
}

export default function OurServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
          <div className="h-10 w-48 bg-[#E4E4E7]/60 rounded-2xl animate-pulse mx-auto" />
          <div className="h-8 w-64 bg-[#E4E4E7]/40 rounded-full animate-pulse mx-auto" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 bg-[#E4E4E7]/40 rounded-[28px] animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <OurServicesList searchParams={searchParams} />
    </Suspense>
  );
}
