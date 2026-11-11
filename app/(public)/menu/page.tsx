"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { formatPesewas } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import { Dialog, Drawer } from "@/components/ui/dialog-and-drawer";
import {
  Utensils,
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Clock,
  Sparkles,
  Flame,
  Wine,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  CreditCard,
  QrCode,
  Hotel,
} from "lucide-react";

interface ModifierOption {
  id: string;
  name: string;
  priceDeltaPesewas: number;
  isAvailable: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: ModifierOption[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  pricePesewas: number;
  imageUrl: string | null;
  isAvailable: boolean;
  prepStation: "KITCHEN" | "BAR";
  modifierGroups: ModifierGroup[];
}

interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

interface CartItem {
  id: string; // unique cart line ID
  item: MenuItem;
  quantity: number;
  selectedModifiers: Array<{
    optionId: string;
    optionName: string;
    priceDeltaPesewas: number;
  }>;
  notes?: string;
  lineTotalPesewas: number;
}

export default function PublicMenuPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen py-24 text-center text-muted-foreground">Loading menu...</div>}>
      <PublicMenuContent />
    </React.Suspense>
  );
}

function PublicMenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qrToken = searchParams.get("table");

  // State
  const [categories, setCategories] = React.useState<MenuCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [restaurantHours, setRestaurantHours] = React.useState<{
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  } | null>(null);

  const [tableInfo, setTableInfo] = React.useState<{ id: string; label: string } | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeCategoryId, setActiveCategoryId] = React.useState<string>("ALL");

  // Cart & Modals
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [selectedItemForMod, setSelectedItemForMod] = React.useState<MenuItem | null>(null);
  const [modifierSelections, setModifierSelections] = React.useState<Record<string, string[]>>({});
  const [customItemNotes, setCustomItemNotes] = React.useState("");

  // Order Type & Details
  const [orderType, setOrderType] = React.useState<"DINE_IN" | "PICKUP" | "ROOM_SERVICE">(
    qrToken ? "DINE_IN" : "PICKUP"
  );
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [orderNotes, setOrderNotes] = React.useState("");

  // Room Service Verification States
  const [rsRoomNumber, setRsRoomNumber] = React.useState("");
  const [rsPhone, setRsPhone] = React.useState("");
  const [rsOtpCode, setRsOtpCode] = React.useState("");
  const [rsStep, setRsStep] = React.useState<"REQUEST" | "ENTER_CODE" | "VERIFIED">("REQUEST");
  const [rsVerifiedToken, setRsVerifiedToken] = React.useState<string | null>(null);
  const [rsLoading, setRsLoading] = React.useState(false);
  const [rsError, setRsError] = React.useState("");

  // Submission States
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  // Load Menu & Table
  React.useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/restaurant/menu");
        const json = await res.json();
        if (!ignore && json.success) {
          setCategories(json.data.categories || []);
          setRestaurantHours(json.data.restaurantHours || null);
        }

        // If table qrToken provided, resolve table
        if (qrToken) {
          const tRes = await fetch(`/api/restaurant/table?qrToken=${qrToken}`);
          const tJson = await tRes.json();
          if (!ignore && tJson.success && tJson.data.table) {
            setTableInfo(tJson.data.table);
            setOrderType("DINE_IN");
          }
        }
      } catch {
        if (!ignore) setErrorMessage("Failed to load menu. Please refresh.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [qrToken]);

  // Handle Opening Modifier Modal
  const handleOpenCustomize = (item: MenuItem) => {
    if (!item.isAvailable) return;
    setSelectedItemForMod(item);
    setCustomItemNotes("");

    // Initialize default selections
    const initial: Record<string, string[]> = {};
    for (const g of item.modifierGroups) {
      const availOptions = g.options.filter((o) => o.isAvailable);
      if (g.isRequired && availOptions.length > 0) {
        initial[g.id] = [availOptions[0].id];
      } else {
        initial[g.id] = [];
      }
    }
    setModifierSelections(initial);
  };

  const handleToggleOption = (groupId: string, optionId: string, maxSelect: number) => {
    setModifierSelections((prev) => {
      const current = prev[groupId] || [];
      if (maxSelect === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length < maxSelect) {
        return { ...prev, [groupId]: [...current, optionId] };
      }
      return prev;
    });
  };

  // Add Item to Cart
  const handleAddToCart = () => {
    if (!selectedItemForMod) return;

    // Validate required groups
    for (const g of selectedItemForMod.modifierGroups) {
      const selected = modifierSelections[g.id] || [];
      if (g.isRequired && selected.length < g.minSelect) {
        alert(`Please choose at least ${g.minSelect} option for "${g.name}".`);
        return;
      }
    }

    // Compute modifier snapshots & total
    let modDeltaTotal = 0;
    const selectedSnapshot: Array<{ optionId: string; optionName: string; priceDeltaPesewas: number }> = [];

    for (const g of selectedItemForMod.modifierGroups) {
      const selectedIds = modifierSelections[g.id] || [];
      for (const optId of selectedIds) {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) {
          modDeltaTotal += opt.priceDeltaPesewas;
          selectedSnapshot.push({
            optionId: opt.id,
            optionName: opt.name,
            priceDeltaPesewas: opt.priceDeltaPesewas,
          });
        }
      }
    }

    const lineTotal = selectedItemForMod.pricePesewas + modDeltaTotal;

    const newCartItem: CartItem = {
      id: `${selectedItemForMod.id}-${Date.now()}`,
      item: selectedItemForMod,
      quantity: 1,
      selectedModifiers: selectedSnapshot,
      notes: customItemNotes.trim() || undefined,
      lineTotalPesewas: lineTotal,
    };

    setCart((prev) => [...prev, newCartItem]);
    setSelectedItemForMod(null);
    setCartOpen(true);
  };

  // Update Cart Quantity
  const handleUpdateQty = (cartLineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => {
          if (ci.id === cartLineId) {
            const nextQty = ci.quantity + delta;
            return nextQty > 0 ? { ...ci, quantity: nextQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (cartLineId: string) => {
    setCart((prev) => prev.filter((ci) => ci.id !== cartLineId));
  };

  const cartTotalPesewas = cart.reduce((acc, ci) => acc + ci.lineTotalPesewas * ci.quantity, 0);
  const cartItemCount = cart.reduce((acc, ci) => acc + ci.quantity, 0);

  // --- Room Service OTP Flow ---
  const handleRequestRsOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRsError("");
    try {
      setRsLoading(true);
      const res = await fetch("/api/restaurant/room-service/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomNumber: rsRoomNumber, phone: rsPhone }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setRsStep("ENTER_CODE");
    } catch (err: unknown) {
      setRsError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setRsLoading(false);
    }
  };

  const handleVerifyRsOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRsError("");
    try {
      setRsLoading(true);
      const res = await fetch("/api/restaurant/room-service/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomNumber: rsRoomNumber,
          phone: rsPhone,
          code: rsOtpCode,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setRsVerifiedToken(json.data.verificationToken);
      setRsStep("VERIFIED");
    } catch (err: unknown) {
      setRsError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setRsLoading(false);
    }
  };

  // --- Place Order ---
  const handlePlaceOrder = async () => {
    setErrorMessage("");
    if (cart.length === 0) return;

    if (restaurantHours && !restaurantHours.isOpen) {
      setErrorMessage(
        `The restaurant is currently closed (Hours: ${restaurantHours.openTime} - ${restaurantHours.closeTime}). Please order during opening hours.`
      );
      return;
    }

    try {
      setSubmitting(true);

      const itemsPayload = cart.map((ci) => ({
        itemId: ci.item.id,
        quantity: ci.quantity,
        selectedModifierOptionIds: ci.selectedModifiers.map((m) => m.optionId),
        notes: ci.notes,
      }));

      // Room Service order submission
      if (orderType === "ROOM_SERVICE") {
        if (!rsVerifiedToken) {
          setErrorMessage("Please verify your room number and phone before placing your order.");
          return;
        }

        const res = await fetch("/api/restaurant/room-service/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verificationToken: rsVerifiedToken,
            notes: orderNotes,
            items: itemsPayload,
          }),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.message);

        // Redirect to order tracking
        router.push(`/order/${json.data.trackingToken}`);
        return;
      }

      // Dine-in or Pickup submission
      const res = await fetch("/api/restaurant/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: orderType,
          tableId: tableInfo?.id,
          qrToken: qrToken || undefined,
          customerName,
          customerPhone,
          customerEmail,
          notes: orderNotes,
          items: itemsPayload,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      // If Pickup with Paystack redirect
      if (orderType === "PICKUP" && json.data.authorizationUrl) {
        window.location.href = json.data.authorizationUrl;
        return;
      }

      // Dine-in: redirect to tracking page
      router.push(`/order/${json.data.trackingToken}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter items
  const allItems = categories.flatMap((c) => c.items);
  const filteredCategories = categories
    .filter((c) => activeCategoryId === "ALL" || c.id === activeCategoryId)
    .map((c) => ({
      ...c,
      items: c.items.filter(
        (i) =>
          i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (i.description && i.description.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    }))
    .filter((c) => c.items.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Table Welcome Banner (if via QR code) */}
      {tableInfo && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-2.5 px-4 text-center text-sm font-medium text-amber-500 flex items-center justify-center gap-2">
          <QrCode className="w-4 h-4" />
          <span>
            Ordering for <strong>{tableInfo.label}</strong> • Pay at table or later
          </span>
        </div>
      )}

      {/* Closed Hours Notice */}
      {restaurantHours && !restaurantHours.isOpen && (
        <div className="bg-destructive/10 border-b border-destructive/20 py-3 px-4 text-center text-sm text-destructive flex items-center justify-center gap-2">
          <Clock className="w-4 h-4" />
          <span>
            The restaurant is currently closed. Daily hours: <strong>{restaurantHours.openTime} – {restaurantHours.closeTime}</strong>. You can browse our offerings below.
          </span>
        </div>
      )}

      {/* Hero Header */}
      <section className="relative py-12 px-4 sm:px-6 lg:px-8 border-b border-border bg-gradient-to-b from-card to-background">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold tracking-wider uppercase border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Culinary Offerings
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Restaurant & Lounge Menu
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Indulge in authentic West African specialties, grilled delicacies, and handcrafted artisan cocktails.
          </p>

          {/* Search bar */}
          <div className="max-w-md mx-auto pt-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search food, grills, drinks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card border-border h-10"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Category Navigation Pills */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-2 overflow-x-auto py-3 no-scrollbar">
          <button
            onClick={() => setActiveCategoryId("ALL")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeCategoryId === "ALL"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            All Items ({allItems.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategoryId(c.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeCategoryId === c.id
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.name} ({c.items.length})
            </button>
          ))}
        </div>
      </div>

      {/* Menu Categories & Items List */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {loading ? (
          <div className="py-24 text-center text-muted-foreground">Loading menu items...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            No items found matching your search.
          </div>
        ) : (
          filteredCategories.map((cat) => (
            <div key={cat.id} className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground border-b border-border pb-2">
                {cat.name}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cat.items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      item.isAvailable
                        ? "border-border bg-card hover:border-amber-500/40"
                        : "border-border/60 bg-muted/40 opacity-75"
                    }`}
                  >
                    <div className="flex gap-4">
                      {item.imageUrl && (
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shrink-0 bg-muted">
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            sizes="96px"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-base text-foreground leading-tight">
                            {item.name}
                          </h3>
                          <span className="font-bold text-amber-500 text-sm sm:text-base shrink-0">
                            {formatPesewas(item.pricePesewas)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 pt-1">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              item.prepStation === "KITCHEN"
                                ? "bg-orange-500/10 text-orange-600"
                                : "bg-indigo-500/10 text-indigo-600"
                            }`}
                          >
                            {item.prepStation === "KITCHEN" ? (
                              <Flame className="w-2.5 h-2.5" />
                            ) : (
                              <Wine className="w-2.5 h-2.5" />
                            )}
                            {item.prepStation}
                          </span>
                          {!item.isAvailable && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                              Sold Out
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {item.modifierGroups.length > 0 ? "Customizable" : "Standard"}
                      </span>
                      {item.isAvailable ? (
                        <Button
                          size="sm"
                          onClick={() => handleOpenCustomize(item)}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-8 px-3 gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add to Order
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled className="text-xs h-8 opacity-50">
                          Unavailable
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Floating Cart Button (Mobile & Desktop) */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-30 px-4 max-w-lg mx-auto">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 px-5 rounded-2xl shadow-xl flex items-center justify-between font-semibold transition-all hover:scale-[1.01]"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-xs">
                {cartItemCount}
              </span>
              <span>View Cart</span>
            </div>
            <span>{formatPesewas(cartTotalPesewas)}</span>
          </button>
        </div>
      )}

      {/* Modifier Customization Modal */}
      <Dialog
        open={!!selectedItemForMod}
        onOpenChange={(open) => !open && setSelectedItemForMod(null)}
        title={selectedItemForMod?.name || "Customize Item"}
      >
        {selectedItemForMod && (
          <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <p className="text-xs text-muted-foreground">{selectedItemForMod.description}</p>
              <span className="font-bold text-amber-500 text-base">
                {formatPesewas(selectedItemForMod.pricePesewas)}
              </span>
            </div>

            {/* Modifier Groups */}
            {selectedItemForMod.modifierGroups.map((group) => {
              const currentSelected = modifierSelections[group.id] || [];
              return (
                <div key={group.id} className="space-y-2 p-3 rounded-xl bg-secondary/30 border border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {group.name} {group.isRequired && <span className="text-amber-500">*</span>}
                    </span>
                    <span className="text-muted-foreground">
                      {group.maxSelect === 1 ? "Select 1" : `Up to ${group.maxSelect}`}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {group.options.map((opt) => {
                      const isChecked = currentSelected.includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition-colors ${
                            isChecked
                              ? "border-amber-500 bg-amber-500/10 text-foreground font-medium"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          } ${!opt.isAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type={group.maxSelect === 1 ? "radio" : "checkbox"}
                              name={`mod-group-${group.id}`}
                              checked={isChecked}
                              disabled={!opt.isAvailable}
                              onChange={() => handleToggleOption(group.id, opt.id, group.maxSelect)}
                              className="text-amber-500"
                            />
                            <span>{opt.name}</span>
                          </div>
                          <span>
                            {opt.priceDeltaPesewas > 0
                              ? `+${formatPesewas(opt.priceDeltaPesewas)}`
                              : "Included"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Special Instructions */}
            <div className="space-y-1 pt-1">
              <Label className="text-xs">Special Requests / Notes</Label>
              <Input
                placeholder="e.g. Dressing on the side, extra spicy"
                value={customItemNotes}
                onChange={(e) => setCustomItemNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedItemForMod(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddToCart} className="bg-amber-500 hover:bg-amber-600 text-white">
                Add to Cart
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Cart & Checkout Drawer */}
      <Drawer open={cartOpen} onOpenChange={setCartOpen} title="Your Order Cart">
        <div className="space-y-5 pt-2 max-h-[80vh] overflow-y-auto pr-1">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cart Items List */}
          {cart.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <ShoppingBag className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-sm">Your order cart is empty.</p>
            </div>
          ) : (
            <div className="space-y-3 divide-y divide-border">
              {cart.map((ci) => (
                <div key={ci.id} className="pt-3 first:pt-0 space-y-1.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">{ci.item.name}</h4>
                      {ci.selectedModifiers.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {ci.selectedModifiers.map((m) => m.optionName).join(", ")}
                        </p>
                      )}
                      {ci.notes && (
                        <p className="text-[11px] text-amber-500 italic">Note: {ci.notes}</p>
                      )}
                    </div>
                    <span className="font-bold text-sm text-amber-500">
                      {formatPesewas(ci.lineTotalPesewas * ci.quantity)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center border border-border rounded-lg bg-background">
                      <button
                        onClick={() => handleUpdateQty(ci.id, -1)}
                        className="px-2 py-1 text-muted-foreground hover:text-foreground"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-semibold">{ci.quantity}</span>
                      <button
                        onClick={() => handleUpdateQty(ci.id, 1)}
                        className="px-2 py-1 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(ci.id)}
                      className="text-xs text-destructive hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="pt-4 border-t border-border space-y-4">
              {/* Dining Mode Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">How would you like to receive your order?</Label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setOrderType("DINE_IN")}
                    className={`py-2 px-1 rounded-lg border font-medium flex flex-col items-center gap-1 ${
                      orderType === "DINE_IN"
                        ? "border-amber-500 bg-amber-500/10 text-amber-500"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    Dine-In
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("PICKUP")}
                    className={`py-2 px-1 rounded-lg border font-medium flex flex-col items-center gap-1 ${
                      orderType === "PICKUP"
                        ? "border-amber-500 bg-amber-500/10 text-amber-500"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("ROOM_SERVICE")}
                    className={`py-2 px-1 rounded-lg border font-medium flex flex-col items-center gap-1 ${
                      orderType === "ROOM_SERVICE"
                        ? "border-amber-500 bg-amber-500/10 text-amber-500"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Hotel className="w-3.5 h-3.5" />
                    Room Service
                  </button>
                </div>
              </div>

              {/* Mode-Specific Details */}
              {orderType === "DINE_IN" && (
                <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-2 text-xs">
                  {tableInfo ? (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Serving Table:</span>
                      <span className="font-bold text-foreground">{tableInfo.label}</span>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs">Table Number or Label</Label>
                      <Input
                        placeholder="e.g. Table 4"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="text-xs mt-1"
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Order is served directly to your dining table. Payment can be settled at the table.
                  </p>
                </div>
              )}

              {orderType === "PICKUP" && (
                <div className="space-y-3 p-3 rounded-xl bg-secondary/30 border border-border">
                  <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Guest Contact Info</span>
                    <span className="text-[11px] text-amber-500">SMS alert when ready</span>
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="Your Full Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      className="text-xs"
                    />
                    <Input
                      placeholder="Ghana Phone Number (+233...)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                      className="text-xs"
                    />
                    <Input
                      placeholder="Email (for Paystack receipt)"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-amber-500" />
                    Pickup orders require Paystack payment before sending to the kitchen.
                  </p>
                </div>
              )}

              {orderType === "ROOM_SERVICE" && (
                <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <Hotel className="w-3.5 h-3.5 text-amber-500" /> Room Service Guest Verification
                    </span>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-full">
                      Charge to Folio
                    </span>
                  </div>

                  {rsStep === "REQUEST" && (
                    <form onSubmit={handleRequestRsOtp} className="space-y-2 text-xs">
                      {rsError && <p className="text-destructive text-[11px]">{rsError}</p>}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[11px]">Room Number</Label>
                          <Input
                            placeholder="e.g. 101"
                            value={rsRoomNumber}
                            onChange={(e) => setRsRoomNumber(e.target.value)}
                            required
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Guest Phone</Label>
                          <Input
                            placeholder="+233..."
                            value={rsPhone}
                            onChange={(e) => setRsPhone(e.target.value)}
                            required
                            className="text-xs"
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={rsLoading}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs mt-1"
                      >
                        {rsLoading ? "Verifying Stay..." : "Send Verification Code"}
                      </Button>
                    </form>
                  )}

                  {rsStep === "ENTER_CODE" && (
                    <form onSubmit={handleVerifyRsOtp} className="space-y-2 text-xs">
                      {rsError && <p className="text-destructive text-[11px]">{rsError}</p>}
                      <Label className="text-[11px]">Enter 6-digit Code sent to your phone</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="6-digit OTP"
                          value={rsOtpCode}
                          maxLength={6}
                          onChange={(e) => setRsOtpCode(e.target.value)}
                          required
                          className="text-xs font-mono tracking-widest text-center"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={rsLoading}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-xs"
                        >
                          Verify
                        </Button>
                      </div>
                    </form>
                  )}

                  {rsStep === "VERIFIED" && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Room {rsRoomNumber} verified. Total will post to your hotel folio.</span>
                    </div>
                  )}
                </div>
              )}

              {/* General Order Notes */}
              <div>
                <Label className="text-xs">Order Notes (Optional)</Label>
                <Input
                  placeholder="Cutlery preference, napkin requests, etc."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="text-xs"
                />
              </div>

              {/* Total Summary & Checkout Button */}
              <div className="pt-2 border-t border-border space-y-3">
                <div className="flex items-center justify-between text-base font-bold">
                  <span>Grand Total</span>
                  <span className="text-amber-500">{formatPesewas(cartTotalPesewas)}</span>
                </div>

                <Button
                  onClick={handlePlaceOrder}
                  disabled={submitting}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    "Processing..."
                  ) : orderType === "PICKUP" ? (
                    <>
                      Pay with Paystack & Order <ArrowRight className="w-4 h-4" />
                    </>
                  ) : orderType === "ROOM_SERVICE" ? (
                    <>
                      Confirm & Charge to Room <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Send Order to Kitchen <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
