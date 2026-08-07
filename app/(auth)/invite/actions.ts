"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function acceptInviteAction(formData: FormData) {
  // "recovery" = password reset for an existing user (no name field rendered
  // on the form — see app/(auth)/invite/page.tsx); "invite" = first-time
  // account setup, name required.
  const flow     = formData.get("flow") === "recovery" ? "recovery" : "invite";
  const name     = (formData.get("name") as string | null)?.trim() || null;
  const password = formData.get("password") as string;
  const confirm  = formData.get("confirm") as string;

  const redirectWithError = (error: string): never =>
    redirect(`/invite?flow=${flow}&error=${error}`);

  if (flow === "invite" && !name) redirectWithError("missing_fields");
  if (!password) redirectWithError("missing_fields");
  if (password !== confirm) redirectWithError("password_mismatch");
  if (password.length < 8) redirectWithError("password_too_short");

  const supabase = await createClient();
  const { data: { user: authUser }, error: sessionErr } = await supabase.auth.getUser();

  if (sessionErr || !authUser) redirect("/login");

  // Set the password (user arrived via a magic link — invite or recovery —
  // and has no usable password session yet).
  const { error: pwErr } = await supabase.auth.updateUser({ password });
  if (pwErr) redirectWithError(encodeURIComponent(pwErr.message));

  // Update the display name in the app users table — invite flow only. A
  // recovery (password reset) never submits a name, so this is skipped and
  // the existing display name is left untouched.
  if (name) {
    await db
      .update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.authUserId, authUser.id));
  }

  redirect("/dashboard");
}
