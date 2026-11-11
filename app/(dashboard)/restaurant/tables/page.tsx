"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog-and-drawer";
import {
  QrCode,
  Plus,
  Users,
  Printer,
  Copy,
  CheckCircle2,
  Trash2,
  Edit2,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface RestaurantTableItem {
  id: string;
  label: string;
  capacity: number;
  qrToken: string;
  isActive: boolean;
  sortOrder: number;
  _count?: { orders: number };
}

export default function RestaurantTablesPage() {
  const [tables, setTables] = React.useState<RestaurantTableItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  // Table form modal
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingTable, setEditingTable] = React.useState<RestaurantTableItem | null>(null);
  const [label, setLabel] = React.useState("");
  const [capacity, setCapacity] = React.useState(4);
  const [sortOrder, setSortOrder] = React.useState(0);
  const [isActive, setIsActive] = React.useState(true);
  const [regenerateQr, setRegenerateQr] = React.useState(false);

  // QR Print Modal
  const [qrModalOpen, setQrModalOpen] = React.useState(false);
  const [selectedTableForQr, setSelectedTableForQr] = React.useState<RestaurantTableItem | null>(null);
  const [copiedUrl, setCopiedUrl] = React.useState(false);

  const fetchTables = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/restaurant/tables");
      const json = await res.json();
      if (json.success) {
        setTables(json.data.tables || []);
      } else {
        throw new Error(json.message);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load dining tables");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/restaurant/tables");
        const json = await res.json();
        if (!ignore) {
          if (json.success) {
            setTables(json.data.tables || []);
          } else {
            throw new Error(json.message);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to load dining tables");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
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

  const handleOpenAdd = () => {
    setEditingTable(null);
    setLabel(`Table ${tables.length + 1}`);
    setCapacity(4);
    setSortOrder(tables.length);
    setIsActive(true);
    setRegenerateQr(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (tbl: RestaurantTableItem) => {
    setEditingTable(tbl);
    setLabel(tbl.label);
    setCapacity(tbl.capacity);
    setSortOrder(tbl.sortOrder);
    setIsActive(tbl.isActive);
    setRegenerateQr(false);
    setModalOpen(true);
  };

  const handleOpenQr = (tbl: RestaurantTableItem) => {
    setSelectedTableForQr(tbl);
    setCopiedUrl(false);
    setQrModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTable) {
        const res = await fetch("/api/admin/restaurant/tables", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingTable.id,
            label,
            capacity: Number(capacity),
            sortOrder: Number(sortOrder),
            isActive,
            regenerateQr,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        showSuccess("Table updated successfully");
      } else {
        const res = await fetch("/api/admin/restaurant/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            capacity: Number(capacity),
            sortOrder: Number(sortOrder),
            isActive,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        showSuccess("Table added successfully");
      }
      setModalOpen(false);
      fetchTables();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Error saving table");
    }
  };

  const handleDelete = async (id: string, tableLabel: string) => {
    if (!confirm(`Are you sure you want to delete ${tableLabel}?`)) return;
    try {
      const res = await fetch(`/api/admin/restaurant/tables?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      showSuccess("Table deleted");
      fetchTables();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Error deleting table");
    }
  };

  const getMenuUrl = (qrToken: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/menu?table=${qrToken}`;
    }
    return `/menu?table=${qrToken}`;
  };

  const handleCopyUrl = (qrToken: string) => {
    const url = getMenuUrl(qrToken);
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell activePath="/restaurant/tables" userName="Restaurant Admin">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <QrCode className="w-6 h-6 text-amber-500" />
              Dining Tables & QR Codes
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage dining room layout, table seating capacity, and generate printable QR code table cards.
            </p>
          </div>
          <Button onClick={handleOpenAdd} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
            <Plus className="w-4 h-4" />
            Add Dining Table
          </Button>
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

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Loading dining tables...</div>
        ) : tables.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl border-border space-y-3">
            <p>No dining tables configured yet.</p>
            <Button onClick={handleOpenAdd} variant="outline" className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Your First Table
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables.map((tbl) => (
              <Card
                key={tbl.id}
                className={`p-4 flex flex-col justify-between border transition-all ${
                  tbl.isActive ? "border-border bg-card" : "border-border/60 bg-muted/40 opacity-70"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">{tbl.label}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Users className="w-3.5 h-3.5" />
                        Seats {tbl.capacity} guests
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        tbl.isActive
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {tbl.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-secondary/50 border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono">QR Token:</span>
                      <span className="font-mono text-[11px] text-foreground font-medium">
                        {tbl.qrToken.slice(0, 10)}...
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Orders served:</span>
                      <span className="font-semibold text-foreground">{tbl._count?.orders ?? 0}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenQr(tbl)}
                    className="gap-1.5 text-xs h-8 border-amber-500/30 hover:bg-amber-500/10 text-amber-500"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Print QR
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(tbl)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(tbl.id, tbl.label)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Table Add/Edit Modal */}
        <Dialog
          open={modalOpen}
          onOpenChange={setModalOpen}
          title={editingTable ? `Edit ${editingTable.label}` : "Add Dining Table"}
        >
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div>
              <Label>Table Label</Label>
              <Input
                placeholder="e.g. Table 1, Terrace 4, Booth B"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Seating Capacity</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="tableActiveCheck"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-border text-amber-500"
              />
              <label htmlFor="tableActiveCheck" className="text-sm font-medium cursor-pointer">
                Table is active and available for seating
              </label>
            </div>

            {editingTable && (
              <div className="flex items-center gap-2 pt-1 border-t border-border mt-3">
                <input
                  type="checkbox"
                  id="regenQrCheck"
                  checked={regenerateQr}
                  onChange={(e) => setRegenerateQr(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-destructive"
                />
                <label htmlFor="regenQrCheck" className="text-xs text-muted-foreground cursor-pointer">
                  Regenerate QR Token (will invalidate old printed table stickers)
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white">
                {editingTable ? "Update Table" : "Create Table"}
              </Button>
            </div>
          </form>
        </Dialog>

        {/* Printable QR Code Modal */}
        <Dialog
          open={qrModalOpen}
          onOpenChange={setQrModalOpen}
          title={`Printable QR Card: ${selectedTableForQr?.label || ""}`}
        >
          {selectedTableForQr && (
            <div className="space-y-4 pt-2">
              {/* The printable card container */}
              <div
                id="printable-qr-card"
                className="mx-auto max-w-sm p-6 rounded-2xl border-2 border-amber-500/40 bg-zinc-950 text-white shadow-xl text-center space-y-4 print:border-none print:shadow-none print:m-0"
              >
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold tracking-wider uppercase border border-amber-500/30">
                    <Sparkles className="w-3 h-3" />
                    Restaurant & Bar
                  </div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-white">
                    {selectedTableForQr.label}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Scan with your phone to view menu & order
                  </p>
                </div>

                {/* QR Code Display */}
                <div className="p-4 bg-white rounded-xl inline-block shadow-inner mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                      getMenuUrl(selectedTableForQr.qrToken)
                    )}`}
                    alt={`QR Code for ${selectedTableForQr.label}`}
                    width={220}
                    height={220}
                    className="w-48 h-48 block mx-auto"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-mono text-zinc-400 break-all select-all">
                    {getMenuUrl(selectedTableForQr.qrToken)}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    Point camera at code • No app download required
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyUrl(selectedTableForQr.qrToken)}
                  className="w-full sm:w-auto gap-1.5 text-xs"
                >
                  {copiedUrl ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Order Link
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getMenuUrl(selectedTableForQr.qrToken), "_blank")}
                    className="gap-1.5 text-xs flex-1 sm:flex-initial"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Test URL
                  </Button>
                  <Button
                    size="sm"
                    onClick={handlePrint}
                    className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs flex-1 sm:flex-initial"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Table Card
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </AppShell>
  );
}
