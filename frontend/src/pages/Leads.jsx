import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import useAuthStore from '../store/authStore';

const STATUTS = ['Nouveau lead', 'Contacté', 'Intéressé', 'En cours', 'Dossier monté', 'Converti', 'Perdu'];

const TYPE_ICONS  = { appel: '📞', sms: '💬', email: '📧', rdv: '📅', note: '📝' };
const TYPE_LABELS = { appel: 'Appel', sms: 'SMS', email: 'Email', rdv: 'RDV', note: 'Note' };

// ── Panel slide-in historique interactions (admin) ────────────────────────────

function InteractionsPanel({ lead, onClose }) {
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!lead) return;
    setLoading(true);
    api.get(`/leads/${lead.id}/interactions`)
      .then(r => setInteractions(r.data?.data || []))
      .catch(() => setInteractions([]))
      .finally(() => setLoading(false));
  }, [lead]);

  if (!lead) return null;

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 200, cursor: 'pointer' }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, width: 380, height: '100vh',
        background: 'var(--bg)', zIndex: 201, overflow: 'auto',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 18px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '.95rem' }}>
              {lead.prenom ? `${lead.prenom} ${lead.nom}` : lead.nom}
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--txt3)' }}>Historique des interactions</div>
          </div>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '14px 18px', flex: 1 }}>
          {loading ? (
            <div className="spinner-wrap" style={{ padding: 20 }}><div className="spinner" /></div>
          ) : interactions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {interactions.map((inter) => (
                <div key={inter.id} style={{
                  background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px',
                  display: 'flex', gap: 10,
                }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{TYPE_ICONS[inter.type] || '📋'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span className={`badge badge-${inter.type === 'appel' ? 'green' : inter.type === 'sms' ? 'blue' : inter.type === 'email' ? 'purple' : 'gray'}`} style={{ fontSize: '.72rem' }}>
                        {TYPE_LABELS[inter.type] || inter.type}
                      </span>
                      <span style={{ fontSize: '.72rem', color: 'var(--txt3)' }}>
                        {inter.created_at ? new Date(inter.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                    {inter.contenu && (
                      <div style={{ fontSize: '.78rem', color: 'var(--txt2)', marginBottom: 2 }}>{inter.contenu}</div>
                    )}
                    {inter.fait_par && (
                      <div style={{ fontSize: '.72rem', color: 'var(--txt3)' }}>par {inter.fait_par}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--txt3)', fontSize: '.82rem', textAlign: 'center', padding: 32 }}>
              Aucune interaction enregistrée pour ce lead
            </div>
          )}
        </div>
      </div>
    </>
  );
}
const STATUT_COLORS = {
  'Nouveau lead': 'badge-gray',
  'Contacté':     'badge-blue',
  'Intéressé':    'badge-purple',
  'En cours':     'badge-orange',
  'Dossier monté':'badge-teal',
  'Converti':     'badge-green',
  'Perdu':        'badge-red',
};
const SOURCES = ['Site web', 'Réseaux sociaux', 'Bouche à oreille', 'Partenaire', 'Autre'];

const emptyForm = {
  nom: '', prenom: '', telephone: '', email: '',
  formation_souhaitee: '', statut: 'Nouveau lead', source: '', notes: '',
};

export default function Leads() {
  const { user } = useAuthStore();
  const role     = user?.role || user?.role_nom || '';
  const isAdmin  = ['super_admin', 'role_admin'].includes(role);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Panel interactions (admin)
  const [interPanel, setInterPanel] = useState(null);

  // Modal création / édition
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  // Commerciaux pour affectation (admin only)
  const [commerciaux, setCommerciaux] = useState([]);

  // Modal conversion lead → dossier
  const [convLead, setConvLead] = useState(null);
  const [convForm, setConvForm] = useState({ vendeur_id: '' });
  const [convSaving, setConvSaving] = useState(false);
  const [convErr, setConvErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads(Array.isArray(data) ? data : data.data || data.leads || []);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger commerciaux (admin uniquement)
  useEffect(() => {
    if (!isAdmin) return;
    api.get('/users').then(r => {
      const users = Array.isArray(r.data) ? r.data : r.data?.data || [];
      setCommerciaux(users.filter(u => ['commercial', 'manager'].includes(u.role_nom || u.role)));
    }).catch(() => {});
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const displayed = leads.filter((l) => {
    const matchStatus = filter === 'all' || l.statut === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      `${l.nom} ${l.prenom} ${l.telephone} ${l.email} ${l.formation_souhaitee}`.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setErr('');
    setShowModal(true);
  }

  function openEdit(lead) {
    setEditId(lead.id);
    setForm({
      nom:                 lead.nom || '',
      prenom:              lead.prenom || '',
      telephone:           lead.telephone || '',
      email:               lead.email || '',
      formation_souhaitee: lead.formation_souhaitee || '',
      statut:              lead.statut || 'Nouveau lead',
      source:              lead.source || '',
      notes:               lead.notes || '',
      vendeur_id:          lead.vendeur_id || '',
    });
    setErr('');
    setShowModal(true);
  }

  function openConvert(lead) {
    setConvLead(lead);
    setConvForm({ vendeur_id: lead.vendeur_id || '' });
    setConvErr('');
  }

  async function handleConvert() {
    if (!convLead) return;
    setConvSaving(true); setConvErr('');
    try {
      await api.post('/dossiers', {
        lead_id:             convLead.id,
        nom:                 convLead.nom,
        prenom:              convLead.prenom || '',
        telephone:           convLead.telephone,
        email:               convLead.email || '',
        formation_souhaitee: convLead.formation_souhaitee || '',
        agence_id:           convLead.agence_id || null,
        vendeur_id:          convForm.vendeur_id || convLead.vendeur_id || null,
      });
      await api.patch(`/leads/${convLead.id}/statut`, { statut: 'Converti' });
      setConvLead(null);
      load();
    } catch (e) {
      setConvErr(e.response?.data?.message || 'Erreur lors de la conversion');
    } finally {
      setConvSaving(false);
    }
  }

  async function handleSave() {
    if (!form.nom || !form.telephone) { setErr('Nom et téléphone sont requis'); return; }
    setSaving(true); setErr('');
    try {
      if (editId) {
        await api.patch(`/leads/${editId}`, form);
      } else {
        await api.post('/leads', form);
      }
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  // Changement de statut rapide depuis la liste
  async function handleStatutChange(lead, newStatut) {
    try {
      await api.patch(`/leads/${lead.id}/statut`, { statut: newStatut });
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, statut: newStatut } : l));
    } catch {
      alert('Erreur lors du changement de statut');
    }
  }

  async function handleDelete() {
    if (!editId) return;
    if (!window.confirm('Supprimer définitivement ce lead ? Cette action est irréversible.')) return;
    setDeleting(true); setErr('');
    try {
      await api.delete(`/leads/${editId}`);
      setShowModal(false);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  }

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="page-enter">

      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Leads</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            {leads.length} lead{leads.length > 1 ? 's' : ''} au total
          </p>
        </div>
        <div className="section-actions">
          <div className="search-box">
            <span style={{ fontSize: 13, color: 'var(--txt3)' }}>🔍</span>
            <input
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={openNew}>➕ Nouveau lead</button>
        </div>
      </div>

      {/* Filtres statut */}
      <div className="filters">
        <button className={`filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Tous ({leads.length})
        </button>
        {STATUTS.map((s) => {
          const c = leads.filter((l) => l.statut === s).length;
          if (c === 0) return null;
          return (
            <button
              key={s}
              className={`filter-btn${filter === s ? ' active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s} ({c})
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
                  <th>Nom</th>
                  <th>Téléphone</th>
                  <th>E-mail</th>
                  <th>Formation souhaitée</th>
                  <th>Source</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong style={{ cursor: 'pointer', color: 'var(--brand)' }} onClick={() => openEdit(l)}>
                        {l.prenom ? `${l.prenom} ${l.nom}` : l.nom}
                      </strong>
                    </td>
                    <td>{l.telephone || '—'}</td>
                    <td>{l.email || '—'}</td>
                    <td>{l.formation_souhaitee || '—'}</td>
                    <td>{l.source || '—'}</td>
                    <td>
                      <select
                        className="statut-select"
                        value={l.statut || ''}
                        onChange={(e) => handleStatutChange(l, e.target.value)}
                        style={{
                          border: 'none', background: 'transparent',
                          cursor: 'pointer', fontSize: '.78rem',
                          fontWeight: 600, color: 'inherit',
                          padding: 0,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {STATUTS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td>{l.created_at ? new Date(l.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm" onClick={() => openEdit(l)} title="Modifier">✏️</button>
                        {isAdmin && (
                          <button
                            className="btn btn-sm"
                            onClick={() => setInterPanel(l)}
                            title="Historique des interactions"
                            style={{ fontSize: '.8rem' }}
                          >
                            🕐
                          </button>
                        )}
                        {isAdmin && l.statut !== 'Converti' && (
                          <button
                            className="btn btn-sm"
                            onClick={() => openConvert(l)}
                            title="Convertir en dossier"
                            style={{ fontSize: '.8rem', color: 'var(--green)' }}
                          >
                            📁+
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-text">
              {search || filter !== 'all' ? 'Aucun résultat pour cette recherche' : 'Aucun lead pour le moment'}
            </div>
          </div>
        )}
      </div>

      {/* Panel historique interactions (admin) */}
      {interPanel && (
        <InteractionsPanel lead={interPanel} onClose={() => setInterPanel(null)} />
      )}

      {/* Modal création / édition */}
      <Modal
        open={showModal}
        title={editId ? 'Modifier le lead' : 'Nouveau lead'}
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? 'Enregistrement…' : (editId ? 'Mettre à jour' : 'Enregistrer')}
        loading={saving}
        onSecondary={editId ? handleDelete : undefined}
        secondaryLabel="🗑️ Supprimer"
        secondaryLoading={deleting}
      >
        {err && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠️</span> {err}</div>}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nom *</label>
            <input className="form-input" value={form.nom} onChange={(e) => upd('nom', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Prénom</label>
            <input className="form-input" value={form.prenom} onChange={(e) => upd('prenom', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Téléphone *</label>
            <input className="form-input" value={form.telephone} onChange={(e) => upd('telephone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" value={form.email} onChange={(e) => upd('email', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Formation souhaitée</label>
          <input className="form-input" value={form.formation_souhaitee} onChange={(e) => upd('formation_souhaitee', e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Source</label>
            <select className="form-select" value={form.source} onChange={(e) => upd('source', e.target.value)}>
              <option value="">— Choisir —</option>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Statut</label>
            <select className="form-select" value={form.statut} onChange={(e) => upd('statut', e.target.value)}>
              {STATUTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-input" value={form.notes} onChange={(e) => upd('notes', e.target.value)} />
        </div>
        {isAdmin && (
          <div className="form-group">
            <label className="form-label">Commercial assigné</label>
            <select className="form-select" value={form.vendeur_id || ''} onChange={(e) => upd('vendeur_id', e.target.value ? parseInt(e.target.value) : '')}>
              <option value="">— Non assigné —</option>
              {commerciaux.map(c => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
          </div>
        )}
      </Modal>

      {/* Modal conversion lead → dossier */}
      <Modal
        open={!!convLead}
        title={`Convertir "${convLead?.prenom ? `${convLead.prenom} ${convLead.nom}` : convLead?.nom}" en dossier`}
        onClose={() => setConvLead(null)}
        onConfirm={handleConvert}
        confirmLabel={convSaving ? 'Conversion…' : '📁 Créer le dossier'}
        loading={convSaving}
      >
        <p style={{ fontSize: '.82rem', color: 'var(--txt2)', marginBottom: 12 }}>
          Un dossier sera créé avec les informations du lead. Le lead passera au statut "Converti".
        </p>
        {convErr && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠️</span> {convErr}</div>}
        <div className="form-group">
          <label className="form-label">Commercial assigné</label>
          <select
            className="form-select"
            value={convForm.vendeur_id}
            onChange={(e) => setConvForm(p => ({ ...p, vendeur_id: e.target.value }))}
          >
            <option value="">— Non assigné —</option>
            {commerciaux.map(c => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
