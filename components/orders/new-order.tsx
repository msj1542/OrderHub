"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/pricing/money";
import { saveOrderAction, submitOrderAction } from "@/app/(app)/orders/new/actions";
import { computeRushFee, getExpeditedDateWindow, isWeekendDateString, type AppSettings } from "@/lib/settings/scheduleCalc";
import { parseCsv } from "@/lib/catalog/csv";
import type { ProductWithMaterials, MaterialWithRolls, Company } from "@/lib/db/schema";
import { Plus, Trash2, Search, Upload } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────

export type CatalogLine = {
  id:            string; // local key
  type:          "catalog";
  product:       ProductWithMaterials;
  materialId:    string;
  quantity:      number;
  isExpedited:   boolean;
  requestedDate: string;
};

export type CustomLine = {
  id:            string;
  type:          "custom";
  description:   string;
  brand:         string;
  model:         string;
  modelYear:     string;
  coverageArea:  string;
  materialId:    string;
  quantity:      number;
  notes:         string;
  isExpedited:   boolean;
  requestedDate: string;
};

export type Line = CatalogLine | CustomLine;

type BulkRow = {
  raw:        { sku: string; quantity: string; material: string };
  status:     "valid" | "error";
  message?:   string;
  product?:   ProductWithMaterials;
  materialId?: string;
  quantity?:  number;
};

type Props = {
  products:   ProductWithMaterials[];
  materials:  MaterialWithRolls[];
  companies:  Company[];      // non-empty only for internal users
  isInternal: boolean;
  /** Pre-fill from an existing order (reorder or supplemental) */
  prefillLines?: Line[];
  prefillCompanyId?: string;
  supplementalToOrderId?: string;
  defaultCompanyId?: string;  // for external users
  settings: AppSettings;
};

// ── Line subtotal ──────────────────────────────────────────────

function getLinePrice(line: Line, products: ProductWithMaterials[]): number | null {
  if (line.type === "custom") return null;
  const priceEntry = line.product.prices.find((p) => p.material.id === line.materialId && p.isActive);
  return priceEntry ? parseFloat(priceEntry.unitPrice) : null;
}

let localId = 0;
function nextId() { return String(++localId); }

// ── Component ─────────────────────────────────────────────────

export function NewOrder({
  products,
  materials,
  companies,
  isInternal,
  prefillLines,
  supplementalToOrderId,
  defaultCompanyId,
  settings,
}: Props) {
  const router = useRouter();

  // Form state
  const [companyId, setCompanyId]       = React.useState(defaultCompanyId ?? companies[0]?.id ?? "");
  const [poNumber, setPoNumber]         = React.useState("");
  const [customerNotes, setCustomerNotes] = React.useState("");
  const [internalNotes, setInternalNotes] = React.useState("");
  const [lines, setLines]               = React.useState<Line[]>(prefillLines ?? []);
  const [error, setError]               = React.useState<string | null>(null);
  const [dupWarning, setDupWarning]     = React.useState<{ orderId: string; orderNumber: string | null } | null>(null);
  const [pending, setPending]           = React.useState<"draft" | "submit" | null>(null);
  const [rushFeeConfirm, setRushFeeConfirm] = React.useState(false);

  // Expedited order state — one order-level toggle + date; per-line toggles
  // only appear once this is on, and default to on for every line.
  const [orderExpedited, setOrderExpedited] = React.useState(
    () => prefillLines?.some((l) => l.isExpedited) ?? false,
  );
  const [orderRequestedDate, setOrderRequestedDate] = React.useState(
    () => prefillLines?.find((l) => l.isExpedited)?.requestedDate ?? "",
  );
  const [dateError, setDateError] = React.useState<string | null>(null);

  const expeditedWindow = React.useMemo(() => getExpeditedDateWindow(settings, new Date()), [settings]);

  function toggleOrderExpedited(next: boolean) {
    setOrderExpedited(next);
    setDateError(null);
    if (!next) {
      setOrderRequestedDate("");
      setLines((prev) => prev.map((l) => ({ ...l, isExpedited: false, requestedDate: "" })));
    } else {
      setLines((prev) => prev.map((l) => ({ ...l, isExpedited: true, requestedDate: orderRequestedDate })));
    }
  }

  function handleRequestedDateChange(value: string) {
    setOrderRequestedDate(value);
    setLines((prev) => prev.map((l) => (l.isExpedited ? { ...l, requestedDate: value } : l)));
    if (!value) { setDateError(null); return; }
    if (isWeekendDateString(value)) {
      setDateError("Weekends aren't available — pick a weekday.");
    } else if (value < expeditedWindow.min || value > expeditedWindow.max) {
      setDateError(`Pick a date between ${expeditedWindow.min} and ${expeditedWindow.max}.`);
    } else {
      setDateError(null);
    }
  }

  // Catalog search state
  const [catalogSearch, setCatalogSearch] = React.useState("");
  const [showSearch, setShowSearch]       = React.useState(false);
  const [showCustomForm, setShowCustomForm] = React.useState(false);

  // Custom item form state
  const [customForm, setCustomForm] = React.useState({
    description: "", brand: "", model: "", modelYear: "", coverageArea: "", materialId: "", quantity: 1, notes: "",
  });

  // Bulk upload state
  const [showBulkUpload, setShowBulkUpload] = React.useState(false);
  const [bulkRows, setBulkRows]             = React.useState<BulkRow[]>([]);

  function closeBulkUpload() {
    setShowBulkUpload(false);
    setBulkRows([]);
  }

  function downloadBulkTemplate() {
    const example = products[0]
      ? `${products[0].sku},1,${products[0].materials[0]?.name ?? "Gloss"}\n`
      : "";
    const csv = `sku,quantity,material\n${example}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "order-bulk-upload-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkFile(file: File) {
    const text = await file.text();
    const csvRows = parseCsv(text);
    const parsed: BulkRow[] = csvRows.map((row) => {
      const sku          = (row.sku ?? row.SKU ?? "").trim();
      const quantityRaw   = (row.quantity ?? row.Quantity ?? "").trim();
      const materialRaw   = (row.material ?? row.Material ?? "").trim();
      const raw = { sku, quantity: quantityRaw, material: materialRaw };

      if (!sku) return { raw, status: "error", message: "Missing SKU" };
      const product = products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
      if (!product) return { raw, status: "error", message: "SKU not found in catalog" };

      const quantity = parseInt(quantityRaw, 10);
      if (!Number.isFinite(quantity) || quantity < 1) {
        return { raw, status: "error", message: "Invalid quantity" };
      }

      let materialId: string | undefined;
      if (materialRaw) {
        const material = product.materials.find((m) => m.name.toLowerCase() === materialRaw.toLowerCase());
        if (!material) return { raw, status: "error", message: `"${materialRaw}" not offered for this item` };
        materialId = material.id;
      } else {
        materialId = product.materials[0]?.id;
        if (!materialId) return { raw, status: "error", message: "No material available for this item" };
      }

      return { raw, status: "valid", product, materialId, quantity };
    });
    setBulkRows(parsed);
  }

  function commitBulkRows() {
    const validRows = bulkRows.filter(
      (r): r is BulkRow & { product: ProductWithMaterials; materialId: string; quantity: number } =>
        r.status === "valid" && !!r.product && !!r.materialId && !!r.quantity,
    );
    setLines((prev) => [
      ...prev,
      ...validRows.map((r) => ({
        id:            nextId(),
        type:          "catalog" as const,
        product:       r.product,
        materialId:    r.materialId,
        quantity:      r.quantity,
        isExpedited:   orderExpedited,
        requestedDate: orderExpedited ? orderRequestedDate : "",
      })),
    ]);
    closeBulkUpload();
  }

  // ── Search / filter catalog ──────────────────────────────────

  const visibleProducts = products.filter((p) => {
    if (!catalogSearch.trim()) return true;
    const q = catalogSearch.toLowerCase();
    return (
      p.brand.toLowerCase().includes(q) ||
      p.model.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)   ||
      p.partName.toLowerCase().includes(q)
    );
  });

  // ── Add line from catalog ────────────────────────────────────

  function addCatalogLine(product: ProductWithMaterials) {
    const defaultMat = product.materials[0];
    if (!defaultMat) return;
    setLines((prev) => [
      ...prev,
      {
        id:            nextId(),
        type:          "catalog",
        product,
        materialId:    defaultMat.id,
        quantity:      1,
        isExpedited:   orderExpedited,
        requestedDate: orderExpedited ? orderRequestedDate : "",
      },
    ]);
    setShowSearch(false);
    setCatalogSearch("");
  }

  function addCustomLine() {
    if (!customForm.description || !customForm.brand || !customForm.model || !customForm.modelYear || !customForm.coverageArea || !customForm.materialId) {
      return;
    }
    setLines((prev) => [
      ...prev,
      { ...customForm, id: nextId(), type: "custom", isExpedited: orderExpedited, requestedDate: orderExpedited ? orderRequestedDate : "" },
    ]);
    setCustomForm({ description: "", brand: "", model: "", modelYear: "", coverageArea: "", materialId: "", quantity: 1, notes: "" });
    setShowCustomForm(false);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } as Line : l)));
  }

  // ── Totals ───────────────────────────────────────────────────

  const linePrice = (line: Line) => {
    const price = getLinePrice(line, products);
    return price == null ? 0 : price * line.quantity;
  };

  const subtotal = lines.reduce((sum, line) => sum + linePrice(line), 0);

  // Expedited is order-level, all-or-nothing — the rush fee prices the
  // full order subtotal.
  const rushFee = React.useMemo(() => {
    if (!orderExpedited) return 0;
    return computeRushFee(subtotal, settings, { requestedDate: orderRequestedDate || undefined });
  }, [orderExpedited, subtotal, settings, orderRequestedDate]);

  // ── Submit helpers ───────────────────────────────────────────

  function buildFormData(mode: "draft" | "submit", confirmDuplicate = false): FormData {
    const fd = new FormData();
    fd.set("companyId",   companyId);
    fd.set("poNumber",    poNumber);
    fd.set("customerNotes", customerNotes);
    if (isInternal) fd.set("internalNotes", internalNotes);
    if (supplementalToOrderId) fd.set("supplementalToOrderId", supplementalToOrderId);
    if (confirmDuplicate) fd.set("confirmDuplicate", "true");
    const requestedDate = orderExpedited ? orderRequestedDate || null : null;
    fd.set("lines", JSON.stringify(
      lines.map((l) =>
        l.type === "catalog"
          ? { isCustom: false, productId: l.product.id, materialId: l.materialId, quantity: l.quantity, isExpedited: orderExpedited, requestedDate }
          : { isCustom: true, description: l.description, brand: l.brand, model: l.model, modelYear: l.modelYear, coverageArea: l.coverageArea, materialId: l.materialId, quantity: l.quantity, notes: l.notes, isExpedited: orderExpedited, requestedDate },
      ),
    ));
    return fd;
  }

  async function handleSubmit(mode: "draft" | "submit", confirmDuplicate = false, bypassRushFee = false) {
    if (!companyId) { setError("Select a company."); return; }
    if (lines.length === 0) { setError("Add at least one item."); return; }
    if (orderExpedited && !orderRequestedDate) { setError("Select a requested date for the expedited items."); return; }
    if (orderExpedited && dateError) { setError(dateError); return; }

    if (mode === "submit" && orderExpedited && rushFee > 0 && !bypassRushFee) {
      setRushFeeConfirm(true);
      return;
    }

    setPending(mode);
    setError(null);
    setDupWarning(null);

    try {
      const fd = buildFormData(mode, confirmDuplicate);
      const action = mode === "draft" ? saveOrderAction : submitOrderAction;
      const result = await action(undefined, fd);

      if (!result) { setError("Unknown error."); return; }

      if ("duplicateOrderId" in result && result.duplicateOrderId) {
        setDupWarning({ orderId: result.duplicateOrderId, orderNumber: result.duplicateOrderNumber ?? null });
        return;
      }
      if (result.error) { setError(result.error); return; }
      if (result.orderId) { router.push(`/orders?id=${result.orderId}`); }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setPending(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-[var(--space-8)] p-[var(--space-6)]">
      <div>
        <h1 className="text-[var(--text-xl)] font-[var(--weight-semibold)]">
          {supplementalToOrderId ? "New Supplemental Order" : "New Order"}
        </h1>
        {supplementalToOrderId && (
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-[var(--space-1)]">
            This order will be linked to the parent order.
          </p>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {dupWarning && (
        <Alert variant="warning">
          <p className="mb-[var(--space-3)]">
            PO number <strong>{poNumber}</strong> was recently used on order{" "}
            <strong>{dupWarning.orderNumber ?? dupWarning.orderId}</strong>.
            Submit anyway?
          </p>
          <div className="flex gap-[var(--space-3)]">
            <Button size="sm" variant="danger" onClick={() => handleSubmit("submit", true)} disabled={!!pending}>
              Submit Anyway
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDupWarning(null)}>
              Go Back
            </Button>
          </div>
        </Alert>
      )}

      {rushFeeConfirm && (
        <Alert variant="warning">
          <p className="mb-[var(--space-3)]">
            This expedited order includes a rush fee of <strong>{formatMoney(rushFee)}</strong>.
            The grand total will be <strong>{formatMoney(subtotal + rushFee)}</strong>. Continue?
          </p>
          <div className="flex gap-[var(--space-3)]">
            <Button size="sm" onClick={() => { setRushFeeConfirm(false); handleSubmit("submit", false, true); }} disabled={!!pending}>
              Confirm &amp; Submit
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setRushFeeConfirm(false)}>
              Go Back
            </Button>
          </div>
        </Alert>
      )}

      {/* Company selector (internal only) */}
      {isInternal && !supplementalToOrderId && (
        <div className="flex flex-col gap-[var(--space-2)]">
          <Label htmlFor="companyId">Company</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger id="companyId">
              <SelectValue placeholder="Select company…" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Order details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-6)]">
        <div className="flex flex-col gap-[var(--space-2)]">
          <Label htmlFor="poNumber">PO Number</Label>
          <Input id="poNumber" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex flex-col gap-[var(--space-2)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Checkbox
              id="orderExpedited"
              checked={orderExpedited}
              onCheckedChange={(v) => toggleOrderExpedited(!!v)}
            />
            <Label htmlFor="orderExpedited" className="cursor-pointer">Expedited Order</Label>
          </div>
          {orderExpedited && (
            <div className="flex flex-col gap-[var(--space-1)]">
              <Label htmlFor="orderRequestedDate" className="text-[var(--text-xs)]">Requested Date*</Label>
              <Input
                id="orderRequestedDate"
                type="date"
                min={expeditedWindow.min}
                max={expeditedWindow.max}
                value={orderRequestedDate}
                onChange={(e) => handleRequestedDateChange(e.target.value)}
                style={{ maxWidth: 200 }}
              />
              {dateError && (
                <p className="text-[var(--text-xs)] text-[var(--status-danger-text)]">{dateError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <section className="flex flex-col gap-[var(--space-4)]">
        <h2 className="text-[var(--text-md)] font-[var(--weight-semibold)]">Items</h2>

        {lines.length === 0 && (
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
            No items added yet. Use the buttons below to add catalog items or custom items.
          </p>
        )}

        {lines.map((line) => (
          <div
            key={line.id}
            className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-panel)]"
          >
            {line.type === "catalog" ? (
              <>
                <div className="flex items-start justify-between gap-[var(--space-3)]">
                  <div>
                    <p className="text-[var(--text-sm)] font-[var(--weight-medium)]">
                      {line.product.sku} — {line.product.description}
                    </p>
                    <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                      {line.product.brand} · {line.product.model}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    aria-label="Remove line item"
                    className="text-[var(--color-text-muted)] hover:text-[var(--status-danger-text)] transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-[var(--space-3)] items-end">
                  <div className="flex flex-col gap-[var(--space-1)] min-w-[140px]">
                    <Label className="text-[var(--text-xs)]">Material</Label>
                    <Select
                      value={line.materialId}
                      onValueChange={(v) => updateLine(line.id, { materialId: v })}
                    >
                      <SelectTrigger className="h-8 text-[var(--text-sm)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {line.product.materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-[var(--space-1)] w-20">
                    <Label className="text-[var(--text-xs)]">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-8 text-[var(--text-sm)]"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    />
                  </div>
                  {(() => {
                    const price = getLinePrice(line, products);
                    return price != null ? (
                      <span className="text-[var(--text-sm)] text-[var(--color-text-muted)] pb-[var(--space-1)]">
                        {formatMoney(price)} × {line.quantity} = {formatMoney(price * line.quantity)}
                      </span>
                    ) : null;
                  })()}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <Badge variant="warning">Custom Item</Badge>
                  <button type="button" onClick={() => removeLine(line.id)} aria-label="Remove line item" className="text-[var(--color-text-muted)] hover:text-[var(--status-danger-text)]">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-[var(--text-sm)]">
                  {line.brand} {line.model} {line.modelYear} — {line.coverageArea}
                </p>
                <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">{line.description}</p>
                <div className="flex gap-[var(--space-3)]">
                  <div className="flex flex-col gap-[var(--space-1)] min-w-[140px]">
                    <Label className="text-[var(--text-xs)]">Material</Label>
                    <Select value={line.materialId} onValueChange={(v) => updateLine(line.id, { materialId: v })}>
                      <SelectTrigger className="h-8 text-[var(--text-sm)]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-[var(--space-1)] w-20">
                    <Label className="text-[var(--text-xs)]">Qty</Label>
                    <Input type="number" min={1} className="h-8 text-[var(--text-sm)]" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
                  </div>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Add catalog item */}
        {showSearch && (
          <div className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-brand)] bg-[var(--color-panel)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <Search size={14} className="text-[var(--color-text-muted)]" />
              <Input
                autoFocus
                placeholder="Search by brand, model, SKU, or part…"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="border-0 p-0 focus-visible:ring-0 shadow-none"
              />
              <button type="button" onClick={() => { setShowSearch(false); setCatalogSearch(""); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-[var(--text-xs)]">
                Cancel
              </button>
            </div>
            <div className="max-h-60 overflow-auto flex flex-col divide-y divide-[var(--color-border-subtle)]">
                {visibleProducts.slice(0, 30).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addCatalogLine(p)}
                    className="text-left px-[var(--space-2)] py-[var(--space-2)] hover:bg-[var(--color-sunken)] transition-colors"
                  >
                    <p className="text-[var(--text-sm)] font-[var(--weight-medium)]">{p.sku} — {p.partName}</p>
                    <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">{p.brand} · {p.model}</p>
                  </button>
                ))}
                {visibleProducts.length === 0 && (
                  <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] py-[var(--space-3)] px-[var(--space-2)]">No products found.</p>
                )}
              </div>
          </div>
        )}

        {/* Add custom item form */}
        {showCustomForm && (
          <div className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-panel)]">
            <p className="text-[var(--text-sm)] font-[var(--weight-semibold)]">Custom Item Request</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-3)]">
              <div className="flex flex-col gap-[var(--space-1)]">
                <Label className="text-[var(--text-xs)]">Description *</Label>
                <Input value={customForm.description} onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })} placeholder="What film coverage?" />
              </div>
              <div className="flex flex-col gap-[var(--space-1)]">
                <Label className="text-[var(--text-xs)]">Brand *</Label>
                <Input value={customForm.brand} onChange={(e) => setCustomForm({ ...customForm, brand: e.target.value })} placeholder="e.g. Harley-Davidson" />
              </div>
              <div className="flex flex-col gap-[var(--space-1)]">
                <Label className="text-[var(--text-xs)]">Model *</Label>
                <Input value={customForm.model} onChange={(e) => setCustomForm({ ...customForm, model: e.target.value })} placeholder="e.g. Road Glide" />
              </div>
              <div className="flex flex-col gap-[var(--space-1)]">
                <Label className="text-[var(--text-xs)]">Year *</Label>
                <Input value={customForm.modelYear} onChange={(e) => setCustomForm({ ...customForm, modelYear: e.target.value })} placeholder="e.g. 2024" />
              </div>
              <div className="flex flex-col gap-[var(--space-1)]">
                <Label className="text-[var(--text-xs)]">Coverage Area *</Label>
                <Input value={customForm.coverageArea} onChange={(e) => setCustomForm({ ...customForm, coverageArea: e.target.value })} placeholder="e.g. Tank" />
              </div>
              <div className="flex flex-col gap-[var(--space-1)]">
                <Label className="text-[var(--text-xs)]">Material *</Label>
                <Select value={customForm.materialId} onValueChange={(v) => setCustomForm({ ...customForm, materialId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select material…" /></SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-[var(--space-1)]">
                <Label className="text-[var(--text-xs)]">Quantity</Label>
                <Input type="number" min={1} value={customForm.quantity} onChange={(e) => setCustomForm({ ...customForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
              </div>
              <div className="flex flex-col gap-[var(--space-1)] sm:col-span-2">
                <Label className="text-[var(--text-xs)]">Notes</Label>
                <Input value={customForm.notes} onChange={(e) => setCustomForm({ ...customForm, notes: e.target.value })} placeholder="Any additional details for the team…" />
              </div>
            </div>
            <div className="flex gap-[var(--space-3)]">
              <Button size="sm" type="button" onClick={addCustomLine}>Add Item</Button>
              <Button size="sm" variant="secondary" type="button" onClick={() => setShowCustomForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Add buttons */}
        {!showSearch && !showCustomForm && (
          <div className="flex gap-[var(--space-3)]">
            <Button size="sm" variant="secondary" type="button" onClick={() => setShowSearch(true)}>
              <Plus size={14} /> Add from Catalog
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setShowCustomForm(true)}>
              <Plus size={14} /> Custom Item
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setShowBulkUpload(true)}>
              <Upload size={14} /> Bulk Upload
            </Button>
          </div>
        )}
      </section>

      {/* Summary */}
      {subtotal > 0 && (
        <div className="flex justify-end">
          <div className="text-[var(--text-sm)] space-y-[var(--space-2)]">
            <div className="flex justify-between gap-[var(--space-10)]">
              <span className="text-[var(--color-text-muted)]">Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {orderExpedited && rushFee > 0 && (
              <div className="flex justify-between gap-[var(--space-10)]">
                <span className="text-[var(--color-text-muted)]">Rush Fee</span>
                <span className="text-[var(--status-urgent-text)]">{formatMoney(rushFee)}</span>
              </div>
            )}
            {orderExpedited && rushFee > 0 && (
              <div className="flex justify-between gap-[var(--space-10)] border-t border-[var(--color-border-default)] pt-[var(--space-2)] font-[var(--weight-semibold)]">
                <span>Grand Total</span>
                <span>{formatMoney(subtotal + rushFee)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="flex flex-col gap-[var(--space-4)]">
        <div className="flex flex-col gap-[var(--space-2)]">
          <Label htmlFor="customerNotes">Order Notes (visible to customer)</Label>
          <Textarea id="customerNotes" rows={3} value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} placeholder="Any notes for the order team…" />
        </div>
        {isInternal && (
          <div className="flex flex-col gap-[var(--space-2)]">
            <Label htmlFor="internalNotes">Internal Notes (hidden from customer)</Label>
            <Textarea id="internalNotes" rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Internal staff notes…" />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-[var(--space-4)] pt-[var(--space-4)] border-t border-[var(--color-border-subtle)]">
        <Button variant="secondary" onClick={() => router.back()} disabled={!!pending}>
          Cancel
        </Button>
        <div className="flex gap-[var(--space-3)]">
          <Button
            variant="secondary"
            onClick={() => handleSubmit("draft")}
            disabled={!!pending || lines.length === 0}
          >
            {pending === "draft" ? "Saving…" : "Save Draft"}
          </Button>
          <Button
            onClick={() => handleSubmit("submit")}
            disabled={!!pending || lines.length === 0}
          >
            {pending === "submit" ? "Submitting…" : "Submit Order"}
          </Button>
        </div>
      </div>

      {orderExpedited && (
        <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] italic">
          *This is a requested date, not a guarantee. Confirmation will be provided upon acceptance.
        </p>
      )}

      {/* Bulk upload modal */}
      <Dialog open={showBulkUpload} onOpenChange={(open) => (open ? setShowBulkUpload(true) : closeBulkUpload())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Upload Items</DialogTitle>
            <DialogDescription>
              Download the template, fill in a row per item (SKU, quantity, material), then upload it here.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-[var(--space-4)]">
            <Button size="sm" variant="secondary" type="button" onClick={downloadBulkTemplate}>
              Download CSV Template
            </Button>

            <div className="flex flex-col gap-[var(--space-1)]">
              <Label htmlFor="bulk-csv-file" className="text-[var(--text-xs)]">Upload filled-out CSV</Label>
              <input
                id="bulk-csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleBulkFile(f);
                }}
                style={{ fontSize: "var(--text-sm)" }}
              />
            </div>

            {bulkRows.length > 0 && (
              <>
                <div className="max-h-72 overflow-auto border border-[var(--color-border-subtle)] rounded-[var(--radius-md)]">
                  <table className="w-full text-[var(--text-xs)]">
                    <thead className="bg-[var(--color-sunken)] sticky top-0">
                      <tr>
                        <th className="text-left p-[var(--space-2)]">SKU</th>
                        <th className="text-left p-[var(--space-2)]">Qty</th>
                        <th className="text-left p-[var(--space-2)]">Material</th>
                        <th className="text-left p-[var(--space-2)]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((r, i) => (
                        <tr key={i} className="border-t border-[var(--color-border-subtle)]">
                          <td className="p-[var(--space-2)]">{r.raw.sku || "—"}</td>
                          <td className="p-[var(--space-2)]">{r.raw.quantity || "—"}</td>
                          <td className="p-[var(--space-2)]">{r.raw.material || "(default)"}</td>
                          <td className="p-[var(--space-2)]">
                            {r.status === "valid" ? (
                              <span style={{ color: "var(--status-success-text)" }}>✓ {r.product?.sku}</span>
                            ) : (
                              <span style={{ color: "var(--status-danger-text)" }}>{r.message}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                  {bulkRows.filter((r) => r.status === "valid").length} of {bulkRows.length} row(s) will be added.
                  {bulkRows.some((r) => r.status === "error") && " Rows with errors are skipped — fix and re-upload, or continue to add just the valid rows."}
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={closeBulkUpload}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={commitBulkRows}
              disabled={!bulkRows.some((r) => r.status === "valid")}
            >
              Add {bulkRows.filter((r) => r.status === "valid").length} Item{bulkRows.filter((r) => r.status === "valid").length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
