"use client";

import { useMemo, useState } from "react";
import { Bike, Package } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { VehicleModel, Product } from "@/lib/db/schema";
import type { CompatibilityFitment } from "@/lib/compatibility/service";

interface Props {
  vehicleModels: VehicleModel[];
  products:      Product[];
  fitments:      CompatibilityFitment[];
}

function modelLabel(m: Pick<VehicleModel, "model" | "yearStart">) {
  return m.yearStart ? `${m.model} (${m.yearStart}+)` : m.model;
}

export function CompatibilityBrowse({ vehicleModels, products, fitments }: Props) {
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const modelById    = useMemo(() => new Map(vehicleModels.map((m) => [m.id, m])), [vehicleModels]);

  const fitmentsByProduct = useMemo(() => {
    const map = new Map<string, VehicleModel[]>();
    for (const f of fitments) {
      const model = modelById.get(f.vehicleModelId);
      if (!model) continue;
      const arr = map.get(f.productId) ?? [];
      arr.push(model);
      map.set(f.productId, arr);
    }
    return map;
  }, [fitments, modelById]);

  const fitmentsByModel = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const f of fitments) {
      const product = productById.get(f.productId);
      if (!product) continue;
      const arr = map.get(f.vehicleModelId) ?? [];
      arr.push(product);
      map.set(f.vehicleModelId, arr);
    }
    return map;
  }, [fitments, productById]);

  return (
    <div className="p-[var(--space-6)] flex flex-col gap-[var(--space-6)]">
      <div>
        <h1 className="text-[var(--text-xl)] font-[var(--weight-semibold)]">Compatibility</h1>
        <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Look up which kit fits your motorcycle, or which motorcycles a kit fits.
        </p>
      </div>

      <Tabs defaultValue="by-model">
        <TabsList>
          <TabsTrigger value="by-model">
            <Bike size={14} style={{ marginRight: 6 }} /> By Motorcycle
          </TabsTrigger>
          <TabsTrigger value="by-kit">
            <Package size={14} style={{ marginRight: 6 }} /> By Kit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="by-model">
          <ByModelView vehicleModels={vehicleModels} fitmentsByModel={fitmentsByModel} />
        </TabsContent>

        <TabsContent value="by-kit">
          <ByKitView products={products} fitmentsByProduct={fitmentsByProduct} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── By Model: pick your bike, see the kits ─────────────────────

function ByModelView({
  vehicleModels,
  fitmentsByModel,
}: {
  vehicleModels: VehicleModel[];
  fitmentsByModel: Map<string, Product[]>;
}) {
  const brands = useMemo(() => [...new Set(vehicleModels.map((m) => m.brand))].sort(), [vehicleModels]);
  const [brand, setBrand] = useState(brands[0] ?? "");

  const modelsForBrand = useMemo(
    () => [...new Set(vehicleModels.filter((m) => m.brand === brand).map((m) => m.model))].sort(),
    [vehicleModels, brand],
  );
  const [model, setModel] = useState(modelsForBrand[0] ?? "");

  const yearsForModel = useMemo(
    () =>
      vehicleModels
        .filter((m) => m.brand === brand && m.model === model)
        .sort((a, b) => (a.yearStart ?? "").localeCompare(b.yearStart ?? "")),
    [vehicleModels, brand, model],
  );
  const [vehicleModelId, setVehicleModelId] = useState(yearsForModel[0]?.id ?? "");

  function handleBrandChange(next: string) {
    setBrand(next);
    const nextModels = [...new Set(vehicleModels.filter((m) => m.brand === next).map((m) => m.model))].sort();
    setModel(nextModels[0] ?? "");
    const nextYears = vehicleModels.filter((m) => m.brand === next && m.model === nextModels[0]);
    setVehicleModelId(nextYears[0]?.id ?? "");
  }

  function handleModelChange(next: string) {
    setModel(next);
    const nextYears = vehicleModels.filter((m) => m.brand === brand && m.model === next);
    setVehicleModelId(nextYears[0]?.id ?? "");
  }

  const grouped = useMemo(() => {
    const results = vehicleModelId ? (fitmentsByModel.get(vehicleModelId) ?? []) : [];
    const map = new Map<string, Product[]>();
    for (const p of results) {
      const arr = map.get(p.partName) ?? [];
      arr.push(p);
      map.set(p.partName, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [vehicleModelId, fitmentsByModel]);

  if (vehicleModels.length === 0) {
    return (
      <EmptyState
        icon={<Bike size={32} strokeWidth={1.5} />}
        title="No compatibility data yet"
        description="Vehicle models will appear here once the compatibility matrix is imported."
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-4)] max-w-2xl">
        <div className="flex flex-col gap-[var(--space-1)]">
          <span className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">Brand</span>
          <Select value={brand} onValueChange={handleBrandChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-[var(--space-1)]">
          <span className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">Model</span>
          <Select value={model} onValueChange={handleModelChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {modelsForBrand.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-[var(--space-1)]">
          <span className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">Year</span>
          <Select value={vehicleModelId} onValueChange={setVehicleModelId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearsForModel.map((y) => (
                <SelectItem key={y.id} value={y.id}>{y.yearStart ? `${y.yearStart}+` : "All years"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={<Bike size={32} strokeWidth={1.5} />}
          title="No kits found for this selection"
          description="No compatibility data is on file for this motorcycle yet."
        />
      ) : (
        <div
          style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}
        >
          <table className="w-full text-[var(--text-sm)]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--color-sunken)", borderBottom: "2px solid var(--color-border-default)" }}>
                <th className="text-left p-[var(--space-3)] px-[var(--space-4)] text-[var(--text-xs)] uppercase tracking-wide text-[var(--color-text-muted)]">Part</th>
                <th className="text-left p-[var(--space-3)] px-[var(--space-4)] text-[var(--text-xs)] uppercase tracking-wide text-[var(--color-text-muted)]">Kit</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([partName, kits]) => (
                <tr key={partName} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <td className="p-[var(--space-3)] px-[var(--space-4)] font-[var(--weight-medium)] align-top">{partName}</td>
                  <td className="p-[var(--space-3)] px-[var(--space-4)]">
                    <div className="flex flex-col gap-[var(--space-2)]">
                      {kits.map((k) => (
                        <div key={k.id}>
                          <strong>{k.sku}</strong>
                          {(k.attr1 || k.attr2) && (
                            <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                              {" "}— {[k.attr1, k.attr2].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── By Kit: pick a kit, see what it fits ───────────────────────

function ByKitView({
  products,
  fitmentsByProduct,
}: {
  products: Product[];
  fitmentsByProduct: Map<string, VehicleModel[]>;
}) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const withFitments = products.filter((p) => (fitmentsByProduct.get(p.id) ?? []).length > 0);
    if (!search.trim()) return withFitments;
    const q = search.toLowerCase();
    return withFitments.filter((p) => {
      const models = fitmentsByProduct.get(p.id) ?? [];
      return (
        p.sku.toLowerCase().includes(q) ||
        p.partName.toLowerCase().includes(q) ||
        models.some((m) => `${m.brand} ${m.model}`.toLowerCase().includes(q))
      );
    });
  }, [products, fitmentsByProduct, search]);

  const columns: Column<Product>[] = [
    {
      key: "kit",
      header: "Kit",
      sortable: true,
      sortValue: (p) => p.partName,
      render: (p) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontWeight: "var(--weight-medium)" }}>
            {p.sku}
          </span>
          <strong style={{ fontSize: "var(--text-base)" }}>{p.partName}</strong>
          {(p.attr1 || p.attr2) && (
            <small style={{ color: "var(--color-text-muted)" }}>{[p.attr1, p.attr2].filter(Boolean).join(", ")}</small>
          )}
        </div>
      ),
    },
    {
      key: "fits",
      header: "Fits",
      render: (p) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
          {(fitmentsByProduct.get(p.id) ?? []).map((m) => (
            <Badge key={m.id} variant="info">{modelLabel(m)}</Badge>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div
      style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}
    >
      <div style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", maxWidth: 360 }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontWeight: "var(--weight-medium)" }}>
            Search kits
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SKU, part, or motorcycle model…"
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              background: "var(--color-canvas)",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getKey={(p) => p.id}
        expandedContent={(p) => (
          <div className="p-[var(--space-4)] px-[var(--space-6)]">
            <p className="text-[var(--text-sm)] whitespace-pre-line">{p.description}</p>
          </div>
        )}
        emptyState={
          <EmptyState
            icon={<Package size={32} strokeWidth={1.5} />}
            title={search ? "No kits match your search" : "No compatibility data yet"}
            description={search ? "Try a different search term." : "Kit fitment data will appear here once imported."}
          />
        }
      />
    </div>
  );
}
