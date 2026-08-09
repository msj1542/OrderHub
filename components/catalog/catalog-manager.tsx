"use client";

import { useState }     from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button }       from "@/components/ui/button";
import { EmptyState }   from "@/components/ui/empty-state";
import { Layers }       from "lucide-react";
import type { MaterialWithRolls, ProductWithMaterials } from "@/lib/db/schema";
import { ProductEditor } from "./product-editor";
import { CsvImport }     from "./csv-import";

interface Props {
  products:   ProductWithMaterials[];
  materials:  MaterialWithRolls[];
  canImport:  boolean;
}

export function CatalogManager({ products, materials, canImport }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(products[0]?.id ?? null);
  const [query,      setQuery]      = useState("");

  const filtered = query.trim()
    ? products.filter((p) =>
        [p.sku, p.brand, p.model, p.yearStart, p.partName, p.description]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : products;

  const selected = products.find((p) => p.id === selectedId);

  return (
    <Tabs defaultValue="products">
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          marginBottom:   "var(--space-4)",
          gap:            "var(--space-4)",
        }}
      >
        <TabsList>
          <TabsTrigger value="products">Product Editor</TabsTrigger>
          {canImport && <TabsTrigger value="import">CSV Import</TabsTrigger>}
        </TabsList>
        <a
          href="/api/catalog/export"
          style={{
            fontSize:      "var(--text-sm)",
            color:         "var(--color-brand)",
            textDecoration: "none",
            fontWeight:    "var(--weight-medium)",
          }}
        >
          Export Current Catalog ↓
        </a>
      </div>

      <TabsContent value="products">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-[var(--space-4)] items-start">
          {/* Product list */}
          <section
            style={{
              background:   "var(--color-panel)",
              border:       "1px solid var(--color-border-default)",
              borderRadius: "var(--radius-lg)",
              overflow:     "hidden",
            }}
          >
            <div
              style={{
                padding:      "var(--space-4) var(--space-5)",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <p
                style={{
                  fontSize:   "var(--text-xs)",
                  color:      "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: "var(--weight-semibold)",
                }}
              >
                Catalog management
              </p>
              <h2 style={{ fontSize: "var(--text-lg)", margin: "var(--space-1) 0" }}>Products</h2>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
                Select a product to edit fields, material compatibility, prices, and files.
              </p>
            </div>

            <div style={{ padding: "var(--space-3)" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                style={{
                  width:        "100%",
                  padding:      "var(--space-2) var(--space-3)",
                  border:       "1px solid var(--color-border-default)",
                  borderRadius: "var(--radius-md)",
                  fontSize:     "var(--text-sm)",
                  background:   "var(--color-canvas)",
                  color:        "var(--color-text-primary)",
                  outline:      "none",
                  boxSizing:    "border-box",
                }}
              />
            </div>

            <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 320px)" }}>
              {filtered.length === 0 && (
                <p
                  style={{
                    padding:   "var(--space-6)",
                    textAlign: "center",
                    fontSize:  "var(--text-sm)",
                    color:     "var(--color-text-muted)",
                  }}
                >
                  No products found
                </p>
              )}
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={p.id !== selectedId ? "hover:bg-[var(--color-sunken)] transition-colors" : undefined}
                  style={{
                    display:    "block",
                    width:      "100%",
                    textAlign:  "left",
                    padding:    "var(--space-3) var(--space-4)",
                    background: selectedId === p.id ? "var(--color-brand-subtle)" : "transparent",
                    border:     "none",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    cursor:     "pointer",
                    color:      selectedId === p.id ? "var(--color-brand)" : "var(--color-text-primary)",
                  }}
                >
                  <strong style={{ display: "block", fontSize: "var(--text-sm)" }}>{p.sku}</strong>
                  <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    {p.partName}
                  </span>
                  <small style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    {p.brand} {p.model}
                    {p.yearStart ? ` · ${p.yearStart}+` : ""}
                  </small>
                </button>
              ))}
            </div>
          </section>

          {/* Product editor */}
          {selected ? (
            <ProductEditor
              key={`${selected.id}-${selected.updatedAt}`}
              product={selected}
              materials={materials}
            />
          ) : (
            <div
              style={{
                background:   "var(--color-panel)",
                border:       "1px solid var(--color-border-default)",
                borderRadius: "var(--radius-lg)",
                padding:      "var(--space-10)",
              }}
            >
              <EmptyState
                icon={<Layers size={28} />}
                title="Select a product"
                description="Choose a product from the list to edit its details, materials, pricing, and files."
              />
            </div>
          )}
        </div>
      </TabsContent>

      {canImport && (
        <TabsContent value="import">
          <CsvImport />
        </TabsContent>
      )}
    </Tabs>
  );
}
