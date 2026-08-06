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

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; reason?: string }> {
  const apiKey   = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_FROM_EMAIL;

  if (!isResendConfigured(apiKey, fromAddr)) {
    console.info(`[email] skipped (Resend not configured): ${input.subject} → ${input.to}`);
    return { sent: false, reason: "not_configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from:    fromAddr!,
      to:      input.to,
      subject: input.subject,
      html:    input.html,
    });
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
