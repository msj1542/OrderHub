"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ProductWithMaterials, ProductFull, ResourceWithVersion } from "@/lib/db/schema";

interface Props {
  product:    ProductWithMaterials | ProductFull;
  /** Internal staff see production-only fields (Cut dimensions) that customers don't. */
  isInternal: boolean;
}

/** Fixed white regardless of theme — the line-art thumbnails have a transparent background and are otherwise invisible in dark mode. */
const THUMB_BG = "#ffffff";

export function ProductDetails({ product, isInternal }: Props) {
  const [zoomOpen, setZoomOpen] = useState(false);

  // Fetched on demand when this row is actually expanded (this component
  // only mounts then — see DataTable's expandedContent) rather than eagerly
  // for every row on every catalog page load/search.
  const [resources, setResources] = useState<ResourceWithVersion[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/catalog/${product.id}/resources`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ResourceWithVersion[]) => { if (!cancelled) setResources(data); })
      .catch(() => { if (!cancelled) setResources([]); });
    return () => { cancelled = true; };
  }, [product.id]);

  const files = "files" in product ? product.files : [];
  // Prefer files[] in full-detail context; fall back to thumbnailFileId from list context.
  // thumbnailFileId is populated by hydrateProducts so browse view doesn't need files[].
  const thumbnailFileId =
    files.find((f) => f.isThumbnail)?.id ??
    files.find((f) => f.mimeType?.startsWith("image/"))?.id ??
    product.thumbnailFileId ?? null;
  const thumbnailSrc = thumbnailFileId ? `/api/product-files/${thumbnailFileId}` : null;

  const downloadableResources = resources.filter((r) => r.currentVersion);

  // Materials, Description, and Pricing are dropped here — all three just
  // restate what the collapsed row above already shows (Vehicle Fit /
  // subtitle / Materials & Pricing column). Cut dimensions is a
  // production-only detail, internal staff only.
  const specs: [string, string][] = [
    ["Brand",            product.brand],
    ["Model",            product.model],
    ["Year",             product.yearStart ? `${product.yearStart}+` : "All years"],
    ["Part",             product.partName],
    ...(isInternal ? ([[
      "Cut dimensions",
      [
        product.patternLengthIn ? `${Math.round(parseFloat(product.patternLengthIn))}″ L` : null,
        product.requiredRollWidthIn ? `${Math.round(parseFloat(product.requiredRollWidthIn))}″ W` : null,
      ]
        .filter(Boolean)
        .join(" × ") || "—",
    ]] as [string, string][]) : []),
    ["Included pieces", product.includedPieces || "Not specified"],
    [
      "Attributes",
      [product.attr1, product.attr2].filter(Boolean).join(" · ") || "None",
    ],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "var(--space-6)" }}>
      {/* Section 1: thumbnail + details */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-6)" }}>
        {/* Thumbnail */}
        <button
          type="button"
          onClick={() => thumbnailSrc && setZoomOpen(true)}
          disabled={!thumbnailSrc}
          aria-label={thumbnailSrc ? `Enlarge ${product.sku} thumbnail` : undefined}
          style={{
            width:           120,
            height:          120,
            background:      THUMB_BG,
            border:          "1px solid var(--color-border-subtle)",
            borderRadius:    "var(--radius-md)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            flexShrink:      0,
            overflow:        "hidden",
            padding:         0,
            cursor:          thumbnailSrc ? "zoom-in" : "default",
          }}
        >
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={`${product.sku} thumbnail`}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
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
        </button>

        {thumbnailSrc && (
          <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
            <DialogContent
              style={{ background: THUMB_BG, maxWidth: "min(90vw, 720px)" }}
              className="flex flex-col items-center"
            >
              <DialogTitle>{product.sku}</DialogTitle>
              <img
                src={thumbnailSrc}
                alt={`${product.sku} thumbnail, enlarged`}
                style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Specs */}
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
        </div>
      </div>

      {/* Section 2: files & references */}
      {downloadableResources.length > 0 && (
        <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-4)" }}>
          <h4
            style={{
              fontSize:     "var(--text-xs)",
              fontWeight:   "var(--weight-semibold)",
              color:        "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "var(--space-3)",
            }}
          >
            Files & references
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
            {downloadableResources.map((r) => (
              <div
                key={r.id}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  gap:            "var(--space-3)",
                  minWidth:       220,
                  padding:        "var(--space-2) var(--space-3)",
                  border:         "1px solid var(--color-border-subtle)",
                  borderRadius:   "var(--radius-md)",
                }}
              >
                <span style={{ fontSize: "var(--text-xs)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.title}
                  {!r.downloadable && (
                    <span style={{ color: "var(--color-text-muted)", marginLeft: "var(--space-1)" }}>
                      · View only
                    </span>
                  )}
                </span>
                <a
                  href={`/api/resources/${r.currentVersion!.id}`}
                  target={r.downloadable ? undefined : "_blank"}
                  rel={r.downloadable ? undefined : "noopener noreferrer"}
                  style={{
                    fontSize:    "var(--text-xs)",
                    color:       "var(--color-brand)",
                    flexShrink:  0,
                    textDecoration: "none",
                  }}
                >
                  {r.downloadable ? "Download" : "View"}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
