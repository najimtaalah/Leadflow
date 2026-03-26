import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';
import Modal from '../../components/ui/Modal';
import useAuthStore from '../../store/authStore';

const ROLES = [
  { value: 'super_admin',       label: 'Super Admin' },
  { value: 'role_admin',        label: 'Administrateur' },
  { value: 'manager',           label: 'Manager' },
  { value: 'commercial',        label: 'Commercial' },
  { value: 'role_administratif',label: 'Gestionnaire' },
  { value: 'agent_accueil',     label: 'Agent accueil' },
];

const ROLE_COLORS = {
  super_admin:        'badge-red',
  role_admin:         'badge-purple',
  manager:            'badge-orange',
  commercial:         'badge-blue',
  role_administratif: 'badge-teal',
  agent_accueil:      'badge-green',
};

const emptyForm = { prenom: '', nom: '', email: '', password: '', role_nom: 'commercial' };

export default function ParamUsers() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactifs, setShowInactifs] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.role_nom === 'super_admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Par défaut : actifs uniquement. Si showInactifs, on récupère tout.
      const url = showInactifs ? '/users' : '/users?actif=1';
      const { data } = await api.get(url);
      setUsers(Array.isArray(data) ? data : data.data || data.users || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [showInactifs]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditId(null);
    setEditUser(null);
    setForm(emptyForm);
    setErr('');
    setShowModal(true);
  }

  function openEdit(user) {
    setEditId(user.id);
    setEditUser(user);
    setForm({
      prenom:   user.prenom || '',
      nom:      user.nom || '',
      email:    user.email || '',
      password: '',
      role_nom: user.role_nom || user.role || 'commercial',
    });
    setErr('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.nom || !form.email) { setErr('Nom et e-mail sont requis'); return; }
    if (!editId && !form.password) { setErr('Mot de passe requis pour un nouvel utilisateur'); return; }
    if (form.password && form.password.length < 8) { setErr('Mot de passe trop court (min 8 caractères)'); return; }
    setSaving(true); setErr('');
    try {
      const payload = { prenom: form.prenom, nom: form.nom, email: form.email, role_nom: form.role_nom };
      if (form.password) payload.password = form.password;
      if (editId) {
        await api.patch(`/users/${editId}`, payload);
      } else {
        await api.post('/users', payload);
      }
      setShowModal(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActif() {
    if (!editId || !editUser) return;
    const isActif = editUser.actif;
    const action  = isActif ? 'désactiver' : 'réactiver';
    if (!window.confirm(
      isActif
        ? `Désactiver le compte de ${editUser.prenom} ${editUser.nom} ?\n\nLe compte sera bloqué mais toutes ses données (dossiers, leads, RDV) seront conservées.`
        : `Réactiver le compte de ${editUser.prenom} ${editUser.nom} ?`
    )) return;

    setToggling(true); setErr('');
    try {
      await api.patch(`/users/${editId}`, { actif: isActif ? 0 : 1 });
      setShowModal(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || `Erreur lors du ${action}`);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!editId || !editUser) return;
    const nom = `${editUser.prenom} ${editUser.nom}`;
    // Double confirmation pour une suppression définitive
    if (!window.confirm(`⚠️ Supprimer DÉFINITIVEMENT le compte de ${nom} ?\n\nCette action est IRRÉVERSIBLE.\nLes dossiers, leads et RDV resteront dans l'application mais sans lien vers cet utilisateur.`)) return;
    if (!window.confirm(`Dernière confirmation : supprimer ${nom} ?`)) return;

    setDeleting(true); setErr('');
    try {
      await api.delete(`/users/${editId}`);
      setShowModal(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  }

  async function handleResetPwd(user) {
    const pwd = window.prompt(`Nouveau mot de passe pour ${user.prenom} ${user.nom} :`);
    if (!pwd) return;
    if (pwd.length < 8) { alert('Mot de passe trop court (min 8 caractères)'); return; }
    try {
      await api.post(`/users/${user.id}/reset-password`, { password: pwd });
      alert('Mot de passe réinitialisé avec succès');
    } catch (e) {
      alert(e.response?.data?.message || 'Erreur');
    }
  }

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Empêcher de désactiver son propre compte
  const canToggle = editId && editId !== currentUser?.id;

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <div className="section-title">Utilisateurs</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            {users.length} utilisateur{users.length > 1 ? 's' : ''}{showInactifs ? ' (tous)' : ' actif' + (users.length > 1 ? 's' : '')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={`btn${showInactifs ? ' active' : ''}`}
            onClick={() => setShowInactifs((v) => !v)}
            style={{ fontSize: '.78rem' }}
          >
            {showInactifs ? '👁 Masquer inactifs' : '👁 Voir inactifs'}
          </button>
          {isSuperAdmin && (
            <button className="btn-primary" onClick={openNew}>➕ Nouvel utilisateur</button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : users.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>E-mail</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  {isSuperAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const roleKey   = u.role_nom || u.role || '';
                  const roleLabel = ROLES.find(r => r.value === roleKey)?.label || roleKey;
                  const isInactif = !u.actif;
                  return (
                    <tr key={u.id} style={{ opacity: isInactif ? 0.6 : 1 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 7,
                            background: isInactif
                              ? 'var(--surface3)'
                              : 'linear-gradient(135deg,var(--brand),var(--purple))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '.68rem', fontWeight: 700,
                            color: isInactif ? 'var(--txt3)' : 'white', flexShrink: 0,
                          }}>
                            {`${(u.prenom||'')[0]||''}${(u.nom||'')[0]||''}`.toUpperCase() || '?'}
                          </div>
                          <span
                            style={{ fontWeight: 600, cursor: isSuperAdmin ? 'pointer' : 'default', color: isSuperAdmin ? 'var(--brand)' : 'inherit' }}
                            onClick={() => isSuperAdmin && openEdit(u)}
                          >
                            {u.prenom} {u.nom}
                          </span>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge ${ROLE_COLORS[roleKey] || 'badge-gray'}`}>
                          {roleLabel}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.actif ? 'badge-green' : 'badge-gray'}`}>
                          {u.actif ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm" onClick={() => openEdit(u)} title="Modifier">✏️</button>
                            <button className="btn btn-sm" onClick={() => handleResetPwd(u)} title="Réinitialiser le mot de passe">🔑</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-text">
              {showInactifs ? 'Aucun utilisateur' : 'Aucun utilisateur actif'}
            </div>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        title={editId ? `Modifier — ${editUser?.prenom} ${editUser?.nom}` : 'Nouvel utilisateur'}
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? 'Enregistrement…' : (editId ? 'Mettre à jour' : 'Créer')}
        loading={saving}
        onSecondary={canToggle ? handleToggleActif : undefined}
        secondaryLabel={editUser?.actif ? '🚫 Désactiver le compte' : '✅ Réactiver le compte'}
        secondaryLoading={toggling}
      >
        {err && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠️</span> {err}</div>}

        {editUser && !editUser.actif && (
          <div style={{ background: 'var(--orange-dim)', border: '1px solid var(--orange)', borderRadius: 8, padding: '10px 14px', fontSize: '.82rem', color: 'var(--orange)', marginBottom: 16 }}>
            ⚠️ Ce compte est désactivé — l'utilisateur ne peut pas se connecter.
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Prénom</label>
            <input className="form-input" value={form.prenom} onChange={(e) => f('prenom', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nom *</label>
            <input className="form-input" value={form.nom} onChange={(e) => f('nom', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">E-mail *</label>
          <input className="form-input" type="email" value={form.email} onChange={(e) => f('email', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">
            {editId ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe * (min 8 caractères)'}
          </label>
          <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={(e) => f('password', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Rôle</label>
          <select className="form-select" value={form.role_nom} onChange={(e) => f('role_nom', e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {canToggle && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.72rem', color: 'var(--txt3)', marginBottom: 8 }}>
              ℹ️ Désactiver bloque la connexion mais conserve les données. Supprimer est définitif et irréversible.
            </div>
            <button
              type="button"
              className="btn"
              onClick={handleDelete}
              disabled={deleting || saving}
              style={{ color: 'var(--red)', borderColor: 'var(--red)', fontSize: '.78rem', width: '100%' }}
            >
              {deleting ? '⏳ Suppression…' : '🗑️ Supprimer définitivement ce compte'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
