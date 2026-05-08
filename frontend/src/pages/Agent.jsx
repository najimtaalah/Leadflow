import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

/* ── Helpers ── */
function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const RESULT_COLORS = {
  admis:      'badge-green',
  echec:      'badge-red',
  en_attente: 'badge-orange',
};
const RESULT_LABELS = {
  admis:      '✅ Admis',
  echec:      '❌ Échec',
  en_attente: '⏳ En attente',
};
const EPREUVE_LABELS = {
  theorie:  '📖 Théorie',
  pratique: '🛠️ Pratique',
};

const FREQ_OPTIONS = [
  { value: '6h',  label: 'Toutes les 6h' },
  { value: '12h', label: 'Toutes les 12h' },
  { value: '24h', label: 'Chaque nuit (24h)' },
];

const TABS = ['tableau_de_bord', 'resultats'];
const TAB_LABELS = {
  tableau_de_bord: '📊 Tableau de bord',
  resultats:       '📋 Résultats CMA',
};

export default function Agent() {
  const user     = useAuthStore((s) => s.user);
  const role     = user?.role || user?.role_nom || '';
  const isAdmin  = ['super_admin', 'role_admin'].includes(role);

  const [activeTab, setActiveTab]   = useState('tableau_de_bord');
  const [status, setStatus]         = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Résultats
  const [resultats, setResultats]   = useState([]);
  const [loadingRes, setLoadingRes] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterResultat, setFilterResultat] = useState('');
  const [search, setSearch]         = useState('');

  // Sync
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState(null);
  const [syncRapport, setSyncRapport] = useState(null);

  // Config
  const [configSaving, setConfigSaving] = useState(false);
  const [configForm, setConfigForm]   = useState({ actif: false, frequence: '24h' });

  /* ── Chargement initial ── */
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const { data } = await api.get('/agent/status');
      setStatus(data.data);
      setConfigForm({
        actif:     data.data?.sync?.actif     ?? false,
        frequence: data.data?.sync?.frequence ?? '24h',
      });
    } catch { /* ignore */ } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadResultats = useCallback(async () => {
    setLoadingRes(true);
    try {
      const params = new URLSearchParams();
      if (filterType)     params.set('type_epreuve', filterType);
      if (filterResultat) params.set('resultat', filterResultat);
      params.set('limit', '200');
      const { data } = await api.get(`/agent/resultats?${params}`);
      setResultats(Array.isArray(data.data) ? data.data : []);
    } catch { /* ignore */ } finally {
      setLoadingRes(false);
    }
  }, [filterType, filterResultat]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => {
    if (activeTab === 'resultats') loadResultats();
  }, [activeTab, loadResultats]);

  /* ── Sync manuelle ── */
  async function handleSync() {
    if (!window.confirm('Lancer la synchronisation CMA maintenant ?')) return;
    setSyncing(true); setSyncMsg(null); setSyncRapport(null);
    try {
      const { data } = await api.post('/agent/sync');
      setSyncMsg({ type: 'success', text: data.message });
      setSyncRapport(data.data);
      loadStatus();
      if (activeTab === 'resultats') loadResultats();
    } catch (e) {
      setSyncMsg({ type: 'error', text: e.response?.data?.message || 'Erreur lors de la synchronisation' });
    } finally {
      setSyncing(false);
    }
  }

  /* ── Sauvegarde config ── */
  async function handleSaveConfig() {
    setConfigSaving(true);
    try {
      await api.patch('/agent/config', configForm);
      loadStatus();
      setSyncMsg({ type: 'success', text: 'Configuration enregistrée.' });
    } catch (e) {
      setSyncMsg({ type: 'error', text: e.response?.data?.message || 'Erreur' });
    } finally {
      setConfigSaving(false);
    }
  }

  /* ── Filtre recherche ── */
  const q = search.toLowerCase();
  const filteredResultats = resultats.filter((r) =>
    !q || `${r.nom} ${r.prenom} ${r.reference || ''} ${r.session_code}`.toLowerCase().includes(q)
  );

  /* ═══════════════════════════ RENDER ═══════════════════════════ */
  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <div className="section-title">🤖 Agent IA — CMA</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            Synchronisation automatique des résultats d'examens CMA + actions intelligentes
          </p>
        </div>
        {isAdmin && (
          <button
            className="btn-primary"
            onClick={handleSync}
            disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {syncing
              ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Synchronisation…</>
              : '🔄 Synchroniser maintenant'}
          </button>
        )}
      </div>

      {/* ── Message résultat sync ── */}
      {syncMsg && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: '.84rem',
          background: syncMsg.type === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
          color:      syncMsg.type === 'success' ? 'var(--green)'     : 'var(--red)',
          border:    `1px solid ${syncMsg.type === 'success' ? 'var(--green)' : 'var(--red)'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{syncMsg.text}</span>
          <button onClick={() => setSyncMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* ── Rapport après sync ── */}
      {syncRapport && (
        <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: '.88rem' }}>📊 Rapport de synchronisation</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {[
              { label: 'Présentés',  value: syncRapport.apprenants_presentes ?? 0, color: 'var(--brand)' },
              { label: 'Trouvés',    value: syncRapport.resultats_trouves    ?? 0, color: 'var(--green)' },
              { label: 'En attente', value: syncRapport.en_attente           ?? 0, color: 'var(--orange)' },
              { label: 'Actions',    value: syncRapport.actions?.length      ?? 0, color: 'var(--purple)' },
              { label: 'Messages',   value: syncRapport.messages_envoyes     ?? 0, color: 'var(--teal)' },
              { label: 'Erreurs',    value: syncRapport.erreurs?.length      ?? 0, color: 'var(--red)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '.7rem', color: 'var(--txt3)' }}>{label}</div>
                <div style={{ fontWeight: 700, color, fontSize: '1.1rem' }}>{value}</div>
              </div>
            ))}
          </div>
          {syncRapport.actions?.length > 0 && (
            <div style={{ marginTop: 12, fontSize: '.78rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>Actions déclenchées :</div>
              {syncRapport.actions.map((a, i) => (
                <div key={i} style={{ color: 'var(--txt2)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong>{a.apprenant}</strong> — {a.type.replace(/_/g, ' ')}
                  {a.detail && <span style={{ color: 'var(--txt3)', marginLeft: 8 }}>{a.detail}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tab-nav">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab-btn${activeTab === t ? ' active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════
          TAB : Tableau de bord
      ════════════════════════════════════ */}
      {activeTab === 'tableau_de_bord' && (
        loadingStatus ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : (
          <div>
            {/* Bandeau statut CMA */}
            <div style={{ marginBottom: 20 }}>
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--txt3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Portail CMA
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: '.8rem', fontWeight: 700,
                    background: status?.cma?.is_simulation ? 'var(--orange-dim)' : 'var(--green-dim)',
                    color:      status?.cma?.is_simulation ? 'var(--orange)'     : 'var(--green)',
                  }}>
                    {status?.cma?.mode_label || '—'}
                  </span>
                </div>
                {status?.cma?.is_simulation && (
                  <p style={{ fontSize: '.72rem', color: 'var(--txt3)', marginTop: 8 }}>
                    Ajoutez <code>CMA_BASE_URL</code>, <code>CMA_LOGIN</code>, <code>CMA_PASSWORD</code> dans <code>.env</code> pour le mode réel.
                  </p>
                )}
              </div>
            </div>

            {/* KPIs résultats */}
            <div className="grid-4" style={{ marginBottom: 20 }}>
              {[
                { label: 'Total résultats',   value: fmt(status?.stats?.total),       color: 'blue',   icon: '📋' },
                { label: 'Admis',             value: fmt(status?.stats?.admis),       color: 'green',  icon: '✅' },
                { label: 'Échecs',            value: fmt(status?.stats?.echecs),      color: 'red',    icon: '❌' },
                { label: 'Actions déclenchées', value: fmt(status?.stats?.actions_declenchees), color: 'orange', icon: '⚡' },
              ].map(({ label, value, color, icon }) => (
                <div key={label} className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-label">{label}</span>
                    <div className="kpi-icon" style={{
                      background: `var(--${color}-dim)`,
                      color:      `var(--${color})`,
                    }}>{icon}</div>
                  </div>
                  <div className="kpi-value">{value}</div>
                  {label === 'Total résultats' && status?.stats?.derniere_sync && (
                    <div className="kpi-delta delta-nt" style={{ fontSize: '.7rem' }}>
                      Dernière sync : {fmtDate(status.stats.derniere_sync)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Config sync auto */}
            {isAdmin && (
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ fontWeight: 700, marginBottom: 14, fontSize: '.92rem' }}>
                  ⚙️ Configuration synchronisation automatique
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ margin: 0, minWidth: 200 }}>
                    <label className="form-label">Fréquence</label>
                    <select
                      className="form-select"
                      value={configForm.frequence}
                      onChange={(e) => setConfigForm((p) => ({ ...p, frequence: e.target.value }))}
                    >
                      {FREQ_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.85rem' }}>
                      <input
                        type="checkbox"
                        checked={!!configForm.actif}
                        onChange={(e) => setConfigForm((p) => ({ ...p, actif: e.target.checked }))}
                      />
                      Sync automatique activée
                    </label>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={handleSaveConfig}
                    disabled={configSaving}
                    style={{ fontSize: '.82rem' }}
                  >
                    {configSaving ? '⏳ Enregistrement…' : '💾 Enregistrer'}
                  </button>
                </div>
                <div style={{ marginTop: 12, fontSize: '.75rem', color: 'var(--txt3)' }}>
                  Dernière sync : <strong>{fmtDate(status?.sync?.derniere_sync)}</strong>
                  {status?.sync?.nb_trouves != null && (
                    <> · {status.sync.nb_trouves} résultats · {status.sync.nb_messages_envoyes} messages envoyés</>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ════════════════════════════════════
          TAB : Résultats CMA
      ════════════════════════════════════ */}
      {activeTab === 'resultats' && (
        <div className="card" style={{ padding: 0 }}>
          {/* Filtres */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-box">
              <span style={{ fontSize: 13, color: 'var(--txt3)' }}>🔍</span>
              <input placeholder="Rechercher apprenant, session…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ width: 'auto', fontSize: '.8rem' }}
              value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Toutes épreuves</option>
              <option value="theorie">Théorie</option>
              <option value="pratique">Pratique</option>
            </select>
            <select className="form-select" style={{ width: 'auto', fontSize: '.8rem' }}
              value={filterResultat} onChange={(e) => setFilterResultat(e.target.value)}>
              <option value="">Tous résultats</option>
              <option value="admis">Admis</option>
              <option value="echec">Échec</option>
              <option value="en_attente">En attente</option>
            </select>
            <span style={{ fontSize: '.78rem', color: 'var(--txt3)', marginLeft: 'auto' }}>
              {filteredResultats.length} résultat(s)
            </span>
          </div>

          {loadingRes ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : filteredResultats.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Apprenant</th>
                    <th>Formation</th>
                    <th>Session</th>
                    <th>Épreuve</th>
                    <th>Note</th>
                    <th>Résultat</th>
                    <th>Action auto</th>
                    <th>Synced</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResultats.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.prenom} {r.nom}</strong>
                        {r.reference && <div style={{ fontSize: '.72rem', color: 'var(--txt3)' }}>{r.reference}</div>}
                      </td>
                      <td style={{ fontSize: '.8rem' }}>{r.formation_souhaitee || '—'}</td>
                      <td>
                        <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontSize: '.72rem' }}>
                          {r.session_code}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-gray">{EPREUVE_LABELS[r.type_epreuve] || r.type_epreuve}</span>
                      </td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>
                        {r.note != null ? `${r.note}/20` : '—'}
                      </td>
                      <td>
                        <span className={`badge ${RESULT_COLORS[r.resultat] || 'badge-gray'}`}>
                          {RESULT_LABELS[r.resultat] || r.resultat}
                        </span>
                      </td>
                      <td style={{ fontSize: '.75rem', color: 'var(--txt3)' }}>
                        {r.action_auto || <span style={{ opacity: .4 }}>—</span>}
                      </td>
                      <td style={{ fontSize: '.72rem', color: 'var(--txt3)' }}>
                        {r.synced_at ? new Date(r.synced_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                        <div style={{ fontSize: '.65rem', marginTop: 2 }}>
                          <span className={`badge ${r.sync_source === 'simulation' ? 'badge-orange' : 'badge-green'}`} style={{ fontSize: '.65rem' }}>
                            {r.sync_source}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">
                {search || filterType || filterResultat ? 'Aucun résultat correspondant' : 'Aucun résultat synchronisé'}
              </div>
              {!search && !filterType && !filterResultat && isAdmin && (
                <button className="btn-primary" style={{ marginTop: 12, fontSize: '.8rem' }} onClick={handleSync} disabled={syncing}>
                  {syncing ? '⏳ Synchronisation…' : '🔄 Lancer une synchronisation'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
