"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog-and-drawer";
import { formatPesewas } from "@/lib/money";
import {
  Utensils,
  Plus,
  Flame,
  Wine,
  CheckCircle2,
  Trash2,
  Edit2,
  AlertCircle,
  FolderPlus,
  Layers,
} from "lucide-react";

interface ModifierOptionForm {
  id?: string;
  name: string;
  priceDeltaGhs: string;
  isAvailable: boolean;
  sortOrder: number;
}

interface ModifierGroupForm {
  id?: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: ModifierOptionForm[];
}

interface MenuCategoryItem {
  id: string;
  name: string;
  sortOrder: number;
  _count?: { items: number };
}

interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  pricePesewas: number;
  imageUrl: string | null;
  isAvailable: boolean;
  prepStation: "KITCHEN" | "BAR";
  sortOrder: number;
  categoryId: string;
  category: { id: string; name: string };
  modifierGroups: Array<{
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    isRequired: boolean;
    options: Array<{
      id: string;
      name: string;
      priceDeltaPesewas: number;
      isAvailable: boolean;
    }>;
  }>;
}

export default function RestaurantMenuPage() {
  const [activeTab, setActiveTab] = React.useState<"items" | "categories">("items");
  const [loading, setLoading] = React.useState(true);
  const [categories, setCategories] = React.useState<MenuCategoryItem[]>([]);
  const [items, setItems] = React.useState<MenuItemData[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = React.useState<string>("ALL");
  const [selectedStationFilter, setSelectedStationFilter] = React.useState<string>("ALL");

  // Notifications
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  // Modals
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<MenuCategoryItem | null>(null);
  const [catName, setCatName] = React.useState("");
  const [catSortOrder, setCatSortOrder] = React.useState(0);

  const [itemModalOpen, setItemModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<MenuItemData | null>(null);
  const [itemName, setItemName] = React.useState("");
  const [itemDesc, setItemDesc] = React.useState("");
  const [itemPriceGhs, setItemPriceGhs] = React.useState("");
  const [itemCategoryId, setItemCategoryId] = React.useState("");
  const [itemImageUrl, setItemImageUrl] = React.useState("");
  const [itemPrepStation, setItemPrepStation] = React.useState<"KITCHEN" | "BAR">("KITCHEN");
  const [itemIsAvailable, setItemIsAvailable] = React.useState(true);
  const [itemSortOrder, setItemSortOrder] = React.useState(0);
  const [itemModifiers, setItemModifiers] = React.useState<ModifierGroupForm[]>([]);

  const fetchData = React.useCallback(async () => {
    try {
      const [catsRes, itemsRes] = await Promise.all([
        fetch("/api/admin/restaurant/categories"),
        fetch("/api/admin/restaurant/items"),
      ]);
      const catsJson = await catsRes.json();
      const itemsJson = await itemsRes.json();

      if (catsJson.success) {
        setCategories(catsJson.data.categories || []);
      }
      if (itemsJson.success) {
        setItems(itemsJson.data.items || []);
      }
    } catch {
      setErrorMsg("Failed to load restaurant menu data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const [catsRes, itemsRes] = await Promise.all([
          fetch("/api/admin/restaurant/categories"),
          fetch("/api/admin/restaurant/items"),
        ]);
        const catsJson = await catsRes.json();
        const itemsJson = await itemsRes.json();

        if (!ignore) {
          if (catsJson.success) setCategories(catsJson.data.categories || []);
          if (itemsJson.success) setItems(itemsJson.data.items || []);
        }
      } catch {
        if (!ignore) setErrorMsg("Failed to load restaurant menu data");
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(""), 5000);
  };

  // --- Category Actions ---
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatName("");
    setCatSortOrder(categories.length);
    setCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: MenuCategoryItem) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatSortOrder(cat.sortOrder);
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        const res = await fetch("/api/admin/restaurant/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingCategory.id,
            name: catName,
            sortOrder: Number(catSortOrder),
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        showSuccess("Category updated successfully");
      } else {
        const res = await fetch("/api/admin/restaurant/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: catName,
            sortOrder: Number(catSortOrder),
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        showSuccess("Category created successfully");
      }
      setCategoryModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Error saving category");
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"? Items inside will need reassignment.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/restaurant/categories?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      showSuccess("Category deleted");
      fetchData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Error deleting category");
    }
  };

  // --- Item Actions ---
  const handleOpenAddItem = () => {
    setEditingItem(null);
    setItemName("");
    setItemDesc("");
    setItemPriceGhs("");
    setItemCategoryId(categories[0]?.id || "");
    setItemImageUrl("");
    setItemPrepStation("KITCHEN");
    setItemIsAvailable(true);
    setItemSortOrder(items.length);
    setItemModifiers([]);
    setItemModalOpen(true);
  };

  const handleOpenEditItem = (item: MenuItemData) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemDesc(item.description || "");
    setItemPriceGhs((item.pricePesewas / 100).toFixed(2));
    setItemCategoryId(item.categoryId);
    setItemImageUrl(item.imageUrl || "");
    setItemPrepStation(item.prepStation);
    setItemIsAvailable(item.isAvailable);
    setItemSortOrder(item.sortOrder);
    setItemModifiers(
      item.modifierGroups.map((g) => ({
        id: g.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        isRequired: g.isRequired,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDeltaGhs: (o.priceDeltaPesewas / 100).toFixed(2),
          isAvailable: o.isAvailable,
          sortOrder: 0,
        })),
      }))
    );
    setItemModalOpen(true);
  };

  const handleToggleAvailability = async (item: MenuItemData) => {
    const nextVal = !item.isAvailable;
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isAvailable: nextVal } : i))
    );
    try {
      const res = await fetch("/api/admin/restaurant/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          isAvailable: nextVal,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      showSuccess(`"${item.name}" marked as ${nextVal ? "available" : "sold out"}`);
    } catch (err: unknown) {
      // Rollback
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: item.isAvailable } : i))
      );
      showError(err instanceof Error ? err.message : "Failed to toggle availability");
    }
  };

  const handleAddModifierGroup = () => {
    setItemModifiers((prev) => [
      ...prev,
      {
        name: "Choice of Side",
        minSelect: 0,
        maxSelect: 1,
        isRequired: false,
        options: [
          { name: "Jollof Rice", priceDeltaGhs: "0.00", isAvailable: true, sortOrder: 0 },
        ],
      },
    ]);
  };

  const handleRemoveModifierGroup = (index: number) => {
    setItemModifiers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddModifierOption = (groupIndex: number) => {
    setItemModifiers((prev) =>
      prev.map((g, idx) => {
        if (idx !== groupIndex) return g;
        return {
          ...g,
          options: [
            ...g.options,
            { name: "New Option", priceDeltaGhs: "0.00", isAvailable: true, sortOrder: g.options.length },
          ],
        };
      })
    );
  };

  const handleRemoveModifierOption = (groupIndex: number, optionIndex: number) => {
    setItemModifiers((prev) =>
      prev.map((g, idx) => {
        if (idx !== groupIndex) return g;
        return {
          ...g,
          options: g.options.filter((_, oIdx) => oIdx !== optionIndex),
        };
      })
    );
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const priceGhsFloat = parseFloat(itemPriceGhs);
      if (isNaN(priceGhsFloat) || priceGhsFloat < 0) {
        throw new Error("Please enter a valid price in GH₵");
      }
      const pricePesewas = Math.round(priceGhsFloat * 100);

      const formattedModifiers = itemModifiers.map((g) => ({
        name: g.name.trim(),
        minSelect: Number(g.minSelect) || 0,
        maxSelect: Number(g.maxSelect) || 1,
        isRequired: Boolean(g.isRequired),
        options: g.options.map((o) => ({
          name: o.name.trim(),
          priceDeltaPesewas: Math.round((parseFloat(o.priceDeltaGhs) || 0) * 100),
          isAvailable: o.isAvailable,
          sortOrder: o.sortOrder,
        })),
      }));

      if (editingItem) {
        const res = await fetch("/api/admin/restaurant/items", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingItem.id,
            name: itemName.trim(),
            description: itemDesc.trim() || undefined,
            pricePesewas,
            categoryId: itemCategoryId,
            imageUrl: itemImageUrl.trim() || undefined,
            prepStation: itemPrepStation,
            isAvailable: itemIsAvailable,
            sortOrder: Number(itemSortOrder),
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        showSuccess("Menu item updated");
      } else {
        const res = await fetch("/api/admin/restaurant/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: itemName.trim(),
            description: itemDesc.trim() || undefined,
            pricePesewas,
            categoryId: itemCategoryId,
            imageUrl: itemImageUrl.trim() || undefined,
            prepStation: itemPrepStation,
            isAvailable: itemIsAvailable,
            sortOrder: Number(itemSortOrder),
            modifierGroups: formattedModifiers,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        showSuccess("Menu item created");
      }
      setItemModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Error saving item");
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete menu item "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/restaurant/items?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      showSuccess("Item deleted");
      fetchData();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Error deleting item");
    }
  };

  // Filtered Items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategoryFilter === "ALL" || item.categoryId === selectedCategoryFilter;
    const matchesStation =
      selectedStationFilter === "ALL" || item.prepStation === selectedStationFilter;
    return matchesSearch && matchesCategory && matchesStation;
  });

  return (
    <AppShell activePath="/restaurant/menu" userName="Restaurant Admin">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Utensils className="w-6 h-6 text-amber-500" />
              Restaurant Menu & Items
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage dining categories, food & beverage offerings, prep stations, and modifier groups.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "categories" ? (
              <Button onClick={handleOpenAddCategory} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
                <FolderPlus className="w-4 h-4" />
                Add Category
              </Button>
            ) : (
              <Button onClick={handleOpenAddItem} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
                <Plus className="w-4 h-4" />
                Add Menu Item
              </Button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm">{successMsg}</p>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("items")}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "items"
                ? "border-amber-500 text-amber-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Utensils className="w-4 h-4" />
            Menu Items ({items.length})
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "categories"
                ? "border-amber-500 text-amber-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-4 h-4" />
            Categories ({categories.length})
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Loading menu configuration...</div>
        ) : activeTab === "items" ? (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-card p-3 rounded-xl border border-border">
              <Input
                placeholder="Search food or beverage..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background"
              />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="ALL">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedStationFilter}
                onChange={(e) => setSelectedStationFilter(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="ALL">All Stations (Kitchen & Bar)</option>
                <option value="KITCHEN">Kitchen Orders Only</option>
                <option value="BAR">Bar Orders Only</option>
              </select>
            </div>

            {/* Menu Items Grid */}
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl border-border">
                No menu items found. Click &quot;Add Menu Item&quot; to build your restaurant menu.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <Card
                    key={item.id}
                    className={`p-4 flex flex-col justify-between transition-all border ${
                      item.isAvailable
                        ? "border-border bg-card"
                        : "border-border/60 bg-muted/40 opacity-80"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground text-base">{item.name}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.category.name}
                          </p>
                        </div>
                        <span className="font-bold text-amber-500 text-base">
                          {formatPesewas(item.pricePesewas)}
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            item.prepStation === "KITCHEN"
                              ? "bg-orange-500/10 text-orange-600 border border-orange-500/20"
                              : "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                          }`}
                        >
                          {item.prepStation === "KITCHEN" ? (
                            <Flame className="w-3 h-3" />
                          ) : (
                            <Wine className="w-3 h-3" />
                          )}
                          {item.prepStation}
                        </span>

                        {item.modifierGroups.length > 0 && (
                          <span className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full border border-border">
                            {item.modifierGroups.length} modifier group{item.modifierGroups.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Footer Controls */}
                    <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                      {/* Availability Quick Toggle */}
                      <button
                        onClick={() => handleToggleAvailability(item)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 transition-colors ${
                          item.isAvailable
                            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20"
                            : "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
                        }`}
                        title="Click to toggle item availability immediately"
                      >
                        {item.isAvailable ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Available
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3" /> Sold Out
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditItem(item)}
                          className="h-8 w-8 p-0"
                          title="Edit Item"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteItem(item.id, item.name)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Delete Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Categories Tab */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <Card key={cat.id} className="p-4 flex items-center justify-between border border-border bg-card">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground text-base">{cat.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Sort order: {cat.sortOrder} • {cat._count?.items ?? 0} menu items
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditCategory(cat)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Category Modal */}
        <Dialog
          open={categoryModalOpen}
          onOpenChange={setCategoryModalOpen}
          title={editingCategory ? "Edit Category" : "Add Menu Category"}
        >
          <form onSubmit={handleSaveCategory} className="space-y-4 pt-2">
            <div>
              <Label>Category Name</Label>
              <Input
                placeholder="e.g. Appetizers, Grills, Cocktails"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Display Sort Order</Label>
              <Input
                type="number"
                value={catSortOrder}
                onChange={(e) => setCatSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white">
                {editingCategory ? "Update Category" : "Create Category"}
              </Button>
            </div>
          </form>
        </Dialog>

        {/* Menu Item Modal */}
        <Dialog
          open={itemModalOpen}
          onOpenChange={setItemModalOpen}
          title={editingItem ? "Edit Menu Item" : "Create Menu Item"}
        >
          <form onSubmit={handleSaveItem} className="space-y-4 pt-2 max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Item Name</Label>
                <Input
                  placeholder="e.g. Jollof with Grilled Tilapia"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Price (GH₵)</Label>
                <Input
                  placeholder="e.g. 120.00"
                  value={itemPriceGhs}
                  onChange={(e) => setItemPriceGhs(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                placeholder="Served with spicy shito, fried plantain and salad"
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Menu Category</Label>
                <select
                  value={itemCategoryId}
                  onChange={(e) => setItemCategoryId(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="" disabled>Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Prep Station</Label>
                <select
                  value={itemPrepStation}
                  onChange={(e) => setItemPrepStation(e.target.value as "KITCHEN" | "BAR")}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="KITCHEN">Kitchen</option>
                  <option value="BAR">Bar</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Image URL (Optional)</Label>
                <Input
                  placeholder="https://... or /images/..."
                  value={itemImageUrl}
                  onChange={(e) => setItemImageUrl(e.target.value)}
                />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={itemSortOrder}
                  onChange={(e) => setItemSortOrder(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Availability */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isAvailableCheckbox"
                checked={itemIsAvailable}
                onChange={(e) => setItemIsAvailable(e.target.checked)}
                className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="isAvailableCheckbox" className="text-sm font-medium cursor-pointer">
                Available for ordering now
              </label>
            </div>

            {/* Modifier Groups Section (When creating new item) */}
            {!editingItem && (
              <div className="pt-4 border-t border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Modifiers & Options</h4>
                    <p className="text-xs text-muted-foreground">Add choices like spice level, temperature, sides or add-ons.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddModifierGroup}
                    className="gap-1 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Group
                  </Button>
                </div>

                {itemModifiers.map((group, gIdx) => (
                  <div key={gIdx} className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        placeholder="Modifier Group Name (e.g. Spice Level)"
                        value={group.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItemModifiers((prev) =>
                            prev.map((g, i) => (i === gIdx ? { ...g, name: val } : g))
                          );
                        }}
                        className="font-medium text-sm h-8"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveModifierGroup(gIdx)}
                        className="h-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={group.isRequired}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setItemModifiers((prev) =>
                              prev.map((g, i) => (i === gIdx ? { ...g, isRequired: checked } : g))
                            );
                          }}
                        />
                        Required
                      </label>
                      <div className="flex items-center gap-1">
                        <span>Max Select:</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={group.maxSelect}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setItemModifiers((prev) =>
                              prev.map((g, i) => (i === gIdx ? { ...g, maxSelect: val } : g))
                            );
                          }}
                          className="w-14 px-1 py-0.5 border rounded text-xs bg-background"
                        />
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-2 pl-2 border-l-2 border-amber-500/40">
                      {group.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <Input
                            placeholder="Option name (e.g. Mild)"
                            value={opt.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItemModifiers((prev) =>
                                prev.map((g, i) => {
                                  if (i !== gIdx) return g;
                                  return {
                                    ...g,
                                    options: g.options.map((o, j) => (j === oIdx ? { ...o, name: val } : o)),
                                  };
                                })
                              );
                            }}
                            className="text-xs h-7 flex-1"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">+GH₵</span>
                            <Input
                              type="number"
                              step="0.5"
                              placeholder="0.00"
                              value={opt.priceDeltaGhs}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemModifiers((prev) =>
                                  prev.map((g, i) => {
                                    if (i !== gIdx) return g;
                                    return {
                                      ...g,
                                      options: g.options.map((o, j) => (j === oIdx ? { ...o, priceDeltaGhs: val } : o)),
                                    };
                                  })
                                );
                              }}
                              className="text-xs h-7 w-20"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveModifierOption(gIdx, oIdx)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddModifierOption(gIdx)}
                        className="text-xs text-amber-500 h-6 px-2 hover:bg-amber-500/10"
                      >
                        + Add Choice Option
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setItemModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white">
                {editingItem ? "Save Changes" : "Create Item"}
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}
