Specific item 1 — DataTable component
Status: Correct. No refactoring needed.

components/ui/data-table.tsx exists and catalog-browse.tsx already imports and uses DataTable — there is no separate custom table implementation. The component is generic (DataTable<T>), has column config via Column<T>[], expandable rows (expandedContent), and an empty state slot. It's ready for Phase 3+.

One real bug found in the component: The sort comparison at line 57:

const av = String(col.render(a) ?? "");
col.render() returns React.ReactNode, not a string. For any column that returns JSX (all three catalog columns), String(...) produces "[object Object]" — sort clicks fire but produce no meaningful ordering. The Column<T> type needs a separate sortValue?: (row: T) => string | number accessor, and the sort logic needs to call it. This should be fixed before Phase 3 adds more sorted tables.

Specific item 2 — Product image/thumbnail display
Status: Partially implemented. Deferral is unintentional — there's a straightforward fix.

The infrastructure is all there: products.thumbnail_path is in the schema, setProductThumbnail() populates it, and the ProductDetails component has a thumbnail slot. The gap is in how the data gets there at browse time:

In Settings/Catalog (admin): getProduct(id) returns ProductFull which includes files[]. The thumbnail resolves from files.find(f => f.isThumbnail). ✓ Works.
In public catalog browse: listProducts() returns ProductWithMaterials, which has no files field. ProductDetails detects this ("files" in product ? product.files : []) and always produces an empty files list → "No thumbnail" placeholder. ✗
The fix is one line: In ProductDetails, use product.thumbnailPath directly as a fallback before the files-based lookup — it's already present on ProductWithMaterials:

const thumbnail = (
  files.find((f) => f.isThumbnail) ??
  files.find((f) => f.mimeType?.startsWith("image/")) ??
  (product.thumbnailPath ? { id: null, filePath: product.thumbnailPath } : null)
);
Or better, render the thumbnail via thumbnailPath in the browse context since the signed-URL route takes a file ID, not a path directly. Cleanest fix: add a thumbnailUrl computed prop, or have the catalog page pass pre-resolved thumbnail signed URLs. Track as a gap to fix before Phase 3.

Specific item 3 — CSV import preview
Status: Validate-then-apply flow is correct. Preview detail quality is a gap vs. plan.

The flow works as intended: Apply button only appears after a successful previewImportAction call, so users always see results before committing. That's the structural requirement and it's met.

What the plan says: "Real formatted diffs for CSV import preview (not raw JSON dumps)"

What's implemented: ReportView iterates Object.entries(report) and shows additions: 12 — [SKU1, SKU2, ...] lines. For additions this is fine. For changes (existing SKUs being updated), there's no before/after diff — users see only that a SKU is changing, not which fields change or from/to what values.

Classification: real gap, deferred is reasonable. A proper field-level diff requires comparing parsed CSV values against the current DB state during preview. The current validateProductImport doesn't fetch current field values — it only checks which SKUs exist. Adding this is straightforward but requires a DB read per changed row. Flag for Phase 3/4 when catalog management is actively used.

Specific item 4 — RLS on product_files / file access scoping
Status: Two real gaps. One in RLS, one in the download route.

Gap A — RLS policy is too permissive:

CREATE POLICY "product_files_select_authenticated"
  ON public.product_files FOR SELECT
  TO authenticated
  USING (true);
All authenticated users can read all file metadata rows. No join to products to check customer_visible or is_active. Since Drizzle uses service-role (RLS bypassed), the RLS here is defense-in-depth only — but it's weaker than intended.

Gap B — Download route doesn't check parent product access (MEDIUM severity):

// app/api/product-files/[id]/route.ts
const [file] = await db.select().from(productFiles).where(eq(productFiles.id, id))
// ← no check: is this product visible to this user?
An authenticated external user who knows a file UUID can download files belonging to inactive products or products with customer_visible=false. The bucket is private (random path guessing blocked), but IDs are UUIDs — not guessable — so the exploitability requires a prior data leak. Still, it violates the access model.

Fix for both: The download route should join to products and apply the same visibility check listProducts uses:

const [file] = await db
  .select({ file: productFiles, product: products })
  .from(productFiles)
  .innerJoin(products, eq(products.id, productFiles.productId))
  .where(eq(productFiles.id, id))
  .limit(1);

const isInternal = file.product && user.role.isInternal;
const canAccess  = isInternal || 
  (file.product.isActive && file.product.customerVisible);
if (!canAccess) return new Response("File not found.", { status: 404 });
Additional gaps found (not in your four items)
Gap 5 — REAL BUG: External users see customer_visible=false products (HIGH priority)

listProducts in lib/catalog/service.ts has no customerVisible filter:

if (!filters.includeInactive) {
  conditions.push(eq(products.isActive, true));
}
// ← customerVisible is never checked
The catalog page passes includeInactive: user.role.isInternal (good), but customer_visible=false products appear to external users regardless. Since Drizzle uses service-role (bypasses RLS), app-code scoping is authoritative. The RLS policy correctly filters externals to is_active AND customer_visible — but it's defense-in-depth only here.

Fix: Add a customerVisible parameter to listProducts and pass it from the catalog page:

// service.ts
if (filters.customerVisibleOnly) {
  conditions.push(eq(products.customerVisible, true));
}

// catalog/page.tsx
listProducts({ 
  includeInactive: user.role.isInternal,
  customerVisibleOnly: !user.role.isInternal,
})
Fix this before Phase 3 — it's a data scoping correctness bug.

Full checklist vs. REBUILD_PLAN.md Phase 2
Item	Status
Schema: materials/rolls/products/product_materials/prices/product_files	✓ Complete
RLS policies on all 6 tables	✓ Present (with Gap A above)
Storage bucket + Storage RLS	✓ Complete
Signed-URL download route	✓ Present (with Gap B above)
CSV import preview+apply	✓ Flow correct; diff quality is a gap
CSV export route	✓ Complete, matches reference format
Catalog browse + search	✓ Complete (client-side filter; server-side is a future improvement)
Product detail (specs, files)	✓ Complete
Admin catalog manager	✓ Complete
Product editor (fields, materials, prices, upload, thumbnail)	✓ Complete
Material settings (list + editor + rolls + cost outputs)	✓ Complete
Settings nav + settings layout	✓ Complete
Seed: materials, rolls, 38 products, 76 price rows	✓ Applied
money.ts util	✓ Complete
Thumbnail display in catalog browse	✗ Gap (fix: use product.thumbnailPath)
customerVisible scoping for external users	✗ Real bug (service layer)
Parent product scoping in file download	✗ Real bug (route handler)
DataTable column sort with JSX renders	✗ Bug in DataTable
CSV import field-level diff	Deferred — acceptable for now
Server-side catalog search/pagination	Deferred — 38 products, client-side is fine
Prioritized fixes
Gap 5 — listProducts missing customerVisible filter for external users. Fix in lib/catalog/service.ts + app/(app)/catalog/page.tsx. Do before Phase 3.
Gap B — /api/product-files/[id] parent-product access check. Fix in route handler. Do before Phase 3.
DataTable sort — Add sortValue?: (row: T) => string | number to Column<T> and use it in sort logic. Fix before Phase 3 adds more tables.
Thumbnail in browse — Use product.thumbnailPath in the thumbnail slot of ProductDetails. One-liner. Fix before Phase 3.
CSV import diff — Acceptable deferred until catalog management is in active use.