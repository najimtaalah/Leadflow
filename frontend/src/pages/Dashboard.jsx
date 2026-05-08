import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

/* ── helpers ────────────────────────────────────────────────────────────────── */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}
function todayFr() {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}
function formatHeure(h) { return h ? h.slice(0, 5) : ''; }
function formatEur(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
}

/* ── KPI card ───────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, icon, color = 'blue', sub, alert }) {
  const colorMap = {
    blue:   { bg: 'var(--brand-dim)',   fg: 'var(--brand)' },
    green:  { bg: 'var(--green-dim)',   fg: 'var(--green)' },
    orange: { bg: 'var(--orange-dim)',  fg: 'var(--orange)' },
    purple: { bg: 'var(--purple-dim)',  fg: 'var(--purple)' },
    red:    { bg: '#fef2f2',            fg: '#ef4444' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className="kpi-card" style={alert ? { borderLeft: '3px solid #ef4444' } : {}}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <div className="kpi-icon" style={{ background: c.bg, color: c.fg }}>{icon}</div>
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-delta delta-nt">{sub}</div>}
    </div>
  );
}

/* ── Badges ─────────────────────────────────────────────────────────────────── */
const STATUT_COLORS = {
  'Nouveau lead': 'badge-gray', 'Contacté': 'badge-blue',
  'Intéressé': 'badge-purple', 'En cours': 'badge-orange',
  'Dossier monté': 'badge-teal', 'Converti': 'badge-green', 'Perdu': 'badge-red',
};
const RDV_TYPE_COLORS = { commercial: 'badge-blue', administratif: 'badge-purple', interne: 'badge-teal' };
const SESSION_TYPE = {
  cours:  { label: 'Cours',  badge: 'badge-blue' },
  edof:   { label: 'EDOF',   badge: 'badge-purple' },
  examen: { label: 'Examen', badge: 'badge-orange' },
};

/* ════════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const user     = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const role     = user?.role_nom || '';

  const isAdmin      = ['super_admin', 'role_admin'].includes(role);
  const isAdminOrAdm = ['super_admin', 'role_admin', 'role_administratif'].includes(role);

  // ── Onglet actif ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState('perf');

  // ── Tab 1 : Performance Commerciale ──────────────────────────────────────
  const [perfData,    setPerfData]    = useState(null);
  const [leads,       setLeads]       = useState([]);
  const [rdvs,        setRdvs]        = useState([]);
  const [loadingPerf, setLoadingPerf] = useState(true);

  // ── Tab 2 : Gestion Dossiers ──────────────────────────────────────────────
  const [gestionKpis, setGestionKpis] = useState(null);
  const [sessions,    setSessions]    = useState([]);
  const [loadingGest, setLoadingGest] = useState(false);
  const [gestFetched, setGestFetched] = useState(false);

  // ── Tab 3 : Finance ───────────────────────────────────────────────────────
  const [finData,     setFinData]     = useState(null);
  const [loadingFin,  setLoadingFin]  = useState(false);
  const [finFetched,  setFinFetched]  = useState(false);

  // ── Tab 4 : Gestionnaire (role_administratif) ─────────────────────────────
  const [gestRetards,    setGestRetards]    = useState([]);
  const [gestEcheances,  setGestEcheances]  = useState([]);
  const [loadingGestAdm, setLoadingGestAdm] = useState(false);
  const [gestAdmFetched, setGestAdmFetched] = useState(false);
  const [gestRelancing,  setGestRelancing]  = useState(null);
  const [gestLancingPrel, setGestLancingPrel] = useState(null); // echeance_id en cours
  const [gestPrelMsg,    setGestPrelMsg]    = useState(null);   // { type, text }

  /* ── Fetch tab Performance (par défaut au montage) ─────────────────────── */
  const fetchPerf = useCallback(() => {
    setLoadingPerf(true);
    const today = new Date().toISOString().split('T')[0];
    const in7d  = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];

    Promise.all([
      api.get('/reporting/performance').catch(() => null),
      api.get('/leads').catch(() => ({ data: [] })),
      api.get(`/agenda?date_debut=${today}&date_fin=${in7d}&statut=planifie,confirme,en_attente&limit=10`).catch(() => ({ data: [] })),
    ]).then(([perf, leadsRes, rdvRes]) => {
      setPerfData(perf?.data?.data || null);
      const list = Array.isArray(leadsRes.data) ? leadsRes.data : leadsRes.data?.leads || [];
      setLeads(list.slice(0, 6));
      setRdvs(Array.isArray(rdvRes.data?.data) ? rdvRes.data.data : (Array.isArray(rdvRes.data) ? rdvRes.data : []));
    }).finally(() => setLoadingPerf(false));
  }, []);

  /* ── Fetch tab Gestion (lazy) ───────────────────────────────────────────── */
  const fetchGestion = useCallback(() => {
    if (gestFetched) return;
    setLoadingGest(true);
    Promise.all([
      api.get('/reporting/kpis-gestion').catch(() => null),
      api.get('/parametrage/sessions?actif=1').catch(() => ({ data: [] })),
    ]).then(([gRes, sessRes]) => {
      setGestionKpis(gRes?.data?.data || null);
      const list = Array.isArray(sessRes.data) ? sessRes.data : sessRes.data?.data || [];
      setSessions([...list].sort((a, b) => new Date(a.date_debut) - new Date(b.date_debut)).slice(0, 6));
      setGestFetched(true);
    }).finally(() => setLoadingGest(false));
  }, [gestFetched]);

  /* ── Fetch tab Finance (lazy) ───────────────────────────────────────────── */
  const fetchFinance = useCallback(() => {
    if (finFetched) return;
    setLoadingFin(true);
    api.get('/reporting/point-financier')
      .then(({ data }) => { setFinData(data?.data || null); setFinFetched(true); })
      .catch(() => setFinData(null))
      .finally(() => setLoadingFin(false));
  }, [finFetched]);

  /* ── Fetch tab Gestionnaire admin (lazy) ───────────────────────────────── */
  const fetchGestionnaireAdm = useCallback(() => {
    if (gestAdmFetched) return;
    setLoadingGestAdm(true);
    Promise.all([
      api.get('/finance/retards').catch(() => ({ data: { data: [] } })),
      api.get('/prelevements/echeances-dues?tous=1').catch(() => ({ data: { data: [] } })),
    ]).then(([retRes, echRes]) => {
      setGestRetards(Array.isArray(retRes.data?.data) ? retRes.data.data : []);
      setGestEcheances(Array.isArray(echRes.data?.data) ? echRes.data.data : []);
      setGestAdmFetched(true);
    }).finally(() => setLoadingGestAdm(false));
  }, [gestAdmFetched]);

  /* ── Montage + re-fetch au retour sur le Dashboard ─────────────────────── */
  useEffect(() => {
    fetchPerf();
    setGestFetched(false);
    setFinFetched(false);
    setGestAdmFetched(false);
  }, [location.pathname]); // eslint-disable-line

  /* ── Changer d'onglet ───────────────────────────────────────────────────── */
  function handleTab(t) {
    setTab(t);
    if (t === 'gestion')        fetchGestion();
    if (t === 'finance')        fetchFinance();
    if (t === 'gestionnaire')   fetchGestionnaireAdm();
  }

  async function handleLancerPrelDashboard(echeanceId) {
    setGestLancingPrel(echeanceId); setGestPrelMsg(null);
    try {
      const { data } = await api.post(`/prelevements/lancer/${echeanceId}`);
      setGestPrelMsg({ type: 'success', text: data.message || 'Prélèvement effectué ✅' });
      setGestAdmFetched(false);
      fetchGestionnaireAdm();
    } catch (e) {
      setGestPrelMsg({ type: 'error', text: e.response?.data?.message || 'Erreur prélèvement' });
    } finally {
      setGestLancingPrel(null);
    }
  }

  async function handleRelancerDashboard(dossier) {
    if (!window.confirm(`Envoyer une relance à ${dossier.prenom} ${dossier.nom} ?`)) return;
    setGestRelancing(dossier.id);
    try {
      const { data } = await api.post(`/finance/dossiers/${dossier.id}/relancer`);
      alert(data.message || 'Relance envoyée.');
    } catch (e) {
      alert(e.response?.data?.message || 'Erreur lors de la relance');
    } finally {
      setGestRelancing(null);
    }
  }

  const prenom = user?.prenom || user?.nom || 'vous';
  const kpis   = perfData?.kpis || {};

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="page-enter">

      {/* ── Entête ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--txt)', letterSpacing: '-0.02em' }}>
          {greeting()}, {prenom} 👋
        </h1>
        <p style={{ fontSize: '.83rem', color: 'var(--txt3)', marginTop: 4, textTransform: 'capitalize' }}>
          {todayFr()}
        </p>
      </div>

      {/* ── Onglets ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { key: 'perf',    label: '📊 Performance Commerciale' },
          { key: 'gestion', label: '📁 Gestion Dossiers' },
          ...(isAdminOrAdm ? [{ key: 'finance', label: '💰 Finance' }] : []),
          ...(role === 'role_administratif' ? [{ key: 'gestionnaire', label: '🗂️ Gestionnaire' }] : []),
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTab(key)}
            style={{
              padding: '8px 16px', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--brand)' : '2px solid transparent',
              color: tab === key ? 'var(--brand)' : 'var(--txt3)',
              marginBottom: -1, transition: 'all .15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          ONGLET 1 — PERFORMANCE COMMERCIALE
      ════════════════════════════════════════════ */}
      {tab === 'perf' && (
        <>
          {/* KPI cards */}
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <KpiCard label="Total leads"     value={loadingPerf ? '…' : (kpis.total_leads || leads.length || 0)} icon="👥" color="blue" />
            <KpiCard label="Convertis"        value={loadingPerf ? '…' : (kpis.leads_gagnes || 0)} icon="🎯" color="green"
              sub={kpis.taux_conversion ? `Taux : ${kpis.taux_conversion}%` : null} />
            <KpiCard label="Non traités"      value={loadingPerf ? '…' : (kpis.leads_actifs || 0)} icon="⏳" color="orange" />
            <KpiCard label="RDV à venir (7j)" value={loadingPerf ? '…' : rdvs.length} icon="📅" color="purple" />
          </div>

          {/* Layout 2 colonnes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 16 }}>

            {/* Derniers leads */}
            <div className="card">
              <div className="card-title">
                Derniers leads
                <button className="btn btn-sm" onClick={() => navigate('/leads')}>Voir tout →</button>
              </div>
              {loadingPerf ? (
                <div className="spinner-wrap"><div className="spinner" /></div>
              ) : leads.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Nom</th><th>Téléphone</th><th>Formation</th><th>Statut</th><th>Date</th></tr></thead>
                    <tbody>
                      {leads.map((l, i) => (
                        <tr key={l.id || i} style={{ cursor: 'pointer' }} onClick={() => navigate('/leads')}>
                          <td><strong>{l.prenom ? `${l.prenom} ${l.nom}` : l.nom || '—'}</strong></td>
                          <td>{l.telephone || '—'}</td>
                          <td>{l.formation_souhaitee || '—'}</td>
                          <td><span className={`badge ${STATUT_COLORS[l.statut] || 'badge-gray'}`}>{l.statut}</span></td>
                          <td>{l.created_at ? new Date(l.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">👥</div>
                  <div className="empty-state-text">Aucun lead pour le moment</div>
                  <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => navigate('/leads')}>➕ Créer le premier lead</button>
                </div>
              )}
            </div>

            {/* RDV à venir */}
            <div className="card" style={{ padding: 0 }}>
              <div className="card-title" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                📅 RDV — 7 jours
                <button className="btn btn-sm" onClick={() => navigate('/agenda')}>Voir tout →</button>
              </div>
              {loadingPerf ? (
                <div className="spinner-wrap"><div className="spinner" /></div>
              ) : rdvs.length > 0 ? (
                <div style={{ padding: '8px 0' }}>
                  {rdvs.map((r) => (
                    <div key={r.id} onClick={() => navigate('/agenda')}
                      style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ minWidth: 52, textAlign: 'center', background: 'var(--brand-dim)', borderRadius: 8, padding: '6px 4px' }}>
                        <div style={{ fontSize: '.68rem', color: 'var(--brand)', fontWeight: 700 }}>
                          {r.date_rdv ? new Date(r.date_rdv).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—'}
                        </div>
                        <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--brand)', marginTop: 2 }}>{formatHeure(r.heure_debut)}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '.83rem', color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titre}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          <span className={`badge ${RDV_TYPE_COLORS[r.type_rdv] || 'badge-gray'}`} style={{ fontSize: '.68rem' }}>{r.type_rdv}</span>
                          {r.lieu && <span style={{ fontSize: '.72rem', color: 'var(--txt3)' }}>📍 {r.lieu}</span>}
                        </div>
                        {r.responsable_nom && <div style={{ fontSize: '.72rem', color: 'var(--txt3)', marginTop: 3 }}>👤 {r.responsable_nom}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                  <div className="empty-state-icon" style={{ fontSize: '1.8rem' }}>📅</div>
                  <div className="empty-state-text">Aucun RDV dans les 7 prochains jours</div>
                  <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/agenda')}>Planifier un RDV</button>
                </div>
              )}
            </div>
          </div>

          {/* Performance par Commercial — Admin seulement */}
          {isAdmin && perfData?.par_commercial?.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title">
                👤 Performance par Commercial
                <button className="btn btn-sm" onClick={() => navigate('/reporting')}>Détail →</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Commercial</th><th>Leads</th><th>Contactés</th><th>RDV</th><th>Gagnés</th><th>Taux conv.</th></tr>
                  </thead>
                  <tbody>
                    {perfData.par_commercial.map((c) => (
                      <tr key={c.vendeur_id}>
                        <td><strong>{c.vendeur_nom}</strong></td>
                        <td>{c.nb_leads}</td>
                        <td>{c.nb_contactes}</td>
                        <td>{c.nb_rdv}</td>
                        <td><span className="badge badge-green">{c.nb_gagnes}</span></td>
                        <td>
                          <span className={`badge ${(c.taux_conversion || 0) >= 20 ? 'badge-green' : 'badge-orange'}`}>
                            {c.taux_conversion || 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Source des leads */}
          {perfData?.sources?.length > 0 && (
            <div className="card">
              <div className="card-title">📡 Source des leads</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '8px 0' }}>
                {perfData.sources.map((s) => (
                  <div key={s.source || 'autre'} style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    textAlign: 'center', minWidth: 120,
                  }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--brand)' }}>{s.nb_leads}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--txt3)', marginTop: 2 }}>{s.source || 'Non renseigné'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 2 — GESTION DOSSIERS
      ════════════════════════════════════════════ */}
      {tab === 'gestion' && (
        <>
          {/* KPI cards */}
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <KpiCard label="Sessions ouvertes"   value={loadingGest ? '…' : (gestionKpis?.sessions_ouvertes ?? '—')}   icon="📚" color="blue" />
            <KpiCard label="Dossiers créés"       value={loadingGest ? '…' : (gestionKpis?.dossiers_crees ?? '—')}       icon="📂" color="green" />
            <KpiCard label="Affectation à faire"  value={loadingGest ? '…' : (gestionKpis?.affectation_a_faire ?? '—')}  icon="📋" color="orange"
              alert={(gestionKpis?.affectation_a_faire || 0) > 0} />
            <KpiCard label="Espace CMA à créer"   value={loadingGest ? '…' : (gestionKpis?.espace_cma_a_creer ?? '—')}   icon="🏛️" color="purple"
              alert={(gestionKpis?.espace_cma_a_creer || 0) > 0} />
          </div>

          {/* KPI CMA paiement séparé */}
          {(gestionKpis?.paiement_cma_a_faire || 0) > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="kpi-card" style={{ maxWidth: 260, borderLeft: '3px solid #ef4444' }}>
                <div className="kpi-top">
                  <span className="kpi-label">Paiement CMA en attente</span>
                  <div className="kpi-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>💳</div>
                </div>
                <div className="kpi-value">{gestionKpis.paiement_cma_a_faire}</div>
                <div className="kpi-delta delta-nt">dossiers avec frais CMA non réglés</div>
              </div>
            </div>
          )}

          {/* Sessions ouvertes */}
          <div className="card" style={{ padding: 0 }}>
            <div className="card-title" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              📚 Sessions ouvertes
              <button className="btn btn-sm" onClick={() => navigate('/parametrage/sessions')}>Gérer →</button>
            </div>
            {loadingGest ? (
              <div className="spinner-wrap"><div className="spinner" /></div>
            ) : sessions.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Code</th><th>Formation</th><th>Type</th><th>Date début</th><th>Date fin</th><th>Capacité</th><th>Inscrits</th></tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => {
                      const st = SESSION_TYPE[s.type_session] || { label: s.type_session, badge: 'badge-gray' };
                      return (
                        <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/parametrage/sessions')}>
                          <td><strong>{s.code_session}</strong></td>
                          <td>{s.formation_nom || '—'}</td>
                          <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                          <td>{s.date_debut ? new Date(s.date_debut).toLocaleDateString('fr-FR') : '—'}</td>
                          <td>{s.date_fin ? new Date(s.date_fin).toLocaleDateString('fr-FR') : '—'}</td>
                          <td>{s.capacite_max || '—'}</td>
                          <td>
                            <span className={`badge ${(s.nb_inscrits || 0) > 0 ? 'badge-blue' : 'badge-gray'}`}>
                              {s.nb_inscrits || 0}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '28px 16px' }}>
                <div className="empty-state-icon">📚</div>
                <div className="empty-state-text">Aucune session ouverte</div>
                <button className="btn-primary" style={{ marginTop: 8, fontSize: '.8rem' }} onClick={() => navigate('/parametrage/sessions')}>
                  ➕ Créer une session
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 4 — GESTIONNAIRE (role_administratif)
      ════════════════════════════════════════════ */}
      {tab === 'gestionnaire' && role === 'role_administratif' && (
        <>
          {loadingGestAdm ? (
            <div className="spinner-wrap" style={{ marginTop: 40 }}><div className="spinner" /></div>
          ) : (
            <>
              {/* KPIs gestionnaire */}
              <div className="grid-4" style={{ marginBottom: 24 }}>
                <KpiCard
                  label="Dossiers en retard"
                  value={gestRetards.length}
                  icon="⚠️" color="red"
                  alert={gestRetards.length > 0}
                  sub={gestRetards.length > 0 ? `${gestRetards.length} dossier(s) à relancer` : 'Aucun retard'}
                />
                <KpiCard
                  label="Échéances dues auj."
                  value={gestEcheances.filter(e => e.date_echeance <= new Date().toISOString().split('T')[0]).length}
                  icon="🏦" color="orange"
                  sub="Prélèvements SEPA à lancer"
                />
                <KpiCard
                  label="Montant en retard"
                  value={formatEur(gestRetards.reduce((s, d) => s + parseFloat(d.reste_a_payer || 0), 0))}
                  icon="💶" color="red"
                />
                <KpiCard
                  label="Échéances en attente"
                  value={gestEcheances.length}
                  icon="📅" color="blue"
                  sub="Total prélèvements configurés"
                />
              </div>

              {/* Dossiers en retard de paiement */}
              <div className="card" style={{ padding: 0, marginBottom: 16 }}>
                <div className="card-title" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  ⚠️ Dossiers en retard de paiement
                  <button className="btn btn-sm" onClick={() => navigate('/finance')}>Voir Finance →</button>
                </div>
                {gestRetards.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 16px' }}>
                    <div className="empty-state-icon">✅</div>
                    <div className="empty-state-text">Aucun dossier en retard</div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Apprenant</th>
                          <th>Contact</th>
                          <th>Reste à payer</th>
                          <th>Prochaine échéance</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gestRetards.slice(0, 10).map(d => (
                          <tr key={d.id}>
                            <td>
                              <strong>{d.prenom} {d.nom}</strong>
                              {d.reference && <div style={{ fontSize: '.72rem', color: 'var(--txt3)' }}>{d.reference}</div>}
                            </td>
                            <td>
                              {d.email     && <div style={{ fontSize: '.78rem' }}>✉️ {d.email}</div>}
                              {d.telephone && <div style={{ fontSize: '.78rem' }}>📞 {d.telephone}</div>}
                            </td>
                            <td style={{ color: '#ef4444', fontWeight: 700 }}>{formatEur(d.reste_a_payer)}</td>
                            <td>
                              {d.prochaine_echeance
                                ? <span className="badge badge-red">{new Date(d.prochaine_echeance).toLocaleDateString('fr-FR')}</span>
                                : '—'}
                            </td>
                            <td>
                              <button
                                className="btn btn-sm"
                                onClick={() => handleRelancerDashboard(d)}
                                disabled={gestRelancing === d.id}
                              >
                                {gestRelancing === d.id ? '⏳…' : '📨 Relancer'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Échéances SEPA dues aujourd'hui */}
              {gestEcheances.filter(e => e.date_echeance <= new Date().toISOString().split('T')[0]).length > 0 && (
                <div className="card" style={{ padding: 0 }}>
                  <div className="card-title" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    🏦 Prélèvements SEPA — à lancer aujourd'hui
                    <button className="btn btn-sm" onClick={() => navigate('/finance')}>Finance →</button>
                  </div>

                  {gestPrelMsg && (
                    <div style={{
                      margin: '10px 16px 0', padding: '8px 12px', borderRadius: 8, fontSize: '.82rem',
                      background: gestPrelMsg.type === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
                      color: gestPrelMsg.type === 'success' ? 'var(--green)' : '#ef4444',
                      border: `1px solid ${gestPrelMsg.type === 'success' ? 'var(--green)' : '#ef4444'}`,
                    }}>
                      {gestPrelMsg.text}
                    </div>
                  )}

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Apprenant</th><th>Date</th><th>Montant</th><th>IBAN</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {gestEcheances
                          .filter(e => e.date_echeance <= new Date().toISOString().split('T')[0])
                          .slice(0, 8)
                          .map(e => (
                            <tr key={e.echeance_id}>
                              <td><strong>{e.prenom} {e.nom}</strong></td>
                              <td><span className="badge badge-orange">{new Date(e.date_echeance).toLocaleDateString('fr-FR')}</span></td>
                              <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{formatEur(e.montant)}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '.78rem' }}>
                                {e.iban ? `${e.iban.slice(0, 4)} ···· ${e.iban.slice(-4)}` : <span style={{ color: '#ef4444' }}>Non renseigné</span>}
                              </td>
                              <td>
                                {e.iban ? (
                                  <button
                                    className="btn btn-sm"
                                    style={{ color: 'var(--green)', borderColor: 'var(--green)', fontSize: '.75rem' }}
                                    onClick={() => handleLancerPrelDashboard(e.echeance_id)}
                                    disabled={gestLancingPrel === e.echeance_id}
                                  >
                                    {gestLancingPrel === e.echeance_id ? '⏳…' : '🏦 Prélever'}
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '.75rem', color: '#ef4444' }}>IBAN requis</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 3 — FINANCE
      ════════════════════════════════════════════ */}
      {tab === 'finance' && isAdminOrAdm && (
        <>
          {loadingFin ? (
            <div className="spinner-wrap" style={{ marginTop: 40 }}><div className="spinner" /></div>
          ) : (
            <>
              {(() => {
                const s = finData?.situation || {};
                return (
                  <div className="grid-4" style={{ marginBottom: 24 }}>
                    <KpiCard label="Dossiers financés"  value={s.nb_dossiers ?? '—'}                icon="📂" color="blue" />
                    <KpiCard label="CA encaissé"         value={formatEur(s.total_encaisse)}         icon="💶" color="green" />
                    <KpiCard label="Reste à percevoir"   value={formatEur(s.reste_total)}            icon="⏳" color="orange"
                      alert={(s.reste_total || 0) > 0} />
                    <KpiCard label="Montant recouvrement" value={s.nb_neant > 0 ? s.nb_neant + ' dossier(s)' : '0'} icon="🔔" color="red"
                      sub={s.nb_neant > 0 ? 'aucun encaissement reçu' : 'Aucun en attente'}
                      alert={(s.nb_neant || 0) > 0} />
                  </div>
                );
              })()}

              {/* Statuts paiement */}
              {finData?.situation && (
                <div className="card">
                  <div className="card-title">💰 Situation financière globale</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '8px 0' }}>
                    {[
                      { label: 'Réglés',      value: finData.situation.nb_effectue || 0, color: 'var(--green)',  bg: 'var(--green-dim)' },
                      { label: 'En cours',    value: finData.situation.nb_partiel || 0,  color: 'var(--orange)', bg: 'var(--orange-dim)' },
                      { label: 'Non réglés',  value: finData.situation.nb_neant || 0,    color: '#ef4444',       bg: '#fef2f2' },
                    ].map((item) => (
                      <div key={item.label} style={{
                        flex: 1, minWidth: 140, padding: '16px', borderRadius: 10,
                        background: item.bg, textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: item.color }}>{item.value}</div>
                        <div style={{ fontSize: '.8rem', color: 'var(--txt2)', marginTop: 4 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', gap: 32, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: '.75rem', color: 'var(--txt3)' }}>Total financements personnels</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--txt)' }}>{formatEur(finData.situation.total_fp)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '.75rem', color: 'var(--txt3)' }}>Total encaissé</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--green)' }}>{formatEur(finData.situation.total_encaisse)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '.75rem', color: 'var(--txt3)' }}>Reste à percevoir</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--orange)' }}>{formatEur(finData.situation.reste_total)}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

    </div>
  );
}
