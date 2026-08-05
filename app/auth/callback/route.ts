import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase Auth callback — handles both PKCE code exchange (email confirm,
 * password reset) and token_hash flows (invite links).
 */
export async function GET(request: NextRequest) {
  const url        = new URL(request.url);
  const origin     = url.origin;
  const code       = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type       = url.searchParams.get("type") as
    | "invite" | "signup" | "recovery" | "email_change" | null;
  const next       = url.searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  // token_hash flow (invite, magic-link, etc.)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      // Invite and recovery both land on /invite (account setup / password set).
      if (type === "invite" || type === "recovery") {
        return NextResponse.redirect(`${origin}/invite`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // PKCE code exchange flow (OAuth, email confirm, invite)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // If this was an invite via PKCE, send to account setup rather than dashboard.
      if (type === "invite" || type === "recovery") {
        return NextResponse.redirect(`${origin}/invite`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
