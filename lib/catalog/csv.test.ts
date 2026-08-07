import { describe, it, expect } from "vitest";
import {
  parseCsv,
  validateProductImport,
  validatePricingImport,
  productRowToValues,
} from "@/lib/catalog/csv";

describe("parseCsv", () => {
  it("parses a simple header + rows", () => {
    const text = "a,b,c\n1,2,3\n4,5,6";
    expect(parseCsv(text)).toEqual([
      { a: "1", b: "2", c: "3" },
      { a: "4", b: "5", c: "6" },
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    const text = 'name,note\n"Smith, John",hello';
    expect(parseCsv(text)).toEqual([{ name: "Smith, John", note: "hello" }]);
  });

  it("handles quoted fields with embedded newlines", () => {
    const text = 'name,note\n"multi\nline",x';
    expect(parseCsv(text)).toEqual([{ name: "multi\nline", note: "x" }]);
  });

  it("handles escaped double-quotes inside a quoted field", () => {
    const text = 'name\n"She said ""hi"""';
    expect(parseCsv(text)).toEqual([{ name: 'She said "hi"' }]);
  });

  it("strips a leading UTF-8 BOM from the header", () => {
    const text = "﻿a,b\n1,2";
    expect(parseCsv(text)).toEqual([{ a: "1", b: "2" }]);
  });

  it("strips trailing CR from CRLF line endings", () => {
    const text = "a,b\r\n1,2\r\n";
    expect(parseCsv(text)).toEqual([{ a: "1", b: "2" }]);
  });

  it("skips fully blank rows", () => {
    const text = "a,b\n1,2\n,\n3,4";
    expect(parseCsv(text)).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("returns an empty array for a header-only file", () => {
    expect(parseCsv("a,b,c")).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("fills missing trailing fields with empty string", () => {
    const text = "a,b,c\n1,2";
    expect(parseCsv(text)).toEqual([{ a: "1", b: "2", c: "" }]);
  });
});

describe("validateProductImport", () => {
  it("classifies new SKUs as additions and known SKUs as changes", () => {
    const rows = [
      { DocTitle: "SKU-NEW", BrandName: "Acme", PartName: "Kit" },
      { DocTitle: "SKU-OLD", BrandName: "Acme", PartName: "Kit" },
    ];
    const report = validateProductImport(rows, new Set(["SKU-OLD"]));
    expect(report.additions).toEqual(["SKU-NEW"]);
    expect(report.changes).toEqual(["SKU-OLD"]);
    expect(report.rows).toBe(2);
  });

  it("flags duplicate SKUs within the same file", () => {
    const rows = [
      { DocTitle: "SKU-A", BrandName: "Acme", PartName: "Kit" },
      { DocTitle: "SKU-A", BrandName: "Acme", PartName: "Kit" },
    ];
    const report = validateProductImport(rows, new Set());
    expect(report.duplicateSkus).toEqual(["SKU-A"]);
  });

  it("warns on missing required fields with a 1-indexed, header-offset row number", () => {
    const rows = [{ DocTitle: "", BrandName: "", PartName: "Kit" }];
    const report = validateProductImport(rows, new Set());
    expect(report.warnings).toEqual([
      "Row 2: missing DocTitle (SKU)",
      "Row 2: missing BrandName",
    ]);
  });

  it("produces no warnings for a fully valid row", () => {
    const rows = [{ DocTitle: "SKU-A", BrandName: "Acme", PartName: "Kit" }];
    const report = validateProductImport(rows, new Set());
    expect(report.warnings).toEqual([]);
  });
});

describe("validatePricingImport", () => {
  it("flags SKUs present in the file but not in the catalog as unmatched", () => {
    const rows = [{ SKU: "SKU-GHOST", GlossPrice: "10", MattePrice: "20" }];
    const report = validatePricingImport(rows, new Set(["SKU-REAL"]));
    expect(report.unmatched).toEqual(["SKU-GHOST"]);
  });

  it("flags existing SKUs missing from the pricing file", () => {
    const rows = [{ SKU: "SKU-A", GlossPrice: "10", MattePrice: "20" }];
    const report = validatePricingImport(rows, new Set(["SKU-A", "SKU-B"]));
    expect(report.missingPricing).toEqual(["SKU-B"]);
    expect(report.warnings).toEqual([
      "1 existing product(s) have no pricing row in this file.",
    ]);
  });

  it("flags non-numeric prices as invalid", () => {
    const rows = [{ SKU: "SKU-A", GlossPrice: "abc", MattePrice: "20" }];
    const report = validatePricingImport(rows, new Set(["SKU-A"]));
    expect(report.invalidPrices).toEqual(["SKU-A"]);
  });

  it("flags negative prices as invalid", () => {
    const rows = [{ SKU: "SKU-A", GlossPrice: "-5", MattePrice: "20" }];
    const report = validatePricingImport(rows, new Set(["SKU-A"]));
    expect(report.invalidPrices).toEqual(["SKU-A"]);
  });

  it("flags matte price <= gloss price as invalid (matte must cost more)", () => {
    const rows = [{ SKU: "SKU-A", GlossPrice: "30", MattePrice: "30" }];
    const report = validatePricingImport(rows, new Set(["SKU-A"]));
    expect(report.invalidPrices).toEqual(["SKU-A"]);
  });

  it("accepts a valid gloss/matte price pair", () => {
    const rows = [{ SKU: "SKU-A", GlossPrice: "20", MattePrice: "28.94" }];
    const report = validatePricingImport(rows, new Set(["SKU-A"]));
    expect(report.invalidPrices).toEqual([]);
    expect(report.changes).toEqual(["SKU-A"]);
  });

  it("excludes invalid-priced SKUs from the changes list", () => {
    const rows = [{ SKU: "SKU-A", GlossPrice: "30", MattePrice: "10" }];
    const report = validatePricingImport(rows, new Set(["SKU-A"]));
    expect(report.changes).toEqual([]);
  });

  it("flags duplicate SKUs within the pricing file", () => {
    const rows = [
      { SKU: "SKU-A", GlossPrice: "20", MattePrice: "28" },
      { SKU: "SKU-A", GlossPrice: "20", MattePrice: "28" },
    ];
    const report = validatePricingImport(rows, new Set(["SKU-A"]));
    expect(report.duplicateSkus).toEqual(["SKU-A"]);
  });
});

describe("productRowToValues", () => {
  it("maps a full row to product insert values", () => {
    const row = {
      DocTitle: "SKU-A",
      BrandName: "Acme",
      ModelName: "Model X",
      StartYear: "2020",
      PartName: "Hood",
      Attr1: "Front",
      Attr2: "Left",
      Description: "A hood kit",
      Version: "v2",
      Width: "48",
      Height: "12",
      SourceFile: "catalog.csv",
    };
    const values = productRowToValues(row);
    expect(values).toMatchObject({
      sku: "SKU-A",
      brand: "Acme",
      model: "Model X",
      yearStart: "2020",
      partName: "Hood",
      attr1: "Front",
      attr2: "Left",
      description: "A hood kit",
      version: "v2",
      patternLengthIn: "48",
      requiredRollWidthIn: "12",
      sourceReference: "catalog.csv",
      isActive: true,
      customerVisible: true,
    });
  });

  it("falls back to defaults for missing brand/model/part fields", () => {
    const values = productRowToValues({ DocTitle: "SKU-A" });
    expect(values.brand).toBe("Unknown");
    expect(values.model).toBe("Generic");
    expect(values.partName).toBe("Kit");
  });

  it("falls back to the SKU as description when none is provided", () => {
    const values = productRowToValues({ DocTitle: "SKU-A" });
    expect(values.description).toBe("SKU-A");
  });

  it("prefers the pricing row's description and includedPieces over the product row's", () => {
    const values = productRowToValues(
      { DocTitle: "SKU-A", Description: "product desc" },
      { ProductDescription: "pricing desc", IncludedPieces: "2 pieces" },
    );
    expect(values.description).toBe("pricing desc");
    expect(values.includedPieces).toBe("2 pieces");
  });

  it("marks isActive false only when the pricing row explicitly says so", () => {
    const inactive = productRowToValues({ DocTitle: "SKU-A" }, { Active: "FALSE" });
    expect(inactive.isActive).toBe(false);

    const active = productRowToValues({ DocTitle: "SKU-A" }, { Active: "TRUE" });
    expect(active.isActive).toBe(true);

    const noPricingRow = productRowToValues({ DocTitle: "SKU-A" });
    expect(noPricingRow.isActive).toBe(true);
  });
});
