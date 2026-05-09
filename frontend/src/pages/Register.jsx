import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

export default function Register() {
  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    email: '',
    password: '',
    password_confirmation: '',
  });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.password_confirmation) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', form);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue. Réessayez.');
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
        <h1 style={styles.headline}>Créez votre compte en quelques secondes</h1>
        <p style={styles.sub}>
          Rejoignez l'équipe et accédez immédiatement à la gestion de vos leads,
          dossiers apprenants et sessions de formation.
        </p>
        <div style={styles.features}>
          {[
            'Suivi des leads en temps réel',
            'Gestion complète des dossiers apprenants',
            'Sessions cours · EDOF · Examens',
            'Reporting &amp; tableaux de bord',
          ].map((f) => (
            <div key={f} style={styles.feature}>
              <span style={styles.featureCheck}>✓</span>
              <span dangerouslySetInnerHTML={{ __html: f }} />
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — register form */}
      <div style={styles.right}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Créer un compte</h2>
            <p style={styles.cardSub}>Remplissez le formulaire pour créer votre identifiant</p>
          </div>

          {success ? (
            <div style={styles.successBox}>
              <span style={{ fontSize: '1.5rem' }}>✓</span>
              <div>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Compte créé avec succès !</p>
                <p style={{ fontSize: '.82rem', color: 'var(--txt3)' }}>
                  Redirection vers la page de connexion…
                </p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="err-box" style={{ marginBottom: 16 }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Prénom *</label>
                    <input
                      className="form-input"
                      type="text"
                      name="prenom"
                      placeholder="Marie"
                      value={form.prenom}
                      onChange={handleChange}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Nom *</label>
                    <input
                      className="form-input"
                      type="text"
                      name="nom"
                      placeholder="Dupont"
                      value={form.nom}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Adresse e-mail *</label>
                  <input
                    className="form-input"
                    type="email"
                    name="email"
                    placeholder="vous@exemple.fr"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mot de passe *</label>
                  <input
                    className="form-input"
                    type="password"
                    name="password"
                    placeholder="Min. 8 caractères, maj., minuscule et chiffre"
                    value={form.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirmer le mot de passe *</label>
                  <input
                    className="form-input"
                    type="password"
                    name="password_confirmation"
                    placeholder="••••••••"
                    value={form.password_confirmation}
                    onChange={handleChange}
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
                      Création…
                    </>
                  ) : (
                    '→ Créer mon compte'
                  )}
                </button>
              </form>

              <p style={styles.hint}>
                Déjà un compte ?{' '}
                <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                  Se connecter
                </Link>
              </p>
            </>
          )}
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
    width: 480,
    minWidth: 400,
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
  successBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '20px 24px',
    background: 'rgba(34,197,94,.1)',
    border: '1px solid rgba(34,197,94,.3)',
    borderRadius: 12,
    color: '#16a34a',
    marginBottom: 16,
  },
  hint: {
    marginTop: 20,
    fontSize: '.75rem',
    color: 'var(--txt3)',
    textAlign: 'center',
  },
};
