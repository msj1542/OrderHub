export type CsvRow = Record<string, string>;

/** RFC 4180-compatible CSV parser. Handles quoted fields with embedded newlines and quotes. */
export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const header =
    rows.shift()?.map((v) => v.replace(/^﻿/, "")) ?? [];

  return rows
    .filter((values) => values.some(Boolean))
    .map((values) =>
      Object.fromEntries(header.map((key, i) => [key, values[i] ?? ""])),
    );
}

// ── Validation ────────────────────────────────────────────────

export type ImportReport = {
  rows: number;
  additions: string[];
  changes: string[];
  unmatched: string[];
  missingPricing: string[];
  duplicateSkus: string[];
  invalidPrices: string[];
  warnings: string[];
};

function findDuplicates(values: string[]): string[] {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
}

export function validateProductImport(
  rows: CsvRow[],
  existingSkus: Set<string>,
): ImportReport {
  const skus = rows.map((r) => r.DocTitle?.trim()).filter(Boolean);
  const duplicateSkus = findDuplicates(skus);
  const additions = skus.filter((sku) => !existingSkus.has(sku));
  const changes = skus.filter((sku) => existingSkus.has(sku));
  const warnings: string[] = [];

  rows.forEach((row, i) => {
    if (!row.DocTitle?.trim()) warnings.push(`Row ${i + 2}: missing DocTitle (SKU)`);
    if (!row.BrandName?.trim()) warnings.push(`Row ${i + 2}: missing BrandName`);
    if (!row.PartName?.trim()) warnings.push(`Row ${i + 2}: missing PartName`);
  });

  return {
    rows: rows.length,
    additions,
    changes,
    unmatched: [],
    missingPricing: [],
    duplicateSkus,
    invalidPrices: [],
    warnings,
  };
}

export function validatePricingImport(
  rows: CsvRow[],
  existingSkus: Set<string>,
): ImportReport {
  const skus = rows.map((r) => r.SKU?.trim()).filter(Boolean);
  const duplicateSkus = findDuplicates(skus);
  const unmatched = skus.filter((sku) => !existingSkus.has(sku));
  const missingPricing = [...existingSkus].filter((sku) => !skus.includes(sku));

  const invalidPrices = rows
    .filter((row) => {
      const gloss = Number(row.GlossPrice);
      const matte = Number(row.MattePrice);
      return (
        !Number.isFinite(gloss) ||
        !Number.isFinite(matte) ||
        gloss < 0 ||
        matte < 0 ||
        matte <= gloss
      );
    })
    .map((row) => row.SKU?.trim())
    .filter(Boolean);

  const changes = skus.filter((sku) => existingSkus.has(sku) && !invalidPrices.includes(sku));

  return {
    rows: rows.length,
    additions: [],
    changes,
    unmatched,
    missingPricing,
    duplicateSkus,
    invalidPrices,
    warnings: missingPricing.length
      ? [`${missingPricing.length} existing product(s) have no pricing row in this file.`]
      : [],
  };
}

// ── Row-to-DB mappers (used by seed script and import actions) ─

export function productRowToValues(row: CsvRow, pricingRow?: CsvRow) {
  const sku = row.DocTitle?.trim();
  return {
    sku,
    brand: row.BrandName || "Unknown",
    model: row.ModelName || "Generic",
    yearStart: row.StartYear || null,
    partName: row.PartName || "Kit",
    attr1: row.Attr1 || null,
    attr2: row.Attr2 || null,
    description: (pricingRow?.ProductDescription || row.Description || sku).trim(),
    includedPieces: pricingRow?.IncludedPieces || null,
    version: row.Version || null,
    patternLengthIn: row.Width ? row.Width : null,
    requiredRollWidthIn: row.Height ? row.Height : null,
    sourceReference: row.SourceFile || null,
    priceListRevision: pricingRow?.PriceListRevision || null,
    priceEffectiveDate: pricingRow?.EffectiveDate || null,
    isActive: pricingRow ? pricingRow.Active?.toUpperCase() === "TRUE" : true,
    customerVisible: true,
  };
}
