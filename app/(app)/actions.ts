"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function exitPreviewAction() {
  const jar = await cookies();
  jar.delete("orderhub_preview");
  redirect("/dashboard");
}
