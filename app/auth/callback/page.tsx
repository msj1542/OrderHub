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
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams }    from "next/navigation";
import { createClient }                  from "@/lib/supabase/client";

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
            linkType === "recovery" || linkType === "invite"
              ? "/invite"
              : (searchParams.get("next") ?? "/dashboard"),
          );
          return;
        }
      }

      // ── 2. OTP token_hash flow ────────────────────────────────────────────
      const tokenHash = searchParams.get("token_hash");
      const qType     = searchParams.get("type") as
        | "invite" | "recovery" | "signup" | "email_change" | null;

      if (tokenHash && qType) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type:       qType,
        });
        if (!error) {
          router.push(
            qType === "invite" || qType === "recovery"
              ? "/invite"
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
          const codeType = searchParams.get("type");
          router.push(
            codeType === "invite" || codeType === "recovery"
              ? "/invite"
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
