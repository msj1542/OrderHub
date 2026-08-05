import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1
        style={{
          fontSize: "var(--text-2xl)",
          fontWeight: "var(--weight-bold)",
          color: "var(--color-text-primary)",
        }}
      >
        Ordering Hub
      </h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-md)" }}>
        Phase 0 foundations are up. Auth and the app shell land in Phase 1.
      </p>
      <Link
        href="/login"
        style={{
          marginTop: "var(--space-6)",
          padding: "var(--space-4) var(--space-7)",
          background: "var(--color-brand)",
          color: "var(--color-brand-fg)",
          borderRadius: "var(--radius-md)",
          fontWeight: "var(--weight-medium)",
          textDecoration: "none",
        }}
      >
        Sign in
      </Link>
    </main>
  );
}
