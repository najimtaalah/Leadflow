import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtCA(n) {
  if (n == null || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
}

// ── Export PDF (print window) ─────────────────────────────────────────────────
function exportPDF(title, bodyHtml) {
  const w = window.open('', '_blank', 'width=920,height=720');
  if (!w) { alert('Autorisez les pop-ups pour exporter en PDF.'); return; }
  w.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${title}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#222;margin:24px}
  h1{font-size:15px;margin:0 0 3px}
  .sub{font-size:10px;color:#888;margin-bottom:18px}
  table{border-collapse:collapse;width:100%;margin:10px 0}
  th{background:#f0f4f8;font-weight:600;text-align:left;padding:6px 8px;border:1px solid #ddd}
  td{padding:5px 8px;border:1px solid #e5e5e5}
  tr:nth-child(even){background:#fafafa}
  .tot{background:#f0f4f8!important;font-weight:700}
  .r{text-align:right}
  .g{color:#16a34a;font-weight:600}
  .o{color:#d97706}
  .sec{font-size:12px;font-weight:700;margin:18px 0 6px;border-bottom:2px solid #3b82f6;padding-bottom:4px}
  .kpis{display:flex;gap:14px;margin:10px 0 16px;flex-wrap:wrap}
  .kpi{border:1px solid #ddd;border-radius:6px;padding:8px 14px;min-width:120px}
  .kpi-l{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.04em}
  .kpi-v{font-size:14px;font-weight:700;margin-top:2px}
  @media print{body{margin:0}button{display:none}}
</style></head><body>
<h1>${title}</h1>
<div class="sub">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} — LeadFlow CRM</div>
${bodyHtml}
<script>window.onload=()=>window.print()<\/script>
</body></html>`);
  w.document.close();
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color, sub }) {
  const colorMap = {
    blue:   { bg: 'var(--brand-dim)',  fg: 'var(--brand)' },
    green:  { bg: 'var(--green-dim)',  fg: 'var(--green)' },
    orange: { bg: 'var(--orange-dim)', fg: 'var(--orange)' },
    purple: { bg: 'var(--purple-dim)', fg: 'var(--purple)' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <div className="kpi-icon" style={{ background: c.bg, color: c.fg }}>{icon}</div>
      </div>
      <div className="kpi-value">{value ?? '—'}</div>
      {sub && <div className="kpi-delta delta-nt">{sub}</div>}
    </div>
  );
}

function TauxBadge({ taux }) {
  if (taux == null) return null;
  return (
    <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
      {Number(taux).toFixed(1)} %
    </span>
  );
}

// ── Vue Commercial ────────────────────────────────────────────────────────────

function VueCommercial({ mois }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = mois ? `?mois=${mois}` : '';
      const res = await api.get(`/commissions/mes-commissions${params}`);
      setData(res.data?.data || null);
    } catch (e) {
      setError(e.response?.data?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [mois]);

  useEffect(() => { load(); }, [load]);

  function handleExport() {
    const periode = mois || 'Toutes périodes';
    const rows = dossiers.map(d => `
      <tr>
        <td>${d.reference || '—'}</td>
        <td>${d.apprenant_nom || '—'}</td>
        <td>${d.formation_souhaitee || '—'}</td>
        <td>${d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : '—'}</td>
        <td class="r">${fmtCA(d.base_calcul)}</td>
        <td class="r">${Number(d.taux_base||0).toFixed(1)} %</td>
        <td class="r g">${fmt(d.commission)}</td>
      </tr>`).join('');
    exportPDF(`Mes Commissions — ${periode}`, `
      <div class="kpis">
        <div class="kpi"><div class="kpi-l">CA total</div><div class="kpi-v">${fmtCA(totalBase)}</div></div>
        <div class="kpi"><div class="kpi-l">Taux</div><div class="kpi-v">${tauxBase} %</div></div>
        <div class="kpi"><div class="kpi-l">Commission totale</div><div class="kpi-v g">${fmt(totalComm)}</div></div>
      </div>
      <div class="sec">Détail par dossier — ${dossiers.length} dossier(s)</div>
      <table>
        <thead><tr><th>Référence</th><th>Apprenant</th><th>Formation</th><th>Date</th><th class="r">CA</th><th class="r">Taux</th><th class="r">Commission</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7">Aucun dossier</td></tr>'}</tbody>
        <tfoot><tr class="tot"><td colspan="4">TOTAL</td><td class="r">${fmtCA(totalBase)}</td><td></td><td class="r g">${fmt(totalComm)}</td></tr></tfoot>
      </table>`);
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (error)   return <div className="empty-state"><div className="empty-state-text" style={{ color: 'var(--red)' }}>{error}</div></div>;

  const dossiers   = data?.dossiers || [];
  const totalBase  = data?.total_base  || 0;
  const totalComm  = data?.total_commission || 0;
  const tauxBase   = data?.taux_base   || 6.5;

  return (
    <>
      {/* KPIs */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <KpiCard label="CA total" value={fmtCA(totalBase)} icon="💰" color="blue"
          sub={`${dossiers.length} dossier${dossiers.length !== 1 ? 's' : ''}`} />
        <KpiCard label="Taux de commission" value={`${tauxBase} %`} icon="📊" color="purple" />
        <KpiCard label="Commission totale" value={fmt(totalComm)} icon="✅" color="green" />
      </div>

      {/* Tableau dossiers */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="card-title" style={{ margin: 0 }}>Détail par dossier</div>
          <button className="btn btn-sm" onClick={handleExport} title="Exporter en PDF">
            🖨 Export PDF
          </button>
        </div>
        {dossiers.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Apprenant</th>
                  <th>Formation</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>CA</th>
                  <th style={{ textAlign: 'right' }}>Taux</th>
                  <th style={{ textAlign: 'right' }}>Commission</th>
                </tr>
              </thead>
              <tbody>
                {dossiers.map((d) => (
                  <tr key={d.dossier_id}>
                    <td><span className="badge badge-blue">{d.reference || '—'}</span></td>
                    <td>{d.apprenant_nom || '—'}</td>
                    <td style={{ color: 'var(--txt3)', fontSize: '.82rem' }}>{d.formation_souhaitee || '—'}</td>
                    <td style={{ color: 'var(--txt3)', fontSize: '.82rem' }}>
                      {d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtCA(d.base_calcul)}</td>
                    <td style={{ textAlign: 'right' }}><TauxBadge taux={d.taux_base} /></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>
                      {fmt(d.commission)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg2)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '10px 12px' }}>TOTAL</td>
                  <td style={{ textAlign: 'right' }}>{fmtCA(totalBase)}</td>
                  <td style={{ textAlign: 'right' }}></td>
                  <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt(totalComm)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-text">Aucun dossier{mois ? ' pour ce mois' : ''}</div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Vue Manager ───────────────────────────────────────────────────────────────

function VueManager({ mois }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [showEquipe, setShowEquipe] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = mois ? `?mois=${mois}` : '';
      const res = await api.get(`/commissions/mes-commissions${params}`);
      setData(res.data?.data || null);
    } catch (e) {
      setError(e.response?.data?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [mois]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (error)   return <div className="empty-state"><div className="empty-state-text" style={{ color: 'var(--red)' }}>{error}</div></div>;

  const manager = data?.manager   || {};
  const equipe  = data?.equipe    || {};
  const totaux_m = data?.totaux   || {};

  function handleExport() {
    const periode  = mois || 'Toutes périodes';
    const membres  = equipe.membres || [];
    const tauxS    = equipe.taux_supplement || 1.5;
    const suppl    = equipe.supplement_manager || 0;
    const totalCE  = equipe.total_comm_equipe || 0;
    const rowsEq   = membres.map(m => `
      <tr>
        <td>${m.vendeur_nom}</td>
        <td class="r">${m.nb_dossiers || 0}</td>
        <td class="r">${fmtCA(m.base_calcul)}</td>
        <td class="r">${Number(m.taux_base||0).toFixed(1)} %</td>
        <td class="r g">${fmt(m.commission)}</td>
      </tr>`).join('');
    exportPDF(`Commissions Manager — ${periode}`, `
      <div class="kpis">
        <div class="kpi"><div class="kpi-l">CA propre</div><div class="kpi-v">${fmtCA(manager.base_calcul_propre)}</div></div>
        <div class="kpi"><div class="kpi-l">Commission propre</div><div class="kpi-v">${fmt(manager.commission_propre)}</div></div>
        <div class="kpi"><div class="kpi-l">Supplément équipe</div><div class="kpi-v o">+${fmt(suppl)}</div></div>
        <div class="kpi"><div class="kpi-l">Commission totale</div><div class="kpi-v g">${fmt(totaux_m.commission_totale)}</div></div>
      </div>
      <div class="sec">Mon équipe (${membres.length} commercial${membres.length!==1?'aux':''})</div>
      <table>
        <thead><tr><th>Commercial</th><th class="r">Dossiers</th><th class="r">CA</th><th class="r">Taux</th><th class="r">Commission</th></tr></thead>
        <tbody>${rowsEq || '<tr><td colspan="5">Aucun commercial</td></tr>'}</tbody>
        <tfoot><tr class="tot"><td colspan="3">Total équipe</td><td></td><td class="r o">${fmt(totalCE)} → <span class="g">+${fmt(suppl)} (${tauxS}%)</span></td></tr></tfoot>
      </table>`);
  }
  const totaux  = data?.totaux    || {};

  const membres        = equipe.membres            || [];
  const totalCommEquipe = equipe.total_comm_equipe  || 0;
  const supplement     = equipe.supplement_manager  || 0;
  const tauxSuppl      = equipe.taux_supplement     || 1.5;

  return (
    <>
      {/* Bouton export */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-sm" onClick={handleExport} title="Exporter en PDF">🖨 Export PDF</button>
      </div>

      {/* KPIs manager */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <KpiCard
          label="CA propre"
          value={fmtCA(manager.base_calcul_propre)}
          icon="💼"
          color="blue"
          sub={`${manager.nb_dossiers_propres || 0} dossier${manager.nb_dossiers_propres !== 1 ? 's' : ''}`}
        />
        <KpiCard
          label="Commission propre"
          value={fmt(manager.commission_propre)}
          icon="💰"
          color="purple"
          sub={`Taux ${manager.taux_base || 6.5} %`}
        />
        <KpiCard
          label={`Supplément équipe (+${tauxSuppl} %)`}
          value={fmt(supplement)}
          icon="👥"
          color="orange"
          sub={`Sur ${fmt(totalCommEquipe)} commissions équipe`}
        />
        <KpiCard
          label="Commission totale"
          value={fmt(totaux.commission_totale)}
          icon="✅"
          color="green"
          sub="Propre + supplément équipe"
        />
      </div>

      {/* Récapitulatif formule */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 18px', background: 'var(--brand-dim)' }}>
        <div style={{ fontSize: '.82rem', color: 'var(--brand)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong>Formule :</strong>
          <span>Commission propre <strong>{fmt(manager.commission_propre)}</strong> ({manager.taux_base || 6.5}% × CA)</span>
          <span style={{ color: 'var(--txt3)' }}>+</span>
          <span>Supplément équipe <strong>{fmt(supplement)}</strong> ({tauxSuppl}% × commissions équipe)</span>
          <span style={{ color: 'var(--txt3)' }}>=</span>
          <span style={{ fontWeight: 700, fontSize: '.9rem' }}>Total : <strong>{fmt(totaux.commission_totale)}</strong></span>
        </div>
      </div>

      {/* Tableau équipe */}
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
          onClick={() => setShowEquipe(o => !o)}
        >
          <div className="card-title" style={{ margin: 0 }}>
            Mon équipe ({membres.length} commercial{membres.length !== 1 ? 'aux' : ''})
          </div>
          <span style={{ fontSize: '.8rem', color: 'var(--txt3)' }}>{showEquipe ? '▲ Réduire' : '▼ Afficher'}</span>
        </div>
        {showEquipe && (
          membres.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Commercial</th>
                    <th style={{ textAlign: 'right' }}>Dossiers</th>
                    <th style={{ textAlign: 'right' }}>CA</th>
                    <th style={{ textAlign: 'right' }}>Taux</th>
                    <th style={{ textAlign: 'right' }}>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {membres.map((m) => (
                    <tr key={m.vendeur_id}>
                      <td><strong>{m.vendeur_nom}</strong></td>
                      <td style={{ textAlign: 'right' }}>{m.nb_dossiers || 0}</td>
                      <td style={{ textAlign: 'right' }}>{fmtCA(m.base_calcul)}</td>
                      <td style={{ textAlign: 'right' }}><TauxBadge taux={m.taux_base} /></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>
                        {fmt(m.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg2)', fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '10px 12px' }}>
                      Total équipe → Supplément manager ({tauxSuppl}%)
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--orange)' }}>
                      {fmt(totalCommEquipe)} → <span style={{ color: 'var(--green)' }}>+{fmt(supplement)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-text">Aucun commercial dans votre équipe</div>
            </div>
          )
        )}
      </div>
    </>
  );
}

// ── Vue Admin ─────────────────────────────────────────────────────────────────

function VueAdmin({ mois }) {
  const [data, setData]         = useState([]);
  const [kpis, setKpis]         = useState(null);
  const [taux, setTaux]         = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = mois ? `?mois=${mois}` : '';
      const res = await api.get(`/commissions/equipe${params}`);
      setData(res.data?.data  || []);
      setKpis(res.data?.kpis  || null);
      setTaux(res.data?.taux  || {});
    } catch (e) {
      setError(e.response?.data?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [mois]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (error)   return <div className="empty-state"><div className="empty-state-text" style={{ color: 'var(--red)' }}>{error}</div></div>;

  const tauxCom  = taux.commercial?.taux_base            || 6.5;
  const tauxMgr  = taux.manager?.taux_base               || 6.5;
  const tauxSuppl= taux.manager?.taux_supplement_equipe  || 1.5;

  const commerciaux = data.filter(d => d.role_nom === 'commercial');
  const managers    = data.filter(d => d.role_nom === 'manager');

  function handleExport() {
    const periode = mois || 'Toutes périodes';
    const rowsMgr = managers.map(m => `
      <tr>
        <td>${m.vendeur_nom}</td>
        <td>${m.agence_nom || '—'}</td>
        <td class="r">${m.nb_dossiers || 0}</td>
        <td class="r">${fmtCA(m.base_calcul)}</td>
        <td class="r">${fmt(m.commission_base)}</td>
        <td class="r o">${m.supplement_equipe > 0 ? '+' + fmt(m.supplement_equipe) : '—'}</td>
        <td class="r g">${fmt(m.commission_totale)}</td>
      </tr>`).join('');
    const rowsCom = commerciaux.map(c => `
      <tr>
        <td>${c.vendeur_nom}</td>
        <td>${c.agence_nom || '—'}</td>
        <td class="r">${c.nb_dossiers || 0}</td>
        <td class="r">${fmtCA(c.base_calcul)}</td>
        <td class="r">${Number(c.taux_base||0).toFixed(1)} %</td>
        <td class="r g">${fmt(c.commission_totale)}</td>
      </tr>`).join('');
    const totalCom = commerciaux.reduce((s,c) => s + parseFloat(c.commission_totale||0), 0);
    exportPDF(`Commissions Équipe — ${periode}`, `
      <div class="kpis">
        <div class="kpi"><div class="kpi-l">Commerciaux</div><div class="kpi-v">${kpis?.nb_commerciaux ?? '—'}</div></div>
        <div class="kpi"><div class="kpi-l">Dossiers totaux</div><div class="kpi-v">${kpis?.nb_dossiers_total ?? '—'}</div></div>
        <div class="kpi"><div class="kpi-l">CA total</div><div class="kpi-v">${fmtCA(kpis?.ca_total)}</div></div>
        <div class="kpi"><div class="kpi-l">Commissions totales</div><div class="kpi-v g">${fmt(kpis?.total_commissions)}</div></div>
      </div>
      ${managers.length > 0 ? `
      <div class="sec">Managers (${managers.length})</div>
      <table>
        <thead><tr><th>Manager</th><th>Agence</th><th class="r">Dossiers</th><th class="r">CA propre</th><th class="r">Comm. propre</th><th class="r">Supplément</th><th class="r">Total</th></tr></thead>
        <tbody>${rowsMgr}</tbody>
      </table>` : ''}
      <div class="sec">Commerciaux (${commerciaux.length})</div>
      <table>
        <thead><tr><th>Commercial</th><th>Agence</th><th class="r">Dossiers</th><th class="r">CA</th><th class="r">Taux</th><th class="r">Commission</th></tr></thead>
        <tbody>${rowsCom || '<tr><td colspan="6">Aucun commercial</td></tr>'}</tbody>
        <tfoot><tr class="tot"><td colspan="5">TOTAL commerciaux</td><td class="r g">${fmt(totalCom)}</td></tr></tfoot>
      </table>`);
  }

  return (
    <>
      {/* Bouton export */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-sm" onClick={handleExport} title="Exporter en PDF">🖨 Export PDF</button>
      </div>

      {/* KPIs globaux */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <KpiCard label="Commerciaux actifs"  value={kpis?.nb_commerciaux ?? '—'}     icon="👥" color="blue" />
        <KpiCard label="Dossiers totaux"      value={kpis?.nb_dossiers_total ?? '—'}  icon="📁" color="purple" />
        <KpiCard label="CA total"             value={fmtCA(kpis?.ca_total)}           icon="💰" color="orange" />
        <KpiCard label="Commissions totales"  value={fmt(kpis?.total_commissions)}    icon="✅" color="green" />
      </div>

      {/* Taux configurés */}
      <div className="card" style={{ marginBottom: 16, padding: '10px 18px', background: 'var(--bg2)' }}>
        <div style={{ display: 'flex', gap: 24, fontSize: '.82rem', color: 'var(--txt2)', flexWrap: 'wrap' }}>
          <span>⚙️ Taux configurés :</span>
          <span>Commercial : <TauxBadge taux={tauxCom} /></span>
          <span>Manager (propre) : <TauxBadge taux={tauxMgr} /></span>
          <span>Supplément équipe : <TauxBadge taux={tauxSuppl} /></span>
        </div>
      </div>

      {/* Managers */}
      {managers.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 16 }}>
          <div className="card-title" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            Managers ({managers.length})
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Manager</th>
                  <th>Agence</th>
                  <th style={{ textAlign: 'right' }}>Dossiers</th>
                  <th style={{ textAlign: 'right' }}>CA propre</th>
                  <th style={{ textAlign: 'right' }}>Comm. propre</th>
                  <th style={{ textAlign: 'right' }}>Supplément</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => (
                  <React.Fragment key={m.vendeur_id}>
                    <tr
                      style={{ cursor: 'pointer', background: expanded[m.vendeur_id] ? 'var(--brand-dim)' : undefined }}
                      onClick={() => toggleExpand(m.vendeur_id)}
                    >
                      <td style={{ width: 32, textAlign: 'center', fontSize: '.8rem' }}>
                        {expanded[m.vendeur_id] ? '▲' : '▶'}
                      </td>
                      <td><strong>{m.vendeur_nom}</strong></td>
                      <td style={{ color: 'var(--txt3)', fontSize: '.82rem' }}>{m.agence_nom || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{m.nb_dossiers || 0}</td>
                      <td style={{ textAlign: 'right' }}>{fmtCA(m.base_calcul)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(m.commission_base)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--orange)' }}>
                        {m.supplement_equipe > 0 ? `+${fmt(m.supplement_equipe)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                        {fmt(m.commission_totale)}
                      </td>
                    </tr>
                    {expanded[m.vendeur_id] && (
                      <tr>
                        <td colSpan={8} style={{ padding: '8px 24px 12px', background: 'var(--bg2)' }}>
                          <div style={{ fontSize: '.8rem', color: 'var(--txt3)', marginBottom: 8 }}>
                            Équipe de {m.vendeur_nom}
                          </div>
                          {(() => {
                            // detail_manager est l'objet equipe: { membres, total_comm_equipe, ... }
                            const equipeDetail = m.detail_manager;
                            const membresList  = Array.isArray(equipeDetail)
                              ? equipeDetail
                              : (equipeDetail?.membres || []);
                            return membresList.length > 0 ? (
                              <table style={{ width: '100%' }}>
                                <thead>
                                  <tr>
                                    <th>Commercial</th>
                                    <th style={{ textAlign: 'right' }}>Dossiers</th>
                                    <th style={{ textAlign: 'right' }}>CA</th>
                                    <th style={{ textAlign: 'right' }}>Commission</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {membresList.map((dm) => (
                                    <tr key={dm.vendeur_id}>
                                      <td>{dm.vendeur_nom}</td>
                                      <td style={{ textAlign: 'right' }}>{dm.nb_dossiers}</td>
                                      <td style={{ textAlign: 'right' }}>{fmtCA(dm.base_calcul)}</td>
                                      <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt(dm.commission)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <span style={{ color: 'var(--txt3)', fontSize: '.8rem' }}>Aucun commercial dans cette équipe</span>
                            );
                          })()}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commerciaux */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          Commerciaux ({commerciaux.length})
        </div>
        {commerciaux.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Commercial</th>
                  <th>Agence</th>
                  <th style={{ textAlign: 'right' }}>Dossiers</th>
                  <th style={{ textAlign: 'right' }}>CA</th>
                  <th style={{ textAlign: 'right' }}>Taux</th>
                  <th style={{ textAlign: 'right' }}>Commission</th>
                </tr>
              </thead>
              <tbody>
                {commerciaux.map((c) => (
                  <tr key={c.vendeur_id}>
                    <td><strong>{c.vendeur_nom}</strong></td>
                    <td style={{ color: 'var(--txt3)', fontSize: '.82rem' }}>{c.agence_nom || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{c.nb_dossiers || 0}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCA(c.base_calcul)}</td>
                    <td style={{ textAlign: 'right' }}><TauxBadge taux={c.taux_base} /></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>
                      {fmt(c.commission_totale)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg2)', fontWeight: 700 }}>
                  <td colSpan={5} style={{ padding: '10px 12px' }}>TOTAL commerciaux</td>
                  <td style={{ textAlign: 'right', color: 'var(--green)' }}>
                    {fmt(commerciaux.reduce((s, c) => s + parseFloat(c.commission_totale || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div className="empty-state-text">Aucun commercial</div></div>
        )}
      </div>
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function Commissions() {
  const { user } = useAuthStore();
  const role = user?.role || user?.role_nom || '';
  const [mois, setMois] = useState('');

  const isAdmin    = ['super_admin', 'role_admin'].includes(role);
  const isManager  = role === 'manager';
  const isCommercial = role === 'commercial';

  return (
    <div className="page-enter">

      {/* En-tête */}
      <div className="section-header">
        <div>
          <div className="section-title">Commissions</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            {isAdmin    && 'Tableau commissions équipe — Commercial 6,5% · Manager 6,5% + 1,5% équipe'}
            {isManager  && 'Vos commissions — Commission propre (6,5%) + supplément équipe (1,5%)'}
            {isCommercial && 'Vos commissions — Taux : 6,5% du CA dossiers'}
          </p>
        </div>
        <div className="section-actions">
          <input
            type="month"
            className="form-input"
            style={{ width: 160 }}
            value={mois}
            onChange={(e) => setMois(e.target.value)}
            title="Filtrer par mois"
          />
          {mois && (
            <button className="btn btn-sm" onClick={() => setMois('')}>✕ Tout</button>
          )}
        </div>
      </div>

      {/* Contenu selon le rôle */}
      {isAdmin     && <VueAdmin     mois={mois} />}
      {isManager   && <VueManager   mois={mois} />}
      {isCommercial && <VueCommercial mois={mois} />}

      {!isAdmin && !isManager && !isCommercial && (
        <div className="empty-state">
          <div className="empty-state-text">Accès non autorisé pour votre rôle.</div>
        </div>
      )}

    </div>
  );
}
