import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';
import Modal from '../../components/ui/Modal';

const CONFIG_PEDA = [
  { value: 'theorie_seule',       label: 'Théorie seule' },
  { value: 'pratique_seule',      label: 'Pratique seule' },
  { value: 'theorie_et_pratique', label: 'Théorie + Pratique' },
];

const TYPES_FORMATION = [
  { value: 'TXF', label: 'TAXI FULL' },
  { value: 'TXP', label: 'TAXI PASSERELLE' },
  { value: 'VTF', label: 'VTC FULL' },
  { value: 'VTP', label: 'VTC PASSERELLE' },
  { value: 'VMF', label: 'VMDTR FULL' },
  { value: 'VMP', label: 'VMDTR PASSERELLE' },
];

const FORMATS = [
  { value: 'P', label: 'Présentiel' },
  { value: 'D', label: 'Distanciel / E-learning' },
];

const LIEUX = [
  { value: 'SD', label: 'Saint-Denis (SD)' },
  { value: 'AY', label: 'Antony (AY)' },
];

const emptyForm = {
  nom: '',
  date_debut: '',
  type: '',
  format: '',
  lieu_code: '',
  duree_heures: '',
  cout_defaut: '',
  config_pedagogique: 'theorie_et_pratique',
  actif: true,
};

/** Code formation = 3 lettres du type uniquement (ex: TXF, VTP, VMP…) */
function previewCode(form) {
  if (!form.type) return null;
  return form.type; // ex: TXF
}

export default function ParamFormations() {
  const [formations, setFormations] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editId, setEditId]         = useState(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [err, setErr]               = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/parametrage/formations');
      setFormations(Array.isArray(data) ? data : data.data || []);
    } catch {
      setFormations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setErr('');
    setShowModal(true);
  }

  function openEdit(fo) {
    setEditId(fo.id);
    setForm({
      nom:               fo.nom || '',
      date_debut:        fo.date_debut ? fo.date_debut.substring(0, 10) : '',
      type:              fo.type || '',
      format:            fo.format || '',
      lieu_code:         fo.lieu_code || '',
      duree_heures:      fo.duree_heures || '',
      cout_defaut:       fo.cout_defaut || '',
      config_pedagogique: fo.config_pedagogique || 'theorie_et_pratique',
      actif:             fo.actif,
    });
    setErr('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.nom) { setErr('Le nom est requis'); return; }
    setSaving(true); setErr('');
    try {
      if (editId) {
        await api.patch(`/parametrage/formations/${editId}`, form);
      } else {
        await api.post('/parametrage/formations', form);
      }
      setShowModal(false);
      load();
    } catch (e) {
      const msg = e.response?.data?.errors?.join(', ') || e.response?.data?.message || 'Erreur lors de l\'enregistrement';
      setErr(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    if (!window.confirm('Supprimer définitivement cette formation ?\n\nCette action est irréversible.')) return;
    setDeleting(true); setErr('');
    try {
      await api.delete(`/parametrage/formations/${editId}`);
      setShowModal(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggle(fo) {
    try {
      await api.patch(`/parametrage/formations/${fo.id}`, { actif: !fo.actif });
      load();
    } catch { /* ignore */ }
  }

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const codePreview = !editId ? previewCode(form) : null;

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <div className="section-title">Formations</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            {formations.length} formation{formations.length > 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>➕ Nouvelle formation</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : formations.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code formation</th>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Format</th>
                  <th>Lieu</th>
                  <th>Durée (h)</th>
                  <th>Prix HT (€)</th>
                  <th>Sessions</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {formations.map((fo) => (
                  <tr key={fo.id}>
                    <td>
                      {fo.code_formation ? (
                        <span style={{
                          fontFamily: 'monospace', fontSize: '.82rem',
                          background: 'var(--brand-dim)', color: 'var(--brand)',
                          padding: '2px 7px', borderRadius: 5, fontWeight: 700,
                        }}>
                          {fo.code_formation}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--txt3)', fontSize: '.75rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      <strong style={{ cursor: 'pointer', color: 'var(--brand)' }} onClick={() => openEdit(fo)}>
                        {fo.nom}
                      </strong>
                    </td>
                    <td>
                      {fo.type ? (
                        <span className="badge badge-purple">
                          {TYPES_FORMATION.find(t => t.value === fo.type)?.label || fo.type}
                        </span>
                      ) : <span style={{ color: 'var(--txt3)' }}>—</span>}
                    </td>
                    <td>
                      {fo.format ? (
                        <span className={`badge ${fo.format === 'P' ? 'badge-blue' : 'badge-teal'}`}>
                          {fo.format === 'P' ? 'Présentiel' : 'E-learning'}
                        </span>
                      ) : <span style={{ color: 'var(--txt3)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '.82rem', fontWeight: 600 }}>{fo.lieu_code || '—'}</td>
                    <td>{fo.duree_heures ? `${fo.duree_heures}h` : '—'}</td>
                    <td>{fo.cout_defaut ? `${Number(fo.cout_defaut).toLocaleString('fr-FR')} €` : '—'}</td>
                    <td>
                      <span className={`badge ${fo.nb_sessions > 0 ? 'badge-blue' : 'badge-gray'}`}>
                        {fo.nb_sessions || 0}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${fo.actif ? 'badge-green' : 'badge-gray'}`}>
                        {fo.actif ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => openEdit(fo)}>✏️ Modifier</button>
                        <button className="btn btn-sm" onClick={() => handleToggle(fo)}>
                          {fo.actif ? '⏸ Désactiver' : '▶ Activer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <div className="empty-state-text">Aucune formation configurée</div>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        title={editId ? 'Modifier la formation' : 'Nouvelle formation'}
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? 'Enregistrement…' : (editId ? 'Mettre à jour' : 'Créer')}
        loading={saving}
      >
        {err && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠️</span> {err}</div>}

        {/* Aperçu / affichage du code formation */}
        <div style={{
          background: 'var(--surface2)', borderRadius: 8,
          padding: '10px 14px', marginBottom: 14, fontSize: '.8rem', color: 'var(--txt2)',
        }}>
          <strong>📌 Code formation</strong>
          {editId ? (
            <>
              <span style={{
                marginLeft: 10, fontFamily: 'monospace', fontWeight: 700,
                color: 'var(--brand)', background: 'var(--brand-dim)',
                padding: '2px 8px', borderRadius: 5,
              }}>
                {formations.find(f => f.id === editId)?.code_formation || '—'}
              </span>
              <div style={{ marginTop: 6, fontSize: '.7rem', color: 'var(--txt3)' }}>
                ℹ️ Le code formation ne peut pas être modifié après création.
              </div>
            </>
          ) : codePreview ? (
            <>
              <span style={{
                marginLeft: 10, fontFamily: 'monospace', fontWeight: 700,
                color: 'var(--orange)', background: 'var(--orange-dim)',
                padding: '2px 8px', borderRadius: 5,
              }}>
                {codePreview} <span style={{ fontWeight: 400, fontSize: '.7rem' }}>(aperçu)</span>
              </span>
              <div style={{ marginTop: 4, fontSize: '.7rem', color: 'var(--txt3)' }}>
                {form.format === 'D'
                  ? <>Code session ex.&nbsp;: <em>2603{form.type}EL</em></>
                  : <>Code session ex.&nbsp;: <em>2603{form.type}J{form.lieu_code}</em> (jour) · <em>2603{form.type}S{form.lieu_code}</em> (soir)</>
                }
              </div>
            </>
          ) : (
            <span style={{ marginLeft: 10, color: 'var(--txt3)' }}>
              Choisissez type + format{form.format === 'P' ? ' + lieu' : ''} pour générer le code
            </span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Nom de la formation *</label>
          <input className="form-input" value={form.nom} onChange={(e) => upd('nom', e.target.value)} />
        </div>

        {/* Champs du code — affichés uniquement à la création (code figé après) */}
        {!editId && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Type *</label>
                <select className="form-select" value={form.type}
                  onChange={(e) => { upd('type', e.target.value); if (e.target.value === '') upd('lieu_code', ''); }}>
                  <option value="">— Choisir —</option>
                  {TYPES_FORMATION.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Format *</label>
                <select className="form-select" value={form.format}
                  onChange={(e) => { upd('format', e.target.value); if (e.target.value === 'D') upd('lieu_code', ''); }}>
                  <option value="">— Choisir —</option>
                  {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>

            {/* Lieu — uniquement pour le Présentiel */}
            {form.format === 'P' && (
              <div className="form-group">
                <label className="form-label">Lieu (agence) *</label>
                <select className="form-select" value={form.lieu_code} onChange={(e) => upd('lieu_code', e.target.value)}>
                  <option value="">— Choisir —</option>
                  {LIEUX.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            )}
            {form.format === 'D' && (
              <div style={{
                background: 'var(--teal-dim, #e6f7f5)', borderRadius: 6,
                padding: '8px 12px', fontSize: '.8rem', color: 'var(--teal, #0d9488)',
              }}>
                🌐 Distanciel / E-learning — code lieu : <strong>EL</strong>
              </div>
            )}
          </>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Durée (heures)</label>
            <input className="form-input" type="number" value={form.duree_heures}
              onChange={(e) => upd('duree_heures', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Coût par défaut (€)</label>
            <input className="form-input" type="number" value={form.cout_defaut}
              onChange={(e) => upd('cout_defaut', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Configuration pédagogique *</label>
          <select className="form-select" value={form.config_pedagogique}
            onChange={(e) => upd('config_pedagogique', e.target.value)}>
            {CONFIG_PEDA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {editId && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.72rem', color: 'var(--txt3)', marginBottom: 8 }}>
              ℹ️ La suppression est définitive et irréversible. Impossible si des sessions sont liées.
            </div>
            <button
              type="button" className="btn" onClick={handleDelete}
              disabled={deleting || saving}
              style={{ color: 'var(--red)', borderColor: 'var(--red)', fontSize: '.78rem', width: '100%' }}
            >
              {deleting ? '⏳ Suppression…' : '🗑️ Supprimer définitivement cette formation'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
