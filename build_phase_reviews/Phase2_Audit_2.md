23/23 pass, only the pre-existing stale-cache TS error. Now commit.


Ran 3 commands
All 4 fixes landed at aa62954. Here's what changed:

Fix	File(s)	What it does
Gap 5 — customerVisible scoping	service.ts, catalog/page.tsx	External users now get WHERE customer_visible = true applied by app code (authoritative because service-role bypasses RLS)
Gap B — file download access	product-files/[id]/route.ts	innerJoin(products, ...) + 404 if product is inactive or customer_visible=false for external callers
DataTable sort	data-table.tsx, catalog-browse.tsx	Column<T> gains sortValue?: (row) => string | number; sort logic calls it instead of String(render()). Both sortable catalog columns now supply sortValue
Thumbnail in browse	schema.ts, service.ts, product-details.tsx	ProductWithMaterials gains thumbnailFileId: string | null; hydrateProducts loads it in the same Promise.all; ProductDetails uses it as fallback when files[] is empty