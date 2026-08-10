import { NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { listResources } from "@/lib/resources/service";

/** Resources for one product, fetched on demand when its catalog row is expanded — not eagerly for every product on every page load/search. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized.", { status: 401 });

  const { id } = await params;
  const resources = await listResources(user, { productIds: [id] });
  return Response.json(resources);
}
