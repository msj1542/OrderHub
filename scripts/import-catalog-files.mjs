/**
 * Bulk-import the per-catalog-item document set (kit-layout / install-layout /
 * install-tack PDFs, plus internal-only EPS pattern files) from a folder
 * dropped at the project root, matching each file to a product by SKU.
 *
 * This is a FIRST-PASS classifier — the exact filename/folder convention of
 * the real 152-file set hasn't been confirmed yet (see
 * build_phase_reviews/Feature_Plan_and_Progress.md, Phase 3). `classifyFile`
 * below is the one function to edit once the real naming pattern is known;
 * everything else (matching, upload, DB insert, reporting) stays the same.
 *
 * Safe by default — always dry-runs (reports what it WOULD do) unless
 * --apply is passed. Re-running with --apply is safe too: an existing
 * resource for the same product+category+file type is updated (new version
 * added) rather than duplicated.
 *
 * Run:
 *   node --env-file=.env.local scripts/import-catalog-files.mjs                # dry run, default dir
 *   node --env-file=.env.local scripts/import-catalog-files.mjs --dir=my-files # dry run, custom dir
 *   node --env-file=.env.local scripts/import-catalog-files.mjs --apply        # actually import
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
// EDIT THIS once the real naming convention is confirmed. Each file maps to
// either the product thumbnail (product_files) or a resources-table entry
// under one of the seeded categories (Diagrams / Install Instructions /
// Product Images / Price Lists), with a default external-access level.

const CATEGORY = {
  KIT_LAYOUT:    "Diagrams",
  INSTALL_LAYOUT: "Install Instructions",
  INSTALL_TACK:   "Diagrams",
};

function classifyFile(filename) {
  const lower = filename.toLowerCase();
  const ext = extname(filename).slice(1).toLowerCase();

  if (ext === "eps") {
    return { target: "resource", category: CATEGORY.KIT_LAYOUT, title: "Pattern Cutting File", customerVisible: false, downloadable: true };
  }
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
    return { target: "thumbnail" };
  }
  if (ext === "pdf") {
    if (lower.includes("tack")) {
      return { target: "resource", category: CATEGORY.INSTALL_TACK, title: "Installation Tack Diagram", customerVisible: true, downloadable: true };
    }
    if (lower.includes("install")) {
      return { target: "resource", category: CATEGORY.INSTALL_LAYOUT, title: "Installation Layout", customerVisible: true, downloadable: true };
    }
    if (lower.includes("kit") || lower.includes("layout") || lower.includes("diagram")) {
      return { target: "resource", category: CATEGORY.KIT_LAYOUT, title: "Kit Layout Diagram", customerVisible: true, downloadable: true };
    }
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

const categories = await sql`SELECT id, name FROM public.resource_categories`;
const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

let matched = 0;
const unmatched = [];

for (const filePath of files) {
  const filename = basename(filePath);
  const info = classifyFile(filename);
  if (!info) { unmatched.push({ filename, reason: "unrecognized file type/name pattern" }); continue; }

  const sku = matchSku(filename, skus);
  if (!sku) { unmatched.push({ filename, reason: "no matching product SKU found in filename" }); continue; }

  const product = productBySku.get(sku.toUpperCase());
  matched++;

  if (info.target === "thumbnail") {
    console.log(`🖼️   ${filename} → ${sku} (thumbnail)`);
    if (APPLY) {
      const buffer = readFileSync(filePath);
      const ext = extname(filename).slice(1);
      const storagePath = `products/${product.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-files").upload(storagePath, buffer, { upsert: false });
      if (upErr) { console.error(`   ❌  upload failed: ${upErr.message}`); continue; }

      await sql`UPDATE public.product_files SET is_thumbnail = false WHERE product_id = ${product.id} AND is_thumbnail = true`;
      await sql`UPDATE public.products SET thumbnail_path = ${storagePath}, updated_at = now() WHERE id = ${product.id}`;
      await sql`
        INSERT INTO public.product_files (product_id, label, file_path, mime_type, is_thumbnail)
        VALUES (${product.id}, ${"Thumbnail"}, ${storagePath}, ${`image/${ext === "jpg" ? "jpeg" : ext}`}, true)
      `;
    }
    continue;
  }

  // target === "resource"
  const categoryId = categoryByName.get(info.category);
  if (!categoryId) { unmatched.push({ filename, reason: `resource category "${info.category}" not found — has the app been seeded?` }); continue; }

  const title = `${sku} — ${info.title}`;
  console.log(`📄  ${filename} → ${sku} (${info.category}${info.customerVisible ? (info.downloadable ? "" : ", view only") : ", internal only"})`);

  if (APPLY) {
    const buffer = readFileSync(filePath);
    const ext = extname(filename).slice(1);
    const mimeType = ext === "pdf" ? "application/pdf" : ext === "eps" ? "application/postscript" : "application/octet-stream";

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
    const { error: upErr } = await supabase.storage.from("resources").upload(storagePath, buffer, { upsert: false });
    if (upErr) { console.error(`   ❌  upload failed: ${upErr.message}`); continue; }

    const [version] = await sql`
      INSERT INTO public.resource_versions (resource_id, file_path, file_name, mime_type, uploaded_by)
      VALUES (${resourceId}, ${storagePath}, ${filename}, ${mimeType}, (SELECT id FROM public.users WHERE role_code = 'internal_admin' LIMIT 1))
      RETURNING id
    `;
    await sql`UPDATE public.resources SET current_version_id = ${version.id} WHERE id = ${resourceId}`;
  }
}

console.log(`\n✅  ${matched} file(s) matched${APPLY ? " and imported" : " (dry run — nothing written)"}.`);
if (unmatched.length) {
  console.log(`⚠️   ${unmatched.length} file(s) NOT matched:`);
  for (const u of unmatched) console.log(`   - ${u.filename}: ${u.reason}`);
}

await sql.end();
