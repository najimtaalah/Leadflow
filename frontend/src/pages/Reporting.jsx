import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

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

function pct(v) { return v != null ? `${Number(v).toFixed(1)} %` : '—'; }
function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
}

export default function Reporting() {
  const { user } = useAuthStore();
  const role = user?.role || user?.role_nom || '';
  const isAdmin = ['super_admin', 'role_admin', 'manager'].includes(role);

  const [perf, setPerf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mois, setMois] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = mois ? `?mois=${mois}` : '';
      const { data } = await api.get(`/reporting/performance${params}`);
      setPerf(data?.data || null);
    } catch {
      setPerf(null);
    } finally {
      setLoading(false);
    }
  }, [mois]);

  useEffect(() => { load(); }, [load]);

  const kpis    = perf?.kpis || {};
  const perCom  = perf?.par_commercial || [];
  const sources = perf?.sources || [];

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <div className="section-title">Reporting</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>Performance commerciale</p>
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

      {/* KPIs */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <KpiCard label="Total leads"      value={kpis.total_leads}      icon="👥" color="blue" />
        <KpiCard label="Convertis"        value={kpis.leads_convertis}  icon="🎯" color="green"
          sub={kpis.taux_conversion != null ? `Taux : ${pct(kpis.taux_conversion)}` : null} />
        <KpiCard label="Dossiers créés"   value={kpis.total_dossiers}   icon="📁" color="purple" />
        <KpiCard label="CA généré"        value={fmt(kpis.ca_total)}    icon="💰" color="orange" />
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Performance par commercial — admin/manager only */}
          {isAdmin && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-title" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                Performance par commercial
              </div>
              {perCom.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Commercial</th>
                        <th>Leads</th>
                        <th>Convertis</th>
                        <th>Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perCom.map((c, i) => (
                        <tr key={i}>
                          <td><strong>{c.prenom} {c.nom}</strong></td>
                          <td>{c.total_leads ?? '—'}</td>
                          <td>{c.leads_convertis ?? '—'}</td>
                          <td>
                            <span className={`badge ${(c.taux_conversion || 0) >= 50 ? 'badge-green' : (c.taux_conversion || 0) >= 25 ? 'badge-orange' : 'badge-red'}`}>
                              {pct(c.taux_conversion)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state"><div className="empty-state-text">Aucune donnée</div></div>
              )}
            </div>
          )}

          {/* Sources de leads */}
          <div className="card" style={{ padding: 0, gridColumn: isAdmin ? 'auto' : '1 / -1' }}>
            <div className="card-title" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              Sources de leads
            </div>
            {sources.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Source</th><th>Leads</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {sources.map((s, i) => {
                      const total = sources.reduce((a, x) => a + (x.count || x.total || 0), 0);
                      const count = s.count || s.total || 0;
                      const p = total > 0 ? Math.round(count / total * 100) : 0;
                      return (
                        <tr key={i}>
                          <td>{s.source || 'Non renseigné'}</td>
                          <td>{count}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                                <div style={{ width: `${p}%`, height: '100%', background: 'var(--brand)', borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: '.75rem', color: 'var(--txt3)', width: 32 }}>{p}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-state-text">Aucune donnée</div></div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
