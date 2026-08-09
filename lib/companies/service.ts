/**
 * Company service — internal admin CRUD for customer companies.
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, type Company, type NewCompany } from "@/lib/db/schema";

export async function listCompanies(): Promise<Company[]> {
  return db.select().from(companies).orderBy(asc(companies.name));
}

export async function getCompany(id: string): Promise<Company | null> {
  const [row] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return row ?? null;
}

export async function createCompany(data: NewCompany): Promise<Company> {
  const [row] = await db.insert(companies).values(data).returning();
  return row;
}

export type CompanyUpdate = Partial<
  Pick<
    Company,
    | "name" | "orderScope" | "pricingVisible" | "notes" | "isActive"
    | "primaryContactName" | "contactEmail" | "contactPhone" | "address" | "billingNotes"
  >
>;

export async function updateCompany(id: string, data: CompanyUpdate): Promise<Company> {
  const [row] = await db
    .update(companies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning();
  return row;
}
