"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>Une erreur est survenue</h1>
      <button onClick={reset} style={{ marginTop: 12, cursor: "pointer" }}>
        Réessayer
      </button>
    </div>
  );
}
