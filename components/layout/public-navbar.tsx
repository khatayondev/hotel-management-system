"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Menu, X, ArrowRight, Calendar } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";

interface SearchItem {
  id: string;
  title: string;
  category: string;
  rate: string;
  duration?: string;
  description?: string;
}

const SIGNATURE_TREATMENTS_FALLBACK: SearchItem[] = [
  {
    id: "deluxe-king-suite",
    title: "Deluxe King Suite",
    category: "SUITES & ROOMS",
    rate: "GH₵ 1,200.00",
    duration: "1 King Bed",
    description: "Spacious master bedroom with marble en-suite bathroom, rain shower, and private balcony.",
  },
  {
    id: "executive-panoramic-suite",
    title: "Executive Panoramic Suite",
    category: "SUITES & ROOMS",
    rate: "GH₵ 2,200.00",
    duration: "1 Super King Bed",
    description: "Floor-to-ceiling city views, executive work desk, living lounge, and complimentary mini-bar.",
  },
  {
    id: "royal-presidential-penthouse",
    title: "Royal Presidential Penthouse",
    category: "PENTHOUSE",
    rate: "GH₵ 5,500.00",
    duration: "2 Master Suites",
    description: "Private rooftop terrace, personal butler service, dedicated jacuzzi, and chef kitchenette.",
  },
  {
    id: "airport-chauffeur",
    title: "Airport VIP Chauffeur Transfer",
    category: "HOTEL EXTRAS",
    rate: "GH₵ 350.00",
    duration: "One-Way / Return",
    description: "Private Mercedes-Benz E-Class executive pickup directly from Kotoka International Airport.",
  },
  {
    id: "champagne-breakfast",
    title: "Daily Champagne Breakfast",
    category: "DINING",
    rate: "GH₵ 180.00",
    duration: "Per Guest / Day",
    description: "Freshly prepared artisan hot breakfast with mimosa station and barista coffee.",
  },
];

export function PublicNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [catalogItems, setCatalogItems] = React.useState<SearchItem[]>(SIGNATURE_TREATMENTS_FALLBACK);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  // Load public rooms to power smart live search
  React.useEffect(() => {
    fetch("/api/hotel/rooms")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const items: SearchItem[] = data.data.map((rt: any) => ({
            id: rt.slug,
            title: rt.name,
            category: "SUITES & ROOMS",
            rate: `GH₵ ${(rt.basePricePesewas / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} / night`,
            duration: rt.bedConfiguration || `${rt.maxAdults} Adults`,
            description: rt.description || "",
          }));
          if (items.length > 0) {
            setCatalogItems(items);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Click outside to close smart search dropdown
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lock body scroll when mobile menu is open
  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const filteredSearch = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return catalogItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [searchQuery, catalogItems]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchOpen(false);
    if (searchQuery.trim()) {
      router.push(`/rooms?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/rooms");
    }
  };

  const navLinks = [
    { href: "/rooms", label: "Suites & Rooms" },
    { href: "/policies", label: "Hotel Policies" },
    { href: "/manage", label: "Manage Stay" },
    { href: "/contact", label: "Concierge & Contact" },
  ];

  return (
    <>
      <header className="absolute top-0 left-0 right-0 z-50 w-full bg-transparent text-white transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-3.5 sm:py-5 flex items-center justify-between gap-4 lg:gap-6">
          {/* Brand Logo with Official Gold Mark & Modern Typography */}
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer shrink-0">
            <BrandLogo variant="mark" theme="gold" size="sm" className="drop-shadow-sm group-hover:scale-105 transition-transform" />
            <span className="text-white text-lg sm:text-2xl font-black tracking-tight group-hover:text-zinc-200 transition-colors">
              Aura Royal Hotel
            </span>
          </Link>

          {/* Center Navigation Links matching reference */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-xs sm:text-sm font-medium">
            {navLinks.map((link, idx) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={`${link.href}-${idx}`}
                  href={link.href}
                  className={`transition-colors cursor-pointer ${
                    isActive ? "text-white font-bold" : "text-white/75 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action: Smart Search Bar, Staff Portal & White Capsule "Book Now!" */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Smart Search Bar (Compact in Navbar) */}
            <div ref={searchContainerRef} className="relative">
              <form onSubmit={handleSearchSubmit} className="relative">
                <div className="flex items-center rounded-full border border-white/20 bg-white/10 hover:bg-white/15 focus-within:bg-zinc-950/95 focus-within:border-white/50 focus-within:ring-1 focus-within:ring-white/30 backdrop-blur-md px-3 py-1.5 transition-all w-28 sm:w-44 md:w-52 lg:w-60 focus-within:w-52 sm:focus-within:w-64 md:focus-within:w-72">
                  <Search className="w-3.5 h-3.5 text-zinc-300 mr-1.5 sm:mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search suites, amenities..."
                    value={searchQuery}
                    onFocus={() => setSearchOpen(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearchOpen(false);
                    }}
                    className="w-full bg-transparent text-xs text-white placeholder-zinc-400 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchOpen(false);
                      }}
                      className="text-zinc-400 hover:text-white p-0.5 shrink-0"
                      aria-label="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </form>

              {/* Smart Dropdown Autocomplete */}
              {searchOpen && searchQuery.trim().length > 0 && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-h-80 overflow-y-auto rounded-2xl bg-zinc-950/95 backdrop-blur-2xl border border-white/20 shadow-2xl p-2 z-50 text-white animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {filteredSearch.length > 0 ? "Matching Suites & Experiences" : "No exact match"}
                  </div>

                  {filteredSearch.length > 0 ? (
                    <div className="space-y-1">
                      {filteredSearch.map((item) => (
                        <Link
                          key={item.id}
                          href={item.category.includes("SUITES") ? `/rooms/${item.id}` : "/rooms"}
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-white/10 transition-colors group cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                              {item.title}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {item.category} • {item.duration}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-poppins font-bold text-amber-300">
                              {item.rate}
                            </div>
                            <span className="text-[9px] uppercase font-bold text-emerald-400 group-hover:underline">
                              View Suite →
                            </span>
                          </div>
                        </Link>
                      ))}

                      <Link
                        href={`/rooms?q=${encodeURIComponent(searchQuery.trim())}`}
                        onClick={() => setSearchOpen(false)}
                        className="block text-center pt-2 pb-1 border-t border-white/10 text-[11px] font-bold text-zinc-300 hover:text-white transition-colors"
                      >
                        View all results for &ldquo;{searchQuery}&rdquo; →
                      </Link>
                    </div>
                  ) : (
                    <div className="p-3 text-center space-y-2">
                      <p className="text-xs text-zinc-400">No suites matching &ldquo;{searchQuery}&rdquo;</p>
                      <Link
                        href="/rooms"
                        onClick={() => setSearchOpen(false)}
                        className="inline-block text-[11px] text-amber-300 font-bold hover:underline"
                      >
                        Browse All Suites & Rooms →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Staff Portal Link */}
            <Link
              href="/login"
              className="hidden md:inline-flex items-center px-3 py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 text-white text-[11px] font-semibold transition-all cursor-pointer shrink-0"
            >
              Staff Portal
            </Link>

            {/* White Background Capsule: Book Now! */}
            <Link
              href="/book"
              className="inline-flex items-center justify-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 font-bold text-xs sm:text-sm tracking-tight transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 cursor-pointer shrink-0"
            >
              Book Stay
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-white/90 hover:text-white transition-colors cursor-pointer p-1"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-start">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 bg-[#141210]/95 backdrop-blur-2xl border-b border-white/15 shadow-2xl rounded-b-3xl p-5 pt-5 space-y-5 animate-in slide-in-from-top-4 duration-200 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5"
              >
                <BrandLogo variant="mark" theme="gold" size="xs" />
                <span className="text-white text-base font-bold tracking-tight">
                  Aura Royal Hotel
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-90 transition-all"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Search */}
            <form
              onSubmit={(e) => {
                setMobileMenuOpen(false);
                handleSearchSubmit(e);
              }}
              className="relative"
            >
              <div className="flex items-center rounded-2xl border border-white/20 bg-white/10 px-3.5 py-2.5">
                <Search className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search suites, amenities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-zinc-400 focus:outline-none"
                />
              </div>
            </form>

            <nav className="flex flex-col gap-1.5">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between ${
                  pathname === "/" ? "bg-white/15 text-white" : "hover:bg-white/10 text-zinc-200 hover:text-white"
                }`}
              >
                <span>Home</span>
                <ArrowRight className="w-4 h-4 opacity-50" />
              </Link>
              {navLinks.map((link, idx) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={`mobile-${link.href}-${idx}`}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between ${
                      isActive ? "bg-white/15 text-white" : "hover:bg-white/10 text-zinc-200 hover:text-white"
                    }`}
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="w-4 h-4 opacity-50" />
                  </Link>
                );
              })}
            </nav>

            <div className="pt-2 border-t border-white/10 space-y-2.5">
              <Link href="/book" onClick={() => setMobileMenuOpen(false)}>
                <button
                  type="button"
                  className="w-full bg-white hover:bg-zinc-100 text-zinc-950 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-95 transition-transform"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Reserve Suite</span>
                </button>
              </Link>
              <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 px-1">
                <span className="font-semibold text-[11px]">🇬🇭 Ghana • GHS (GH₵)</span>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="font-bold text-[11px] text-zinc-300 hover:text-white"
                >
                  Staff Portal →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
