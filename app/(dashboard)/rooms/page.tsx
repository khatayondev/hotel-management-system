"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog-and-drawer";
import { StatusChip } from "@/components/ui/status-chip";
import { formatPesewas } from "@/lib/money";
import {
  Hotel,
  Plus,
  BedDouble,
  DollarSign,
  Tag,
  CheckCircle2,
  Trash2,
  Edit2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function RoomsAdminPage() {
  const [activeTab, setActiveTab] = React.useState<"roomTypes" | "rooms" | "overrides" | "extras">("roomTypes");
  const [loading, setLoading] = React.useState(true);
  const [roomTypes, setRoomTypes] = React.useState<any[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [overrides, setOverrides] = React.useState<any[]>([]);
  const [extras, setExtras] = React.useState<any[]>([]);

  // Modals
  const [roomTypeModalOpen, setRoomTypeModalOpen] = React.useState(false);
  const [roomModalOpen, setRoomModalOpen] = React.useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = React.useState(false);
  const [extraModalOpen, setExtraModalOpen] = React.useState(false);

  // Edit target
  const [editingItem, setEditingItem] = React.useState<any | null>(null);

  // Form states
  const [rtName, setRtName] = React.useState("");
  const [rtSlug, setRtSlug] = React.useState("");
  const [rtDesc, setRtDesc] = React.useState("");
  const [rtAdults, setRtAdults] = React.useState(2);
  const [rtChildren, setRtChildren] = React.useState(0);
  const [rtBed, setRtBed] = React.useState("1 King Bed");
  const [rtPriceGhs, setRtPriceGhs] = React.useState("1000");
  const [rtAmenities, setRtAmenities] = React.useState("WiFi, Air Conditioning, Smart TV, Balcony");
  const [rtImages, setRtImages] = React.useState("/images/suites/deluxe-suite.jpg");

  const [rNumber, setRNumber] = React.useState("");
  const [rFloor, setRFloor] = React.useState(1);
  const [rRoomTypeId, setRRoomTypeId] = React.useState("");
  const [rStatus, setRStatus] = React.useState("CLEAN");
  const [rNotes, setRNotes] = React.useState("");

  const [ovRoomTypeId, setOvRoomTypeId] = React.useState("");
  const [ovStart, setOvStart] = React.useState("");
  const [ovEnd, setOvEnd] = React.useState("");
  const [ovPriceGhs, setOvPriceGhs] = React.useState("1200");
  const [ovMinNights, setOvMinNights] = React.useState(1);
  const [ovLabel, setOvLabel] = React.useState("Weekend Special");

  const [exName, setExName] = React.useState("");
  const [exPriceGhs, setExPriceGhs] = React.useState("150");
  const [exPricing, setExPricing] = React.useState("PER_STAY");

  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [roomsRes, ovRes, exRes] = await Promise.all([
        fetch("/api/admin/hotel/rooms"),
        fetch("/api/admin/hotel/rate-overrides"),
        fetch("/api/admin/hotel/extras"),
      ]);

      if (roomsRes.ok) {
        const json = await roomsRes.json();
        setRoomTypes(json.data.roomTypes || []);
        setRooms(json.data.rooms || []);
      }
      if (ovRes.ok) {
        const json = await ovRes.json();
        setOverrides(json.data || []);
      }
      if (exRes.ok) {
        const json = await exRes.json();
        setExtras(json.data || []);
      }
    } catch {
      setErrorMsg("Failed to load hotel inventory data");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleSaveRoomType = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      const payload = {
        name: rtName,
        slug: rtSlug,
        description: rtDesc,
        maxAdults: Number(rtAdults),
        maxChildren: Number(rtChildren),
        bedConfiguration: rtBed,
        basePricePesewas: Math.round(Number(rtPriceGhs) * 100),
        amenities: rtAmenities.split(",").map((s) => s.trim()).filter(Boolean),
        imageUrls: rtImages.split(",").map((s) => s.trim()).filter(Boolean),
      };

      const res = await fetch("/api/admin/hotel/rooms", {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingItem
            ? { entity: "roomType", id: editingItem.id, data: payload }
            : { entity: "roomType", data: payload }
        ),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to save room type");

      setSuccessMsg("Room type saved successfully");
      setRoomTypeModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      const payload = {
        number: rNumber,
        floor: Number(rFloor),
        roomTypeId: rRoomTypeId,
        status: rStatus,
        notes: rNotes,
      };

      const res = await fetch("/api/admin/hotel/rooms", {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingItem
            ? { entity: "room", id: editingItem.id, data: payload }
            : { entity: "room", data: payload }
        ),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to save room");

      setSuccessMsg("Room saved successfully");
      setRoomModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      const payload = {
        roomTypeId: ovRoomTypeId,
        startDate: ovStart,
        endDate: ovEnd,
        pricePesewas: Math.round(Number(ovPriceGhs) * 100),
        minNights: Number(ovMinNights) || 1,
        label: ovLabel,
      };

      const res = await fetch("/api/admin/hotel/rate-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to save override");

      setSuccessMsg("Rate override applied successfully");
      setOverrideModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      const payload = {
        name: exName,
        pricePesewas: Math.round(Number(exPriceGhs) * 100),
        pricing: exPricing,
      };

      const res = await fetch("/api/admin/hotel/extras", {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItem ? { id: editingItem.id, data: payload } : payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to save extra");

      setSuccessMsg("Room extra saved");
      setExtraModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteItem = async (entity: string, id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      const url =
        entity === "override"
          ? `/api/admin/hotel/rate-overrides?id=${id}`
          : entity === "extra"
          ? `/api/admin/hotel/extras?id=${id}`
          : `/api/admin/hotel/rooms?entity=${entity}&id=${id}`;

      const res = await fetch(url, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Delete failed");
      setSuccessMsg("Record deleted successfully");
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <AppShell activePath="/dashboard/rooms" userName="Hotel Operations">
      <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 flex items-center gap-2">
              <Hotel className="w-6 h-6 text-amber-500" />
              <span>Rooms & Rates Management</span>
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Configure room types, individual physical rooms, seasonal rate overrides, and guest extras.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "roomTypes" && (
              <Button
                variant="blackPill"
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setRtName("");
                  setRtSlug("");
                  setRtDesc("");
                  setRtPriceGhs("1000");
                  setRoomTypeModalOpen(true);
                }}
                className="gap-1.5 text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                <span>New Room Type</span>
              </Button>
            )}
            {activeTab === "rooms" && (
              <Button
                variant="blackPill"
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setRNumber("");
                  setRFloor(1);
                  setRRoomTypeId(roomTypes[0]?.id || "");
                  setRStatus("CLEAN");
                  setRoomModalOpen(true);
                }}
                className="gap-1.5 text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                <span>Add Room</span>
              </Button>
            )}
            {activeTab === "overrides" && (
              <Button
                variant="blackPill"
                size="sm"
                onClick={() => {
                  setOvRoomTypeId(roomTypes[0]?.id || "");
                  setOvStart("");
                  setOvEnd("");
                  setOverrideModalOpen(true);
                }}
                className="gap-1.5 text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                <span>Add Seasonal Override</span>
              </Button>
            )}
            {activeTab === "extras" && (
              <Button
                variant="blackPill"
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setExName("");
                  setExPriceGhs("150");
                  setExtraModalOpen(true);
                }}
                className="gap-1.5 text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                <span>Add Extra</span>
              </Button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg("")} className="font-bold underline text-[11px]">Dismiss</button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg("")} className="font-bold underline text-[11px]">Dismiss</button>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex gap-2 border-b border-neutral-200 pb-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab("roomTypes")}
            className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === "roomTypes" ? "bg-black text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Room Types ({roomTypes.length})
          </button>
          <button
            onClick={() => setActiveTab("rooms")}
            className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === "rooms" ? "bg-black text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Physical Rooms ({rooms.length})
          </button>
          <button
            onClick={() => setActiveTab("overrides")}
            className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === "overrides" ? "bg-black text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Seasonal Overrides ({overrides.length})
          </button>
          <button
            onClick={() => setActiveTab("extras")}
            className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === "extras" ? "bg-black text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Room Extras ({extras.length})
          </button>
        </div>

        {/* Tab Content: Room Types */}
        {activeTab === "roomTypes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roomTypes.map((rt) => (
              <Card key={rt.id} variant="white" className="p-5 space-y-4 rounded-3xl border border-neutral-200 shadow-xs">
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-100 relative">
                  <img
                    src={rt.imageUrls?.[0] || "/images/suites/deluxe-suite.jpg"}
                    alt={rt.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-bold text-white uppercase">
                    {rt.rooms?.length || 0} Rooms
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-neutral-900">{rt.name}</h3>
                    <span className="text-xs font-black text-amber-600">
                      GH₵ {(rt.basePricePesewas / 100).toFixed(2)}/nt
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 line-clamp-2">{rt.description}</p>
                </div>

                <div className="text-[11px] text-neutral-600 space-y-1 bg-neutral-50 p-3 rounded-2xl">
                  <div>Bed: <span className="font-semibold text-neutral-900">{rt.bedConfiguration}</span></div>
                  <div>Max Guests: <span className="font-semibold text-neutral-900">{rt.maxAdults} Adults, {rt.maxChildren} Children</span></div>
                  <div>Amenities: <span className="text-neutral-500">{rt.amenities?.slice(0, 3).join(", ")}...</span></div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs">
                  <button
                    onClick={() => {
                      setEditingItem(rt);
                      setRtName(rt.name);
                      setRtSlug(rt.slug);
                      setRtDesc(rt.description || "");
                      setRtAdults(rt.maxAdults);
                      setRtChildren(rt.maxChildren);
                      setRtBed(rt.bedConfiguration);
                      setRtPriceGhs((rt.basePricePesewas / 100).toString());
                      setRtAmenities(rt.amenities?.join(", ") || "");
                      setRtImages(rt.imageUrls?.join(", ") || "");
                      setRoomTypeModalOpen(true);
                    }}
                    className="font-bold text-neutral-700 hover:text-black flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDeleteItem("roomType", rt.id)}
                    className="font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Tab Content: Physical Rooms */}
        {activeTab === "rooms" && (
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-4">Room Number</th>
                  <th className="p-4">Floor</th>
                  <th className="p-4">Suite Category</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Notes</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {rooms.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="p-4 font-bold text-neutral-900">{r.number}</td>
                    <td className="p-4">Floor {r.floor}</td>
                    <td className="p-4 font-medium">{r.roomType?.name}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        r.status === "CLEAN" ? "bg-emerald-100 text-emerald-800" :
                        r.status === "DIRTY" ? "bg-amber-100 text-amber-800" :
                        r.status === "OCCUPIED" ? "bg-blue-100 text-blue-800" :
                        r.status === "INSPECTED" ? "bg-purple-100 text-purple-800" :
                        "bg-rose-100 text-rose-800"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-4 text-neutral-500 max-w-xs truncate">{r.notes || "—"}</td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingItem(r);
                          setRNumber(r.number);
                          setRFloor(r.floor);
                          setRRoomTypeId(r.roomTypeId);
                          setRStatus(r.status);
                          setRNotes(r.notes || "");
                          setRoomModalOpen(true);
                        }}
                        className="text-neutral-700 hover:text-black font-bold cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem("room", r.id)}
                        className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content: Overrides */}
        {activeTab === "overrides" && (
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-4">Label</th>
                  <th className="p-4">Suite Category</th>
                  <th className="p-4">Start Date</th>
                  <th className="p-4">End Date</th>
                  <th className="p-4">Override Price</th>
                  <th className="p-4">Min Stay</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {overrides.map((ov) => (
                  <tr key={ov.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="p-4 font-bold text-neutral-900">{ov.label || "Override"}</td>
                    <td className="p-4">{ov.roomType?.name}</td>
                    <td className="p-4">{new Date(ov.startDate).toISOString().slice(0, 10)}</td>
                    <td className="p-4">{new Date(ov.endDate).toISOString().slice(0, 10)}</td>
                    <td className="p-4 font-bold text-amber-600">GH₵ {(ov.pricePesewas / 100).toFixed(2)}</td>
                    <td className="p-4">{ov.minNights || 1} nights</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteItem("override", ov.id)}
                        className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content: Extras */}
        {activeTab === "extras" && (
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-4">Extra Name</th>
                  <th className="p-4">Pricing Model</th>
                  <th className="p-4">Rate</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {extras.map((ex) => (
                  <tr key={ex.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="p-4 font-bold text-neutral-900">{ex.name}</td>
                    <td className="p-4 uppercase text-[11px] font-semibold text-neutral-600">{ex.pricing}</td>
                    <td className="p-4 font-bold text-amber-600">GH₵ {(ex.pricePesewas / 100).toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        ex.isActive ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600"
                      }`}>
                        {ex.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteItem("extra", ex.id)}
                        className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Room Type */}
        {roomTypeModalOpen && (
          <Dialog open={roomTypeModalOpen} onOpenChange={setRoomTypeModalOpen} title={editingItem ? "Edit Room Type" : "Create Room Type"}>
            <form onSubmit={handleSaveRoomType} className="space-y-4 text-xs">
              <div>
                <Label>Suite Name</Label>
                <Input required value={rtName} onChange={(e) => setRtName(e.target.value)} placeholder="Deluxe King Suite" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>URL Slug</Label>
                  <Input required value={rtSlug} onChange={(e) => setRtSlug(e.target.value)} placeholder="deluxe-king-suite" />
                </div>
                <div>
                  <Label>Base Price (GH₵ / night)</Label>
                  <Input required type="number" value={rtPriceGhs} onChange={(e) => setRtPriceGhs(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Max Adults</Label>
                  <Input type="number" min={1} value={rtAdults} onChange={(e) => setRtAdults(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Max Children</Label>
                  <Input type="number" min={0} value={rtChildren} onChange={(e) => setRtChildren(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Bed Configuration</Label>
                  <Input value={rtBed} onChange={(e) => setRtBed(e.target.value)} placeholder="1 King Bed" />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={rtDesc} onChange={(e) => setRtDesc(e.target.value)} placeholder="Spacious master suite..." />
              </div>
              <div>
                <Label>Amenities (comma-separated)</Label>
                <Input value={rtAmenities} onChange={(e) => setRtAmenities(e.target.value)} placeholder="WiFi, AC, Jacuzzi" />
              </div>
              <div>
                <Label>Image URLs (comma-separated)</Label>
                <Input value={rtImages} onChange={(e) => setRtImages(e.target.value)} placeholder="/images/suites/suite1.jpg" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setRoomTypeModalOpen(false)}>Cancel</Button>
                <Button variant="blackPill" type="submit">Save Suite</Button>
              </div>
            </form>
          </Dialog>
        )}

        {/* Modal: Physical Room */}
        {roomModalOpen && (
          <Dialog open={roomModalOpen} onOpenChange={setRoomModalOpen} title={editingItem ? "Edit Physical Room" : "Add Physical Room"}>
            <form onSubmit={handleSaveRoom} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Room Number</Label>
                  <Input required value={rNumber} onChange={(e) => setRNumber(e.target.value)} placeholder="101" />
                </div>
                <div>
                  <Label>Floor</Label>
                  <Input type="number" value={rFloor} onChange={(e) => setRFloor(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <Label>Suite Category</Label>
                <select
                  value={rRoomTypeId}
                  onChange={(e) => setRRoomTypeId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs font-semibold"
                >
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Initial Status</Label>
                <select
                  value={rStatus}
                  onChange={(e) => setRStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs font-semibold"
                >
                  <option value="CLEAN">CLEAN</option>
                  <option value="INSPECTED">INSPECTED</option>
                  <option value="DIRTY">DIRTY</option>
                  <option value="OUT_OF_ORDER">OUT OF ORDER</option>
                </select>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={rNotes} onChange={(e) => setRNotes(e.target.value)} placeholder="Balcony overlooking courtyard" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setRoomModalOpen(false)}>Cancel</Button>
                <Button variant="blackPill" type="submit">Save Room</Button>
              </div>
            </form>
          </Dialog>
        )}

        {/* Modal: Rate Override */}
        {overrideModalOpen && (
          <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen} title="Add Seasonal Rate Override">
            <form onSubmit={handleSaveOverride} className="space-y-4 text-xs">
              <div>
                <Label>Suite Category</Label>
                <select
                  value={ovRoomTypeId}
                  onChange={(e) => setOvRoomTypeId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs font-semibold"
                >
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" required value={ovStart} onChange={(e) => setOvStart(e.target.value)} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" required value={ovEnd} onChange={(e) => setOvEnd(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Override Rate (GH₵ / night)</Label>
                  <Input type="number" required value={ovPriceGhs} onChange={(e) => setOvPriceGhs(e.target.value)} />
                </div>
                <div>
                  <Label>Min Stay Nights</Label>
                  <Input type="number" min={1} value={ovMinNights} onChange={(e) => setOvMinNights(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <Label>Reason / Label</Label>
                <Input value={ovLabel} onChange={(e) => setOvLabel(e.target.value)} placeholder="Dec Festive Season Peak" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setOverrideModalOpen(false)}>Cancel</Button>
                <Button variant="blackPill" type="submit">Apply Rate Override</Button>
              </div>
            </form>
          </Dialog>
        )}

        {/* Modal: Room Extra */}
        {extraModalOpen && (
          <Dialog open={extraModalOpen} onOpenChange={setExtraModalOpen} title="Add Guest Extra">
            <form onSubmit={handleSaveExtra} className="space-y-4 text-xs">
              <div>
                <Label>Extra Service Name</Label>
                <Input required value={exName} onChange={(e) => setExName(e.target.value)} placeholder="Airport VIP Transfer" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price (GH₵)</Label>
                  <Input type="number" required value={exPriceGhs} onChange={(e) => setExPriceGhs(e.target.value)} />
                </div>
                <div>
                  <Label>Pricing Model</Label>
                  <select
                    value={exPricing}
                    onChange={(e) => setExPricing(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs font-semibold"
                  >
                    <option value="PER_STAY">PER STAY</option>
                    <option value="PER_NIGHT">PER NIGHT</option>
                    <option value="PER_PERSON">PER PERSON</option>
                  </select>
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setExtraModalOpen(false)}>Cancel</Button>
                <Button variant="blackPill" type="submit">Save Extra</Button>
              </div>
            </form>
          </Dialog>
        )}
      </div>
    </AppShell>
  );
}
