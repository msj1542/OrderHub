"use client";

/**
 * Auth callback — handles all three Supabase auth link formats:
 *
 *  1. Implicit flow  (#access_token=…)  — email invite + password-reset links.
 *     Tokens are in the URL fragment; they are browser-only and never reach
 *     the server, so this MUST be a client component.
 *
 *  2. OTP flow       (?token_hash=…&type=…)  — newer Supabase email OTPs.
 *
 *  3. PKCE code flow (?code=…)              — OAuth / browser-initiated flows.
 *     This is `@supabase/ssr`'s default flow type (see lib/supabase/client.ts,
 *     lib/supabase/server.ts — neither overrides `flowType`). Note: Supabase
 *     does not reliably preserve `type=recovery`/`type=invite` on the PKCE
 *     redirect the way it does for the implicit/OTP flows above — if a
 *     recovery link arrives here as bare `?code=…` with no `type`, there is
 *     no way to distinguish it from a plain sign-in code from the URL alone.
 *     If that turns out to happen in practice, the fix is on the Supabase
 *     side (dashboard → Auth → email templates), not here: pass an explicit
 *     `redirectTo` when triggering the recovery email so `type=recovery` is
 *     baked into your own redirect URL rather than relying on Supabase to
 *     re-add it.
 *
 * `type=recovery` (password reset) and `type=invite` (first-time account
 * setup) are intentionally routed to the same destination, `/invite` — that
 * page already collects a new password; see its `flow` query param for how
 * it adapts copy/behavior between the two cases.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams }    from "next/navigation";
import { createClient }                  from "@/lib/supabase/client";

type LinkType = string | null;

/** invite and recovery both land on the password-setup page. */
function isPasswordSetupType(type: LinkType): type is "invite" | "recovery" {
  return type === "invite" || type === "recovery";
}

function passwordSetupDestination(type: "invite" | "recovery"): string {
  return `/invite?flow=${type}`;
}

function CallbackInner() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const supabase = createClient();

    async function handle() {
      // ── 1. Implicit flow: tokens in the URL hash fragment ─────────────────
      const hash = window.location.hash.slice(1); // strip the leading "#"
      if (hash) {
        const p             = new URLSearchParams(hash);
        const accessToken   = p.get("access_token");
        const refreshToken  = p.get("refresh_token");
        // "type" can appear in the hash (recovery) or query string (invite link)
        const linkType      = p.get("type") ?? searchParams.get("type");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setMsg("Authentication failed.");
            router.push("/login?error=auth_failed");
            return;
          }
          router.push(
            isPasswordSetupType(linkType)
              ? passwordSetupDestination(linkType)
              : (searchParams.get("next") ?? "/dashboard"),
          );
          return;
        }
      }

      // ── 2. OTP token_hash flow ────────────────────────────────────────────
      const tokenHash = searchParams.get("token_hash");
      // "type" is a query param for this flow, but fall back to the hash too
      // in case a given Supabase link variant puts it there instead.
      const qType     = searchParams.get("type") ?? new URLSearchParams(hash).get("type");

      if (tokenHash && qType) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type:       qType as "invite" | "recovery" | "signup" | "email_change",
        });
        if (!error) {
          router.push(
            isPasswordSetupType(qType)
              ? passwordSetupDestination(qType)
              : (searchParams.get("next") ?? "/dashboard"),
          );
          return;
        }
        setMsg("Authentication failed.");
        router.push("/login?error=auth_failed");
        return;
      }

      // ── 3. PKCE code exchange flow ────────────────────────────────────────
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          // See the file-level comment: `type` isn't guaranteed to survive
          // this flow, so this falls back to /dashboard if it's missing —
          // same behavior as before, just centralized through the shared
          // helper so invite/recovery are handled identically wherever
          // `type` IS present.
          const codeType = searchParams.get("type") ?? new URLSearchParams(hash).get("type");
          router.push(
            isPasswordSetupType(codeType)
              ? passwordSetupDestination(codeType)
              : (searchParams.get("next") ?? "/dashboard"),
          );
          return;
        }
        setMsg("Authentication failed.");
        router.push("/login?error=auth_failed");
        return;
      }

      // No recognised auth params.
      router.push("/login?error=auth_failed");
    }

    handle();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main
      style={{
        minHeight:      "100vh",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     "var(--color-canvas)",
      }}
    >
      <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
        {msg}
      </p>
    </main>
  );
}

// useSearchParams must be inside a Suspense boundary in the App Router.
export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}
