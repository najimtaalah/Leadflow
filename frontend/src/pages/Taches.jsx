import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

const STATUTS = ['en_attente', 'en_cours', 'fait', 'incomplet'];

const STATUT_LABELS = {
  en_attente: 'En attente',
  en_cours:   'En cours',
  fait:       'Fait',
  incomplet:  'Incomplet',
};

const STATUT_COLORS = {
  en_attente: 'badge-gray',
  en_cours:   'badge-blue',
  fait:       'badge-green',
  incomplet:  'badge-red',
};

// Regrouper les tâches par étape CMA
const ETAPES_CMA = [
  { type: 'affecter_session_edof',  label: 'Session EDOF',    icon: '🏛️' },
  { type: 'affecter_session_cours', label: 'Session Cours',   icon: '📚' },
  { type: 'affecter_examen',        label: 'Examen',          icon: '📝' },
  { type: 'creation_espace_cma',    label: 'Espace CMA',      icon: '💻' },
  { type: 'depot_dossier_cma',      label: 'Dépôt dossier',   icon: '📤' },
  { type: 'paiement_examen_cma',    label: 'Paiement examen', icon: '💳' },
];

export default function Taches() {
  const { user } = useAuthStore();
  const role    = user?.role || user?.role_nom || '';
  const isAdmin = ['super_admin', 'role_admin', 'role_administratif'].includes(role);

  const [taches, setTaches]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filterStatut, setFilterStatut] = useState('');
  const [filterType, setFilterType]     = useState('');
  const [search, setSearch]     = useState('');
  const [saving, setSaving]     = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatut) params.set('statut', filterStatut);
      const { data } = await api.get(`/taches?${params}`);
      setTaches(Array.isArray(data) ? data : data.data || []);
    } catch {
      setTaches([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatut]);

  useEffect(() => { load(); }, [load]);

  async function updateStatut(tache, newStatut) {
    setSaving(p => ({ ...p, [tache.id]: true }));
    try {
      await api.patch(`/taches/${tache.id}`, { statut: newStatut });
      setTaches(prev => prev.map(t => t.id === tache.id ? { ...t, statut: newStatut } : t));
    } catch {
      alert('Erreur lors de la mise à jour');
    } finally {
      setSaving(p => ({ ...p, [tache.id]: false }));
    }
  }

  // Filtrage frontend
  const displayed = taches.filter(t => {
    const matchType = !filterType || t.type === filterType;
    const q = search.toLowerCase();
    const matchSearch = !q || [t.titre, t.dossier_nom, t.dossier_prenom, t.reference]
      .join(' ').toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  // Compteurs par statut
  const counts = STATUTS.reduce((acc, s) => {
    acc[s] = taches.filter(t => t.statut === s).length;
    return acc;
  }, {});

  return (
    <div className="page-enter">

      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Tâches CMA</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            Suivi du workflow par dossier
          </p>
        </div>
        <div className="section-actions">
          <div className="search-box">
            <span style={{ fontSize: 13, color: 'var(--txt3)' }}>🔍</span>
            <input
              placeholder="Rechercher dossier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* KPI statuts */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUTS.map(s => (
          <div
            key={s}
            onClick={() => setFilterStatut(filterStatut === s ? '' : s)}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              background: filterStatut === s ? 'var(--brand-dim)' : 'var(--surface2)',
              border: `1px solid ${filterStatut === s ? 'var(--brand)' : 'var(--border)'}`,
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 2 }}>
              {STATUT_LABELS[s]}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: filterStatut === s ? 'var(--brand)' : 'var(--txt)' }}>
              {counts[s] || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Filtres type d'étape */}
      <div className="filters" style={{ marginBottom: 16 }}>
        <button
          className={`filter-btn${!filterType ? ' active' : ''}`}
          onClick={() => setFilterType('')}
        >
          Toutes les étapes
        </button>
        {ETAPES_CMA.map(e => (
          <button
            key={e.type}
            className={`filter-btn${filterType === e.type ? ' active' : ''}`}
            onClick={() => setFilterType(filterType === e.type ? '' : e.type)}
          >
            {e.icon} {e.label}
          </button>
        ))}
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
                  <th>Dossier</th>
                  <th>Étape</th>
                  <th>Statut</th>
                  <th>Assigné à</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(t => {
                  const etape = ETAPES_CMA.find(e => e.type === t.type);
                  return (
                    <tr key={t.id} style={{
                      opacity: t.statut === 'fait' ? 0.65 : 1,
                    }}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '.85rem' }}>
                          {t.dossier_prenom ? `${t.dossier_prenom} ${t.dossier_nom}` : t.dossier_nom || '—'}
                        </div>
                        {t.reference && (
                          <div style={{ fontSize: '.73rem', color: 'var(--txt3)' }}>{t.reference}</div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '.82rem' }}>
                          {etape ? `${etape.icon} ${etape.label}` : t.titre}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${STATUT_COLORS[t.statut]}`}>
                          {STATUT_LABELS[t.statut]}
                        </span>
                      </td>
                      <td style={{ fontSize: '.8rem', color: 'var(--txt2)' }}>
                        {t.assigned_nom || '—'}
                      </td>
                      <td>
                        <select
                          className="form-select"
                          style={{ fontSize: '.78rem', padding: '3px 8px', width: 'auto' }}
                          value={t.statut}
                          disabled={saving[t.id]}
                          onChange={(e) => updateStatut(t, e.target.value)}
                        >
                          {STATUTS.map(s => (
                            <option key={s} value={s}>{STATUT_LABELS[s]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-text">
              {filterStatut || filterType || search
                ? 'Aucune tâche pour ce filtre'
                : 'Aucune tâche — créez un dossier pour démarrer le workflow'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
