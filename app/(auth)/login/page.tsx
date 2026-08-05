export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          padding: "var(--space-8)",
          background: "var(--color-panel)",
          border: "1px solid var(--color-border-default)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <h1
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: "var(--weight-semibold)",
            marginBottom: "var(--space-2)",
          }}
        >
          Sign in
        </h1>
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--text-sm)",
            marginBottom: "var(--space-6)",
          }}
        >
          Supabase email + password auth ships in Phase 1.
        </p>
      </div>
    </main>
  );
}
