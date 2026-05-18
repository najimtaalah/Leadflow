import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

const TYPE_LABELS = {
  CPF:           'CPF',
  FRANCE_TRAVAIL:'France Travail',
  OPCO:          'OPCO',
  PERSONNEL:     'Personnel',
};

const STATUT_LABELS = {
  a_facturer: 'À facturer',
  facture:    'Facturé',
  paye:       'Payé',
  litige:     'Litige',
  rembourse:  'Remboursé',
  annule:     'Annulé',
};

const STATUT_COLORS = {
  a_facturer: '#6b7280',
  facture:    '#3b82f6',
  paye:       '#16a34a',
  litige:     '#f97316',
  rembourse:  '#7c3aed',
  annule:     '#ef4444',
};

function fmtCurrency(v) {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

const TABS = ['liste', 'exports'];
const TAB_LABELS = { liste: '📄 Dossiers facturables', exports: '⬇️ Exports comptables' };

export default function Facturation() {
  const user    = useAuthStore((s) => s.user);
  const role    = user?.role_nom || user?.role || '';
  const isAdmin = ['super_admin', 'role_admin'].includes(role);

  const [tab, setTab]                 = useState('liste');
  const [rows, setRows]               = useState([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const [page, setPage]               = useState(0);
  const LIMIT = 50;

  // Filtres
  const [filtStatuts, setFiltStatuts]     = useState('');
  const [filtType, setFiltType]           = useState('');
  const [filtDateDebFact, setFiltDateDebFact] = useState('');
  const [filtDateFinFact, setFiltDateFinFact] = useState('');

  // Exports
  const [expMois, setExpMois]             = useState(new Date().getMonth() + 1);
  const [expAnnee, setExpAnnee]           = useState(new Date().getFullYear());
  const [exporting, setExporting]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: page * LIMIT });
      if (filtStatuts)    params.append('statuts', filtStatuts);
      if (filtType)       params.append('type_financement', filtType);
      if (filtDateDebFact) params.append('date_facturation_debut', filtDateDebFact);
      if (filtDateFinFact) params.append('date_facturation_fin', filtDateFinFact);

      const { data } = await api.get(`/facturation?${params}`);
      setRows(data.financements || []);
      setTotal(data.total || 0);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [page, filtStatuts, filtType, filtDateDebFact, filtDateFinFact]);

  useEffect(() => { if (tab === 'liste') load(); }, [tab, load]);

  async function downloadExport(url, filename) {
    setExporting(true);
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const href = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = href; a.download = filename; a.click();
      URL.revokeObjectURL(href);
    } catch (e) { alert('Erreur export : ' + (e.response?.data?.message || e.message)); }
    finally { setExporting(false); }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Facturation</h1>
      </div>

      {/* Onglets */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.filter(t => t !== 'exports' || isAdmin).map(t => (
          <button
            key={t}
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── Liste dossiers ── */}
      {tab === 'liste' && (
        <>
          {/* Filtres */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <select value={filtStatuts} onChange={(e) => { setFiltStatuts(e.target.value); setPage(0); }}>
              <option value="">Tous statuts</option>
              {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filtType} onChange={(e) => { setFiltType(e.target.value); setPage(0); }}>
              <option value="">Tous types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" value={filtDateDebFact} onChange={(e) => { setFiltDateDebFact(e.target.value); setPage(0); }} placeholder="Fact. depuis" title="Date facturation depuis" />
            <input type="date" value={filtDateFinFact} onChange={(e) => { setFiltDateFinFact(e.target.value); setPage(0); }} placeholder="Fact. jusqu'au" title="Date facturation jusqu'au" />
            <button className="btn btn-sm btn-secondary" onClick={() => { setFiltStatuts(''); setFiltType(''); setFiltDateDebFact(''); setFiltDateFinFact(''); setPage(0); }}>Réinitialiser</button>
          </div>

          {loading ? (
            <div className="loading-state">Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="empty-state">Aucun dossier facturé — modifiez vos filtres</div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dossier</th>
                      <th>Formation</th>
                      <th>Type financement</th>
                      <th>Organisme</th>
                      <th>Montant total</th>
                      <th>Pris en charge</th>
                      <th>Reste à charge</th>
                      <th>Statut</th>
                      <th>Date fact.</th>
                      <th>Date paiement</th>
                      <th>Commercial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.dossier_id}>
                        <td><strong>{r.reference}</strong><br /><small>{r.prenom} {r.nom}</small></td>
                        <td>{r.formation_souhaitee || '—'}</td>
                        <td><span className="badge" style={{ background: '#f3f4f6' }}>{TYPE_LABELS[r.type_financement] || r.type_financement}</span></td>
                        <td>{r.nom_organisme || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{fmtCurrency(r.montant_total)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtCurrency(r.montant_pris_en_charge)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {parseFloat(r.reste_a_charge) > 0
                            ? <span className="badge badge-orange">{fmtCurrency(r.reste_a_charge)}</span>
                            : fmtCurrency(r.reste_a_charge)}
                        </td>
                        <td>
                          {r.statut_facturation
                            ? <span className="badge" style={{ background: STATUT_COLORS[r.statut_facturation] + '22', color: STATUT_COLORS[r.statut_facturation] }}>
                                {STATUT_LABELS[r.statut_facturation]}
                              </span>
                            : '—'}
                        </td>
                        <td>{fmtDate(r.date_facturation)}</td>
                        <td>{fmtDate(r.date_paiement)}</td>
                        <td>{r.commercial_nom || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
                <span style={{ color: '#6b7280' }}>{total} dossier(s)</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Précédent</button>
                  <span style={{ padding: '4px 8px' }}>Page {page + 1} / {Math.ceil(total / LIMIT) || 1}</span>
                  <button className="btn btn-sm btn-secondary" disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(p => p + 1)}>Suivant →</button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Exports comptables ── */}
      {tab === 'exports' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>

          {/* Export 1 — Dossiers facturables */}
          <section className="card" style={{ padding: 16 }}>
            <h4 style={{ marginTop: 0 }}>Export dossiers facturables (CSV)</h4>
            <p style={{ color: '#6b7280', fontSize: '0.9em' }}>Tous les dossiers À facturer et Facturés, avec identifiants financeurs et montants.</p>
            <button
              className="btn btn-primary btn-sm"
              disabled={exporting}
              onClick={() => downloadExport(
                `/facturation/export/dossiers-facturables?statuts=a_facturer,facture`,
                `export_dossiers_facturables_${new Date().toISOString().split('T')[0].replace(/-/g,'')}.csv`
              )}
            >
              {exporting ? 'Génération…' : '⬇️ Télécharger'}
            </button>
          </section>

          {/* Export 2 — Rapport mensuel */}
          <section className="card" style={{ padding: 16 }}>
            <h4 style={{ marginTop: 0 }}>Rapport mensuel (CSV)</h4>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <label>
                Mois&nbsp;
                <select value={expMois} onChange={(e) => setExpMois(parseInt(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('fr-FR', { month: 'long' })}</option>
                  ))}
                </select>
              </label>
              <label>
                Année&nbsp;
                <input type="number" value={expAnnee} onChange={(e) => setExpAnnee(parseInt(e.target.value))} style={{ width: 90 }} min="2020" max="2099" />
              </label>
            </div>
            <button
              className="btn btn-primary btn-sm"
              disabled={exporting}
              onClick={() => downloadExport(
                `/facturation/export/rapport-mensuel?mois=${expMois}&annee=${expAnnee}`,
                `rapport_mensuel_${expAnnee}${String(expMois).padStart(2,'0')}.csv`
              )}
            >
              {exporting ? 'Génération…' : '⬇️ Télécharger'}
            </button>
          </section>

        </div>
      )}
    </div>
  );
}
