import { redirect }          from "next/navigation";
import { createClient }      from "@/lib/supabase/server";
import { Input }             from "@/components/ui/input";
import { Label }             from "@/components/ui/label";
import { Button }            from "@/components/ui/button";
import { acceptInviteAction } from "./actions";

export const metadata = { title: "Accept invite — Ordering Hub" };

type Props = { searchParams: Promise<{ error?: string; flow?: string }> };

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields:    "Name and password are required.",
  password_mismatch: "Passwords do not match.",
  password_too_short: "Password must be at least 8 characters.",
};

export default async function InvitePage({ searchParams }: Props) {
  // Redirect to login if there's no active session — the invite/recovery
  // callback must have run first to establish one.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error, flow } = await searchParams;
  const errorMsg = error ? (ERROR_MESSAGES[error] ?? error) : null;
  // Reused by both first-time invite acceptance (type=invite) and password
  // reset (type=recovery) — see app/auth/callback/page.tsx. Recovery skips
  // the display-name field entirely so a routine password reset never
  // touches an existing user's name.
  const isRecovery = flow === "recovery";

  // Prefill name from email if not set.
  const defaultName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-canvas)",
        padding: "var(--space-8)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--color-panel)",
          border: "1px solid var(--color-border-default)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          padding: "var(--space-8)",
        }}
      >
        <div style={{ marginBottom: "var(--space-7)" }}>
          <div
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: "var(--weight-bold)",
              color: "var(--color-brand)",
              marginBottom: "var(--space-2)",
            }}
          >
            Ordering Hub
          </div>
          <h1
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "var(--weight-semibold)",
              marginBottom: "var(--space-2)",
            }}
          >
            {isRecovery ? "Reset your password" : "Set up your account"}
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            {isRecovery
              ? `Enter a new password for ${user.email}.`
              : `Welcome, ${user.email}. Choose a display name and password to get started.`}
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            style={{
              marginBottom: "var(--space-5)",
              padding: "var(--space-4) var(--space-5)",
              background: "var(--status-danger-bg)",
              border: "1px solid var(--status-danger-border)",
              borderRadius: "var(--radius-md)",
              color: "var(--status-danger-text)",
              fontSize: "var(--text-sm)",
            }}
          >
            {errorMsg}
          </div>
        )}

        <form
          action={acceptInviteAction}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
        >
          <input type="hidden" name="flow" value={isRecovery ? "recovery" : "invite"} />

          {!isRecovery && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                defaultValue={defaultName}
                placeholder="Your name"
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="At least 8 characters"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Re-enter password"
            />
          </div>

          <Button type="submit" variant="primary" style={{ width: "100%", marginTop: "var(--space-2)" }}>
            {isRecovery ? "Reset password" : "Get started"}
          </Button>
        </form>
      </div>
    </main>
  );
}
