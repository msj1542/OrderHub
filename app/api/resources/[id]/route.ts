import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resourceVersions, resources } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { canExternalUserSeeResource } from "@/lib/resources/visibility";

const BUCKET = "resources";
const SIGNED_URL_TTL = 60; // seconds

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized.", { status: 401 });

  const { id } = await params;

  const [row] = await db
    .select({ version: resourceVersions, resource: resources })
    .from(resourceVersions)
    .innerJoin(resources, eq(resources.id, resourceVersions.resourceId))
    .where(eq(resourceVersions.id, id))
    .limit(1);

  if (!row) return new Response("File not found.", { status: 404 });

  const { version, resource } = row;

  if (!user.role.isInternal && !canExternalUserSeeResource(resource, { pricingVisible: user.company?.pricingVisible ?? false })) {
    return new Response("File not found.", { status: 404 });
  }

  // Internal staff and downloadable resources get a normal download link.
  // A view-only resource never gets a download-flagged signed URL for an
  // external viewer — the browser renders it inline instead. This deters
  // casual right-click-save; it isn't real DRM (screenshots/devtools still
  // work) and callers were told that plainly in the admin UI.
  const forceDownload = user.role.isInternal || resource.downloadable;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(version.filePath, SIGNED_URL_TTL, forceDownload ? { download: version.fileName } : undefined);

  if (error || !data?.signedUrl) {
    return new Response("Could not generate download link.", { status: 502 });
  }

  return Response.redirect(data.signedUrl, 302);
}
