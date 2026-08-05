"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function acceptInviteAction(formData: FormData) {
  const name     = (formData.get("name") as string)?.trim();
  const password = formData.get("password") as string;
  const confirm  = formData.get("confirm") as string;

  if (!name || !password) redirect("/invite?error=missing_fields");
  if (password !== confirm) redirect("/invite?error=password_mismatch");
  if (password.length < 8) redirect("/invite?error=password_too_short");

  const supabase = await createClient();
  const { data: { user: authUser }, error: sessionErr } = await supabase.auth.getUser();

  if (sessionErr || !authUser) redirect("/login");

  // Set the password (user was invited with a magic link, no password yet).
  const { error: pwErr } = await supabase.auth.updateUser({ password });
  if (pwErr) redirect("/invite?error=" + encodeURIComponent(pwErr.message));

  // Update the display name in the app users table.
  await db
    .update(users)
    .set({ name, updatedAt: new Date() })
    .where(eq(users.authUserId, authUser.id));

  redirect("/dashboard");
}
