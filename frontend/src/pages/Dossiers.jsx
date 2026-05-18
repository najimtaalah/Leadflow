import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import useAuthStore from '../store/authStore';
import FinancementTab from '../components/dossiers/FinancementTab';

const STATUTS_DOSSIER = ['Actif', 'En attente', 'Clôturé', 'Annulé'];
const STATUT_COLORS = {
  'Actif':      'badge-green',
  'En attente': 'badge-orange',
  'Clôturé':    'badge-teal',
  'Annulé':     'badge-red',
};

const emptyForm = {
  nom: '', prenom: '', telephone: '', email: '',
  formation_souhaitee: '', statut: 'Actif',
  session_cours_id: '', session_edof_id: '', examen_id: '',
  cout_total_formation: '', part_financeur: '',
};

// ── Statut CMA calculé ──────────────────────────────────────────────────────
function getStatutCMA(d) {
  if (!d.frais_cma || parseFloat(d.frais_cma) === 0) return { label: 'En attente', cls: 'badge-orange' };
  if (d.frais_cma_paye) return { label: 'Validée ✓', cls: 'badge-green' };
  return { label: 'Bloquée', cls: 'badge-red' };
}

// ── Badge résultat examen ───────────────────────────────────────────────────
function ResultatBadge({ val }) {
  if (!val) return <span style={{ color: 'var(--txt3)' }}>—</span>;
  const map = {
    admis:      { label: 'Admis',      cls: 'badge-green'  },
    echec:      { label: 'Échec',      cls: 'badge-red'    },
    en_attente: { label: 'En attente', cls: 'badge-orange' },
  };
  const b = map[val] || { label: val, cls: 'badge-gray' };
  return <span className={`badge ${b.cls}`}>{b.label}</span>;
}

export default function Dossiers() {
  const { user } = useAuthStore();
  const role = user?.role || user?.role_nom || '';
  const canEditCMA = ['super_admin', 'role_admin', 'role_administratif'].includes(role);

  // ── Onglet actif ────────────────────────────────────────────────────────
  const [tab, setTab] = useState('liste');

  // ── Données principales ─────────────────────────────────────────────────
  const [dossiers, setDossiers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');
  const [search, setSearch]         = useState('');

  // ── Modal création / édition ────────────────────────────────────────────
  const [showModal, setShowModal]   = useState(false);
  const [editId, setEditId]         = useState(null);

  // ── Modal Financement dossier ────────────────────────────────────────────
  const [showFinancement, setShowFinancement]   = useState(false);
  const [financementDossier, setFinancementDossier] = useState(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');

  // ── Références (formations / sessions) ─────────────────────────────────
  const [formations, setFormations]     = useState([]);
  const [allSessions, setAllSessions]   = useState([]);
  const [selectedFormationId, setSelectedFormationId] = useState('');

  // ── CMA inline edit ─────────────────────────────────────────────────────
  const [cmaFilter, setCmaFilter]     = useState('all'); // all | nonpaye
  const [cmaEditing, setCmaEditing]   = useState(null);  // dossier_id en cours d'édition
  const [cmaForm, setCmaForm]         = useState({ frais_cma: '', frais_cma_paye: false });
  const [cmaSaving, setCmaSaving]     = useState(false);

  // ── Pédagogie — panel dossier ────────────────────────────────────────────
  const [pedaExpanded, setPedaExpanded] = useState(null); // dossier_id ouvert
  const [pedaData, setPedaData]         = useState({});   // { [id]: { inscriptions, resultats } }
  const [pedaLoading, setPedaLoading]   = useState(false);

  // ── Sessions filtrées ───────────────────────────────────────────────────
  const filteredCours  = selectedFormationId
    ? allSessions.filter(s => s.type_session === 'cours'  && String(s.formation_id) === String(selectedFormationId))
    : allSessions.filter(s => s.type_session === 'cours');
  const filteredEdof   = selectedFormationId
    ? allSessions.filter(s => s.type_session === 'edof'   && String(s.formation_id) === String(selectedFormationId))
    : allSessions.filter(s => s.type_session === 'edof');
  const filteredExamen = selectedFormationId
    ? allSessions.filter(s => s.type_session === 'examen' && String(s.formation_id) === String(selectedFormationId))
    : allSessions.filter(s => s.type_session === 'examen');

  // ── Chargement dossiers ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/dossiers');
      setDossiers(Array.isArray(data) ? data : data.data || data.dossiers || []);
    } catch {
      setDossiers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadRefs() {
    try {
      const [fRes, sRes] = await Promise.all([
        api.get('/parametrage/formations'),
        api.get('/parametrage/sessions?actif=1'),
      ]);
      setFormations((Array.isArray(fRes.data) ? fRes.data : fRes.data?.data || []).filter(f => f.actif !== 0));
      setAllSessions(Array.isArray(sRes.data) ? sRes.data : sRes.data?.data || []);
    } catch { /* ignore */ }
  }

  // ── Modal ────────────────────────────────────────────────────────────────
  function handleFormationChange(foId) {
    setSelectedFormationId(foId);
    const fo = formations.find(f => String(f.id) === String(foId));
    setForm(p => ({ ...p, formation_souhaitee: fo ? fo.nom : '', session_cours_id: '', session_edof_id: '', examen_id: '' }));
  }

  async function openNew() {
    setEditId(null); setForm(emptyForm); setSelectedFormationId(''); setErr('');
    await loadRefs(); setShowModal(true);
  }

  async function openEdit(dossier) {
    setEditId(dossier.id); await loadRefs();
    setForm({
      nom: dossier.nom || '', prenom: dossier.prenom || '',
      telephone: dossier.telephone || '', email: dossier.email || '',
      formation_souhaitee: dossier.formation_souhaitee || '',
      statut: dossier.statut_nom || dossier.statut || 'Actif',
      session_cours_id: dossier.session_cours_id || '',
      session_edof_id:  dossier.session_edof_id  || '',
      examen_id:        dossier.examen_id        || '',
      cout_total_formation: dossier.cout_total_formation || '',
      part_financeur:       dossier.part_financeur       || '',
    });
    setErr(''); setShowModal(true);
  }

  async function handleSave() {
    if (!form.nom || !form.telephone) { setErr('Nom et téléphone sont requis'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        ...form,
        session_cours_id:     form.session_cours_id     ? parseInt(form.session_cours_id)     : null,
        session_edof_id:      form.session_edof_id      ? parseInt(form.session_edof_id)      : null,
        examen_id:            form.examen_id            ? parseInt(form.examen_id)            : null,
        cout_total_formation: form.cout_total_formation ? parseFloat(form.cout_total_formation) : null,
        part_financeur:       form.part_financeur       ? parseFloat(form.part_financeur)       : null,
      };
      if (editId) await api.patch(`/dossiers/${editId}`, payload);
      else        await api.post('/dossiers', payload);
      setShowModal(false); load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally { setSaving(false); }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── CMA — actions ────────────────────────────────────────────────────────
  function startEditCMA(d) {
    setCmaEditing(d.id);
    setCmaForm({ frais_cma: d.frais_cma || '', frais_cma_paye: !!d.frais_cma_paye });
  }

  async function saveCMA(dossierId) {
    setCmaSaving(true);
    try {
      await api.patch(`/dossiers/${dossierId}/cma`, {
        frais_cma:      cmaForm.frais_cma ? parseFloat(cmaForm.frais_cma) : undefined,
        frais_cma_paye: cmaForm.frais_cma_paye,
      });
      setCmaEditing(null);
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Erreur lors de la sauvegarde CMA');
    } finally { setCmaSaving(false); }
  }

  async function toggleCMAPaye(d) {
    if (!canEditCMA) return;
    if (!d.frais_cma && !d.frais_cma_paye) { startEditCMA(d); return; }
    try {
      await api.patch(`/dossiers/${d.id}/cma`, { frais_cma_paye: !d.frais_cma_paye });
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Erreur');
    }
  }

  // ── Pédagogie — chargement panel ────────────────────────────────────────
  async function togglePeda(dossierId) {
    if (pedaExpanded === dossierId) { setPedaExpanded(null); return; }
    setPedaExpanded(dossierId);
    if (pedaData[dossierId]) return; // déjà chargé
    setPedaLoading(true);
    try {
      const [insRes, resRes] = await Promise.all([
        api.get(`/pedagogie/dossiers/${dossierId}/inscriptions`),
        api.get(`/pedagogie/dossiers/${dossierId}/resultats-cma`),
      ]);
      setPedaData(prev => ({
        ...prev,
        [dossierId]: {
          inscriptions: insRes.data?.data || insRes.data || {},
          resultats:    Array.isArray(resRes.data?.data) ? resRes.data.data : [],
        },
      }));
    } catch {
      setPedaData(prev => ({ ...prev, [dossierId]: { inscriptions: {}, resultats: [] } }));
    } finally { setPedaLoading(false); }
  }

  // ── Filtres ──────────────────────────────────────────────────────────────
  const displayed = dossiers.filter(d => {
    const dStatut = d.statut_nom || d.statut || '';
    const matchStatus = filter === 'all' || dStatut === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      `${d.nom} ${d.prenom} ${d.telephone} ${d.email} ${d.reference || ''}`.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const displayedCMA = dossiers.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      `${d.nom} ${d.prenom} ${d.formation_souhaitee || ''}`.toLowerCase().includes(q);
    const matchFilter = cmaFilter === 'all' || (cmaFilter === 'nonpaye' && !d.frais_cma_paye);
    return matchSearch && matchFilter;
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="page-enter">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="section-header">
        <div>
          <div className="section-title">Dossiers apprenants</div>
          <p style={{ fontSize: '.8rem', color: 'var(--txt3)', marginTop: 2 }}>
            {dossiers.length} dossier{dossiers.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="section-actions">
          <div className="search-box">
            <span style={{ fontSize: 13, color: 'var(--txt3)' }}>🔍</span>
            <input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={openNew}>➕ Nouveau dossier</button>
        </div>
      </div>

      {/* ── Onglets ─────────────────────────────────────────────────────── */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[
          { key: 'liste',     label: '📋 Liste' },
          { key: 'cma',       label: '🏛️ CMA' },
          { key: 'pedagogie', label: '📚 Pédagogie' },
        ].map(t => (
          <button
            key={t.key}
            className={`tab-btn${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'cma' && dossiers.filter(d => !d.frais_cma_paye).length > 0 && (
              <span className="badge badge-red" style={{ marginLeft: 6, fontSize: '.65rem', padding: '1px 5px' }}>
                {dossiers.filter(d => !d.frais_cma_paye).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          ONGLET LISTE
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'liste' && (
        <>
          <div className="filters">
            <button className={`filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
              Tous ({dossiers.length})
            </button>
            {STATUTS_DOSSIER.map(s => {
              const c = dossiers.filter(d => (d.statut_nom || d.statut) === s).length;
              if (c === 0) return null;
              return (
                <button key={s} className={`filter-btn${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
                  {s} ({c})
                </button>
              );
            })}
          </div>

          <div className="card" style={{ padding: 0 }}>
            {loading ? (
              <div className="spinner-wrap"><div className="spinner" /></div>
            ) : displayed.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>N° Dossier</th>
                      <th>Apprenant</th>
                      <th>Téléphone</th>
                      <th>Formation</th>
                      <th>Session cours</th>
                      <th>Session EDOF</th>
                      <th>Examen</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(d => (
                      <tr key={d.id}>
                        <td>
                          {d.reference
                            ? <span className="badge badge-gray" style={{ fontFamily: 'monospace', fontSize: '.72rem' }}>{d.reference}</span>
                            : <span style={{ color: 'var(--txt3)', fontSize: '.72rem' }}>—</span>}
                        </td>
                        <td>
                          <strong style={{ cursor: 'pointer', color: 'var(--brand)' }} onClick={() => openEdit(d)}>
                            {d.prenom ? `${d.prenom} ${d.nom}` : d.nom}
                          </strong>
                        </td>
                        <td>{d.telephone || '—'}</td>
                        <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.formation_souhaitee || '—'}
                        </td>
                        <td>
                          {d.session_cours_code
                            ? <span className="badge badge-blue">{d.session_cours_code}</span>
                            : <span style={{ color: 'var(--txt3)' }}>—</span>}
                        </td>
                        <td>
                          {d.session_edof_code
                            ? <span className="badge badge-purple">{d.session_edof_code}</span>
                            : <span style={{ color: 'var(--txt3)' }}>—</span>}
                        </td>
                        <td>
                          {d.examen_code
                            ? <span className="badge badge-orange">{d.examen_code}</span>
                            : <span style={{ color: 'var(--txt3)' }}>—</span>}
                        </td>
                        <td>
                          <span className={`badge ${STATUT_COLORS[d.statut_nom || d.statut] || 'badge-gray'}`}>
                            {d.statut_nom || d.statut || '—'}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-sm" onClick={() => openEdit(d)} title="Modifier">✏️</button>
                          <button
                            className="btn btn-sm"
                            style={{ marginLeft: 4 }}
                            title="Financement"
                            onClick={() => { setFinancementDossier(d); setShowFinancement(true); }}
                          >🧾</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📁</div>
                <div className="empty-state-text">
                  {search || filter !== 'all' ? 'Aucun résultat' : 'Aucun dossier pour le moment'}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ONGLET CMA
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'cma' && (
        <>
          {/* Info */}
          <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'var(--blue-light, #eff6ff)', border: '1px solid var(--blue-200, #bfdbfe)' }}>
            <p style={{ fontSize: '.82rem', color: 'var(--txt2)', margin: 0 }}>
              🏛️ <strong>Validation des frais CMA</strong> — Les dossiers avec frais CMA non payés sont bloqués pour validation.
              Un badge rouge indique les dossiers à régulariser.
            </p>
          </div>

          {/* Filtres CMA */}
          <div className="filters" style={{ marginBottom: 12 }}>
            <button className={`filter-btn${cmaFilter === 'all' ? ' active' : ''}`} onClick={() => setCmaFilter('all')}>
              Tous ({dossiers.length})
            </button>
            <button className={`filter-btn${cmaFilter === 'nonpaye' ? ' active' : ''}`} onClick={() => setCmaFilter('nonpaye')}>
              ⚠️ CMA non réglées ({dossiers.filter(d => !d.frais_cma_paye).length})
            </button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {loading ? (
              <div className="spinner-wrap"><div className="spinner" /></div>
            ) : displayedCMA.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>N° Dossier</th>
                      <th>Apprenant</th>
                      <th>Formation</th>
                      <th>Frais CMA (€)</th>
                      <th>Statut CMA</th>
                      {canEditCMA && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedCMA.map(d => {
                      const statut = getStatutCMA(d);
                      const isEditing = cmaEditing === d.id;
                      return (
                        <tr key={d.id} style={{ background: !d.frais_cma_paye && d.frais_cma ? 'var(--red-light, #fff1f2)' : undefined }}>
                          <td>
                            <span className="badge badge-gray" style={{ fontFamily: 'monospace', fontSize: '.72rem' }}>
                              {d.reference || `#${d.id}`}
                            </span>
                          </td>
                          <td>
                            <strong>{d.prenom ? `${d.prenom} ${d.nom}` : d.nom}</strong>
                          </td>
                          <td style={{ color: 'var(--txt2)', fontSize: '.82rem' }}>
                            {d.formation_souhaitee || '—'}
                          </td>

                          {/* Frais CMA */}
                          <td>
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                className="form-input"
                                style={{ width: 100, padding: '3px 6px', fontSize: '.82rem' }}
                                value={cmaForm.frais_cma}
                                onChange={e => setCmaForm(p => ({ ...p, frais_cma: e.target.value }))}
                                autoFocus
                              />
                            ) : (
                              <span style={{ fontWeight: 600 }}>
                                {d.frais_cma ? `${parseFloat(d.frais_cma).toLocaleString('fr-FR')} €` : <span style={{ color: 'var(--txt3)' }}>Non saisi</span>}
                              </span>
                            )}
                          </td>

                          {/* Statut CMA */}
                          <td>
                            {isEditing ? (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '.82rem' }}>
                                <input
                                  type="checkbox"
                                  checked={cmaForm.frais_cma_paye}
                                  onChange={e => setCmaForm(p => ({ ...p, frais_cma_paye: e.target.checked }))}
                                />
                                Marquer comme payé
                              </label>
                            ) : (
                              <span className={`badge ${statut.cls}`}>{statut.label}</span>
                            )}
                          </td>

                          {/* Actions */}
                          {canEditCMA && (
                            <td>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => saveCMA(d.id)}
                                    disabled={cmaSaving}
                                  >
                                    {cmaSaving ? '…' : '✓ Sauvegarder'}
                                  </button>
                                  <button className="btn btn-sm" onClick={() => setCmaEditing(null)}>
                                    Annuler
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    className="btn btn-sm"
                                    onClick={() => startEditCMA(d)}
                                    title="Modifier les frais CMA"
                                  >
                                    ✏️ Frais
                                  </button>
                                  {d.frais_cma > 0 && (
                                    <button
                                      className={`btn btn-sm ${d.frais_cma_paye ? 'btn-outline' : 'btn-success'}`}
                                      onClick={() => toggleCMAPaye(d)}
                                      title={d.frais_cma_paye ? 'Marquer non payé' : 'Marquer payé'}
                                    >
                                      {d.frais_cma_paye ? '↩ Impayé' : '✓ Payé'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🏛️</div>
                <div className="empty-state-text">
                  {cmaFilter === 'nonpaye' ? 'Aucun dossier avec CMA non réglée 🎉' : 'Aucun dossier'}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ONGLET PÉDAGOGIE
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'pedagogie' && (
        <>
          <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'var(--purple-light, #f5f3ff)', border: '1px solid #ddd6fe' }}>
            <p style={{ fontSize: '.82rem', color: 'var(--txt2)', margin: 0 }}>
              📚 <strong>Suivi pédagogique</strong> — Sessions assignées et résultats CMA par apprenant.
              Cliquez sur un dossier pour voir le détail.
            </p>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {loading ? (
              <div className="spinner-wrap"><div className="spinner" /></div>
            ) : dossiers.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>N° Dossier</th>
                      <th>Apprenant</th>
                      <th>Formation</th>
                      <th>Cours</th>
                      <th>EDOF</th>
                      <th>Examen</th>
                      <th>Dernier résultat CMA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossiers
                      .filter(d => {
                        const q = search.toLowerCase();
                        return !q || `${d.nom} ${d.prenom} ${d.formation_souhaitee || ''}`.toLowerCase().includes(q);
                      })
                      .map(d => {
                        const isOpen = pedaExpanded === d.id;
                        const pData  = pedaData[d.id];
                        return (
                          <React.Fragment key={d.id}>
                            <tr
                              style={{ cursor: 'pointer', background: isOpen ? 'var(--bg2)' : undefined }}
                              onClick={() => togglePeda(d.id)}
                            >
                              <td style={{ textAlign: 'center', fontSize: '.9rem' }}>
                                {isOpen ? '▼' : '▶'}
                              </td>
                              <td>
                                <span className="badge badge-gray" style={{ fontFamily: 'monospace', fontSize: '.72rem' }}>
                                  {d.reference || `#${d.id}`}
                                </span>
                              </td>
                              <td>
                                <strong>{d.prenom ? `${d.prenom} ${d.nom}` : d.nom}</strong>
                              </td>
                              <td style={{ color: 'var(--txt2)', fontSize: '.82rem' }}>
                                {d.formation_souhaitee || '—'}
                              </td>
                              <td>
                                {d.session_cours_code
                                  ? <span className="badge badge-blue">{d.session_cours_code}</span>
                                  : <span style={{ color: 'var(--txt3)' }}>—</span>}
                              </td>
                              <td>
                                {d.session_edof_code
                                  ? <span className="badge badge-purple">{d.session_edof_code}</span>
                                  : <span style={{ color: 'var(--txt3)' }}>—</span>}
                              </td>
                              <td>
                                {d.examen_code
                                  ? <span className="badge badge-orange">{d.examen_code}</span>
                                  : <span style={{ color: 'var(--txt3)' }}>—</span>}
                              </td>
                              <td>
                                {/* Résumé rapide depuis la liste */}
                                {pData?.resultats?.length > 0
                                  ? <ResultatBadge val={pData.resultats[0]?.resultat} />
                                  : <span style={{ color: 'var(--txt3)', fontSize: '.78rem' }}>—</span>}
                              </td>
                            </tr>

                            {/* ── Panel expandable ─────────────────────── */}
                            {isOpen && (
                              <tr>
                                <td colSpan={8} style={{ padding: 0, background: 'var(--bg2)' }}>
                                  <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
                                    {pedaLoading && !pData ? (
                                      <div style={{ textAlign: 'center', padding: 16 }}>
                                        <div className="spinner" style={{ margin: '0 auto' }} />
                                      </div>
                                    ) : pData ? (
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

                                        {/* ── Sessions ─────────────────── */}
                                        <div>
                                          <div style={{ fontWeight: 700, fontSize: '.8rem', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                                            📅 Sessions assignées
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <SessionRow
                                              label="Cours"
                                              code={pData.inscriptions?.session_cours_code}
                                              debut={pData.inscriptions?.cours_debut}
                                              fin={pData.inscriptions?.cours_fin}
                                              badgeCls="badge-blue"
                                            />
                                            <SessionRow
                                              label="EDOF"
                                              code={pData.inscriptions?.session_edof_code}
                                              debut={pData.inscriptions?.edof_debut}
                                              fin={pData.inscriptions?.edof_fin}
                                              badgeCls="badge-purple"
                                            />
                                            <SessionRow
                                              label="Examen"
                                              code={pData.inscriptions?.examen_code}
                                              debut={pData.inscriptions?.examen_debut}
                                              fin={pData.inscriptions?.examen_fin}
                                              badgeCls="badge-orange"
                                            />
                                          </div>
                                          {canEditCMA && (
                                            <button
                                              className="btn btn-sm"
                                              style={{ marginTop: 12 }}
                                              onClick={e => { e.stopPropagation(); openEdit(d); }}
                                            >
                                              ✏️ Modifier les sessions
                                            </button>
                                          )}
                                        </div>

                                        {/* ── Résultats CMA ────────────── */}
                                        <div>
                                          <div style={{ fontWeight: 700, fontSize: '.8rem', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                                            🎯 Résultats CMA
                                          </div>
                                          {pData.resultats.length === 0 ? (
                                            <div style={{ color: 'var(--txt3)', fontSize: '.82rem', padding: '8px 0' }}>
                                              Aucun résultat synchronisé pour cet apprenant.
                                            </div>
                                          ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                              {pData.resultats.map((r, i) => (
                                                <div key={i} style={{
                                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                  padding: '8px 12px', background: 'var(--bg)', borderRadius: 8,
                                                  border: '1px solid var(--border)', fontSize: '.82rem',
                                                }}>
                                                  <div>
                                                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                                      {r.type_epreuve === 'theorie' ? '📖 Théorie' : '🔧 Pratique'}
                                                    </span>
                                                    <span style={{ color: 'var(--txt3)', marginLeft: 8 }}>
                                                      Session {r.session_code}
                                                    </span>
                                                  </div>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    {r.note && (
                                                      <span style={{ fontWeight: 700, color: 'var(--txt)' }}>
                                                        {r.note}/20
                                                      </span>
                                                    )}
                                                    <ResultatBadge val={r.resultat} />
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {pData.resultats.some(r => r.action_auto) && (
                                            <div style={{ marginTop: 10 }}>
                                              {pData.resultats.filter(r => r.action_auto).map((r, i) => (
                                                <div key={i} style={{ fontSize: '.75rem', color: 'var(--brand)', padding: '4px 0' }}>
                                                  {r.action_auto}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <div className="empty-state-text">Aucun dossier pour le moment</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal création / édition ─────────────────────────────────────── */}
      <Modal
        open={showModal}
        title={editId ? 'Modifier le dossier' : 'Nouveau dossier apprenant'}
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? 'Enregistrement…' : (editId ? 'Mettre à jour' : 'Enregistrer')}
        loading={saving}
      >
        {err && <div className="err-box" style={{ marginBottom: 12 }}><span>⚠️</span> {err}</div>}

        {/* Identité */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nom *</label>
            <input className="form-input" value={form.nom} onChange={e => f('nom', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Prénom</label>
            <input className="form-input" value={form.prenom} onChange={e => f('prenom', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Téléphone *</label>
            <input className="form-input" value={form.telephone} onChange={e => f('telephone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">📚 Formation</label>
            <select className="form-select" value={selectedFormationId || ''} onChange={e => handleFormationChange(e.target.value)}>
              <option value="">— Choisir une formation —</option>
              {formations.map(fo => <option key={fo.id} value={fo.id}>{fo.nom}</option>)}
            </select>
            {form.formation_souhaitee && !selectedFormationId && (
              <div style={{ fontSize: '.72rem', color: 'var(--txt3)', marginTop: 4 }}>Actuel : {form.formation_souhaitee}</div>
            )}
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Statut</label>
            <select className="form-select" value={form.statut} onChange={e => f('statut', e.target.value)}>
              {STATUTS_DOSSIER.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="sep" />
        <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
          Sessions
          {selectedFormationId && <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 8, color: 'var(--brand)' }}>(filtrées)</span>}
        </div>

        <div className="form-group">
          <label className="form-label">📚 Session cours</label>
          <select className="form-select" value={form.session_cours_id} onChange={e => f('session_cours_id', e.target.value)}>
            <option value="">— Aucune —</option>
            {filteredCours.map(s => (
              <option key={s.id} value={s.id}>
                {s.code_session}{selectedFormationId ? '' : ` — ${s.formation_nom}`}
                {s.date_debut ? ` (${new Date(s.date_debut).toLocaleDateString('fr-FR')})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">🏛️ Session EDOF</label>
          <select className="form-select" value={form.session_edof_id} onChange={e => f('session_edof_id', e.target.value)}>
            <option value="">— Aucune —</option>
            {filteredEdof.map(s => (
              <option key={s.id} value={s.id}>
                {s.code_session}{selectedFormationId ? '' : ` — ${s.formation_nom}`}
                {s.date_debut ? ` (${new Date(s.date_debut).toLocaleDateString('fr-FR')})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">📝 Examen</label>
          <select className="form-select" value={form.examen_id} onChange={e => f('examen_id', e.target.value)}>
            <option value="">— Aucun —</option>
            {filteredExamen.map(s => (
              <option key={s.id} value={s.id}>
                {s.code_session}{selectedFormationId ? '' : ` — ${s.formation_nom}`}
                {s.date_debut ? ` (${new Date(s.date_debut).toLocaleDateString('fr-FR')})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="sep" />
        <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
          Financement
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Coût total (€)</label>
            <input className="form-input" type="number" placeholder="0.00"
              value={form.cout_total_formation} onChange={e => f('cout_total_formation', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Part financeur (€)</label>
            <input className="form-input" type="number" placeholder="0.00"
              value={form.part_financeur} onChange={e => f('part_financeur', e.target.value)} />
          </div>
        </div>
        {(form.cout_total_formation || form.part_financeur) && (
          <div style={{ fontSize: '.78rem', color: 'var(--txt3)', marginTop: -4 }}>
            Financement personnel estimé :{' '}
            <strong style={{ color: 'var(--brand)' }}>
              {Math.max(0, (parseFloat(form.cout_total_formation) || 0) - (parseFloat(form.part_financeur) || 0)).toLocaleString('fr-FR')} €
            </strong>
          </div>
        )}
      </Modal>

      {/* ── Modal Financement dossier (Lot 7) ─────────────────────────────── */}
      <Modal
        open={showFinancement}
        title={financementDossier ? `Financement — ${financementDossier.prenom || ''} ${financementDossier.nom}` : 'Financement'}
        onClose={() => setShowFinancement(false)}
      >
        {financementDossier && (
          <FinancementTab dossierId={financementDossier.id} />
        )}
      </Modal>
    </div>
  );
}

// ── Composant ligne session ──────────────────────────────────────────────────
function SessionRow({ label, code, debut, fin, badgeCls }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 10px', background: 'var(--bg)', borderRadius: 8,
      border: '1px solid var(--border)', fontSize: '.82rem',
    }}>
      <span style={{ color: 'var(--txt3)', minWidth: 55 }}>{label}</span>
      {code ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'space-between' }}>
          <span className={`badge ${badgeCls}`}>{code}</span>
          {debut && (
            <span style={{ color: 'var(--txt3)', fontSize: '.75rem' }}>
              {new Date(debut).toLocaleDateString('fr-FR')}
              {fin ? ` → ${new Date(fin).toLocaleDateString('fr-FR')}` : ''}
            </span>
          )}
        </div>
      ) : (
        <span style={{ color: 'var(--txt3)', fontStyle: 'italic', fontSize: '.78rem' }}>Non assigné</span>
      )}
    </div>
  );
}
