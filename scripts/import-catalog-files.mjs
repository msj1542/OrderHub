/**
 * Bulk-import the per-catalog-item document set from a folder dropped at the
 * project root, matching each file to a product by SKU.
 *
 * Confirmed real-world layout (2026-08-09 delivery, "Layout Diagrams.zip"):
 * two flat folders, "Layout Diagrams" (one PDF per SKU — kit-layout,
 * install-layout, and install-tack all live as separate pages within that
 * single PDF, not as 3 separate files) and "Transparent BG" (one PNG per
 * SKU — black line art on a transparent background, used as the product
 * thumbnail). Filenames are just the bare SKU + extension, no keywords.
 * EPS pattern-cutting files aren't part of this delivery yet — `classifyFile`
 * still recognizes them (forced internal-only) for whenever they arrive.
 *
 * PNGs are uploaded byte-for-byte unmodified — no flattening, no editing.
 * Transparency is preserved; visibility against dark/light backgrounds is a
 * display-layer concern (see components/catalog/product-details.tsx), not
 * something baked into the stored file. Each PNG is written to TWO places:
 * the product's thumbnail (product_files, drives the small catalog-item
 * image) and a "Product Images" resource (drives its standalone entry on
 * the Resources page, grouped separately from the "Diagrams" PDFs). Same
 * bytes, two independent copies — product_files and resources are separate
 * systems with separate buckets, so this is the simplest way to serve both
 * without a bigger unification refactor.
 *
 * Safe by default — always dry-runs (reports what it WOULD do) unless
 * --apply is passed. Re-running with --apply is safe too: an existing
 * resource for the same product+title is updated (new version added)
 * rather than duplicated. (Thumbnails aren't deduped the same way — each
 * apply run creates a fresh product_files row and flips the old one's
 * is_thumbnail flag off — so don't re-run --apply over SKUs already
 * imported correctly without a reason to.)
 *
 * Run:
 *   node --env-file=.env.local scripts/import-catalog-files.mjs                # dry run, default dir
 *   node --env-file=.env.local scripts/import-catalog-files.mjs --dir=my-files # dry run, custom dir
 *   node --env-file=.env.local scripts/import-catalog-files.mjs --only=SKU1,SKU2 --apply # limited real run
 *   node --env-file=.env.local scripts/import-catalog-files.mjs --apply        # actually import everything
 */

import postgres from "postgres";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { readdirSync, statSync, readFileSync } from "fs";
import { resolve, dirname, extname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dirArg = args.find((a) => a.startsWith("--dir="));
const INPUT_DIR = resolve(root, dirArg ? dirArg.slice("--dir=".length) : "catalog-files-import");
const onlyArg = args.find((a) => a.startsWith("--only="));
// Limit to a specific set of SKUs (comma-separated) — for a small test batch
// before running the full import.
const ONLY_SKUS = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim().toUpperCase())) : null;

const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DATABASE_URL) { console.error("❌  DATABASE_URL is not set in .env.local"); process.exit(1); }
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set in .env.local");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });
const supabase = createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 1. Classify a file by name/extension ──────────────────────────
//
// PDF -> a "Diagrams" resource (customer-visible, downloadable).
// PNG/JPG/WEBP -> the product thumbnail AND a "Product Images" resource
// (same file, both places).
// EPS -> a "Diagrams" resource, forced internal-only (pattern-cutting file).

function classifyFile(filename) {
  const ext = extname(filename).slice(1).toLowerCase();

  if (ext === "eps") {
    return {
      target:  "resource",
      category: "Diagrams", title: "Pattern Cutting File",
      customerVisible: false, downloadable: true,
    };
  }
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
    return {
      target: "thumbnail",
      alsoResource: {
        category: "Product Images", title: "Product Thumbnail",
        customerVisible: true, downloadable: true,
      },
    };
  }
  if (ext === "pdf") {
    // Kit-layout, install-layout, and install-tack are separate pages
    // within this one combined PDF (per the actual delivery) — imported as
    // a single resource rather than split into 3.
    return {
      target: "resource",
      category: "Diagrams", title: "Layout Diagrams",
      customerVisible: true, downloadable: true,
    };
  }
  return null; // unrecognized — reported, not imported
}

// ── 2. Match a filename to a product SKU ──────────────────────────
// Longest-match wins, so "HD-SB-14_SPK" isn't mis-matched to "HD-SB-14".

function matchSku(filename, skus) {
  const candidates = skus.filter((sku) => filename.toUpperCase().includes(sku.toUpperCase()));
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.length > a.length ? b : a));
}

// ── 3. Walk the input directory ────────────────────────────────────

function walk(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out = out.concat(walk(full));
    else out.push(full);
  }
  return out;
}

const MIME_BY_EXT = {
  pdf: "application/pdf", eps: "application/postscript",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
};

const categories = await sql`SELECT id, name FROM public.resource_categories`;
const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

/** Create-or-reuse a resources row for (product, title) and attach a new version. Returns false on upload failure. */
async function importResource(product, filename, buffer, ext, info) {
  const categoryId = categoryByName.get(info.category);
  if (!categoryId) {
    console.error(`   ❌  resource category "${info.category}" not found — has the app been seeded?`);
    return false;
  }

  const title = `${product.sku} — ${info.title}`;
  const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";

  // Re-runnable: reuse an existing resource with the same product+title
  // instead of creating a duplicate every time this script runs.
  const [existing] = await sql`
    SELECT id FROM public.resources WHERE product_id = ${product.id} AND title = ${title} LIMIT 1
  `;

  let resourceId;
  if (existing) {
    resourceId = existing.id;
    await sql`
      UPDATE public.resources SET
        category_id = ${categoryId}, customer_visible = ${info.customerVisible},
        downloadable = ${info.downloadable}, updated_at = now()
      WHERE id = ${resourceId}
    `;
  } else {
    const [created] = await sql`
      INSERT INTO public.resources (category_id, product_id, title, customer_visible, downloadable)
      VALUES (${categoryId}, ${product.id}, ${title}, ${info.customerVisible}, ${info.downloadable})
      RETURNING id
    `;
    resourceId = created.id;
  }

  const storagePath = `resources/${resourceId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("resources")
    .upload(storagePath, buffer, { upsert: false, contentType: mimeType });
  if (upErr) { console.error(`   ❌  upload failed: ${upErr.message}`); return false; }

  const [version] = await sql`
    INSERT INTO public.resource_versions (resource_id, file_path, file_name, mime_type, uploaded_by)
    VALUES (${resourceId}, ${storagePath}, ${filename}, ${mimeType}, (SELECT id FROM public.users WHERE role_code = 'internal_admin' LIMIT 1))
    RETURNING id
  `;
  await sql`UPDATE public.resources SET current_version_id = ${version.id} WHERE id = ${resourceId}`;
  return true;
}

let files;
try {
  files = walk(INPUT_DIR);
} catch {
  console.error(`❌  Input directory not found: ${INPUT_DIR}`);
  console.error(`    Drop your files there, or pass --dir=<path>.`);
  await sql.end();
  process.exit(1);
}

console.log(`📂  ${files.length} file(s) found in ${INPUT_DIR}`);
console.log(APPLY ? "⚠️   --apply passed: importing for real.\n" : "ℹ️   Dry run (pass --apply to actually import).\n");

const products = await sql`SELECT id, sku FROM public.products`;
const skus = products.map((p) => p.sku);
const productBySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));

let matched = 0;
const unmatched = [];

for (const filePath of files) {
  const filename = basename(filePath);
  const info = classifyFile(filename);
  if (!info) { unmatched.push({ filename, reason: "unrecognized file type/name pattern" }); continue; }

  const sku = matchSku(filename, skus);
  if (!sku) { unmatched.push({ filename, reason: "no matching product SKU found in filename" }); continue; }

  if (ONLY_SKUS && !ONLY_SKUS.has(sku.toUpperCase())) continue; // outside this run's --only filter, skip silently

  const product = productBySku.get(sku.toUpperCase());
  matched++;
  const ext = extname(filename).slice(1).toLowerCase();

  if (info.target === "thumbnail") {
    console.log(`🖼️   ${filename} → ${sku} (thumbnail + Product Images resource, unmodified)`);
    if (APPLY) {
      const buffer = readFileSync(filePath); // uploaded exactly as provided — no processing
      const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";
      const storagePath = `products/${product.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-files")
        .upload(storagePath, buffer, { upsert: false, contentType: mimeType });
      if (upErr) { console.error(`   ❌  thumbnail upload failed: ${upErr.message}`); continue; }

      await sql`UPDATE public.product_files SET is_thumbnail = false WHERE product_id = ${product.id} AND is_thumbnail = true`;
      await sql`UPDATE public.products SET thumbnail_path = ${storagePath}, updated_at = now() WHERE id = ${product.id}`;
      await sql`
        INSERT INTO public.product_files (product_id, label, file_path, mime_type, is_thumbnail)
        VALUES (${product.id}, ${"Thumbnail"}, ${storagePath}, ${mimeType}, true)
      `;

      if (info.alsoResource) {
        await importResource(product, filename, buffer, ext, info.alsoResource);
      }
    }
    continue;
  }

  // target === "resource"
  console.log(`📄  ${filename} → ${sku} (${info.category}${info.customerVisible ? (info.downloadable ? "" : ", view only") : ", internal only"})`);
  if (APPLY) {
    const buffer = readFileSync(filePath);
    await importResource(product, filename, buffer, ext, info);
  }
}

console.log(`\n✅  ${matched} file(s) matched${APPLY ? " and imported" : " (dry run — nothing written)"}.`);
if (unmatched.length) {
  console.log(`⚠️   ${unmatched.length} file(s) NOT matched:`);
  for (const u of unmatched) console.log(`   - ${u.filename}: ${u.reason}`);
}

await sql.end();
