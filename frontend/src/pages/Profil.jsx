import React, { useState } from 'react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

export default function Profil() {
  const { user, updateUser } = useAuthStore();
  const [form, setForm] = useState({
    prenom: user?.prenom || '',
    nom: user?.nom || '',
    email: user?.email || '',
    password: '',
    password_confirm: '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setErr(''); setSuccess(false);
    if (form.password && form.password !== form.password_confirm) {
      setErr('Les mots de passe ne correspondent pas');
      return;
    }
    if (form.password && form.password.length < 8) {
      setErr('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    setSaving(true);
    try {
      const payload = { prenom: form.prenom, nom: form.nom, email: form.email };
      if (form.password) payload.password = form.password;
      const { data } = await api.patch('/users/me', payload);
      updateUser(data.user || payload);
      setSuccess(true);
      setForm((p) => ({ ...p, password: '', password_confirm: '' }));
    } catch (e) {
      setErr(e.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  }

  const initials = `${(form.prenom || '')[0] || ''}${(form.nom || '')[0] || ''}`.toUpperCase();

  return (
    <div className="page-enter">
      <div className="section-header">
        <div className="section-title">Mon profil</div>
      </div>

      <div style={{ maxWidth: 520 }}>
        {/* Avatar */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,var(--brand),var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {initials || '?'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--txt)' }}>
              {form.prenom} {form.nom}
            </div>
            <div style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>{user?.role_nom || user?.role}</div>
          </div>
        </div>

        {/* Form */}
        <div className="card">
          <div className="card-title">Informations personnelles</div>

          {success && (
            <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: 8, padding: '10px 14px', fontSize: '.82rem', color: 'var(--green)', marginBottom: 16, display: 'flex', gap: 8 }}>
              ✅ Profil mis à jour avec succès
            </div>
          )}
          {err && (
            <div className="err-box" style={{ marginBottom: 16 }}>
              <span>⚠️</span> {err}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Prénom</label>
                <input className="form-input" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Nom</label>
                <input className="form-input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Adresse e-mail</label>
              <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>

            <div className="sep" />
            <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>
              Changer le mot de passe <span style={{ fontWeight: 400 }}>(laisser vide pour ne pas modifier)</span>
            </div>

            <div className="form-group">
              <label className="form-label">Nouveau mot de passe</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmer le mot de passe</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password_confirm} onChange={(e) => setForm({ ...form, password_confirm: e.target.value })} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? '⏳ Enregistrement…' : '💾 Enregistrer les modifications'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
