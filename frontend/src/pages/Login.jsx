import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      {/* Left panel — branding */}
      <div style={styles.left}>
        <div style={styles.brand}>
          <div style={styles.brandIcon}>L</div>
          <span style={styles.brandName}>LeadFlow CRM</span>
        </div>
        <h1 style={styles.headline}>Gérez vos leads &amp; dossiers en toute simplicité</h1>
        <p style={styles.sub}>
          Pilotez votre activité formation de la prospection à la facturation,
          depuis une interface claire et rapide.
        </p>
        <div style={styles.features}>
          {['Suivi des leads en temps réel', 'Gestion complète des dossiers apprenants', 'Sessions cours · EDOF · Examens', 'Reporting &amp; tableaux de bord'].map((f) => (
            <div key={f} style={styles.feature}>
              <span style={styles.featureCheck}>✓</span>
              <span dangerouslySetInnerHTML={{ __html: f }} />
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={styles.right}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Connexion</h2>
            <p style={styles.cardSub}>Entrez vos identifiants pour accéder à votre espace</p>
          </div>

          {error && (
            <div className="err-box" style={{ marginBottom: 16 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Adresse e-mail</label>
              <input
                className="form-input"
                type="email"
                placeholder="vous@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Connexion…
                </>
              ) : (
                '→ Se connecter'
              )}
            </button>
          </form>

          <p style={styles.hint}>
            Pas encore de compte ? Contactez votre administrateur.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    background: 'var(--bg)',
  },
  left: {
    flex: 1,
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
    padding: '60px 48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 28,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  brandIcon: {
    width: 40,
    height: 40,
    background: '#2563eb',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    color: 'white',
  },
  brandName: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'white',
    letterSpacing: '-0.01em',
  },
  headline: {
    fontSize: '2rem',
    fontWeight: 700,
    color: 'white',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    maxWidth: 440,
  },
  sub: {
    fontSize: '.95rem',
    color: '#94a3b8',
    lineHeight: 1.6,
    maxWidth: 420,
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: '.88rem',
    color: '#cbd5e1',
  },
  featureCheck: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'rgba(37,99,235,.25)',
    border: '1px solid #2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    color: '#60a5fa',
    flexShrink: 0,
  },
  right: {
    width: 440,
    minWidth: 380,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 32,
    boxShadow: 'var(--shadow-md)',
  },
  cardHeader: {
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: 'var(--txt)',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: '.82rem',
    color: 'var(--txt3)',
  },
  hint: {
    marginTop: 20,
    fontSize: '.75rem',
    color: 'var(--txt3)',
    textAlign: 'center',
  },
};
