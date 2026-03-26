import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';
import Modal from '../../components/ui/Modal';

const TYPES = [
  { key: 'cours',  label: '📚 Cours',   badge: 'badge-blue' },
  { key: 'edof',   label: '🏛️ EDOF',    badge: 'badge-purple' },
  { key: 'examen', label: '📝 Examen',  badge: 'badge-orange' },
];

const emptyForm = {
  formation_id: '', type_session: 'cours',
  date_debut: '', date_fin: '', capacite_max: '', lieu: '', moment: 'J',
};

const TYPE_LABELS = {
  TXF: 'TAXI FULL', TXP: 'TAXI PASSERELLE',
  VTF: 'VTC FULL',  VTP: 'VTC PASSERELLE',
  VMF: 'VMDTR FULL', VMP: 'VMDTR PASSERELLE',
};

/** Prévisualise le code session côté frontend
 *  Présentiel : YYMM + TYPE(3) + J/S + LIEU(2)  → ex: 2603VTFJSD
 *  Distanciel : YYMM + TYPE(3) + EL              → ex: 2603VTPEL
 */
function previewCodeSession(formation, dateDebut, moment) {
  if (!formation || !dateDebut) return null;
  const d = new Date(dateDebut);
  if (isNaN(d)) return null;
  const yy   = String(d.getFullYear()).slice(2);
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const type3 = (formation.code_formation || formation.type || '???').slice(0, 3);
  const base  = formation.format === 'D'
    ? `${yy}${mm}${type3}EL`
    : `${yy}${mm}${type3}${moment || 'J'}${formation.lieu_code || ''}`;
  return base;
}

export default function ParamSessions() {
  const [activeTab, setActiveTab]     = useState('cours');
  const [sessions, setSessions]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [formations, setFormations]   = useState([]);

  // Modal création
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState(emptyForm);
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState('');

  // Modal détail / suppression
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [cloturing, setCloturing]             = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [detailErr, setDetailErr]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/parametrage/sessions?type_session=${activeTab}`);
      setSessions(Array.isArray(data) ? data : data.data || []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  async function openNew() {
    try {
      const { data } = await api.get('/parametrage/formations');
      const list = Array.isArray(data) ? data : data.data || [];
      setFormations(list.filter(f => f.actif !== 0));
    } catch { setFormations([]); }
    setForm({ ...emptyForm, type_session: activeTab });
    setErr('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.formation_id) {
      setErr('La formation est requise');
      return;
    }
    if (!form.date_debut || !form.date_fin) {
      setErr('Les dates de début et fin sont requises');
      return;
    }
    setSaving(true); setErr('');
    try {
      const selF = formations.find(f => String(f.id) === String(form.formation_id));
      const { data } = await api.post('/parametrage/sessions', {
        formation_id:  parseInt(form.formation_id),
        type_session:  form.type_session,
        date_debut:    form.date_debut,
        date_fin:      form.date_fin,
        capacite_max:  form.capacite_max ? parseInt(form.capacite_max) : undefined,
        lieu:          form.lieu || undefined,
        moment:        selF?.format === 'D' ? undefined : (form.moment || 'J'),
      });
      setShowModal(false);
      load();
      // Affiche brièvement le code généré
      if (data?.data?.code_session) {
        window._lastCreatedSession = data.data.code_session;
      }
    } catch (e) {
      setErr(e.response?.data?.message || e.response?.data?.errors?.join(', ') || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  }

  function openDetail(s) {
    setSelectedSession(s);
    setDetailErr('');
    setShowDetailModal(true);
  }

  async function handleCloturer() {
    if (!selectedSession) return;
    if (!window.confirm(`Clôturer la session "${selectedSession.code_session}" ?\n\nLes dossiers affectés sont conservés.`)) return;
    setCloturing(true); setDetailErr('');
    try {
      await api.post(`/parametrage/sessions/${selectedSession.id}/cloturer`);
      setShowDetailModal(false);
      load();
    } catch (e) {
      setDetailErr(e.response?.data?.message || 'Erreur lors de la clôture');
    } finally {
      setCloturing(false);
    }
  }

  async function handleDelete() {
    if (!selectedSession) return;
    const msg = `⚠️ Supprimer définitivement la session "${selectedSession.code_session}" ?\n\nCette action est irréversible. Les dossiers liés conserveront leurs données.`;
    if (!window.confirm(msg)) return;
    if (!window.confirm('Confirmez-vous la suppression définitive ?')) return;
    setDeleting(true); setDetailErr('');
    try {
      // Essayer de clôturer d'abord pour libérer les contraintes, puis supprimer
      await api.delete(`/parametrage/sessions/${selectedSession.id}`);
      setShowDetailModal(false);
      load();
    } catch (e) {
      setDetailErr(e.response?.data?.message || 'Impossible de supprimer cette session.');
    } finally {
      setDeleting(false);
    }
  }

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const currentType = TYPES.find((t) => t.key === activeTab);

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <div className="section-title">Sessions de formation</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            Créez et gérez vos sessions cours, EDOF et examens
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          ➕ Nouvelle session
        </button>
      </div>

      {/* Tab nav */}
      <div className="tab-nav">
        {TYPES.map((t) => (
          <button
            key={t.key}
            className={`tab-btn${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : sessions.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code session</th>
                  <th>Formation</th>
                  <th>Date début</th>
                  <th>Date fin</th>
                  <th>Lieu</th>
                  <th>Capacité</th>
                  <th>Apprenants</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong style={{ cursor: 'pointer', color: 'var(--brand)' }} onClick={() => openDetail(s)}>
                        {s.code_session}
                      </strong>
                    </td>
                    <td>{s.formation_nom || '—'}</td>
                    <td>{s.date_debut ? new Date(s.date_debut).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>{s.date_fin   ? new Date(s.date_fin).toLocaleDateString('fr-FR')   : '—'}</td>
                    <td style={{ fontSize: '.8rem', color: 'var(--txt3)' }}>{s.lieu || '—'}</td>
                    <td>{s.capacite_max || '—'}</td>
                    <td>
                      <span className={`badge ${(s.nb_inscrits || 0) > 0 ? 'badge-blue' : 'badge-gray'}`}>
                        {s.nb_inscrits || 0}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${s.actif ? 'badge-green' : 'badge-gray'}`}>
                        {s.actif ? 'Ouverte' : 'Clôturée'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm" onClick={() => openDetail(s)}>
                        ⚙️ Gérer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">{currentType?.label.split(' ')[0]}</div>
            <div className="empty-state-text">Aucune session {currentType?.label} pour le moment</div>
            <button className="btn-primary" style={{ marginTop: 8 }} onClick={openNew}>
              ➕ Créer une session
            </button>
          </div>
        )}
      </div>

      {/* ── Modal création ── */}
      <Modal
        open={showModal}
        title={`Nouvelle session — ${currentType?.label}`}
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? 'Création…' : '✅ Créer la session'}
        loading={saving}
      >
        {err && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠️</span> {err}</div>}

        <div className="form-group">
          <label className="form-label">Formation *</label>
          <select className="form-select" value={form.formation_id}
            onChange={(e) => { upd('formation_id', e.target.value); upd('date_debut', form.date_debut); }}>
            <option value="">— Choisir une formation —</option>
            {formations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code_formation ? `[${f.code_formation}] ` : ''}{TYPE_LABELS[f.type] || f.nom}
                {f.format === 'P' && f.lieu_code ? ` — ${f.lieu_code}` : ''}
                {f.format === 'D' ? ' — E-learning' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Jour / Soir — uniquement pour Présentiel */}
        {(() => {
          const selF = formations.find(f => String(f.id) === String(form.formation_id));
          if (!selF || selF.format === 'D') return null;
          return (
            <div className="form-group">
              <label className="form-label">Créneau *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ value: 'J', label: '☀️ Jour' }, { value: 'S', label: '🌙 Soir' }].map(opt => (
                  <label key={opt.value} style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: '.85rem',
                    border: `2px solid ${form.moment === opt.value ? 'var(--brand)' : 'var(--border)'}`,
                    background: form.moment === opt.value ? 'var(--brand-dim)' : 'transparent',
                    color: form.moment === opt.value ? 'var(--brand)' : 'var(--txt2)',
                  }}>
                    <input
                      type="radio" name="moment" value={opt.value}
                      checked={form.moment === opt.value}
                      onChange={() => upd('moment', opt.value)}
                      style={{ display: 'none' }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Aperçu du code session */}
        {(() => {
          const selFormation = formations.find(f => String(f.id) === String(form.formation_id));
          const preview = previewCodeSession(selFormation, form.date_debut, form.moment);
          return (
            <div style={{
              background: 'var(--surface2)', borderRadius: 8,
              padding: '10px 14px', marginBottom: 14, fontSize: '.8rem', color: 'var(--txt2)',
            }}>
              <strong>🔢 Code session</strong>
              {preview ? (
                <>
                  <span style={{
                    marginLeft: 10, fontFamily: 'monospace', fontWeight: 700,
                    color: 'var(--orange)', background: 'var(--orange-dim)',
                    padding: '2px 8px', borderRadius: 5,
                  }}>
                    {preview} <span style={{ fontWeight: 400, fontSize: '.7rem' }}>(aperçu)</span>
                  </span>
                  <div style={{ marginTop: 4, fontSize: '.7rem', color: 'var(--txt3)' }}>
                    {selFormation?.format === 'D'
                      ? 'Format : AAMM + code + EL (e-learning)'
                      : `Format : AAMM + code + ${form.moment === 'S' ? 'S (soir)' : 'J (jour)'} + lieu`}
                  </div>
                </>
              ) : (
                <span style={{ marginLeft: 10, color: 'var(--txt3)' }}>
                  Sélectionnez une formation et une date de début
                </span>
              )}
            </div>
          );
        })()}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Type de session</label>
            <select className="form-select" value={form.type_session} onChange={(e) => upd('type_session', e.target.value)}>
              {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Capacité max.</label>
            <input
              className="form-input" type="number" placeholder="30"
              value={form.capacite_max} onChange={(e) => upd('capacite_max', e.target.value)}
            />
          </div>
        </div>

        {(() => {
          const selF = formations.find(f => String(f.id) === String(form.formation_id));
          if (!selF) return null;
          if (selF.format === 'D') return (
            <div style={{
              background: 'var(--teal-dim, #e6f7f5)', borderRadius: 6,
              padding: '8px 12px', marginBottom: 8, fontSize: '.8rem', color: 'var(--teal, #0d9488)',
            }}>
              🌐 Session Distanciel / E-learning — pas de lieu physique
            </div>
          );
          return (
            <div className="form-group">
              <label className="form-label">Salle / précision lieu</label>
              <input
                className="form-input" placeholder="ex. Salle A — Saint-Denis"
                value={form.lieu} onChange={(e) => upd('lieu', e.target.value)}
              />
            </div>
          );
        })()}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date début *</label>
            <input className="form-input" type="date" value={form.date_debut} onChange={(e) => upd('date_debut', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Date fin *</label>
            <input className="form-input" type="date" value={form.date_fin} onChange={(e) => upd('date_fin', e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* ── Modal gestion session ── */}
      <Modal
        open={showDetailModal}
        title={selectedSession ? `Session — ${selectedSession.code_session}` : 'Session'}
        onClose={() => setShowDetailModal(false)}
        cancelLabel="Fermer"
      >
        {selectedSession && (
          <>
            {detailErr && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠️</span> {detailErr}</div>}

            {/* Infos */}
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '.82rem' }}>
                {[
                  { label: 'Formation',   value: selectedSession.formation_nom },
                  { label: 'Type',        value: TYPES.find(t => t.key === selectedSession.type_session)?.label || selectedSession.type_session },
                  { label: 'Date début',  value: selectedSession.date_debut ? new Date(selectedSession.date_debut).toLocaleDateString('fr-FR') : '—' },
                  { label: 'Date fin',    value: selectedSession.date_fin   ? new Date(selectedSession.date_fin).toLocaleDateString('fr-FR')   : '—' },
                  { label: 'Lieu',        value: selectedSession.lieu       || '—' },
                  { label: 'Capacité',    value: selectedSession.capacite_max || '—' },
                  { label: 'Apprenants',  value: selectedSession.nb_inscrits ?? 0 },
                  { label: 'Statut',      value: selectedSession.actif ? '🟢 Ouverte' : '🔴 Clôturée' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ color: 'var(--txt3)', fontSize: '.7rem', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 600 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedSession.actif ? (
                <button
                  className="btn-primary"
                  onClick={handleCloturer}
                  disabled={cloturing || deleting}
                  style={{ width: '100%' }}
                >
                  {cloturing ? '⏳ Clôture…' : '🔒 Clôturer cette session'}
                </button>
              ) : (
                <div style={{ background: 'var(--orange-dim)', borderRadius: 8, padding: '8px 12px', fontSize: '.8rem', color: 'var(--orange)', textAlign: 'center' }}>
                  Cette session est déjà clôturée.
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <div style={{ fontSize: '.7rem', color: 'var(--txt3)', marginBottom: 6 }}>
                  ⚠️ La suppression est définitive. Les dossiers liés conservent leurs données.
                </div>
                <button
                  className="btn"
                  onClick={handleDelete}
                  disabled={cloturing || deleting}
                  style={{ color: 'var(--red)', borderColor: 'var(--red)', width: '100%', fontSize: '.8rem' }}
                >
                  {deleting ? '⏳ Suppression…' : '🗑️ Supprimer définitivement cette session'}
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
