import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/authz/policy";
import { db } from "@/lib/db";
import { materials, products, prices } from "@/lib/db/schema";

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(_req: NextRequest) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized.", { status: 401 });
  if (!can(user, "pricing:view")) return new Response("Pricing permission required.", { status: 403 });

  const isInternal = user.role.isInternal;

  const [productRows, activePrices, materialRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(isInternal ? eq(products.isActive, true) : eq(products.customerVisible, true))
      .orderBy(products.sku),
    db.select().from(prices).where(eq(prices.isActive, true)),
    db.select().from(materials),
  ]);

  const materialsById = new Map(materialRows.map((m) => [m.id, m]));

  const header = [
    "SKU", "ProductDescription", "IncludedPieces",
    "GlossPrice", "MattePrice",
    "Currency", "EffectiveDate", "PriceListRevision", "Active",
  ];

  const lines = [header];

  for (const product of productRows) {
    const productPrices = activePrices.filter((p) => p.productId === product.id);

    const glossPrice = productPrices.find((p) => materialsById.get(p.materialId)?.code === "Gloss");
    const mattePrice = productPrices.find((p) => materialsById.get(p.materialId)?.code === "Matte");

    lines.push([
      product.sku,
      product.description,
      product.includedPieces ?? "",
      glossPrice?.unitPrice ?? "",
      mattePrice?.unitPrice ?? "",
      "USD",
      glossPrice?.effectiveDate ?? mattePrice?.effectiveDate ?? "",
      glossPrice?.revision ?? mattePrice?.revision ?? "",
      String(product.isActive).toUpperCase(),
    ]);
  }

  const csv = lines.map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="Ordering_Hub_Current_Catalog.csv"',
    },
  });
}
