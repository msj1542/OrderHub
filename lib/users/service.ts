/**
 * User service — internal admin (Settings > Team) and external company-admin
 * (company-users page) user management.
 *
 * Creating a user is two steps: insert the `public.users` row (source of
 * truth for role/company/active state), then send a Supabase Auth invite
 * email. `public.users.auth_user_id` is linked automatically by the
 * `on_auth_user_created` trigger (see 0001_auth_identity.sql) once the
 * invite is accepted and the matching auth.users row appears.
 */

import { asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, roles, type User, type Role } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { INTERNAL_ROLES, EXTERNAL_ROLES, type RoleCode } from "@/lib/authz/roles";

export type UserWithRole = User & { role: Role };

export async function listInternalUsers(): Promise<UserWithRole[]> {
  const rows = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(roles.roleCode, users.roleCode))
    .where(eq(roles.isInternal, true))
    .orderBy(asc(users.name));
  return rows.map(({ user, role }) => ({ ...user, role }));
}

export async function listCompanyUsers(companyId: string): Promise<UserWithRole[]> {
  const rows = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(roles.roleCode, users.roleCode))
    .where(eq(users.companyId, companyId))
    .orderBy(asc(users.name));
  return rows.map(({ user, role }) => ({ ...user, role }));
}

/**
 * Every external user across every company, in one query — used by the
 * internal Settings > Customers view to show each company's user list
 * without an N+1 query per company.
 */
export async function listAllCompanyUsers(): Promise<UserWithRole[]> {
  const rows = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(roles.roleCode, users.roleCode))
    .where(isNotNull(users.companyId))
    .orderBy(asc(users.name));
  return rows.map(({ user, role }) => ({ ...user, role }));
}

export type CreateUserInput = {
  email:      string;
  name:       string;
  roleCode:   RoleCode;
  companyId?: string | null;
};

/** Creates the app user row and sends a Supabase Auth invite email. */
export async function createUser(input: CreateUserInput): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.name.trim()) throw new Error("Email and name are required.");

  const isInternalRole = INTERNAL_ROLES.has(input.roleCode);
  if (isInternalRole && input.companyId) {
    throw new Error("Internal users cannot belong to a company.");
  }
  if (!isInternalRole && !input.companyId) {
    throw new Error("External users must belong to a company.");
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new Error("A user with this email already exists.");

  const [row] = await db
    .insert(users)
    .values({
      email,
      name:      input.name.trim(),
      roleCode:  input.roleCode,
      companyId: isInternalRole ? null : input.companyId,
    })
    .returning();

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  });
  if (error) {
    // Roll back the app-user row so a failed invite doesn't leave an orphan.
    await db.delete(users).where(eq(users.id, row.id));
    throw new Error(`Could not send invite email: ${error.message}`);
  }

  return row;
}

/**
 * Re-trigger the Supabase Auth invite email for a user who hasn't accepted
 * their original invite yet. There's no password system in this app (auth
 * is entirely Supabase-managed) and no hard-delete anywhere — this is the
 * closest real equivalent to "reset" for a user stuck in a pending state.
 */
export async function resendInvite(id: string): Promise<void> {
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new Error("User not found.");
  if (target.authUserId) throw new Error("This user has already accepted their invite.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(target.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  });
  if (error) throw new Error(`Could not resend invite: ${error.message}`);
}

export type UpdateUserInput = Partial<Pick<User, "name" | "roleCode" | "isActive">>;

/** Internal-admin path — no scope restriction beyond the self-deactivation guard. */
export async function updateUser(id: string, data: UpdateUserInput, actingUser: User): Promise<User> {
  if (id === actingUser.id && data.isActive === false) {
    throw new Error("You cannot deactivate your own account.");
  }
  const [row] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return row;
}

/**
 * Company-admin path — the target must belong to the acting admin's own
 * company, and company admins can never modify another external_admin
 * (mirrors the `users_write_external_admin` RLS policy in
 * 0001_auth_identity.sql: `role_code != 'external_admin'`).
 */
export async function updateCompanyUser(
  id: string,
  data: Pick<UpdateUserInput, "isActive">,
  actingUser: User,
): Promise<User> {
  if (id === actingUser.id && data.isActive === false) {
    throw new Error("You cannot deactivate your own account.");
  }
  if (!actingUser.companyId) throw new Error("Not authorized.");

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target || target.companyId !== actingUser.companyId) {
    throw new Error("User not found.");
  }
  if (target.roleCode === "external_admin") {
    throw new Error("Company admins cannot modify another admin's account.");
  }

  const [row] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return row;
}
