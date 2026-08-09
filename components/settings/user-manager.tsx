"use client";

import { useState, useActionState, useTransition } from "react";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Alert }     from "@/components/ui/alert";
import { Badge }     from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_DISPLAY, type RoleCode } from "@/lib/authz/roles";
import type { UserWithRole } from "@/lib/users/service";

type InviteState = { error?: string; success?: string };
type UpdateResult = { error?: string; success?: string };

interface Props {
  users:            UserWithRole[];
  currentUserId:    string;
  roleOptions:      RoleCode[];
  /** Whether the toolbar shows a role selector when editing an existing user's role (internal admin only). */
  canChangeRole:    boolean;
  inviteAction:     (prev: InviteState, formData: FormData) => Promise<InviteState>;
  updateAction:     (id: string, data: { roleCode?: RoleCode; isActive?: boolean }) => Promise<UpdateResult>;
  /** Re-trigger the invite email for a user who hasn't accepted it yet. Omit to hide the "Resend Invite" control. */
  resendAction?:    (id: string) => Promise<UpdateResult>;
  /** Heading above the user list — defaults to "Team" (internal Team page); pass something else (e.g. "Users") when reused elsewhere. */
  title?:           string;
}

export function UserManager({ users, currentUserId, roleOptions, canChangeRole, inviteAction, updateAction, resendAction, title = "Team" }: Props) {
  const [inviteState, inviteFormAction, invitePending] = useActionState(inviteAction, {});

  return (
    <div className="flex flex-col gap-[var(--space-6)] max-w-3xl">
      <section
        style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}
      >
        <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>{title}</h2>
        </div>
        <div style={{ padding: "var(--space-2)" }}>
          {users.length === 0 && (
            <p style={{ padding: "var(--space-6)", textAlign: "center", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              No users yet
            </p>
          )}
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === currentUserId}
              roleOptions={roleOptions}
              canChangeRole={canChangeRole}
              updateAction={updateAction}
              resendAction={resendAction}
            />
          ))}
        </div>
      </section>

      <section
        style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}
      >
        <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)", margin: "0 0 var(--space-4)" }}>
          Invite a user
        </h3>
        {(inviteState.error || inviteState.success) && (
          <Alert variant={inviteState.error ? "danger" : "success"} className="mb-4">
            {inviteState.error ?? inviteState.success}
          </Alert>
        )}
        <form action={inviteFormAction} className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-4)] items-end">
          <div>
            <Label htmlFor="invite-name">Name</Label>
            <Input id="invite-name" name="name" required />
          </div>
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <Select name="roleCode" defaultValue={roleOptions[0]}>
              <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => <SelectItem key={r} value={r}>{ROLE_DISPLAY[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={invitePending}>
              {invitePending ? "Sending invite…" : "Send Invite"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function UserRow({ user, isSelf, roleOptions, canChangeRole, updateAction, resendAction }: {
  user: UserWithRole;
  isSelf: boolean;
  roleOptions: RoleCode[];
  canChangeRole: boolean;
  updateAction: Props["updateAction"];
  resendAction: Props["resendAction"];
}) {
  const [pending, startTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<string | null>(null);
  const [role, setRole] = useState(user.roleCode);

  function toggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await updateAction(user.id, { isActive: !user.isActive });
      if (result.error) setError(result.error);
    });
  }

  function changeRole(newRole: string) {
    setRole(newRole as RoleCode);
    setError(null);
    startTransition(async () => {
      const result = await updateAction(user.id, { roleCode: newRole as RoleCode });
      if (result.error) setError(result.error);
    });
  }

  function handleResend() {
    if (!resendAction) return;
    setResendResult(null);
    startResendTransition(async () => {
      const result = await resendAction(user.id);
      setResendResult(result.error ?? result.success ?? null);
    });
  }

  const isPending = !user.authUserId;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-4)",
        padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)",
        opacity: user.isActive ? 1 : 0.55,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <strong style={{ fontSize: "var(--text-sm)" }}>{user.name}</strong>
          {isSelf && <Badge variant="neutral">You</Badge>}
          {!user.isActive && <Badge variant="danger">Deactivated</Badge>}
          {isPending && user.isActive && <Badge variant="warning">Invite pending</Badge>}
        </div>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{user.email}</span>
        {resendResult && (
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>{resendResult}</p>
        )}
      </div>

      {canChangeRole ? (
        <Select value={role} onValueChange={changeRole} disabled={pending}>
          <SelectTrigger style={{ width: 170, height: 32 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => <SelectItem key={r} value={r}>{ROLE_DISPLAY[r]}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", width: 170 }}>
          {ROLE_DISPLAY[user.roleCode as RoleCode] ?? user.roleCode}
        </span>
      )}

      {resendAction && isPending && user.isActive && (
        <Button size="sm" variant="ghost" disabled={resendPending} onClick={handleResend}>
          {resendPending ? "…" : "Resend Invite"}
        </Button>
      )}

      <Button
        size="sm"
        variant={user.isActive ? "secondary" : "primary"}
        disabled={pending || isSelf}
        onClick={toggleActive}
      >
        {pending ? "…" : user.isActive ? "Deactivate" : "Reactivate"}
      </Button>

      {error && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--status-danger-text)" }}>{error}</p>
      )}
    </div>
  );
}
