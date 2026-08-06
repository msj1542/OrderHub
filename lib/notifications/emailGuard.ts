/**
 * Pure guard for whether Resend email sending is actually configured.
 *
 * .env.local ships with placeholder values (RESEND_API_KEY=re_.. and
 * RESEND_FROM_EMAIL=orders@yourdomain.com) so the app runs without real
 * credentials. This guard keeps email sending a safe no-op until an operator
 * supplies real values — no code change needed to activate it later.
 */

const RESEND_KEY_PATTERN = /^re_[A-Za-z0-9_]{20,}$/;
const PLACEHOLDER_DOMAINS = new Set(["yourdomain.com", "example.com"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isResendConfigured(apiKey: string | undefined, fromEmail: string | undefined): boolean {
  if (!apiKey || !RESEND_KEY_PATTERN.test(apiKey)) return false;
  if (!fromEmail || !EMAIL_PATTERN.test(fromEmail)) return false;
  const domain = fromEmail.split("@")[1]?.toLowerCase();
  if (domain && PLACEHOLDER_DOMAINS.has(domain)) return false;
  return true;
}
