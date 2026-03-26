import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import useAuthStore from '../store/authStore';

const MODES_PAIEMENT = ['virement', 'cb', 'cheque', 'especes', 'prelevement'];
const MODE_LABELS = {
  virement:    'Virement',
  cb:          'CB',
  cheque:      'Chèque',
  especes:     'Espèces',
  prelevement: 'Prélèvement',
};

const STATUT_COLORS = {
  effectue:     'badge-green',
  partiel:      'badge-orange',
  neant:        'badge-red',
  non_concerne: 'badge-gray',
};
const STATUT_LABELS = {
  effectue:     'Soldé',
  partiel:      'Partiel',
  neant:        'Non payé',
  non_concerne: 'N/A',
};

const ECHEANCE_COLORS = { payee: 'badge-green', en_attente: 'badge-orange' };
const ECHEANCE_LABELS = { payee: 'Payée', en_attente: 'En attente' };

function fmt(n) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function KpiCard({ label, value, icon, color, sub }) {
  const colorMap = {
    blue:   { bg: 'var(--brand-dim)',  fg: 'var(--brand)' },
    green:  { bg: 'var(--green-dim)',  fg: 'var(--green)' },
    orange: { bg: 'var(--orange-dim)', fg: 'var(--orange)' },
    red:    { bg: 'var(--red-dim)',    fg: 'var(--red)' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <div className="kpi-icon" style={{ background: c.bg, color: c.fg }}>{icon}</div>
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-delta delta-nt">{sub}</div>}
    </div>
  );
}

const TABS = ['dossiers', 'encaissements', 'retards', 'prelevements'];
const TAB_LABELS = {
  dossiers:      '📁 Dossiers',
  encaissements: '💳 Encaissements',
  retards:       '⚠️ Retards',
  prelevements:  '🏦 Prélèvements',
};

const emptyEncForm = {
  montant: '',
  date_encaissement: new Date().toISOString().split('T')[0],
  mode_paiement: 'virement',
  notes: '',
};

export default function Finance() {
  const user = useAuthStore((s) => s.user);
  const canWrite = ['super_admin', 'role_admin', 'role_administratif'].includes(user?.role || user?.role_nom);

  const [activeTab, setActiveTab]       = useState('dossiers');
  const [situation, setSituation]       = useState(null);
  const [dossiers, setDossiers]         = useState([]);
  const [encaissements, setEncaissements] = useState([]);
  const [retards, setRetards]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');

  // ── Modal encaissement ──
  const [showEncModal, setShowEncModal]       = useState(false);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [encForm, setEncForm]                 = useState(emptyEncForm);
  const [encSaving, setEncSaving]             = useState(false);
  const [encErr, setEncErr]                   = useState('');
  const [relancing, setRelancing]             = useState(null);

  // ── Modal plan financier ──
  const [showPlanModal, setShowPlanModal]   = useState(false);
  const [planDossier, setPlanDossier]       = useState(null);
  const [echeances, setEcheances]           = useState([]);
  const [resumePlan, setResumePlan]         = useState(null);
  const [dossierEncs, setDossierEncs]       = useState([]);
  const [loadingPlan, setLoadingPlan]       = useState(false);
  const [planTab, setPlanTab]               = useState('echeancier');
  // Formulaire création plan
  const [planMode, setPlanMode]             = useState('mensualites');
  const [planNbMois, setPlanNbMois]         = useState(6);
  const [planDateDebut, setPlanDateDebut]   = useState('');
  const [planRows, setPlanRows]             = useState([{ date_echeance: '', montant: '' }]);
  const [planSaving, setPlanSaving]         = useState(false);
  const [planErr, setPlanErr]               = useState('');
  const [planPrelevement, setPlanPrelevement] = useState(false); // option prélèvement auto

  // ── Prélèvements automatiques ──
  const [prelStatus, setPrelStatus]           = useState(null);
  const [echeancesDues, setEcheancesDues]     = useState([]);
  const [prelLog, setPrelLog]                 = useState([]);
  const [loadingPrel, setLoadingPrel]         = useState(false);
  const [lancingPrel, setLancingPrel]         = useState(null); // id en cours
  const [lancingTous, setLancingTous]         = useState(false);
  const [prelMsg, setPrelMsg]                 = useState(null); // { type:'success'|'error', text }

  // ── Modal SEPA dossier ──
  const [showSepaModal, setShowSepaModal]     = useState(false);
  const [sepaDossier, setSepaDossier]         = useState(null);
  const [sepaForm, setSepaForm]               = useState({ iban: '', bic: '', prelevement_actif: true });
  const [sepaSaving, setSepaSaving]           = useState(false);
  const [sepaErr, setSepaErr]                 = useState('');
  const [sepaSuccess, setSepaSuccess]         = useState('');

  // ── Load all data ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pfRes, dosRes, encRes, retRes] = await Promise.all([
        api.get('/finance/point-financier'),
        api.get('/finance/dossiers-suivi'),
        api.get('/finance/suivi'),
        api.get('/finance/retards'),
      ]);
      setSituation(pfRes.data?.data?.situation || null);
      setDossiers(Array.isArray(dosRes.data?.data) ? dosRes.data.data : []);
      setEncaissements(Array.isArray(encRes.data?.data) ? encRes.data.data : []);
      setRetards(Array.isArray(retRes.data?.data) ? retRes.data.data : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Prélèvements ──
  const loadPrelevements = useCallback(async () => {
    setLoadingPrel(true);
    try {
      const [statusRes, duesRes, logRes] = await Promise.all([
        api.get('/prelevements/status'),
        api.get('/prelevements/echeances-dues?tous=1'),
        api.get('/prelevements/log?limit=30'),
      ]);
      setPrelStatus(statusRes.data?.data || null);
      setEcheancesDues(Array.isArray(duesRes.data?.data) ? duesRes.data.data : []);
      setPrelLog(Array.isArray(logRes.data?.data) ? logRes.data.data : []);
    } catch { /* ignore */ } finally {
      setLoadingPrel(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'prelevements') loadPrelevements();
  }, [activeTab, loadPrelevements]);

  async function lancerUn(echeanceId) {
    setLancingPrel(echeanceId); setPrelMsg(null);
    try {
      const { data } = await api.post(`/prelevements/lancer/${echeanceId}`);
      setPrelMsg({ type: 'success', text: data.message || 'Prélèvement effectué ✅' });
      loadPrelevements();
    } catch (e) {
      setPrelMsg({ type: 'error', text: e.response?.data?.message || 'Erreur lors du prélèvement' });
    } finally {
      setLancingPrel(null);
    }
  }

  async function lancerTousHandler() {
    if (!window.confirm('Lancer tous les prélèvements dus aujourd\'hui ?')) return;
    setLancingTous(true); setPrelMsg(null);
    try {
      const { data } = await api.post('/prelevements/lancer-tous');
      setPrelMsg({ type: 'success', text: data.message });
      loadPrelevements();
      loadAll();
    } catch (e) {
      setPrelMsg({ type: 'error', text: e.response?.data?.message || 'Erreur' });
    } finally {
      setLancingTous(false);
    }
  }

  function openSepa(dossier) {
    setSepaDossier(dossier);
    setSepaForm({
      iban: dossier.iban || '',
      bic:  dossier.bic  || '',
      prelevement_actif: dossier.prelevement_actif !== false,
    });
    setSepaErr('');
    setSepaSuccess('');
    setShowSepaModal(true);
  }

  async function handleSaveSepa() {
    if (!sepaForm.iban.trim()) { setSepaErr('IBAN requis'); return; }
    setSepaSaving(true); setSepaErr(''); setSepaSuccess('');
    try {
      const { data } = await api.patch(
        `/prelevements/dossiers/${sepaDossier.dossier_id || sepaDossier.id}/sepa`,
        sepaForm
      );
      setSepaSuccess(`✅ ${data.message} — Mandat : ${data.data?.mandat_ref || ''}`);
      loadPrelevements();
    } catch (e) {
      setSepaErr(e.response?.data?.message || 'Erreur lors de la configuration');
    } finally {
      setSepaSaving(false);
    }
  }

  // ── Encaissement ──
  function openEncaissement(dossier, montantPrefill = null) {
    setSelectedDossier(dossier);
    setEncForm({
      ...emptyEncForm,
      date_encaissement: new Date().toISOString().split('T')[0],
      montant: montantPrefill != null ? String(montantPrefill) : '',
    });
    setEncErr('');
    setShowEncModal(true);
  }

  async function handleSaveEncaissement() {
    if (!encForm.montant || parseFloat(encForm.montant) <= 0) { setEncErr('Montant valide requis (> 0)'); return; }
    if (!encForm.date_encaissement) { setEncErr('Date requise'); return; }
    setEncSaving(true); setEncErr('');
    try {
      await api.post(`/finance/dossiers/${selectedDossier.id}/encaissements`, {
        montant:           parseFloat(encForm.montant),
        date_encaissement: encForm.date_encaissement,
        mode_paiement:     encForm.mode_paiement,
        notes:             encForm.notes || undefined,
      });
      setShowEncModal(false);
      loadAll();
      // Si le plan modal est ouvert pour ce dossier, rafraîchir
      if (showPlanModal && planDossier?.id === selectedDossier.id) {
        refreshPlanData(selectedDossier.id);
      }
    } catch (e) {
      setEncErr(e.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setEncSaving(false);
    }
  }

  async function handleRelancer(dossier) {
    if (!window.confirm(`Envoyer une relance à ${dossier.prenom} ${dossier.nom} ?`)) return;
    setRelancing(dossier.id);
    try {
      const { data } = await api.post(`/finance/dossiers/${dossier.id}/relancer`);
      alert(data.message || 'Relance envoyée.');
    } catch (e) {
      alert(e.response?.data?.message || 'Erreur lors de la relance');
    } finally {
      setRelancing(null);
    }
  }

  const updEnc = (k, v) => setEncForm((p) => ({ ...p, [k]: v }));

  // ── Plan financier ──
  async function refreshPlanData(dossierId) {
    try {
      const [planRes, encRes] = await Promise.all([
        api.get(`/finance/dossiers/${dossierId}/plan`),
        api.get(`/finance/suivi?dossier_id=${dossierId}`),
      ]);
      const plan   = planRes.data?.data?.plan   || [];
      const resume = planRes.data?.data?.resume  || null;
      const encs   = Array.isArray(encRes.data?.data) ? encRes.data.data : [];
      setEcheances(plan);
      setResumePlan(resume);
      setDossierEncs(encs);
      // Mettre à jour planDossier avec les données fraîches (total_encaisse, reste_a_payer)
      if (resume) {
        setPlanDossier((prev) => prev ? { ...prev, ...resume } : prev);
      }
    } catch { /* ignore */ }
  }

  async function openPlan(dossier) {
    setPlanDossier(dossier);
    setPlanErr('');
    setPlanMode('mensualites');
    setPlanNbMois(6);
    setPlanDateDebut('');
    setPlanRows([{ date_echeance: '', montant: '' }]);
    setPlanPrelevement(false);
    setPlanTab('echeancier');
    setShowPlanModal(true);
    setLoadingPlan(true);
    try {
      await refreshPlanData(dossier.id);
    } finally {
      setLoadingPlan(false);
    }
  }

  async function handleCreatePlan() {
    setPlanSaving(true); setPlanErr('');
    try {
      let body;
      if (planMode === 'mensualites') {
        if (!planDateDebut) { setPlanErr('Date de début requise'); setPlanSaving(false); return; }
        body = { mode: 'mensualites', nb_mensualites: planNbMois, date_debut: planDateDebut, prelevement_auto: planPrelevement };
      } else {
        const valid = planRows.filter((r) => r.date_echeance && parseFloat(r.montant) > 0);
        if (valid.length === 0) { setPlanErr('Au moins une échéance requise'); setPlanSaving(false); return; }
        body = {
          mode: 'dates_libres',
          echeances: valid.map((r) => ({ date_echeance: r.date_echeance, montant: parseFloat(r.montant) })),
        };
      }
      await api.post(`/finance/dossiers/${planDossier.id}/plan`, body);
      await refreshPlanData(planDossier.id);
      loadAll();
      setPlanTab('echeancier');
    } catch (e) {
      setPlanErr(e.response?.data?.message || 'Erreur lors de la création du plan');
    } finally {
      setPlanSaving(false);
    }
  }

  function addPlanRow()       { setPlanRows((r) => [...r, { date_echeance: '', montant: '' }]); }
  function removePlanRow(i)   { setPlanRows((r) => r.filter((_, idx) => idx !== i)); }
  function updatePlanRow(i, k, v) {
    setPlanRows((r) => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  }

  const planRowsTotal = planRows.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0);

  // ── Filters ──
  const q = search.toLowerCase();
  const filteredDossiers      = dossiers.filter((d) => !q || `${d.nom} ${d.prenom} ${d.formation_souhaitee || ''}`.toLowerCase().includes(q));
  const filteredEncaissements = encaissements.filter((e) => !q || `${e.nom} ${e.prenom} ${e.formation_souhaitee || ''}`.toLowerCase().includes(q));
  const filteredRetards       = retards.filter((d) => !q || `${d.nom} ${d.prenom} ${d.formation_souhaitee || ''}`.toLowerCase().includes(q));

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <div className="section-title">Finance</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>Suivi financier des dossiers</p>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <KpiCard label="Financement total" value={situation ? fmt(situation.total_fp)      : '…'} icon="💰" color="blue" />
        <KpiCard label="Encaissé"          value={situation ? fmt(situation.total_encaisse) : '…'} icon="✅" color="green" />
        <KpiCard label="Reste à encaisser" value={situation ? fmt(situation.reste_total)    : '…'} icon="⏳" color="orange" />
        <KpiCard
          label="En retard"
          value={loading ? '…' : retards.length}
          icon="⚠️" color="red"
          sub={retards.length > 0 ? `${retards.length} dossier(s)` : null}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="tab-nav">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab-btn${activeTab === t ? ' active' : ''}`}
            onClick={() => { setActiveTab(t); setSearch(''); }}
          >
            {TAB_LABELS[t]}
            {t === 'retards' && retards.length > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--red)', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: '.68rem' }}>
                {retards.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: '.88rem', flex: 1 }}>{TAB_LABELS[activeTab]}</span>
          <div className="search-box">
            <span style={{ fontSize: 13, color: 'var(--txt3)' }}>🔍</span>
            <input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : (
          <>
            {/* ── Tab Dossiers ── */}
            {activeTab === 'dossiers' && (
              filteredDossiers.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Apprenant</th>
                        <th>Formation</th>
                        <th>Coût total</th>
                        <th>CPF</th>
                        <th>FP</th>
                        <th>Encaissé</th>
                        <th>Reste</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDossiers.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <strong>{d.prenom} {d.nom}</strong>
                            {d.reference && <div style={{ fontSize: '.72rem', color: 'var(--txt3)' }}>{d.reference}</div>}
                          </td>
                          <td>{d.formation_souhaitee || '—'}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(d.cout_total)}</td>
                          <td style={{ color: 'var(--brand)', fontWeight: 600 }}>{fmt(d.part_financeur)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 600 }}>{fmt(d.financement_personnel)}</span>
                              {(d.financement_personnel || 0) > 0 && (
                                <span title="Peut générer un plan financier" style={{ fontSize: '.7rem', color: 'var(--brand)', cursor: 'pointer' }}
                                  onClick={() => openPlan(d)}>
                                  📋
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(d.total_encaisse)}</td>
                          <td style={{ color: d.reste_a_payer > 0 ? 'var(--orange)' : 'var(--green)', fontWeight: 600 }}>
                            {fmt(d.reste_a_payer)}
                          </td>
                          <td>
                            <span className={`badge ${STATUT_COLORS[d.statut_paiement] || 'badge-gray'}`}>
                              {STATUT_LABELS[d.statut_paiement] || d.statut_paiement}
                            </span>
                            {d.trop_percu > 0 && <span className="badge badge-purple" style={{ marginLeft: 4 }}>Trop-perçu</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {canWrite && (
                                <button className="btn btn-sm" onClick={() => openEncaissement(d)}>➕ Encaisser</button>
                              )}
                              <button className="btn btn-sm" onClick={() => openPlan(d)}>📋 Plan</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">💰</div>
                  <div className="empty-state-text">{search ? 'Aucun résultat' : 'Aucun dossier avec financement personnel'}</div>
                </div>
              )
            )}

            {/* ── Tab Encaissements ── */}
            {activeTab === 'encaissements' && (
              filteredEncaissements.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Apprenant</th>
                        <th>Formation</th>
                        <th>Montant</th>
                        <th>Mode</th>
                        <th>Saisi par</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEncaissements.map((e) => (
                        <tr key={e.id}>
                          <td>{e.date_encaissement ? new Date(e.date_encaissement).toLocaleDateString('fr-FR') : '—'}</td>
                          <td><strong>{e.prenom} {e.nom}</strong></td>
                          <td>{e.formation_souhaitee || '—'}</td>
                          <td style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(e.montant)}</td>
                          <td><span className="badge badge-blue">{MODE_LABELS[e.mode_paiement] || e.mode_paiement || '—'}</span></td>
                          <td style={{ fontSize: '.78rem', color: 'var(--txt3)' }}>{e.saisi_par || '—'}</td>
                          <td style={{ fontSize: '.78rem', color: 'var(--txt3)' }}>{e.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">💳</div>
                  <div className="empty-state-text">{search ? 'Aucun résultat' : 'Aucun encaissement enregistré'}</div>
                </div>
              )
            )}

            {/* ── Tab Prélèvements ── */}
            {activeTab === 'prelevements' && (
              loadingPrel ? (
                <div className="spinner-wrap"><div className="spinner" /></div>
              ) : (
                <div style={{ padding: '0 0 12px' }}>

                  {/* Bandeau statut */}
                  {prelStatus && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 12px', borderRadius: 20, fontSize: '.78rem', fontWeight: 700,
                        background: prelStatus.is_simulation ? 'var(--orange-dim)' : 'var(--green-dim)',
                        color: prelStatus.is_simulation ? 'var(--orange)' : 'var(--green)',
                      }}>
                        {prelStatus.is_simulation ? '🔶 Mode simulation' : `✅ ${prelStatus.mode_label}`}
                      </span>
                      <span style={{ fontSize: '.78rem', color: 'var(--txt3)' }}>
                        {prelStatus.stats?.dues_aujourd_hui || 0} échéance(s) due(s) aujourd'hui
                        {' · '}{prelStatus.stats?.en_attente || 0} en attente au total
                      </span>
                      {prelStatus.is_simulation && (
                        <span style={{ fontSize: '.72rem', color: 'var(--txt3)', marginLeft: 'auto' }}>
                          Ajoutez <code>SEPA_PROVIDER=gocardless</code> dans .env pour activer GoCardless
                        </span>
                      )}
                      {canWrite && echeancesDues.filter(e => e.date_echeance <= new Date().toISOString().split('T')[0]).length > 0 && (
                        <button
                          className="btn-primary"
                          style={{ marginLeft: 'auto', fontSize: '.78rem' }}
                          onClick={lancerTousHandler}
                          disabled={lancingTous}
                        >
                          {lancingTous ? '⏳ Traitement…' : `🚀 Lancer tous (${echeancesDues.filter(e => e.date_echeance <= new Date().toISOString().split('T')[0]).length})`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Message résultat */}
                  {prelMsg && (
                    <div style={{
                      margin: '10px 18px 0', padding: '8px 14px', borderRadius: 8, fontSize: '.82rem',
                      background: prelMsg.type === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
                      color: prelMsg.type === 'success' ? 'var(--green)' : 'var(--red)',
                      border: `1px solid ${prelMsg.type === 'success' ? 'var(--green)' : 'var(--red)'}`,
                    }}>
                      {prelMsg.text}
                    </div>
                  )}

                  {/* Tableau des échéances à prélever */}
                  {echeancesDues.length > 0 ? (
                    <div className="table-wrap" style={{ marginTop: 8 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Apprenant</th>
                            <th>Date échéance</th>
                            <th>Montant</th>
                            <th>IBAN</th>
                            <th>Mandat</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {echeancesDues.map((e) => {
                            const isDue = e.date_echeance <= new Date().toISOString().split('T')[0];
                            return (
                              <tr key={e.echeance_id} style={{ opacity: isDue ? 1 : 0.7 }}>
                                <td>
                                  <strong>{e.prenom} {e.nom}</strong>
                                  {e.reference && <div style={{ fontSize: '.72rem', color: 'var(--txt3)' }}>{e.reference}</div>}
                                </td>
                                <td>
                                  <span className={isDue ? 'badge badge-orange' : 'badge badge-gray'}>
                                    {new Date(e.date_echeance).toLocaleDateString('fr-FR')}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{fmt(e.montant)}</td>
                                <td style={{ fontSize: '.78rem', fontFamily: 'monospace' }}>
                                  {e.iban
                                    ? `${e.iban.slice(0, 4)} ···· ${e.iban.slice(-4)}`
                                    : <span style={{ color: 'var(--red)' }}>⚠️ Non renseigné</span>}
                                </td>
                                <td style={{ fontSize: '.75rem', color: 'var(--txt3)' }}>
                                  {e.mandat_ref
                                    ? <span title={e.mandat_date}>{e.mandat_ref}</span>
                                    : <span style={{ color: 'var(--orange)' }}>Non créé</span>}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    {canWrite && isDue && e.iban && (
                                      <button
                                        className="btn btn-sm"
                                        style={{ color: 'var(--green)', borderColor: 'var(--green)', fontSize: '.75rem' }}
                                        onClick={() => lancerUn(e.echeance_id)}
                                        disabled={lancingPrel === e.echeance_id}
                                      >
                                        {lancingPrel === e.echeance_id ? '⏳…' : '🏦 Prélever'}
                                      </button>
                                    )}
                                    <button
                                      className="btn btn-sm"
                                      style={{ fontSize: '.75rem' }}
                                      onClick={() => openSepa(e)}
                                    >
                                      ⚙️ IBAN
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ paddingTop: 32 }}>
                      <div className="empty-state-icon">🏦</div>
                      <div className="empty-state-text">Aucune échéance à prélever</div>
                      <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 6 }}>
                        Créez un plan financier avec l'option "Prélèvement SEPA" pour voir les échéances ici.
                      </p>
                    </div>
                  )}

                  {/* Historique des prélèvements */}
                  {prelLog.length > 0 && (
                    <>
                      <div style={{ padding: '16px 18px 6px', fontWeight: 700, fontSize: '.82rem', color: 'var(--txt3)', borderTop: '1px solid var(--border)', marginTop: 16 }}>
                        📋 Historique des prélèvements (30 derniers)
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Apprenant</th>
                              <th>Montant</th>
                              <th>Mode</th>
                              <th>Référence</th>
                              <th>Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prelLog.map((l) => (
                              <tr key={l.id}>
                                <td style={{ fontSize: '.78rem', color: 'var(--txt3)' }}>
                                  {new Date(l.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td><strong>{l.prenom} {l.nom}</strong></td>
                                <td style={{ fontWeight: 600 }}>{fmt(l.montant)}</td>
                                <td>
                                  <span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>{l.mode}</span>
                                </td>
                                <td style={{ fontSize: '.72rem', fontFamily: 'monospace', color: 'var(--txt3)' }}>
                                  {l.provider_ref || '—'}
                                </td>
                                <td>
                                  <span className={`badge ${l.statut === 'succes' ? 'badge-green' : l.statut === 'echec' ? 'badge-red' : 'badge-orange'}`}>
                                    {l.statut === 'succes' ? '✅ Succès' : l.statut === 'echec' ? '❌ Échec' : '⏳ En cours'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )
            )}

            {/* ── Tab Retards ── */}
            {activeTab === 'retards' && (
              filteredRetards.length > 0 ? (
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
                      {filteredRetards.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <strong>{d.prenom} {d.nom}</strong>
                            {d.reference && <div style={{ fontSize: '.72rem', color: 'var(--txt3)' }}>{d.reference}</div>}
                          </td>
                          <td>
                            {d.email     && <div style={{ fontSize: '.78rem' }}>✉️ {d.email}</div>}
                            {d.telephone && <div style={{ fontSize: '.78rem' }}>📞 {d.telephone}</div>}
                          </td>
                          <td style={{ color: 'var(--red)', fontWeight: 700 }}>{fmt(d.reste_a_payer)}</td>
                          <td>
                            {d.prochaine_echeance
                              ? <span className="badge badge-red">{new Date(d.prochaine_echeance).toLocaleDateString('fr-FR')}</span>
                              : '—'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {canWrite && (
                                <>
                                  <button className="btn btn-sm" onClick={() => openEncaissement(d)}>➕ Encaisser</button>
                                  <button className="btn btn-sm" onClick={() => handleRelancer(d)} disabled={relancing === d.id}>
                                    {relancing === d.id ? '⏳…' : '📨 Relancer'}
                                  </button>
                                </>
                              )}
                              <button className="btn btn-sm" onClick={() => openPlan(d)}>📋 Plan</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-text">{search ? 'Aucun résultat' : 'Aucun dossier en retard de paiement'}</div>
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          Modal encaissement
      ═══════════════════════════════════════════════ */}
      <Modal
        open={showEncModal}
        title={selectedDossier ? `Encaissement — ${selectedDossier.prenom} ${selectedDossier.nom}` : 'Encaissement'}
        onClose={() => setShowEncModal(false)}
        onConfirm={handleSaveEncaissement}
        confirmLabel={encSaving ? 'Enregistrement…' : 'Enregistrer'}
        loading={encSaving}
      >
        {encErr && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠️</span> {encErr}</div>}

        {selectedDossier && (
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: '.82rem', marginBottom: 16 }}>
            <strong>{selectedDossier.prenom} {selectedDossier.nom}</strong>
            {selectedDossier.formation_souhaitee && ` — ${selectedDossier.formation_souhaitee}`}
            <div style={{ color: 'var(--txt3)', marginTop: 4 }}>
              Encaissé : <strong>{fmt(selectedDossier.total_encaisse)}</strong>
              {' / '}{fmt(selectedDossier.financement_personnel)}
              {' — Reste : '}
              <strong style={{ color: selectedDossier.reste_a_payer > 0 ? 'var(--orange)' : 'var(--green)' }}>
                {fmt(selectedDossier.reste_a_payer)}
              </strong>
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Montant (€) *</label>
            <input className="form-input" type="number" step="0.01" min="0.01" placeholder="0.00"
              value={encForm.montant} onChange={(e) => updEnc('montant', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input className="form-input" type="date"
              value={encForm.date_encaissement} onChange={(e) => updEnc('date_encaissement', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Mode de paiement</label>
          <select className="form-select" value={encForm.mode_paiement} onChange={(e) => updEnc('mode_paiement', e.target.value)}>
            {MODES_PAIEMENT.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-input" placeholder="Optionnel"
            value={encForm.notes} onChange={(e) => updEnc('notes', e.target.value)} />
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════
          Modal configuration SEPA
      ═══════════════════════════════════════════════ */}
      <Modal
        open={showSepaModal}
        title={sepaDossier ? `🏦 Prélèvement SEPA — ${sepaDossier.prenom} ${sepaDossier.nom}` : 'Configuration SEPA'}
        onClose={() => setShowSepaModal(false)}
        onConfirm={handleSaveSepa}
        confirmLabel={sepaSaving ? 'Enregistrement…' : 'Valider et créer le mandat'}
        loading={sepaSaving}
      >
        {sepaErr     && <div className="err-box"  style={{ marginBottom: 12 }}><span>⚠️</span> {sepaErr}</div>}
        {sepaSuccess && <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: 8, padding: '8px 12px', fontSize: '.82rem', color: 'var(--green)', marginBottom: 12 }}>{sepaSuccess}</div>}

        <div style={{ background: 'var(--orange-dim)', border: '1px solid var(--orange)', borderRadius: 8, padding: '8px 12px', fontSize: '.78rem', color: 'var(--orange)', marginBottom: 14 }}>
          ⚠️ En mode simulation, aucun vrai prélèvement n'est effectué. Configurez <strong>SEPA_PROVIDER</strong> dans <code>.env</code> pour GoCardless ou Stripe.
        </div>

        <div className="form-group">
          <label className="form-label">IBAN *</label>
          <input
            className="form-input"
            placeholder="FR76 3000 6000 0112 3456 7890 189"
            value={sepaForm.iban}
            onChange={(e) => setSepaForm((p) => ({ ...p, iban: e.target.value.toUpperCase() }))}
            style={{ fontFamily: 'monospace', letterSpacing: '.05em' }}
            maxLength={42}
          />
          <div style={{ fontSize: '.72rem', color: 'var(--txt3)', marginTop: 4 }}>
            Format international (FR, BE, DE, ES…)
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">BIC / SWIFT</label>
          <input
            className="form-input"
            placeholder="BNPAFRPPXXX"
            value={sepaForm.bic}
            onChange={(e) => setSepaForm((p) => ({ ...p, bic: e.target.value.toUpperCase() }))}
            style={{ fontFamily: 'monospace' }}
            maxLength={11}
          />
        </div>

        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '.85rem' }}>
            <input
              type="checkbox"
              checked={sepaForm.prelevement_actif}
              onChange={(e) => setSepaForm((p) => ({ ...p, prelevement_actif: e.target.checked }))}
            />
            <span>Prélèvement automatique activé pour ce dossier</span>
          </label>
          <div style={{ fontSize: '.72rem', color: 'var(--txt3)', marginTop: 4, paddingLeft: 24 }}>
            Décochez pour suspendre les prélèvements sans supprimer les données SEPA.
          </div>
        </div>

        {sepaDossier?.mandat_ref && (
          <div style={{ marginTop: 12, fontSize: '.75rem', color: 'var(--txt3)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            📋 Mandat actuel : <strong>{sepaDossier.mandat_ref}</strong>
            {sepaDossier.mandat_date && ` · Signé le ${new Date(sepaDossier.mandat_date).toLocaleDateString('fr-FR')}`}
            <br />⚠️ Modifier l'IBAN créera un nouveau mandat.
          </div>
        )}
      </Modal>

      {/* ═══════════════════════════════════════════════
          Modal plan financier + suivi de paiement
      ═══════════════════════════════════════════════ */}
      <Modal
        open={showPlanModal}
        title={planDossier ? `Plan financier — ${planDossier.prenom} ${planDossier.nom}` : 'Plan financier'}
        onClose={() => setShowPlanModal(false)}
        cancelLabel="Fermer"
      >
        {loadingPlan ? (
          <div className="spinner-wrap" style={{ minHeight: 120 }}><div className="spinner" /></div>
        ) : (
          <>
            {/* Résumé financier — toujours visible */}
            {(() => {
              const r = resumePlan || planDossier || {};
              // Fallback : calculer le total encaissé depuis la liste des encaissements
              const encTotal = r.total_encaisse != null
                ? parseFloat(r.total_encaisse)
                : dossierEncs.reduce((s, e) => s + parseFloat(e.montant || 0), 0);
              const fp    = parseFloat(r.financement_personnel || r.cout_total_formation || 0);
              const reste = r.reste_a_payer != null ? parseFloat(r.reste_a_payer) : Math.max(0, fp - encTotal);
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: 'Financement perso', value: fmt(fp),      color: 'var(--brand)' },
                    { label: 'Encaissé',          value: fmt(encTotal), color: 'var(--green)' },
                    { label: 'Reste à payer',     value: fmt(reste),    color: reste > 0 ? 'var(--orange)' : 'var(--green)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '.7rem', color: 'var(--txt3)' }}>{label}</div>
                      <div style={{ fontWeight: 700, color, fontSize: '.92rem' }}>{value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Inner tabs */}
            <div className="tab-nav" style={{ marginBottom: 12 }}>
              {[
                { key: 'echeancier', label: '📅 Suivi de paiement' },
                { key: 'creer',      label: echeances.length > 0 ? '🔄 Recréer le plan' : '➕ Créer un plan' },
                { key: 'historique', label: `💳 Encaissements (${dossierEncs.length})` },
              ].map((t) => (
                <button
                  key={t.key}
                  className={`tab-btn${planTab === t.key ? ' active' : ''}`}
                  onClick={() => setPlanTab(t.key)}
                  style={{ fontSize: '.78rem' }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Suivi de paiement (échéancier) ── */}
            {planTab === 'echeancier' && (
              echeances.length > 0 ? (
                <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Date échéance</th>
                          <th>Montant dû</th>
                          <th>Statut</th>
                          {canWrite && <th>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {echeances.map((e, i) => (
                          <tr key={e.id} style={{ opacity: e.statut === 'payee' ? 0.65 : 1 }}>
                            <td style={{ color: 'var(--txt3)', fontSize: '.78rem' }}>{i + 1}</td>
                            <td>
                              {e.date_echeance ? new Date(e.date_echeance).toLocaleDateString('fr-FR') : '—'}
                              {/* Retard : date passée et non payée */}
                              {e.statut === 'en_attente' && e.date_echeance && new Date(e.date_echeance) < new Date() && (
                                <span className="badge badge-red" style={{ marginLeft: 6, fontSize: '.65rem' }}>Retard</span>
                              )}
                            </td>
                            <td style={{ fontWeight: 600 }}>{fmt(e.montant)}</td>
                            <td>
                              <span className={`badge ${ECHEANCE_COLORS[e.statut] || 'badge-gray'}`}>
                                {ECHEANCE_LABELS[e.statut] || e.statut}
                              </span>
                              {e.prelevement_auto ? (
                                <span title="Prélèvement SEPA automatique" style={{ marginLeft: 5, fontSize: '.75rem' }}>🏦</span>
                              ) : null}
                            </td>
                            {canWrite && (
                              <td>
                                {e.statut === 'en_attente' ? (
                                  <button
                                    className="btn btn-sm"
                                    style={{ color: 'var(--green)', borderColor: 'var(--green)', fontSize: '.75rem' }}
                                    onClick={() => {
                                      setShowPlanModal(false);
                                      setTimeout(() => openEncaissement(planDossier, parseFloat(e.montant)), 150);
                                    }}
                                  >
                                    💰 Encaisser
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '.72rem', color: 'var(--green)' }}>✅ Payée</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2} style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--txt3)', paddingTop: 8 }}>
                            Total plan
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {fmt(echeances.reduce((s, e) => s + parseFloat(e.montant || 0), 0))}
                          </td>
                          <td colSpan={canWrite ? 2 : 1}>
                            <span style={{ fontSize: '.72rem', color: 'var(--txt3)' }}>
                              {echeances.filter(e => e.statut === 'payee').length}/{echeances.length} payées
                              {' · '}
                              <span style={{ color: 'var(--green)' }}>
                                {fmt(echeances.filter(e => e.statut === 'payee').reduce((s, e) => s + parseFloat(e.montant || 0), 0))} encaissés
                              </span>
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {canWrite && (
                    <div style={{ marginTop: 10, textAlign: 'right' }}>
                      <button className="btn btn-sm" onClick={() => openEncaissement(planDossier)}>
                        ➕ Encaissement libre
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--txt3)' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>📅</div>
                  <div style={{ fontSize: '.85rem' }}>Aucun plan d'échelonnement créé</div>
                  <button className="btn-primary" style={{ marginTop: 12, fontSize: '.8rem' }} onClick={() => setPlanTab('creer')}>
                    ➕ Créer un plan
                  </button>
                </div>
              )
            )}

            {/* ── Créer / Recréer le plan ── */}
            {planTab === 'creer' && (
              <div>
                {planErr && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠️</span> {planErr}</div>}

                {echeances.length > 0 && (
                  <div style={{ background: 'var(--orange-dim)', border: '1px solid var(--orange)', borderRadius: 8, padding: '8px 12px', fontSize: '.78rem', color: 'var(--orange)', marginBottom: 12 }}>
                    ⚠️ Un plan existe déjà ({echeances.length} échéance(s)). Le recréer supprimera les échéances en attente.
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Mode</label>
                  <select className="form-select" value={planMode} onChange={(e) => setPlanMode(e.target.value)}>
                    <option value="mensualites">Mensualités fixes</option>
                    <option value="dates_libres">Dates libres</option>
                  </select>
                </div>

                {planMode === 'mensualites' && (() => {
                  const r = resumePlan || planDossier || {};
                  const encTotal = r.total_encaisse != null
                    ? parseFloat(r.total_encaisse)
                    : dossierEncs.reduce((s, e) => s + parseFloat(e.montant || 0), 0);
                  const fp        = parseFloat(r.financement_personnel || r.cout_total_formation || 0);
                  const resteDu   = Math.max(0, fp - encTotal);
                  const mensualite = planNbMois > 0 ? Math.round((resteDu / planNbMois) * 100) / 100 : 0;

                  return (
                    <>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Nombre de mensualités</label>
                          <select className="form-select" value={planNbMois} onChange={(e) => setPlanNbMois(parseInt(e.target.value))}>
                            {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                              <option key={n} value={n}>{n} mensualité{n > 1 ? 's' : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Date de la 1ère mensualité *</label>
                          <input className="form-input" type="date" value={planDateDebut} onChange={(e) => setPlanDateDebut(e.target.value)} />
                        </div>
                      </div>

                      {/* Aperçu calcul automatique */}
                      {resteDu > 0 && (
                        <div style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                          <div style={{ fontSize: '.72rem', color: 'var(--txt3)', marginBottom: 6 }}>📊 Calcul automatique</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <span style={{ fontSize: '.82rem' }}>
                              Reste dû : <strong>{fmt(resteDu)}</strong>
                              {encTotal > 0 && <span style={{ color: 'var(--txt3)', fontSize: '.75rem' }}> (après {fmt(encTotal)} encaissés)</span>}
                            </span>
                            <span style={{ fontSize: '.82rem' }}>
                              ÷ {planNbMois} =
                              <strong style={{ color: 'var(--brand)', fontSize: '1rem', marginLeft: 6 }}>{fmt(mensualite)} / mois</strong>
                            </span>
                          </div>
                          {planDateDebut && (
                            <div style={{ marginTop: 8, fontSize: '.75rem', color: 'var(--txt3)' }}>
                              Échéances prévues : {Array.from({ length: planNbMois }, (_, i) => {
                                const d = new Date(planDateDebut);
                                d.setMonth(d.getMonth() + i);
                                return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
                              }).join(' · ')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Option prélèvement automatique */}
                      <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 4 }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={planPrelevement}
                            onChange={(e) => setPlanPrelevement(e.target.checked)}
                            style={{ marginTop: 2 }}
                          />
                          <div>
                            <div style={{ fontSize: '.82rem', fontWeight: 600 }}>🏦 Prélèvement automatique SEPA</div>
                            <div style={{ fontSize: '.72rem', color: 'var(--txt3)', marginTop: 2 }}>
                              Marque les échéances comme "à prélever". L'IBAN et le mandat SEPA doivent être configurés dans le dossier apprenant.
                            </div>
                          </div>
                        </label>
                      </div>
                    </>
                  );
                })()}

                {planMode === 'dates_libres' && (
                  <div>
                    <div style={{ marginBottom: 8, fontSize: '.78rem', color: 'var(--txt3)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Définissez chaque échéance</span>
                      <span style={{ fontWeight: 600, color: planDossier && Math.abs(planRowsTotal - planDossier.financement_personnel) < 0.03 ? 'var(--green)' : 'var(--orange)' }}>
                        Total saisi : {fmt(planRowsTotal)} / {fmt(planDossier?.financement_personnel)}
                      </span>
                    </div>
                    {planRows.map((row, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <input className="form-input" type="date" style={{ flex: 1 }}
                          value={row.date_echeance} onChange={(e) => updatePlanRow(i, 'date_echeance', e.target.value)} />
                        <input className="form-input" type="number" placeholder="Montant €" style={{ flex: 1 }}
                          value={row.montant} onChange={(e) => updatePlanRow(i, 'montant', e.target.value)} />
                        {planRows.length > 1 && (
                          <button className="btn btn-sm" style={{ color: 'var(--red)', borderColor: 'var(--red)', flexShrink: 0 }}
                            onClick={() => removePlanRow(i)}>✕</button>
                        )}
                      </div>
                    ))}
                    <button className="btn btn-sm" style={{ marginTop: 4 }} onClick={addPlanRow}>
                      ➕ Ajouter une échéance
                    </button>
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <button
                    className="btn-primary"
                    onClick={handleCreatePlan}
                    disabled={planSaving}
                    style={{ width: '100%' }}
                  >
                    {planSaving ? '⏳ Création…' : (echeances.length > 0 ? '🔄 Recréer le plan' : '✅ Créer le plan')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Historique des encaissements ── */}
            {planTab === 'historique' && (
              dossierEncs.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Montant</th>
                        <th>Mode</th>
                        <th>Saisi par</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossierEncs.map((e) => (
                        <tr key={e.id}>
                          <td>{e.date_encaissement ? new Date(e.date_encaissement).toLocaleDateString('fr-FR') : '—'}</td>
                          <td style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(e.montant)}</td>
                          <td><span className="badge badge-blue">{MODE_LABELS[e.mode_paiement] || e.mode_paiement}</span></td>
                          <td style={{ fontSize: '.78rem', color: 'var(--txt3)' }}>{e.saisi_par || '—'}</td>
                          <td style={{ fontSize: '.78rem', color: 'var(--txt3)' }}>{e.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--txt3)', paddingTop: 8 }}>Total</td>
                        <td style={{ fontWeight: 700, color: 'var(--green)' }}>
                          {fmt(dossierEncs.reduce((s, e) => s + parseFloat(e.montant || 0), 0))}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--txt3)', fontSize: '.85rem' }}>
                  Aucun encaissement enregistré pour ce dossier.
                </div>
              )
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
