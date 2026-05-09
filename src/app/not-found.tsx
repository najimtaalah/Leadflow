export default function NotFound() {
  return (
    <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>404 — Page introuvable</h1>
      <p style={{ color: "#666", marginTop: 8 }}>
        <a href="/" style={{ color: "inherit" }}>Retour à l'accueil</a>
      </p>
    </div>
  );
}
