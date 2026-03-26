import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import useAuthStore from '../store/authStore';

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUTS = ['Nouveau lead', 'Contacté', 'Intéressé', 'En cours', 'Dossier monté', 'Converti', 'Perdu'];
const STATUT_COLORS = {
  'Nouveau lead':  'badge-gray',
  'Contacté':      'badge-blue',
  'Intéressé':     'badge-purple',
  'En cours':      'badge-orange',
  'Dossier monté': 'badge-teal',
  'Converti':      'badge-green',
  'Perdu':         'badge-red',
};
const SOURCES = ['Site web', 'Réseaux sociaux', 'Bouche à oreille', 'Partenaire', 'Meta Ads', 'Autre'];

const TYPE_ICONS = { appel: '📞', sms: '💬', email: '📧', rdv: '📅', note: '📝' };
const TYPE_LABELS = { appel: 'Appel', sms: 'SMS', email: 'Email', rdv: 'RDV', note: 'Note' };

const emptyForm = {
  nom: '', prenom: '', telephone: '', email: '',
  formation_souhaitee: '', statut: 'Nouveau lead', source: '', notes: '',
};

// ── Panel slide-in détail lead ─────────────────────────────────────────────────

function LeadPanel({ lead, onClose, onStatutChange }) {
  const [interactions, setInteractions] = useState([]);
  const [loadingInter, setLoadingInter] = useState(true);

  useEffect(() => {
    if (!lead) return;
    setLoadingInter(true);
    api.get(`/leads/${lead.id}/interactions`)
      .then(r => setInteractions(r.data?.data || []))
      .catch(() => setInteractions([]))
      .finally(() => setLoadingInter(false));
  }, [lead]);

  if (!lead) return null;

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
          zIndex: 200, cursor: 'pointer',
        }}
        onClick={onClose}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, width: 420, height: '100vh',
        background: 'var(--bg)', zIndex: 201, overflow: 'auto',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header panel */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>
              {lead.prenom ? `${lead.prenom} ${lead.nom}` : lead.nom}
            </div>
            <div style={{ fontSize: '.82rem', color: 'var(--txt3)' }}>{lead.formation_souhaitee || 'Formation non renseignée'}</div>
            <span className={`badge ${STATUT_COLORS[lead.statut] || 'badge-gray'}`} style={{ marginTop: 6, display: 'inline-block' }}>
              {lead.statut || '—'}
            </span>
          </div>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Infos lead */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '.82rem' }}>
            <div>
              <div style={{ color: 'var(--txt3)', marginBottom: 2 }}>Téléphone</div>
              <div style={{ fontWeight: 600 }}>{lead.telephone || '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--txt3)', marginBottom: 2 }}>Email</div>
              <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{lead.email || '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--txt3)', marginBottom: 2 }}>Source</div>
              <div>{lead.source || '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--txt3)', marginBottom: 2 }}>Date</div>
              <div>{lead.created_at ? new Date(lead.created_at).toLocaleDateString('fr-FR') : '—'}</div>
            </div>
          </div>
          {lead.notes && (
            <div style={{ marginTop: 10, padding: 10, background: 'var(--bg2)', borderRadius: 6, fontSize: '.8rem', color: 'var(--txt2)' }}>
              {lead.notes}
            </div>
          )}
        </div>

        {/* Actions rapides */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '.78rem', color: 'var(--txt3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Actions rapides
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <CallButton lead={lead} label="📞 Appel" onInteraction={() => {
              api.get(`/leads/${lead.id}/interactions`)
                .then(r => setInteractions(r.data?.data || []))
                .catch(() => {});
            }} />
            <SmsButton lead={lead} label="💬 SMS" onInteraction={() => {
              api.get(`/leads/${lead.id}/interactions`)
                .then(r => setInteractions(r.data?.data || []))
                .catch(() => {});
            }} />
          </div>
        </div>

        {/* Changer statut */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '.78rem', color: 'var(--txt3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Statut
          </div>
          <select
            className="form-select"
            style={{ width: '100%' }}
            value={lead.statut || ''}
            onChange={(e) => onStatutChange(lead, e.target.value)}
          >
            {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Historique interactions */}
        <div style={{ padding: '14px 20px', flex: 1 }}>
          <div style={{ fontSize: '.78rem', color: 'var(--txt3)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Historique des interactions
          </div>
          {loadingInter ? (
            <div className="spinner-wrap" style={{ padding: 20 }}><div className="spinner" /></div>
          ) : interactions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {interactions.map((inter) => (
                <div key={inter.id} style={{
                  background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: '1.1rem' }}>{TYPE_ICONS[inter.type] || '📋'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: '.82rem' }}>{TYPE_LABELS[inter.type] || inter.type}</span>
                      <span style={{ fontSize: '.75rem', color: 'var(--txt3)' }}>
                        {inter.created_at ? new Date(inter.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                    {inter.contenu && (
                      <div style={{ fontSize: '.78rem', color: 'var(--txt2)' }}>{inter.contenu}</div>
                    )}
                    {inter.fait_par && (
                      <div style={{ fontSize: '.75rem', color: 'var(--txt3)', marginTop: 2 }}>par {inter.fait_par}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--txt3)', fontSize: '.82rem', textAlign: 'center', padding: 20 }}>
              Aucune interaction enregistrée
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Bouton Appel (tel:) ────────────────────────────────────────────────────────

function CallButton({ lead, label = '📞', onInteraction, compact = false }) {
  function handleClick(e) {
    // Log l'interaction immédiatement (en arrière-plan)
    api.post(`/leads/${lead.id}/interactions`, {
      type: 'appel',
      contenu: 'Appel sortant',
    }).then(() => { if (onInteraction) onInteraction(); }).catch(() => {});
  }

  const tel = lead.telephone ? lead.telephone.replace(/\s/g, '') : '';
  if (!tel) return null;

  return (
    <a
      href={`tel:${tel}`}
      className="btn btn-sm"
      style={{ background: 'var(--green-dim)', color: 'var(--green)', textDecoration: 'none', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      onClick={handleClick}
      title={`Appeler ${tel}`}
    >
      {label}
    </a>
  );
}

// ── Bouton SMS (sms:) ──────────────────────────────────────────────────────────

function SmsButton({ lead, label = '💬', onInteraction, compact = false }) {
  function handleClick(e) {
    // Log l'interaction immédiatement (en arrière-plan)
    api.post(`/leads/${lead.id}/interactions`, {
      type: 'sms',
      contenu: 'SMS sortant',
    }).then(() => { if (onInteraction) onInteraction(); }).catch(() => {});
  }

  const tel = lead.telephone ? lead.telephone.replace(/\s/g, '') : '';
  if (!tel) return null;

  const nom = lead.prenom ? `${lead.prenom} ${lead.nom}` : lead.nom;
  const body = encodeURIComponent(`Bonjour ${nom || ''}, `);

  return (
    <a
      href={`sms:${tel}?body=${body}`}
      className="btn btn-sm"
      style={{ background: 'var(--brand-dim)', color: 'var(--brand)', textDecoration: 'none', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      onClick={handleClick}
      title={`Envoyer un SMS à ${tel}`}
    >
      {label}
    </a>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MesLeads() {
  const { user } = useAuthStore();
  const role     = user?.role || user?.role_nom || '';
  const isManager = role === 'manager';

  const [leads, setLeads]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');

  // Modal création
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  // Panel slide-in
  const [panelLead, setPanelLead] = useState(null);

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

  useEffect(() => { load(); }, [load]);

  const displayed = leads.filter((l) => {
    const matchStatus = filter === 'all' || l.statut === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      `${l.nom} ${l.prenom} ${l.telephone} ${l.email} ${l.formation_souhaitee}`.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  async function handleStatutChange(lead, newStatut) {
    try {
      await api.patch(`/leads/${lead.id}/statut`, { statut: newStatut });
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, statut: newStatut } : l));
      if (panelLead?.id === lead.id) setPanelLead((p) => ({ ...p, statut: newStatut }));
    } catch {
      alert('Erreur lors du changement de statut');
    }
  }

  async function handleSave() {
    if (!form.nom || !form.telephone) { setErr('Nom et téléphone sont requis'); return; }
    setSaving(true); setErr('');
    try {
      await api.post('/leads', form);
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Nombre de leads par statut pour les badges
  const countByStatut = STATUTS.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.statut === s).length;
    return acc;
  }, {});

  return (
    <div className="page-enter">

      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Mes Leads</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            {leads.length} lead{leads.length !== 1 ? 's' : ''} assigné{leads.length !== 1 ? 's' : ''}
            {isManager && ' — vue manager (agence)'}
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
          <button className="btn-primary" onClick={() => { setForm(emptyForm); setErr(''); setShowModal(true); }}>
            ➕ Nouveau lead
          </button>
        </div>
      </div>

      {/* Filtres statut */}
      <div className="filters">
        <button className={`filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Tous ({leads.length})
        </button>
        {STATUTS.map((s) => {
          const c = countByStatut[s] || 0;
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
                  <th>Formation souhaitée</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'center' }}>Contacter</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--brand)' }} onClick={() => setPanelLead(l)}>
                        {l.prenom ? `${l.prenom} ${l.nom}` : l.nom}
                      </div>
                      {l.email && <div style={{ fontSize: '.75rem', color: 'var(--txt3)' }}>{l.email}</div>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{l.telephone || '—'}</td>
                    <td style={{ color: 'var(--txt2)', fontSize: '.82rem' }}>{l.formation_souhaitee || '—'}</td>
                    <td>
                      <select
                        className="statut-select"
                        value={l.statut || ''}
                        onChange={(e) => handleStatutChange(l, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '.78rem', fontWeight: 600, color: 'inherit', padding: 0 }}
                      >
                        {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ color: 'var(--txt3)', fontSize: '.8rem' }}>
                      {l.created_at ? new Date(l.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <CallButton lead={l} label="📞" onInteraction={load} />
                        <SmsButton  lead={l} label="💬" onInteraction={load} />
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => setPanelLead(l)}
                        title="Voir la fiche"
                        style={{ fontSize: '1rem' }}
                      >
                        👁
                      </button>
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

      {/* Panel slide-in fiche lead */}
      {panelLead && (
        <LeadPanel
          lead={panelLead}
          onClose={() => setPanelLead(null)}
          onStatutChange={handleStatutChange}
        />
      )}

      {/* Modal création lead */}
      <Modal
        open={showModal}
        title="Nouveau lead"
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? 'Enregistrement…' : 'Enregistrer'}
        loading={saving}
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
      </Modal>
    </div>
  );
}
