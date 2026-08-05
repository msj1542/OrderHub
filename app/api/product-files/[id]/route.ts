import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { productFiles } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "product-files";
const SIGNED_URL_TTL = 60; // seconds

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized.", { status: 401 });

  const { id } = await params;

  const [file] = await db
    .select()
    .from(productFiles)
    .where(eq(productFiles.id, id))
    .limit(1);

  if (!file) return new Response("File not found.", { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(file.filePath, SIGNED_URL_TTL);

  if (error || !data?.signedUrl) {
    return new Response("Could not generate download link.", { status: 502 });
  }

  return Response.redirect(data.signedUrl, 302);
}
