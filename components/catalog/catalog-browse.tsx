"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState }             from "@/components/ui/empty-state";
import { Layers }                 from "lucide-react";
import { formatMoney }            from "@/lib/pricing/money";
import type { MaterialWithRolls, ProductWithMaterials } from "@/lib/db/schema";
import { ProductDetails }         from "./product-details";

interface Props {
  products:       ProductWithMaterials[];
  materials:      MaterialWithRolls[];
  pricingVisible: boolean;
}

export function CatalogBrowse({ products, materials, pricingVisible }: Props) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? products.filter((p) =>
        [p.sku, p.brand, p.model, p.yearStart, p.partName, p.attr1, p.attr2, p.description]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : products;

  const columns: Column<ProductWithMaterials>[] = [
    {
      key:      "product",
      header:   "Product",
      sortable: true,
      render:   (p) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontWeight: "var(--weight-medium)" }}>
            {p.sku}
          </span>
          <strong style={{ fontSize: "var(--text-base)" }}>{p.partName}</strong>
          <small style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
            {p.description.split("\n")[0]}
          </small>
        </div>
      ),
    },
    {
      key:      "vehicle",
      header:   "Vehicle fit",
      sortable: true,
      render:   (p) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong>{p.brand} {p.model}</strong>
          <small style={{ color: "var(--color-text-muted)" }}>
            {p.yearStart ? `${p.yearStart}+` : "All years"}
          </small>
        </div>
      ),
    },
    {
      key:    "materials",
      header: "Materials & pricing",
      render: (p) => <MaterialCell product={p} pricingVisible={pricingVisible} />,
    },
  ];

  return (
    <section
      style={{
        background:   "var(--color-panel)",
        border:       "1px solid var(--color-border-default)",
        borderRadius: "var(--radius-lg)",
        overflow:     "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding:       "var(--space-5) var(--space-6)",
          borderBottom:  "1px solid var(--color-border-subtle)",
          display:       "flex",
          alignItems:    "center",
          justifyContent: "space-between",
          gap:           "var(--space-4)",
        }}
      >
        <div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            Open any product to view specifications, compatible materials, pricing, and associated files.
          </p>
        </div>
        <span
          style={{
            fontSize:   "var(--text-sm)",
            color:      "var(--color-text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Toolbar */}
      <div style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", maxWidth: 360 }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontWeight: "var(--weight-medium)" }}>
            Search catalog
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SKU, year, model, part…"
            style={{
              padding:      "var(--space-2) var(--space-3)",
              border:       "1px solid var(--color-border-default)",
              borderRadius: "var(--radius-md)",
              fontSize:     "var(--text-sm)",
              background:   "var(--color-canvas)",
              color:        "var(--color-text-primary)",
              outline:      "none",
            }}
          />
        </label>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        rows={filtered}
        getKey={(p) => p.id}
        expandedContent={(p) => (
          <ProductDetails product={p} pricingVisible={pricingVisible} />
        )}
        emptyState={
          <EmptyState
            icon={<Layers size={32} />}
            title={query ? "No products match your search" : "No products yet"}
            description={query ? "Try a different search term." : "Products will appear here once the catalog is seeded."}
          />
        }
      />
    </section>
  );
}

function MaterialCell({
  product,
  pricingVisible,
}: {
  product: ProductWithMaterials;
  pricingVisible: boolean;
}) {
  const compatMaterials = compatibleMaterials(product);

  if (!compatMaterials.length) {
    return (
      <em style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
        Not configured
      </em>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      {compatMaterials.map((mat) => {
        const price = product.prices.find((pr) => pr.materialId === mat.id);
        return (
          <div key={mat.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <strong style={{ fontSize: "var(--text-xs)" }}>{mat.code}</strong>
            {pricingVisible && price && (
              <small style={{ color: "var(--color-text-muted)" }}>
                {formatMoney(price.unitPrice)}
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
}

function compatibleMaterials(product: ProductWithMaterials) {
  const requiredWidth = product.requiredRollWidthIn ? parseFloat(product.requiredRollWidthIn) : 0;
  return product.materials.filter(
    (m) =>
      m.isActive &&
      (requiredWidth === 0 || m.rolls.some((r) => r.isActive && parseFloat(r.widthIn) >= requiredWidth)),
  );
}
