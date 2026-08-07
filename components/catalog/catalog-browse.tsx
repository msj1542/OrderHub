"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState }             from "@/components/ui/empty-state";
import { Pagination }             from "@/components/ui/pagination";
import { Layers }                 from "lucide-react";
import { formatMoney }            from "@/lib/pricing/money";
import type { MaterialWithRolls, ProductWithMaterials } from "@/lib/db/schema";
import { ProductDetails }         from "./product-details";

interface Props {
  products:       ProductWithMaterials[];
  total:          number;
  page:           number;
  pageSize:       number;
  search:         string;
  materials:      MaterialWithRolls[];
  pricingVisible: boolean;
}

export function CatalogBrowse({ products, total, page, pageSize, search, materials, pricingVisible }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(search);

  // Debounce search text → URL param (server refetch), reset to page 1.
  useEffect(() => {
    if (query === search) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      router.push(`${pathname}?${params.toString()}`);
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function goToPage(nextPage: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  const columns: Column<ProductWithMaterials>[] = [
    {
      key:       "product",
      header:    "Product",
      sortable:  true,
      sortValue: (p) => p.partName,
      render:    (p) => (
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
      key:       "vehicle",
      header:    "Vehicle fit",
      sortable:  true,
      sortValue: (p) => `${p.brand} ${p.model}`,
      render:    (p) => (
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
          {total} product{total !== 1 ? "s" : ""}
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
        rows={products}
        getKey={(p) => p.id}
        expandedContent={(p) => (
          <ProductDetails product={p} pricingVisible={pricingVisible} />
        )}
        emptyState={
          <EmptyState
            icon={<Layers size={32} />}
            title={search ? "No products match your search" : "No products yet"}
            description={search ? "Try a different search term." : "Products will appear here once the catalog is seeded."}
          />
        }
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={goToPage} />
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
