Phase 2 complete — Catalog & Materials
Files created / modified
Schema & migration

lib/db/schema.ts — 6 new tables: materials, material_roll_widths, products, product_materials, prices, product_files
supabase/migrations/0002_catalog_materials.sql — DDL, RLS policies, storage bucket, seeded Gloss/Matte materials and 3 roll widths
Service / lib

lib/catalog/service.ts — full CRUD for materials, products, prices, files
lib/catalog/csv.ts — RFC 4180 parser, product + pricing import validators
lib/pricing/money.ts — formatMoney, parseMoney, toDecimal, addMoney
Pages & server actions

app/(app)/catalog/page.tsx — public catalog browse (RSC)
app/(app)/settings/layout.tsx — settings shell with nav
app/(app)/settings/catalog/page.tsx + app/(app)/settings/catalog/actions.ts — product editor, CSV import
app/(app)/settings/materials/page.tsx + app/(app)/settings/materials/actions.ts — material + roll-width editor
app/(app)/settings/%5Bsection%5D/page.tsx — removed catalog and materials from catch-all (they now have dedicated pages)
API routes

app/api/catalog/export/route.ts — CSV export matching reference format (SKU, GlossPrice, MattePrice…)
app/api/product-files/%5Bid%5D/route.ts — signed-URL redirect for Supabase Storage downloads
UI components

components/catalog/catalog-browse.tsx — searchable product table with expandable detail
components/catalog/product-details.tsx — specs, pricing, files
components/catalog/catalog-manager.tsx — admin product list + tabs
components/catalog/product-editor.tsx — full product form with material/price fieldset and file upload
components/catalog/csv-import.tsx — validate-then-apply import flow
components/catalog/material-settings.tsx — material list + roll-width editor
components/ui/alert.tsx, components/ui/field-hint.tsx, components/ui/data-table.tsx — new UI primitives
Scripts

scripts/run-migration.mjs — applies SQL migration to Supabase
scripts/seed-catalog.mjs — seeded 38 products, 76 price rows
Checks passed
npm test → 23/23 authz tests pass
tsc --noEmit → 0 new errors (only 1 pre-existing stale .next cache error from the Phase 1 auth/callback → client-page change; clears on rm -rf .next)
Migration applied ✓, seed ran ✓ (38 products, 76 prices)