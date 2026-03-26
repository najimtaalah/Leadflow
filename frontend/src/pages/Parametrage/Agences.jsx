import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';
import Modal from '../../components/ui/Modal';
import useAuthStore from '../../store/authStore';

const emptyForm = {
  nom: '', ville: '', region: '', code: '', actif: true,
};

export default function ParamAgences() {
  const user   = useAuthStore((s) => s.user);
  const isAdmin = ['super_admin', 'role_admin'].includes(user?.role || user?.role_nom);

  const [agences, setAgences]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showInactives, setShowInactives] = useState(false);

  const [showModal, setShowModal]   = useState(false);
  const [editId, setEditId]         = useState(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [toggling, setToggling]     = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [err, setErr]               = useState('');
  const [warning, setWarning]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = showInactives ? '/parametrage/agences' : '/parametrage/agences?actif=1';
      const { data } = await api.get(url);
      setAgences(Array.isArray(data) ? data : data.data || []);
    } catch {
      setAgences([]);
    } finally {
      setLoading(false);
    }
  }, [showInactives]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setErr('');
    setWarning('');
    setShowModal(true);
  }

  function openEdit(ag) {
    setEditId(ag.id);
    setForm({
      nom:    ag.nom    || '',
      ville:  ag.ville  || '',
      region: ag.region || '',
      code:   ag.code   || '',
      actif:  !!ag.actif,
    });
    setErr('');
    setWarning('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.nom.trim()) { setErr('Le nom est requis'); return; }
    setSaving(true); setErr(''); setWarning('');
    try {
      let res;
      if (editId) {
        res = await api.patch(`/parametrage/agences/${editId}`, form);
      } else {
        res = await api.post('/parametrage/agences', form);
      }
      if (res.data?.warning) setWarning(res.data.warning);
      setShowModal(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ag) {
    const target = ag || (editId && agences.find((a) => a.id === editId));
    if (!target) return;
    if (!window.confirm(`Supprimer définitivement l'agence "${target.nom}" ?\n\nLes dossiers et leads associés perdront leur lien agence.`)) return;
    if (!window.confirm('Confirmez-vous la suppression définitive ?')) return;
    setDeleting(target.id);
    try {
      await api.delete(`/parametrage/agences/${target.id}`);
      setShowModal(false);
      load();
    } catch (e) {
      const msg = e.response?.data?.message || 'Erreur lors de la suppression';
      setErr(msg);
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggle(ag) {
    const action = ag.actif ? 'désactiver' : 'activer';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} l'agence "${ag.nom}" ?`)) return;
    setToggling(ag.id);
    try {
      const res = await api.patch(`/parametrage/agences/${ag.id}`, { actif: !ag.actif });
      if (res.data?.warning) alert('⚠️ ' + res.data.warning);
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Erreur');
    } finally {
      setToggling(null);
    }
  }

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const actives   = agences.filter((a) => a.actif);
  const inactives = agences.filter((a) => !a.actif);

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <div className="section-title">Agences</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            {actives.length} agence{actives.length > 1 ? 's' : ''} active{actives.length > 1 ? 's' : ''}
            {inactives.length > 0 && ` · ${inactives.length} inactive${inactives.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {inactives.length > 0 && (
            <button className="btn" onClick={() => setShowInactives((v) => !v)}>
              {showInactives ? '👁 Actives seulement' : '👁 Voir inactives'}
            </button>
          )}
          {isAdmin && (
            <button className="btn-primary" onClick={openNew}>➕ Nouvelle agence</button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : agences.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Code</th>
                  <th>Ville</th>
                  <th>Région</th>
                  <th>Statut</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {agences.map((ag) => (
                  <tr key={ag.id} style={{ opacity: ag.actif ? 1 : 0.6 }}>
                    <td>
                      <strong
                        style={isAdmin ? { cursor: 'pointer', color: 'var(--brand)' } : {}}
                        onClick={() => isAdmin && openEdit(ag)}
                      >
                        {ag.nom}
                      </strong>
                    </td>
                    <td>
                      {ag.code
                        ? <span className="badge badge-gray" style={{ fontFamily: 'monospace' }}>{ag.code}</span>
                        : <span style={{ color: 'var(--txt3)' }}>—</span>}
                    </td>
                    <td>{ag.ville || '—'}</td>
                    <td>{ag.region || '—'}</td>
                    <td>
                      <span className={`badge ${ag.actif ? 'badge-green' : 'badge-gray'}`}>
                        {ag.actif ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" onClick={() => openEdit(ag)}>
                            ✏️ Modifier
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleToggle(ag)}
                            disabled={toggling === ag.id}
                            style={!ag.actif ? { color: 'var(--green)', borderColor: 'var(--green)' } : {}}
                          >
                            {toggling === ag.id ? '⏳…' : ag.actif ? '⏸ Désactiver' : '▶ Activer'}
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleDelete(ag)}
                            disabled={deleting === ag.id}
                            style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                          >
                            {deleting === ag.id ? '⏳…' : '🗑️'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🏢</div>
            <div className="empty-state-text">Aucune agence configurée</div>
            {isAdmin && (
              <button className="btn-primary" style={{ marginTop: 8 }} onClick={openNew}>
                ➕ Créer la première agence
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal création / édition */}
      <Modal
        open={showModal}
        title={editId ? 'Modifier l\'agence' : 'Nouvelle agence'}
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? 'Enregistrement…' : (editId ? 'Mettre à jour' : 'Créer')}
        loading={saving}
      >
        {err     && <div className="err-box"  style={{ marginBottom: 12 }}><span>⚠️</span> {err}</div>}
        {warning && <div className="warn-box" style={{ marginBottom: 12, background: 'var(--orange-dim)', border: '1px solid var(--orange)', borderRadius: 8, padding: '8px 12px', fontSize: '.82rem', color: 'var(--orange)' }}>⚠️ {warning}</div>}

        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Nom de l'agence *</label>
            <input
              className="form-input"
              placeholder="ex. Agence Paris Centre"
              value={form.nom}
              onChange={(e) => upd('nom', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Code</label>
            <input
              className="form-input"
              placeholder="ex. PAR01"
              value={form.code}
              onChange={(e) => upd('code', e.target.value.toUpperCase())}
              maxLength={10}
              style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ville</label>
            <input
              className="form-input"
              placeholder="ex. Paris"
              value={form.ville}
              onChange={(e) => upd('ville', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Région</label>
            <input
              className="form-input"
              placeholder="ex. Île-de-France"
              value={form.region}
              onChange={(e) => upd('region', e.target.value)}
            />
          </div>
        </div>

        {editId && (
          <>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '.85rem' }}>
                <input
                  type="checkbox"
                  checked={form.actif}
                  onChange={(e) => upd('actif', e.target.checked)}
                />
                <span>Agence active</span>
                {!form.actif && (
                  <span style={{ fontSize: '.75rem', color: 'var(--orange)' }}>
                    (désactiver bloque l'assignation de nouveaux leads)
                  </span>
                )}
              </label>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.72rem', color: 'var(--txt3)', marginBottom: 8 }}>
                ⚠️ La suppression est définitive. Impossible si des utilisateurs y sont assignés.
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => handleDelete()}
                disabled={deleting || saving}
                style={{ color: 'var(--red)', borderColor: 'var(--red)', width: '100%', fontSize: '.8rem' }}
              >
                {deleting ? '⏳ Suppression…' : '🗑️ Supprimer définitivement cette agence'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
