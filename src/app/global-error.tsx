'use client';

export const dynamic = 'force-dynamic';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Une erreur critique est survenue</h1>
        <button onClick={() => reset()} style={{ marginTop: 12, cursor: 'pointer' }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
