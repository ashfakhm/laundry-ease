"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export interface InvoiceItem {
  itemType: string;
  quantity: number;
  unitPrice: number;
  photo?: File | null;
  photoUrl?: string; // URL after upload
}

interface InvoiceFormProps {
  bookingId: string;
}

export function InvoiceForm({ bookingId }: InvoiceFormProps) {
  const router = useRouter();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [pricingRates, setPricingRates] = useState<Record<string, number>>({});
  const [loadingRates, setLoadingRates] = useState(true);

  // Selection State
  const [selectedItemKey, setSelectedItemKey] = useState("");
  const [customItemName, setCustomItemName] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Fetch Pricing Rates on Mount
  React.useEffect(() => {
    async function fetchPricing() {
      try {
        const res = await fetch("/api/profile/provider");
        if (res.ok) {
          const data = await res.json();
          setPricingRates(data.pricingRates || {});
        }
      } catch (e) {
        console.error("Failed to fetch pricing", e);
      } finally {
        setLoadingRates(false);
      }
    }
    fetchPricing();
  }, []);

  // Handle Dropdown Change
  function handleItemSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const key = e.target.value;
    setSelectedItemKey(key);

    if (key === "Other") {
      setCustomItemName("");
      setUnitPrice(0);
    } else if (key) {
      // Standard Item: Lock Price
      setCustomItemName(key);
      setUnitPrice(pricingRates[key] || 0);
    } else {
      setCustomItemName("");
      setUnitPrice(0);
    }
  }

  function addItem() {
    const finalItemName =
      selectedItemKey === "Other" ? customItemName : selectedItemKey;

    if (!finalItemName) {
      setError("Please select or enter an item name");
      return;
    }

    // PRD Requirement: Photo is MANDATORY
    if (!photo) {
      setError("Photo evidence is mandatory for every item");
      return;
    }

    setItems([
      ...items,
      { itemType: finalItemName, quantity, unitPrice, photo },
    ]);

    // Reset inputs
    setSelectedItemKey("");
    setCustomItemName("");
    setQuantity(1);
    setUnitPrice(0);
    setPhoto(null);
    setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
      setError(null); // Clear error on file select
    }
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url as string;
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const total = Math.max(0, subtotal - discount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const itemsWithUrls = await Promise.all(
        items.map(async (item) => {
          if (item.photo) {
            const url = await uploadPhoto(item.photo);
            return { ...item, photoUrl: url };
          }
          return { ...item };
        }),
      );

      const payload = itemsWithUrls.map(({ photo: _photo, ...rest }) => rest);

      const res = await fetch(`/api/bookings/${bookingId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payload,
          subtotal,
          discount,
          total,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to submit invoice");
      }

      // Success: Redirect to dashboard
      router.refresh(); // Update server components
      router.push("/provider?invoice=success");
    } catch (err: unknown) {
      let msg = "Unknown error";
      if (err && typeof err === "object" && "message" in err) {
        msg = (err as { message?: string }).message || msg;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const availableItems = Object.keys(pricingRates);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      {/* Item Entry Area */}
      <div className="p-6 bg-card/80 backdrop-blur-md rounded-2xl border border-border shadow-xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-500 opacity-80" />

        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              +
            </span>
            Add New Item
          </h3>
          {loadingRates && (
            <span className="loading loading-spinner loading-sm text-primary"></span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Item Selection */}
          <div className="md:col-span-4 space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              Item Type
            </label>
            <select
              className="select select-bordered w-full bg-background focus:bg-background transition-all border-border focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl"
              value={selectedItemKey}
              onChange={handleItemSelect}
              disabled={loadingRates}
            >
              <option value="">-- Select Item --</option>
              {availableItems.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              <option value="Other">Other (Manual Entry)</option>
            </select>

            {selectedItemKey === "Other" && (
              <input
                type="text"
                placeholder="Enter custom item name"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                className="input input-sm input-bordered w-full mt-2 bg-yellow-500/10 border-yellow-500/20 focus:border-yellow-500 rounded-lg text-foreground"
              />
            )}
          </div>

          {/* Quantity */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              Qty
            </label>
            <input
              type="number"
              min={1}
              placeholder="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="input input-bordered w-full bg-background focus:bg-background transition-all rounded-xl font-mono text-center text-foreground"
              required
            />
          </div>

          {/* Unit Price */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              Price/Unit
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                ₹
              </span>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className={`input input-bordered w-full pl-7 transition-all rounded-xl font-mono text-right ${
                  selectedItemKey !== "Other" && selectedItemKey !== ""
                    ? "bg-muted text-muted-foreground cursor-not-allowed border-transparent"
                    : "bg-background border-border focus:border-primary text-foreground"
                }`}
                readOnly={selectedItemKey !== "Other" && selectedItemKey !== ""}
              />
            </div>
          </div>

          {/* Photo Upload */}
          <div className="md:col-span-3 space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              Evidence
            </label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file-input file-input-bordered file-input-sm w-full rounded-xl file:bg-primary/10 file:text-primary file:border-0 hover:file:bg-primary/20 bg-background text-foreground"
              />
            </div>
            {!photo && (
              <p className="text-[10px] text-destructive font-medium ml-1 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive"></span>
                Photo required
              </p>
            )}
          </div>

          {/* Add Button */}
          <div className="md:col-span-1 flex justify-end pt-8">
            <button
              type="button"
              onClick={addItem}
              className="btn btn-primary btn-square rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
              disabled={!selectedItemKey || !photo}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Item List */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-muted/30 border-b border-border flex justify-between items-center">
          <span className="font-bold text-foreground text-sm tracking-wide">
            ITEMS ADDED ({items.length})
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            Review before submitting
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8 opacity-50"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <p className="text-sm">
              No items added yet. Start adding items above.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {items.map((item, i) => (
              <li
                key={i}
                className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-muted rounded-xl flex items-center justify-center text-lg shadow-sm border border-border group-hover:scale-105 transition-transform text-foreground">
                    {item.photo ? "📸" : "📄"}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{item.itemType}</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      Qty: {item.quantity} × ₹{item.unitPrice}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-foreground bg-muted/50 px-3 py-1 rounded-lg">
                    ₹{item.quantity * item.unitPrice}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer: Notes, Discount & Total */}
      <div className="flex flex-col md:flex-row gap-6 p-6 bg-primary rounded-2xl shadow-xl text-primary-foreground relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

        <div className="w-full md:w-3/5 z-10">
          <label className="text-xs font-bold uppercase tracking-wider text-primary-foreground/70 mb-2 block">
            Notes for Customer
          </label>
          <textarea
            placeholder="Add any special instructions or notes about damage..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="textarea textarea-bordered w-full h-24 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/30 focus:bg-primary-foreground/20 focus:border-primary-foreground/40 rounded-xl"
          />
        </div>
        <div className="w-full md:w-2/5 flex flex-col justify-between items-end text-right z-10">
          <div className="mb-4">
            <p className="text-sm text-primary-foreground/70 mb-1">Subtotal</p>
            <p className="text-xl font-heading font-bold text-primary-foreground tracking-tight">
              <span className="text-base align-top opacity-50 mr-1">₹</span>
              {subtotal}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs font-semibold text-primary-foreground/80">
                Discount
              </label>
              <input
                type="number"
                min={0}
                max={subtotal}
                value={discount}
                onChange={(e) =>
                  setDiscount(
                    Math.max(0, Math.min(Number(e.target.value), subtotal)),
                  )
                }
                className="input input-sm input-bordered w-24 text-right bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground focus:bg-primary-foreground/20 focus:border-primary-foreground/40 rounded-lg ml-2"
              />
            </div>
          </div>
          <div>
            <p className="text-sm text-primary-foreground/70 mb-1">
              Total Estimated Amount
            </p>
            <p className="text-4xl font-heading font-black text-primary-foreground tracking-tight">
              <span className="text-2xl align-top opacity-50 mr-1">₹</span>
              {total}
            </p>
          </div>
          <button
            type="submit"
            className="btn btn-secondary w-full mt-4 h-14 text-lg font-bold border-none shadow-lg shadow-black/10 rounded-xl relative overflow-hidden group hover:bg-secondary/90 text-secondary-foreground"
            disabled={submitting || items.length === 0}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <span className="relative z-10 flex items-center justify-center gap-2">
              {submitting ? (
                <>Processing Invoice...</>
              ) : (
                <>
                  Create Invoice <span className="text-xl">→</span>
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error shadow-lg rounded-xl border border-destructive/20 bg-destructive/10 text-destructive font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}
