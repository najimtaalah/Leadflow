import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';

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
const SOURCES = ['Site web', 'Réseaux sociaux', 'Bouche à oreille', 'Partenaire', 'Meta Ads', 'Formulaire web', 'Autre'];

const emptyForm = {
  nom: '', prenom: '', telephone: '', email: '',
  formation_souhaitee: '', statut: 'Nouveau lead', source: '', notes: '',
};

// ── Page Accueil agent d'accueil ───────────────────────────────────────────────

export default function Accueil() {
  const [leads, setLeads]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');

  // Modal création
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  async function handleSave() {
    if (!form.nom || !form.telephone) { setErr('Nom et téléphone sont requis'); return; }
    setSaving(true); setErr('');
    try {
      await api.post('/leads', form);
      setShowModal(false);
      setForm(emptyForm);
      setSuccessMsg('Lead créé avec succès ! Il sera assigné automatiquement à un commercial.');
      setTimeout(() => setSuccessMsg(''), 5000);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const countByStatut = STATUTS.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.statut === s).length;
    return acc;
  }, {});

  // KPIs rapides
  const nbAujourdhui = leads.filter((l) => {
    if (!l.created_at) return false;
    const d = new Date(l.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="page-enter">

      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Accueil</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            Enregistrement et suivi des leads
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
          <button
            className="btn-primary"
            style={{ fontSize: '1rem', padding: '10px 20px' }}
            onClick={() => { setForm(emptyForm); setErr(''); setShowModal(true); }}
          >
            ➕ Créer un lead
          </button>
        </div>
      </div>

      {/* Message succès */}
      {successMsg && (
        <div style={{
          background: 'var(--green-dim)', color: 'var(--green)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          fontWeight: 600, fontSize: '.85rem', display: 'flex', gap: 8,
        }}>
          ✅ {successMsg}
        </div>
      )}

      {/* KPIs rapides */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total leads</span>
            <div className="kpi-icon" style={{ background: 'var(--brand-dim)', color: 'var(--brand)' }}>👥</div>
          </div>
          <div className="kpi-value">{leads.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Créés aujourd'hui</span>
            <div className="kpi-icon" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>📥</div>
          </div>
          <div className="kpi-value">{nbAujourdhui}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Convertis</span>
            <div className="kpi-icon" style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}>🎯</div>
          </div>
          <div className="kpi-value">{countByStatut['Converti'] || 0}</div>
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
                  <th>E-mail</th>
                  <th>Formation souhaitée</th>
                  <th>Source</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.prenom ? `${l.prenom} ${l.nom}` : l.nom}</strong>
                    </td>
                    <td>{l.telephone || '—'}</td>
                    <td style={{ fontSize: '.82rem', color: 'var(--txt2)' }}>{l.email || '—'}</td>
                    <td style={{ fontSize: '.82rem', color: 'var(--txt2)' }}>{l.formation_souhaitee || '—'}</td>
                    <td style={{ fontSize: '.82rem', color: 'var(--txt3)' }}>{l.source || '—'}</td>
                    <td>
                      <span className={`badge ${STATUT_COLORS[l.statut] || 'badge-gray'}`}>
                        {l.statut || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: '.8rem', color: 'var(--txt3)' }}>
                      {l.created_at ? new Date(l.created_at).toLocaleDateString('fr-FR') : '—'}
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
              {search || filter !== 'all'
                ? 'Aucun résultat pour cette recherche'
                : 'Aucun lead enregistré — cliquez sur "Créer un lead" pour commencer'}
            </div>
            {!search && filter === 'all' && (
              <button
                className="btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => { setForm(emptyForm); setErr(''); setShowModal(true); }}
              >
                ➕ Créer le premier lead
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal création lead */}
      <Modal
        open={showModal}
        title="Créer un nouveau lead"
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? 'Enregistrement…' : 'Créer le lead'}
        loading={saving}
      >
        {err && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠️</span> {err}</div>}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nom *</label>
            <input className="form-input" value={form.nom} onChange={(e) => upd('nom', e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Prénom</label>
            <input className="form-input" value={form.prenom} onChange={(e) => upd('prenom', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Téléphone *</label>
            <input
              className="form-input"
              value={form.telephone}
              onChange={(e) => upd('telephone', e.target.value)}
              placeholder="06 12 34 56 78"
            />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" value={form.email} onChange={(e) => upd('email', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Formation souhaitée</label>
          <input
            className="form-input"
            value={form.formation_souhaitee}
            onChange={(e) => upd('formation_souhaitee', e.target.value)}
            placeholder="Ex: Développement Web, Marketing Digital…"
          />
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
            <label className="form-label">Statut initial</label>
            <select className="form-select" value={form.statut} onChange={(e) => upd('statut', e.target.value)}>
              {STATUTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input"
            value={form.notes}
            onChange={(e) => upd('notes', e.target.value)}
            placeholder="Informations complémentaires…"
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
}
