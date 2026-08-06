import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getWorkOrder } from "@/lib/production/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [user, { id }] = await Promise.all([requireUser(), params]);
    const wo = await getWorkOrder(id, user);
    if (!wo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(wo);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}
