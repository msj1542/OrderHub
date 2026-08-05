import { formatMoney }  from "@/lib/pricing/money";
import type { ProductWithMaterials, ProductFull } from "@/lib/db/schema";

interface Props {
  product:        ProductWithMaterials | ProductFull;
  pricingVisible: boolean;
}

export function ProductDetails({ product, pricingVisible }: Props) {
  const files = "files" in product ? product.files : [];
  const thumbnail = files.find((f) => f.isThumbnail) ?? files.find((f) => f.mimeType?.startsWith("image/"));

  const specs: [string, string][] = [
    ["Brand",            product.brand],
    ["Model",            product.model],
    ["Year",             product.yearStart ? `${product.yearStart}+` : "All years"],
    ["Part",             product.partName],
    [
      "Materials",
      product.materials.map((m) => m.name).join(" · ") || "Not configured",
    ],
    [
      "Cut dimensions",
      [
        product.patternLengthIn ? `${product.patternLengthIn}″ L` : null,
        product.requiredRollWidthIn ? `${product.requiredRollWidthIn}″ W` : null,
      ]
        .filter(Boolean)
        .join(" × ") || "—",
    ],
    ["Included pieces", product.includedPieces || "Not specified"],
    [
      "Attributes",
      [product.attr1, product.attr2].filter(Boolean).join(" · ") || "None",
    ],
  ];

  return (
    <div
      style={{
        display:       "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap:           "var(--space-6)",
        padding:       "var(--space-6)",
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width:           120,
          height:          120,
          background:      "var(--color-sunken)",
          border:          "1px solid var(--color-border-subtle)",
          borderRadius:    "var(--radius-md)",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          flexShrink:      0,
          overflow:        "hidden",
        }}
      >
        {thumbnail ? (
          <img
            src={`/api/product-files/${thumbnail.id}`}
            alt={`${product.sku} thumbnail`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "var(--space-3)" }}>
            <strong style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              {product.sku}
            </strong>
            <br />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              No thumbnail
            </span>
          </div>
        )}
      </div>

      {/* Specs */}
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap:                 "var(--space-3) var(--space-6)",
          alignContent:        "start",
        }}
      >
        {specs.map(([label, value]) => (
          <div key={label}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", display: "block" }}>
              {label}
            </span>
            <strong style={{ fontSize: "var(--text-sm)" }}>{value}</strong>
          </div>
        ))}
        {product.description && (
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", display: "block" }}>
              Description
            </span>
            <p style={{ fontSize: "var(--text-sm)", margin: 0, whiteSpace: "pre-wrap" }}>
              {product.description}
            </p>
          </div>
        )}
        {pricingVisible && product.prices.length > 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", display: "block", marginBottom: "var(--space-1)" }}>
              Pricing
            </span>
            <div style={{ display: "flex", gap: "var(--space-4)" }}>
              {product.prices.map((p) => (
                <div key={p.id}>
                  <strong style={{ fontSize: "var(--text-sm)" }}>{p.material?.code}</strong>
                  <span style={{ fontSize: "var(--text-sm)", marginLeft: "var(--space-2)" }}>
                    {formatMoney(p.unitPrice)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Files */}
      {files.length > 0 && (
        <div style={{ minWidth: 200 }}>
          <h4
            style={{
              fontSize:     "var(--text-xs)",
              fontWeight:   "var(--weight-semibold)",
              color:        "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "var(--space-2)",
            }}
          >
            Files & references
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {files.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                <span style={{ fontSize: "var(--text-xs)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.label}
                  {f.isThumbnail && (
                    <span style={{ color: "var(--color-text-muted)", marginLeft: "var(--space-1)" }}>
                      · Thumbnail
                    </span>
                  )}
                </span>
                <a
                  href={`/api/product-files/${f.id}`}
                  style={{
                    fontSize:    "var(--text-xs)",
                    color:       "var(--color-brand)",
                    flexShrink:  0,
                    textDecoration: "none",
                  }}
                  download
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
