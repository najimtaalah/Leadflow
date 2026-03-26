import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import useAuthStore from '../store/authStore';

const TYPES_RDV   = ['commercial', 'administratif', 'interne'];
const STATUTS_RDV = ['planifie', 'confirme', 'effectue', 'annule', 'en_attente'];

const TYPE_COLORS = {
  commercial:    'badge-blue',
  administratif: 'badge-purple',
  interne:       'badge-teal',
};
const STATUT_COLORS = {
  planifie:   'badge-orange',
  confirme:   'badge-green',
  effectue:   'badge-teal',
  annule:     'badge-red',
  en_attente: 'badge-gray',
};

const emptyForm = {
  titre: '', type_rdv: 'interne', statut: 'planifie',
  date_rdv: '', heure_debut: '', heure_fin: '',
  lieu: '', notes: '', lead_id: '', dossier_id: '',
};

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatHeure(h) {
  if (!h) return '';
  return h.slice(0, 5);
}

export default function Agenda() {
  const user   = useAuthStore((s) => s.user);
  const [rdvs, setRdvs] = useState([]);
  const [today, setToday] = useState([]);
  const [leads, setLeads] = useState([]);
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allRes, todayRes, leadsRes, dossiersRes] = await Promise.all([
        api.get('/agenda?limit=50'),
        api.get('/agenda/today'),
        api.get('/leads?limit=200&statut=nouveau,contacte,en_cours'),
        api.get('/dossiers?limit=200'),
      ]);
      const all = allRes.data?.data || allRes.data || [];
      const td  = todayRes.data?.data || todayRes.data || [];
      const ls  = leadsRes.data?.data || leadsRes.data || [];
      const ds  = dossiersRes.data?.data || dossiersRes.data || [];
      setRdvs(Array.isArray(all) ? all : []);
      setToday(Array.isArray(td) ? td : []);
      setLeads(Array.isArray(ls) ? ls : []);
      setDossiers(Array.isArray(ds) ? ds : []);
    } catch {
      setRdvs([]); setToday([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditId(null);
    setForm({ ...emptyForm, date_rdv: new Date().toISOString().split('T')[0], heure_debut: '09:00', heure_fin: '10:00' });
    setErr('');
    setShowModal(true);
  }

  function openEdit(rdv) {
    setEditId(rdv.id);
    setForm({
      titre:       rdv.titre || '',
      type_rdv:    rdv.type_rdv || 'commercial',
      statut:      rdv.statut || 'planifie',
      date_rdv:    rdv.date_rdv?.split('T')[0] || '',
      heure_debut: rdv.heure_debut || '',
      heure_fin:   rdv.heure_fin || '',
      lieu:        rdv.lieu || '',
      notes:       rdv.notes || '',
    });
    setErr('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.titre) { setErr('Le titre est requis'); return; }
    if (!form.date_rdv) { setErr('La date est requise'); return; }
    if (!form.heure_debut) { setErr('L\'heure de début est requise'); return; }
    if (!form.heure_fin) { setErr('L\'heure de fin est requise'); return; }
    if (form.type_rdv === 'commercial' && !form.lead_id) { setErr('Veuillez sélectionner un lead pour un RDV commercial'); return; }
    if (form.type_rdv === 'administratif' && !form.dossier_id) { setErr('Veuillez sélectionner un dossier pour un RDV administratif'); return; }

    setSaving(true); setErr('');
    try {
      const payload = {
        ...form,
        responsable_id: user?.id,
        lead_id:     form.lead_id     || null,
        dossier_id:  form.dossier_id  || null,
      };
      if (editId) {
        await api.patch(`/agenda/${editId}`, payload);
      } else {
        await api.post('/agenda', payload);
      }
      setShowModal(false);
      load();
    } catch (e) {
      const errors = e.response?.data?.errors;
      setErr(errors ? errors.join(' ') : (e.response?.data?.message || 'Erreur lors de l\'enregistrement'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelRdv() {
    if (!editId) return;
    if (!window.confirm('Confirmer l\'annulation de ce rendez-vous ?')) return;
    setCancelling(true); setErr('');
    try {
      await api.patch(`/agenda/${editId}`, { statut: 'annule' });
      setShowModal(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Erreur lors de l\'annulation');
    } finally {
      setCancelling(false);
    }
  }

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const displayed = rdvs.filter((r) =>
    filter === 'all' || r.statut === filter
  );

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <div className="section-title">Agenda</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            {rdvs.length} rendez-vous
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>➕ Nouveau RDV</button>
      </div>

      {/* Aujourd'hui */}
      {today.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--brand)', padding: '12px 16px' }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
            📅 Aujourd'hui — {today.length} RDV
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {today.map((r) => (
              <div
                key={r.id}
                onClick={() => openEdit(r)}
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', minWidth: 160 }}
              >
                <div style={{ fontWeight: 600, fontSize: '.82rem', color: 'var(--txt)' }}>{r.titre}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--txt3)', marginTop: 2 }}>
                  {formatHeure(r.heure_debut)}{r.heure_fin ? ` → ${formatHeure(r.heure_fin)}` : ''}
                  {r.lieu ? ` · ${r.lieu}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="filters">
        <button className={`filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Tous ({rdvs.length})
        </button>
        {STATUTS_RDV.map((s) => {
          const c = rdvs.filter((r) => r.statut === s).length;
          if (c === 0) return null;
          return (
            <button key={s} className={`filter-btn${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
              {s.replace('_', ' ')} ({c})
            </button>
          );
        })}
      </div>

      {/* Tableau */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : displayed.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Heure</th>
                  <th>Lieu</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ cursor: 'pointer', color: 'var(--brand)' }} onClick={() => openEdit(r)}>
                        {r.titre}
                      </strong>
                    </td>
                    <td><span className={`badge ${TYPE_COLORS[r.type_rdv] || 'badge-gray'}`}>{r.type_rdv}</span></td>
                    <td>{formatDate(r.date_rdv)}</td>
                    <td style={{ fontSize: '.8rem', color: 'var(--txt2)' }}>
                      {formatHeure(r.heure_debut)}{r.heure_fin ? ` — ${formatHeure(r.heure_fin)}` : ''}
                    </td>
                    <td>{r.lieu || '—'}</td>
                    <td><span className={`badge ${STATUT_COLORS[r.statut] || 'badge-gray'}`}>{r.statut?.replace('_', ' ')}</span></td>
                    <td>
                      <button className="btn btn-sm" onClick={() => openEdit(r)}>✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-text">Aucun rendez-vous</div>
            <button className="btn-primary" style={{ marginTop: 8 }} onClick={openNew}>
              ➕ Planifier un RDV
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        open={showModal}
        title={editId ? 'Modifier le RDV' : 'Nouveau rendez-vous'}
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? 'Enregistrement…' : (editId ? 'Mettre à jour' : 'Créer')}
        loading={saving}
        onSecondary={editId && form.statut !== 'annule' ? handleCancelRdv : undefined}
        secondaryLabel="🚫 Annuler le RDV"
        secondaryLoading={cancelling}
      >
        {err && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠️</span> {err}</div>}

        <div className="form-group">
          <label className="form-label">Titre *</label>
          <input className="form-input" value={form.titre} onChange={(e) => f('titre', e.target.value)} placeholder="Ex. Appel découverte Sophie DURAND" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.type_rdv} onChange={(e) => f('type_rdv', e.target.value)}>
              {TYPES_RDV.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Statut</label>
            <select className="form-select" value={form.statut} onChange={(e) => f('statut', e.target.value)}>
              {STATUTS_RDV.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input className="form-input" type="date" value={form.date_rdv} onChange={(e) => f('date_rdv', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Heure début</label>
            <input className="form-input" type="time" value={form.heure_debut} onChange={(e) => f('heure_debut', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Heure fin</label>
            <input className="form-input" type="time" value={form.heure_fin} onChange={(e) => f('heure_fin', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Lieu</label>
          <input className="form-input" value={form.lieu} onChange={(e) => f('lieu', e.target.value)} placeholder="Ex. Présentiel, Visio, Téléphone…" />
        </div>
        {/* Lead (si commercial) */}
        {form.type_rdv === 'commercial' && (
          <div className="form-group">
            <label className="form-label">Lead associé *</label>
            <select className="form-select" value={form.lead_id} onChange={(e) => f('lead_id', e.target.value)}>
              <option value="">— Sélectionner un lead —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.prenom ? `${l.prenom} ${l.nom}` : l.nom} {l.telephone ? `· ${l.telephone}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Dossier (si administratif) */}
        {form.type_rdv === 'administratif' && (
          <div className="form-group">
            <label className="form-label">Dossier associé *</label>
            <select className="form-select" value={form.dossier_id} onChange={(e) => f('dossier_id', e.target.value)}>
              <option value="">— Sélectionner un dossier —</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>{d.prenom ? `${d.prenom} ${d.nom}` : d.nom}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-input" value={form.notes} onChange={(e) => f('notes', e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
