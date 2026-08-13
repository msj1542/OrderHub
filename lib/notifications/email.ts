/**
 * Transactional email — Resend, guarded no-op when unconfigured.
 *
 * Every call site must treat this as best-effort: a failed or skipped send
 * must never fail the order transition that triggered it. Callers await
 * this after their own DB transaction has already committed.
 */

import { Resend } from "resend";
import { isResendConfigured } from "@/lib/notifications/emailGuard";

export type SendEmailInput = {
  to:      string;
  subject: string;
  html:    string;
};

// Resend's SDK does a plain fetch() with no default timeout — an unresponsive
// API or a stalled connection would otherwise hang the caller indefinitely
// (this hung the /orders/new submit action until Vercel's 300s function
// ceiling killed it). Bound it explicitly. (The SDK's request options accept
// an AbortSignal at runtime — it's passed straight through to fetch() — but
// its published types don't declare that field, so we race a timeout instead
// of fighting the SDK's types with an `any` cast.)
const SEND_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Resend request timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; reason?: string }> {
  const apiKey   = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_FROM_EMAIL;

  if (!isResendConfigured(apiKey, fromAddr)) {
    console.info(`[email] skipped (Resend not configured): ${input.subject} → ${input.to}`);
    return { sent: false, reason: "not_configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await withTimeout(
      resend.emails.send({
        from:    fromAddr!,
        to:      input.to,
        subject: input.subject,
        html:    input.html,
      }),
      SEND_TIMEOUT_MS,
    );
    if (error) {
      console.error(`[email] Resend error sending "${input.subject}" to ${input.to}:`, error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[email] failed to send "${input.subject}" to ${input.to}:`, err);
    return { sent: false, reason: err instanceof Error ? err.message : "unknown_error" };
  }
}
