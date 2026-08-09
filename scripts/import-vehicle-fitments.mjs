/**
 * Import the vehicle compatibility matrix from data/vehicle-models.csv and
 * data/kit-vehicle-fitments.csv into vehicle_models / product_vehicle_fitments.
 *
 * Those two CSVs were extracted (read-only, one time) from the user's
 * "Kit Compatability" tab in Kit Compatibility.xlsx — see
 * build_phase_reviews/Feature_Plan_and_Progress.md, Phase 5, for how and why
 * that tab (not the raw skuBikeJoin/bikeList tabs) was chosen as the source.
 *
 * Safe to re-run — vehicle models are upserted by (brand, model, yearStart);
 * fitments are inserted with ON CONFLICT DO NOTHING against the unique
 * (product_id, vehicle_model_id) pair.
 *
 * Run: node --env-file=.env.local scripts/import-vehicle-fitments.mjs
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; }
      else { field += char; }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field); field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const header = rows.shift()?.map((v) => v.replace(/^﻿/, "")) ?? [];
  return rows.filter((v) => v.some(Boolean)).map((v) => Object.fromEntries(header.map((k, i) => [k, v[i] ?? ""])));
}

const modelRows   = parseCsv(readFileSync(resolve(root, "data/vehicle-models.csv"), "utf-8"));
const fitmentRows = parseCsv(readFileSync(resolve(root, "data/kit-vehicle-fitments.csv"), "utf-8"));

console.log(`📋  ${modelRows.length} vehicle model(s), ${fitmentRows.length} fitment pair(s)`);

const modelIdByKey = new Map();
let modelsInserted = 0;
let modelsExisting = 0;

for (const row of modelRows) {
  const brand = row.brand.trim();
  const model = row.model.trim();
  const yearStart = row.yearStart.trim() || null;

  const [existing] = await sql`
    SELECT id FROM public.vehicle_models WHERE brand = ${brand} AND model = ${model} AND year_start ${yearStart === null ? sql`IS NULL` : sql`= ${yearStart}`}
  `;

  let id;
  if (existing) {
    id = existing.id;
    modelsExisting++;
  } else {
    const [created] = await sql`
      INSERT INTO public.vehicle_models (brand, model, year_start)
      VALUES (${brand}, ${model}, ${yearStart})
      RETURNING id
    `;
    id = created.id;
    modelsInserted++;
  }
  modelIdByKey.set(`${brand}|${model}|${yearStart}`, id);
}

console.log(`✅  Vehicle models: ${modelsInserted} inserted, ${modelsExisting} already existed.`);

let fitmentsInserted = 0;
let fitmentsSkippedNoProduct = 0;
const unmatchedSkus = new Set();

for (const row of fitmentRows) {
  const sku = row.sku.trim();
  const brand = row.brand.trim();
  const model = row.model.trim();
  const yearStart = row.yearStart.trim() || null;

  const [product] = await sql`SELECT id FROM public.products WHERE sku = ${sku}`;
  if (!product) {
    fitmentsSkippedNoProduct++;
    unmatchedSkus.add(sku);
    continue;
  }

  const vehicleModelId = modelIdByKey.get(`${brand}|${model}|${yearStart}`);
  if (!vehicleModelId) {
    console.warn(`⚠️   No vehicle model row for ${brand} ${model} ${yearStart} (SKU ${sku}) — skipping.`);
    continue;
  }

  await sql`
    INSERT INTO public.product_vehicle_fitments (product_id, vehicle_model_id)
    VALUES (${product.id}, ${vehicleModelId})
    ON CONFLICT (product_id, vehicle_model_id) DO NOTHING
  `;
  fitmentsInserted++;
}

console.log(`✅  Fitments: ${fitmentsInserted} inserted/confirmed, ${fitmentsSkippedNoProduct} skipped (SKU not in catalog).`);
if (unmatchedSkus.size) {
  console.log(`⚠️   SKUs not found in products table: ${[...unmatchedSkus].join(", ")}`);
}

await sql.end();
