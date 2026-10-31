"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGuard } from "@/components/auth/role-guard";
import { ROLES, PERMISSION_KEYS } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import { Dialog, Drawer } from "@/components/ui/dialog-and-drawer";
import { StatusChip } from "@/components/ui/status-chip";
import { formatPesewas } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  Scissors,
  Plus,
  Clock,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Layers,
  ShieldAlert,
  Search,
  X,
  Tag,
} from "lucide-react";

interface Addon {
  id: string;
  name: string;
  durationMin: number;
  pricePesewas: number;
  active: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  phone?: string | null;
  bio?: string | null;
}

interface ServiceItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  durationMin: number;
  bufferMin: number;
  pricePesewas: number;
  depositType: "NONE" | "FULL" | "PERCENTAGE" | "FIXED";
  depositValue: number;
  active: boolean;
  order: number;
  addons: Addon[];
  staffServices: {
    staff: StaffMember;
  }[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  order: number;
  services: ServiceItem[];
}

export default function ServicesPage() {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [staffMembers, setStaffMembers] = React.useState<StaffMember[]>([]);
  const [userRole, setUserRole] = React.useState<string>("STAFF_RECEPTIONIST");
  const [loading, setLoading] = React.useState(true);
  const [notification, setNotification] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Active category filter
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("all");

  // Category modal states
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [catName, setCatName] = React.useState("");
  const [catDesc, setCatDesc] = React.useState("");

  // Category manage/reorder modal
  const [manageCategoriesOpen, setManageCategoriesOpen] = React.useState(false);

  // Service modal states
  const [serviceDrawerOpen, setServiceDrawerOpen] = React.useState(false);
  const [editingService, setEditingService] = React.useState<ServiceItem | null>(null);
  const [svcName, setSvcName] = React.useState("");
  const [svcCategory, setSvcCategory] = React.useState("");
  const [svcDesc, setSvcDesc] = React.useState("");
  const [svcDuration, setSvcDuration] = React.useState("60");
  const [svcBuffer, setSvcBuffer] = React.useState("15");
  const [svcPriceGhs, setSvcPriceGhs] = React.useState("300");
  const [svcDepositType, setSvcDepositType] = React.useState<"NONE" | "FULL" | "PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [svcDepositValue, setSvcDepositValue] = React.useState("30");
  const [svcActive, setSvcActive] = React.useState(true);
  const [svcSelectedStaff, setSvcSelectedStaff] = React.useState<string[]>([]);

  // Addon modal states
  const [addonModalOpen, setAddonModalOpen] = React.useState(false);
  const [addonTargetServiceId, setAddonTargetServiceId] = React.useState<string>("");
  const [addonName, setAddonName] = React.useState("");
  const [addonDuration, setAddonDuration] = React.useState("15");
  const [addonPriceGhs, setAddonPriceGhs] = React.useState("50");

  // Smart Search state
  const [searchQuery, setSearchQuery] = React.useState("");

  const isReadOnly = userRole === "STAFF_RECEPTIONIST";

  const fetchCatalog = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/catalog");
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data.categories || []);
        setStaffMembers(json.data.staffMembers || []);
        setUserRole(json.data.userRole || "STAFF_RECEPTIONIST");
      }
    } catch {
      setNotification({ type: "error", message: "Failed to load services catalogue." });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        const res = await fetch("/api/admin/catalog");
        if (res.ok && !ignore) {
          const json = await res.json();
          setCategories(json.data.categories || []);
          setStaffMembers(json.data.staffMembers || []);
          setUserRole(json.data.userRole || "STAFF_RECEPTIONIST");
        }
      } catch {
        if (!ignore) {
          setNotification({ type: "error", message: "Failed to load services catalogue." });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      ignore = true;
    };
  }, []);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Open Service Drawer for Create / Edit
  const handleOpenServiceDrawer = (service?: ServiceItem) => {
    if (isReadOnly) return;
    if (service) {
      setEditingService(service);
      setSvcName(service.name);
      setSvcCategory(service.categoryId);
      setSvcDesc(service.description || "");
      setSvcDuration(service.durationMin.toString());
      setSvcBuffer(service.bufferMin.toString());
      setSvcPriceGhs((service.pricePesewas / 100).toFixed(2));
      setSvcDepositType(service.depositType);
      setSvcDepositValue(
        service.depositType === "FIXED"
          ? (service.depositValue / 100).toFixed(2)
          : service.depositValue.toString()
      );
      setSvcActive(service.active);
      setSvcSelectedStaff(service.staffServices.map((ss) => ss.staff.id));
    } else {
      setEditingService(null);
      setSvcName("");
      setSvcCategory(categories[0]?.id || "");
      setSvcDesc("");
      setSvcDuration("60");
      setSvcBuffer("15");
      setSvcPriceGhs("250");
      setSvcDepositType("PERCENTAGE");
      setSvcDepositValue("30");
      setSvcActive(true);
      setSvcSelectedStaff(staffMembers.map((s) => s.id));
    }
    setServiceDrawerOpen(true);
  };

  // Save Service (Create or Update)
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    const pricePesewas = Math.round(Number.parseFloat(svcPriceGhs || "0") * 100);
    const durationMin = Number.parseInt(svcDuration || "0", 10);
    const bufferMin = Number.parseInt(svcBuffer || "0", 10);
    const rawDepVal = Number.parseFloat(svcDepositValue || "0");
    const depositValue = svcDepositType === "FIXED" ? Math.round(rawDepVal * 100) : Math.round(rawDepVal);

    if (!svcName.trim()) {
      showNotification("error", "Service name is required.");
      return;
    }
    if (!svcCategory) {
      showNotification("error", "Category is required.");
      return;
    }
    if (durationMin < 5) {
      showNotification("error", "Duration must be at least 5 minutes.");
      return;
    }
    if (pricePesewas < 100) {
      showNotification("error", "Price must be at least GH₵ 1.00.");
      return;
    }

    try {
      const payload = {
        name: svcName.trim(),
        categoryId: svcCategory,
        description: svcDesc.trim() || null,
        durationMin,
        bufferMin,
        pricePesewas,
        depositType: svcDepositType,
        depositValue,
        active: svcActive,
        staffIds: svcSelectedStaff.length > 0 ? svcSelectedStaff : staffMembers.map((s) => s.id),
      };

      const url = editingService
        ? `/api/admin/catalog/services/${editingService.id}`
        : "/api/admin/catalog/services";
      const method = editingService ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to save service");
      }

      showNotification("success", editingService ? "Service updated successfully" : "Service created successfully");
      setServiceDrawerOpen(false);
      fetchCatalog();
    } catch (err: unknown) {
      showNotification("error", (err as Error).message);
    }
  };

  // Delete Service
  const handleDeleteService = async (serviceId: string, serviceName: string) => {
    if (isReadOnly) return;
    if (!confirm(`Are you sure you want to deactivate and remove "${serviceName}" from the catalogue?`)) return;

    try {
      const res = await fetch(`/api/admin/catalog/services/${serviceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to delete service");
      }
      showNotification("success", `Service "${serviceName}" removed.`);
      fetchCatalog();
    } catch (err: unknown) {
      showNotification("error", (err as Error).message);
    }
  };

  // Save Category (Create or Edit)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!catName.trim()) {
      showNotification("error", "Category name is required.");
      return;
    }

    try {
      const url = editingCategory
        ? `/api/admin/catalog/categories/${editingCategory.id}`
        : "/api/admin/catalog/categories";
      const method = editingCategory ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catName.trim(),
          description: catDesc.trim() || null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to save category");
      }

      showNotification("success", editingCategory ? "Category updated." : "Category created.");
      setCategoryModalOpen(false);
      setEditingCategory(null);
      setCatName("");
      setCatDesc("");
      fetchCatalog();
    } catch (err: unknown) {
      showNotification("error", (err as Error).message);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: Category) => {
    if (isReadOnly) return;
    if (!confirm(`Delete category "${cat.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/catalog/categories/${cat.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to delete category");
      }
      showNotification("success", `Category "${cat.name}" deleted.`);
      fetchCatalog();
    } catch (err: unknown) {
      showNotification("error", (err as Error).message);
    }
  };

  // Reorder Category (Move Up / Down)
  const handleReorderCategory = async (catId: string, direction: "up" | "down") => {
    if (isReadOnly) return;
    const index = categories.findIndex((c) => c.id === catId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newCats = [...categories];
    const [moved] = newCats.splice(index, 1);
    newCats.splice(targetIndex, 0, moved);

    const reorderPayload = newCats.map((c, i) => ({ id: c.id, order: i }));

    try {
      const res = await fetch("/api/admin/catalog/categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: reorderPayload }),
      });
      if (!res.ok) throw new Error("Failed to reorder categories");
      setCategories(newCats);
      showNotification("success", "Category order updated.");
    } catch (err: unknown) {
      showNotification("error", (err as Error).message);
    }
  };

  // Save Add-on
  const handleSaveAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!addonName.trim()) {
      showNotification("error", "Add-on name is required.");
      return;
    }

    const durationMin = Number.parseInt(addonDuration || "0", 10);
    const pricePesewas = Math.round(Number.parseFloat(addonPriceGhs || "0") * 100);

    try {
      const res = await fetch(`/api/admin/catalog/services/${addonTargetServiceId}/addons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addonName.trim(),
          durationMin,
          pricePesewas,
          active: true,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to create add-on");
      }

      showNotification("success", "Add-on added to service.");
      setAddonModalOpen(false);
      setAddonName("");
      setAddonDuration("15");
      setAddonPriceGhs("50");
      fetchCatalog();
    } catch (err: unknown) {
      showNotification("error", (err as Error).message);
    }
  };

  // Delete Addon
  const handleDeleteAddon = async (addonId: string) => {
    if (isReadOnly) return;
    if (!confirm("Are you sure you want to remove this add-on?")) return;

    try {
      const res = await fetch(`/api/admin/catalog/addons/${addonId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete add-on");
      showNotification("success", "Add-on removed.");
      fetchCatalog();
    } catch (err: unknown) {
      showNotification("error", (err as Error).message);
    }
  };

  // Filtered categories/services with smart multi-attribute search
  const displayedCategories = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // If searching, search across all categories and services
    if (q) {
      return categories
        .map((cat) => {
          const matchingServices = cat.services.filter((svc) => {
            const nameMatch = svc.name.toLowerCase().includes(q);
            const descMatch = svc.description?.toLowerCase().includes(q);
            const catMatch = cat.name.toLowerCase().includes(q);
            const priceGhs = (svc.pricePesewas / 100).toFixed(2);
            const priceMatch =
              priceGhs.includes(q) ||
              svc.pricePesewas.toString().includes(q);
            const durationMatch = `${svc.durationMin}m`.includes(q) || `${svc.durationMin}`.includes(q);
            const addonMatch = svc.addons.some((a) =>
              a.name.toLowerCase().includes(q)
            );

            return nameMatch || descMatch || catMatch || priceMatch || durationMatch || addonMatch;
          });

          return {
            ...cat,
            services: matchingServices,
          };
        })
        .filter((cat) => cat.services.length > 0);
    }

    // Standard category filter
    if (selectedCategoryId === "all") return categories;
    return categories.filter((c) => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId, searchQuery]);

  const totalServicesCount = categories.reduce((acc, c) => acc + c.services.length, 0);
  const matchingServicesCount = displayedCategories.reduce((acc, c) => acc + c.services.length, 0);

  return (
    <RoleGuard
      allowedRoles={[ROLES.OWNER_ADMIN, ROLES.MANAGER]}
      requiredPermission={PERMISSION_KEYS.SERVICES_MANAGE}
      pageTitle="Services & Pricing Catalogue"
      activePath="/services"
    >
      <AppShell activePath="/services">
      <div className="space-y-6 pb-20">
        {/* Toast Alert */}
        {notification && (
          <div
            className={cn(
              "p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-lg border animate-in fade-in duration-200",
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
            )}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-current opacity-60 hover:opacity-100 cursor-pointer text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Read-Only Notice for Staff */}
        {isReadOnly && (
          <div className="p-4 rounded-2xl bg-[#F4F4F6] border border-[#E4E4E7] flex items-center gap-3 text-xs text-[#71717A]">
            <ShieldAlert className="w-4 h-4 text-[#1E1E1E] shrink-0" />
            <div>
              <span className="font-bold text-[#1E1E1E]">Read-Only Mode: </span>
              Staff accounts can view active treatments and pricing. Only Studio Managers or the
              Owner can edit prices, add treatments, or reorder categories.
            </div>
          </div>
        )}

        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E1E1E] tracking-tight">
              Services & Pricing Catalogue
            </h1>
            <p className="text-xs text-[#71717A] mt-1">
              {totalServicesCount} active studio treatments across {categories.length} beauty & fashion categories
            </p>
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-2.5">
              <Button
                variant="outlinePill"
                size="sm"
                onClick={() => setManageCategoriesOpen(true)}
                className="gap-1.5 cursor-pointer text-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Categories</span>
              </Button>

              <Button
                variant="blackPill"
                size="sm"
                onClick={() => handleOpenServiceDrawer()}
                className="gap-1.5 cursor-pointer text-xs shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Service</span>
              </Button>
            </div>
          )}
        </div>

        {/* Smart Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-[#E4E4E7] shadow-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, category, price (e.g. 160 or 550), duration (90m), or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchQuery("");
              }}
              className="w-full pl-10 pr-10 py-2 rounded-xl bg-[#F4F4F6] hover:bg-[#ECECF0] focus:bg-white border border-transparent focus:border-[#1E1E1E] text-xs font-semibold text-[#1E1E1E] placeholder:text-[#A1A1AA] transition-all focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#71717A] hover:text-[#1E1E1E] hover:bg-black/5 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searchQuery.trim() && (
            <div className="flex items-center gap-2 px-1 text-xs text-[#71717A] shrink-0">
              <span className="font-semibold">
                Found <strong className="text-[#1E1E1E] font-poppins">{matchingServicesCount}</strong> service{matchingServicesCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2.5 py-1 rounded-full font-bold transition-colors cursor-pointer"
              >
                Reset Search
              </button>
            </div>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategoryId("all")}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
              selectedCategoryId === "all"
                ? "bg-[#1E1E1E] text-white shadow-xs"
                : "bg-white text-[#71717A] border border-[#E4E4E7] hover:border-[#1E1E1E]"
            )}
          >
            All Services ({totalServicesCount})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5",
                selectedCategoryId === cat.id
                  ? "bg-[#1E1E1E] text-white shadow-xs"
                  : "bg-white text-[#71717A] border border-[#E4E4E7] hover:border-[#1E1E1E]"
              )}
            >
              <span>{cat.name}</span>
              <span className="text-[10px] opacity-70">({cat.services.length})</span>
            </button>
          ))}
        </div>

        {/* Catalogue Groups */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} variant="white" className="p-6 h-64 animate-pulse bg-white/60" />
            ))}
          </div>
        ) : displayedCategories.length === 0 ? (
          <div className="p-12 text-center bg-white/60 rounded-[28px] border border-dashed border-[#E4E4E7]">
            <Scissors className="w-8 h-8 text-[#A1A1AA] mx-auto mb-3" />
            <h3 className="text-sm font-bold text-[#1E1E1E]">No Services Found</h3>
            <p className="text-xs text-[#71717A] mt-1">
              Add your first beauty or dress service to populate the studio booking engine.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {displayedCategories.map((category) => (
              <div key={category.id} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-black/5">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold text-[#1E1E1E]">{category.name}</h2>
                    <span className="text-xs text-[#71717A]">
                      ({category.services.length} services)
                    </span>
                  </div>
                  {category.description && (
                    <span className="text-xs text-[#71717A] hidden md:inline-block">
                      {category.description}
                    </span>
                  )}
                </div>

                {category.services.length === 0 ? (
                  <p className="text-xs text-[#A1A1AA] py-4 italic">
                    No services in this category yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {category.services.map((svc) => (
                      <Card
                        key={svc.id}
                        variant="white"
                        className="p-6 flex flex-col justify-between hover:border-[#1E1E1E]/40 transition-all shadow-xs relative group"
                      >
                        <div>
                          {/* Top Row: Category & Status */}
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                              {category.name}
                            </span>
                            <StatusChip
                              status={svc.active ? "green" : "grey"}
                              label={svc.active ? "Active" : "Inactive"}
                            />
                          </div>

                          {/* Service Title & Description */}
                          <h3 className="text-sm font-extrabold text-[#1E1E1E] mt-2 group-hover:text-black">
                            {svc.name}
                          </h3>
                          <p className="text-xs text-[#71717A] mt-1 line-clamp-2 leading-relaxed">
                            {svc.description || "No description provided."}
                          </p>

                          {/* Service Metrics Pill Row */}
                          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#F4F4F6]">
                            {/* Duration & Buffer */}
                            <div className="px-2.5 py-1 rounded-full bg-[#F4F4F6] text-[11px] font-medium text-[#1E1E1E] flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-[#71717A]" />
                              <span>{svc.durationMin}m</span>
                              {svc.bufferMin > 0 && (
                                <span className="text-[#71717A] text-[10px]">
                                  (+{svc.bufferMin}m buffer)
                                </span>
                              )}
                            </div>

                            {/* Deposit Rule */}
                            <div className="px-2.5 py-1 rounded-full bg-[#F4F4F6] text-[11px] font-medium text-[#1E1E1E]">
                              {svc.depositType === "PERCENTAGE" && `${svc.depositValue}% Deposit`}
                              {svc.depositType === "FULL" && "Full Deposit Required"}
                              {svc.depositType === "FIXED" &&
                                `${formatPesewas(svc.depositValue)} Deposit`}
                              {svc.depositType === "NONE" && "No Deposit"}
                            </div>
                          </div>

                          {/* Solo direct shop mode: Assigned staff tag omitted
                          <div className="mt-3.5 flex items-center gap-1.5">
                            <span className="text-[10px] text-[#A1A1AA]">Staff:</span>
                            {svc.staffServices.length > 0 ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                {svc.staffServices.map((ss) => (
                                  <span
                                    key={ss.staff.id}
                                    className="px-2 py-0.5 rounded-md bg-[#FAFAFB] border border-[#E4E4E7] text-[10px] font-medium text-[#1E1E1E]"
                                  >
                                    {ss.staff.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#EF4444] font-medium">
                                Unassigned
                              </span>
                            )}
                          </div>
                          */}

                          {/* Addons List */}
                          {svc.addons.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-[#F4F4F6]">
                              <div className="flex items-center justify-between text-[11px] font-bold text-[#1E1E1E] mb-1.5">
                                <span className="flex items-center gap-1">
                                  <Plus className="w-3 h-3 text-[#71717A]" />
                                  <span>Add-ons ({svc.addons.length})</span>
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {svc.addons.map((addon) => (
                                  <div
                                    key={addon.id}
                                    className="flex items-center justify-between text-xs p-1.5 bg-[#FAFAFB] rounded-lg border border-[#F4F4F6]"
                                  >
                                    <span className="font-medium text-[#1E1E1E] text-[11px]">
                                      {addon.name}
                                    </span>
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <span className="text-[#71717A]">+{addon.durationMin}m</span>
                                      <span className="font-bold text-[#1E1E1E]">
                                        +{formatPesewas(addon.pricePesewas)}
                                      </span>
                                      {!isReadOnly && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteAddon(addon.id)}
                                          className="text-[#A1A1AA] hover:text-[#EF4444] cursor-pointer"
                                          title="Remove Add-on"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom Row: Price & Actions */}
                        <div className="mt-5 pt-4 border-t border-[#F4F4F6] flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] text-[#71717A] block">Price</span>
                            <div className="mt-0.5">
                              <span className="text-lg font-black font-poppins text-[#1E1E1E]">
                                {formatPesewas(svc.pricePesewas)}
                              </span>
                            </div>
                          </div>

                          {!isReadOnly && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outlinePill"
                                size="sm"
                                onClick={() => {
                                  setAddonTargetServiceId(svc.id);
                                  setAddonModalOpen(true);
                                }}
                                className="text-[10px] px-2.5 h-8 gap-1 cursor-pointer"
                                title="Add an add-on item"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add-on</span>
                              </Button>

                              <Button
                                variant="outlinePill"
                                size="sm"
                                onClick={() => handleOpenServiceDrawer(svc)}
                                className="text-[10px] px-2.5 h-8 gap-1 cursor-pointer"
                                title="Edit service"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </Button>

                              <Button
                                variant="circularIcon"
                                size="iconSm"
                                onClick={() => handleDeleteService(svc.id, svc.name)}
                                className="w-8 h-8 text-[#71717A] hover:text-[#EF4444] hover:bg-rose-50"
                                title="Delete service"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          DRAWER: CREATE / EDIT SERVICE
         ========================================================================= */}
      <Drawer
        isOpen={serviceDrawerOpen}
        onClose={() => setServiceDrawerOpen(false)}
        title={editingService ? "Edit Service" : "Add New Service"}
        side="right"
      >
        <form onSubmit={handleSaveService} className="space-y-5 p-2">
          <div>
            <Label>Service Name *</Label>
            <Input
              required
              placeholder="e.g. Bridal Soft Glam"
              value={svcName}
              onChange={(e) => setSvcName(e.target.value)}
            />
          </div>

          <div>
            <Label>Category *</Label>
            <select
              value={svcCategory}
              onChange={(e) => setSvcCategory(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-2xl bg-white border border-[#E4E4E7] focus:outline-hidden focus:border-[#1E1E1E]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Description</Label>
            <textarea
              rows={3}
              placeholder="Brief description of what is included in this treatment..."
              value={svcDesc}
              onChange={(e) => setSvcDesc(e.target.value)}
              className="w-full p-3 text-xs rounded-2xl bg-white border border-[#E4E4E7] focus:outline-hidden focus:border-[#1E1E1E]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Duration (Minutes) *</Label>
              <Input
                type="number"
                min="5"
                step="5"
                required
                value={svcDuration}
                onChange={(e) => setSvcDuration(e.target.value)}
              />
            </div>
            <div>
              <Label>Buffer Time (Minutes)</Label>
              <Input
                type="number"
                min="0"
                step="5"
                value={svcBuffer}
                onChange={(e) => setSvcBuffer(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Price (GH₵) *</Label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-bold text-[#71717A]">
                GH₵
              </span>
              <Input
                type="number"
                min="1"
                step="0.01"
                required
                className="pl-12"
                value={svcPriceGhs}
                onChange={(e) => setSvcPriceGhs(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-[#A1A1AA] mt-1">
              Stored as integer pesewas in database ({Math.round(Number.parseFloat(svcPriceGhs || "0") * 100)} pesewas)
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F4F4F6] border border-[#E4E4E7] space-y-3">
            <Label>Deposit Policy</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: "PERCENTAGE", label: "Percentage %" },
                { type: "FULL", label: "Full 100%" },
                { type: "FIXED", label: "Fixed GH₵" },
                { type: "NONE", label: "No Deposit" },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setSvcDepositType(opt.type as "NONE" | "FULL" | "PERCENTAGE" | "FIXED")}
                  className={cn(
                    "py-2 px-3 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer",
                    svcDepositType === opt.type
                      ? "bg-[#1E1E1E] text-white border-[#1E1E1E]"
                      : "bg-white text-[#71717A] border-[#E4E4E7] hover:border-[#1E1E1E]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {svcDepositType === "PERCENTAGE" && (
              <div>
                <Label>Deposit Percentage (%)</Label>
                <Input
                  type="number"
                  min="5"
                  max="100"
                  value={svcDepositValue}
                  onChange={(e) => setSvcDepositValue(e.target.value)}
                />
              </div>
            )}

            {svcDepositType === "FIXED" && (
              <div>
                <Label>Fixed Deposit Amount (GH₵)</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={svcDepositValue}
                  onChange={(e) => setSvcDepositValue(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Solo direct shop mode: Staff Assignment picker omitted
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="mb-0">Who can perform this service?</Label>
              <span className="text-[10px] text-[#71717A]">
                {svcSelectedStaff.length} selected
              </span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-[#FAFAFB] rounded-2xl border border-[#E4E4E7]">
              {staffMembers.map((staff) => {
                const isChecked = svcSelectedStaff.includes(staff.id);
                return (
                  <label
                    key={staff.id}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white text-xs cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSvcSelectedStaff((prev) => [...prev, staff.id]);
                        } else {
                          setSvcSelectedStaff((prev) => prev.filter((id) => id !== staff.id));
                        }
                      }}
                      className="w-4 h-4 rounded-sm border-gray-300 text-black focus:ring-black"
                    />
                    <span className="font-semibold text-[#1E1E1E]">{staff.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          */}

          {/* Active Switch */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F4F4F6]">
            <div>
              <span className="text-xs font-bold text-[#1E1E1E] block">Active in Catalogue</span>
              <span className="text-[10px] text-[#71717A]">
                Inactive services will not be bookable online or on POS
              </span>
            </div>
            <input
              type="checkbox"
              checked={svcActive}
              onChange={(e) => setSvcActive(e.target.checked)}
              className="w-4 h-4 text-black rounded-sm cursor-pointer"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-[#F4F4F6]">
            <Button
              type="button"
              variant="outlinePill"
              size="sm"
              onClick={() => setServiceDrawerOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="blackPill" size="sm">
              {editingService ? "Update Service" : "Create Service"}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* =========================================================================
          DIALOG: ADD ADD-ON TO SERVICE
         ========================================================================= */}
      <Dialog
        isOpen={addonModalOpen}
        onClose={() => setAddonModalOpen(false)}
        title="Add Add-On Item"
        description="Add a customizable option (e.g. gel polish, bottom lash application, lace customization) with extra duration and price."
      >
        <form onSubmit={handleSaveAddon} className="space-y-4 pt-2">
          <div>
            <Label>Add-on Title *</Label>
            <Input
              required
              placeholder="e.g. Bottom Lashes / Gel Removal"
              value={addonName}
              onChange={(e) => setAddonName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Extra Time (Minutes)</Label>
              <Input
                type="number"
                min="0"
                step="5"
                value={addonDuration}
                onChange={(e) => setAddonDuration(e.target.value)}
              />
            </div>
            <div>
              <Label>Extra Price (GH₵) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                required
                value={addonPriceGhs}
                onChange={(e) => setAddonPriceGhs(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[#F4F4F6]">
            <Button
              type="button"
              variant="outlinePill"
              size="sm"
              onClick={() => setAddonModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="blackPill" size="sm">
              Save Add-on
            </Button>
          </div>
        </form>
      </Dialog>

      {/* =========================================================================
          DIALOG: CATEGORIES MANAGEMENT & REORDERING
         ========================================================================= */}
      <Dialog
        isOpen={manageCategoriesOpen}
        onClose={() => setManageCategoriesOpen(false)}
        title="Manage Categories"
        description="Add, edit, or reorder beauty and fashion categories on the booking menu."
      >
        <div className="space-y-5 pt-2">
          {/* Add Category Trigger */}
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#1E1E1E]">Active Categories</span>
            <Button
              variant="blackPill"
              size="sm"
              onClick={() => {
                setEditingCategory(null);
                setCatName("");
                setCatDesc("");
                setCategoryModalOpen(true);
              }}
              className="text-xs gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Category</span>
            </Button>
          </div>

          <div className="divide-y divide-[#F4F4F6] max-h-72 overflow-y-auto">
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <h4 className="font-bold text-[#1E1E1E]">{cat.name}</h4>
                  <span className="text-[10px] text-[#71717A]">
                    {cat.services.length} services • Order: {cat.order}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Reorder Buttons */}
                  <Button
                    variant="circularIcon"
                    size="iconSm"
                    disabled={idx === 0}
                    onClick={() => handleReorderCategory(cat.id, "up")}
                    className="w-7 h-7"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="circularIcon"
                    size="iconSm"
                    disabled={idx === categories.length - 1}
                    onClick={() => handleReorderCategory(cat.id, "down")}
                    className="w-7 h-7"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="circularIcon"
                    size="iconSm"
                    onClick={() => {
                      setEditingCategory(cat);
                      setCatName(cat.name);
                      setCatDesc(cat.description || "");
                      setCategoryModalOpen(true);
                    }}
                    className="w-7 h-7 ml-1"
                    title="Edit category"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="circularIcon"
                    size="iconSm"
                    onClick={() => handleDeleteCategory(cat)}
                    className="w-7 h-7 text-[#71717A] hover:text-[#EF4444]"
                    title="Delete category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 flex justify-end">
            <Button
              variant="outlinePill"
              size="sm"
              onClick={() => setManageCategoriesOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* =========================================================================
          DIALOG: CREATE / EDIT CATEGORY MODAL
         ========================================================================= */}
      <Dialog
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategory ? "Edit Category" : "New Category"}
        description="Categories group your studio services for online booking and quick POS selection."
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 pt-2">
          <div>
            <Label>Category Title *</Label>
            <Input
              required
              placeholder="e.g. Lash Tech & Brow Art"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />
          </div>

          <div>
            <Label>Description</Label>
            <textarea
              rows={3}
              placeholder="Brief summary of treatments in this category..."
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              className="w-full p-3 text-xs rounded-2xl bg-white border border-[#E4E4E7] focus:outline-hidden focus:border-[#1E1E1E]"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-[#F4F4F6]">
            <Button
              type="button"
              variant="outlinePill"
              size="sm"
              onClick={() => setCategoryModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="blackPill" size="sm">
              {editingCategory ? "Update Category" : "Create Category"}
            </Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
    </RoleGuard>
  );
}
