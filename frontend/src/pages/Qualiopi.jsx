import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

const TABS = [
  { key: 'dashboard',   label: '📊 Tableau de bord' },
  { key: 'emargement',  label: '✍️ Émargement' },
  { key: 'evaluation',  label: '📝 Évaluations' },
  { key: 'satisfaction',label: '⭐ Satisfaction' },
  { key: 'documents',   label: '📄 Documents' },
];

// ── Utilitaires ───────────────────────────────────────────────────────────────

function Badge({ val, suffix = '%', good = 70 }) {
  const cls = val == null ? 'badge-gray' : val >= good ? 'badge-green' : val >= 50 ? 'badge-blue' : 'badge-red';
  return <span className={`badge ${cls}`}>{val != null ? `${val}${suffix}` : '—'}</span>;
}

function KpiCard({ icon, label, value, suffix, good }) {
  return (
    <div className="kpi-card" style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '16px 20px', minWidth: 160, flex: 1 }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>
        {value != null ? <><span>{value}</span>{suffix && <span style={{ fontSize: 14, marginLeft: 2 }}>{suffix}</span>}</> : '—'}
      </div>
    </div>
  );
}

// ── Onglet Tableau de bord ────────────────────────────────────────────────────

function TabDashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/qualiopi/dashboard')
      .then(r => setData(r.data?.data || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Chargement…</p>;
  if (!data)   return <p>Données indisponibles.</p>;

  const { satisfaction = {}, evaluations = [], presence = {} } = data;

  const evalPosit = evaluations.find(e => e.type_eval === 'positionnement');
  const evalPost  = evaluations.find(e => e.type_eval === 'post_formation');

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Indicateurs Qualiopi</h2>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <KpiCard icon="✅" label="Taux de présence" value={presence.taux_presence_global} suffix="%" />
        <KpiCard icon="⭐" label="Taux de satisfaction" value={satisfaction.taux_satisfaction_pct} suffix="%" />
        <KpiCard icon="📊" label="Note globale moy." value={satisfaction.avg_note_globale} suffix="/ 5" />
        <KpiCard icon="👥" label="Répondants satisfaction" value={satisfaction.total_repondants} />
        <KpiCard icon="📝" label="Positionnement (moy.)" value={evalPosit?.score_moyen} suffix="%" />
        <KpiCard icon="🎓" label="Post-formation (moy.)" value={evalPost?.score_moyen} suffix="%" />
      </div>

      <h3 style={{ marginBottom: 12 }}>Indicateurs de conformité Qualiopi</h3>
      <table className="table" style={{ maxWidth: 700 }}>
        <thead>
          <tr><th>Indicateur</th><th>Description</th><th>Statut</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Indicateur 3</strong></td>
            <td>Traçabilité des présences</td>
            <td><Badge val={presence.taux_presence_global ?? 0} /></td>
          </tr>
          <tr>
            <td><strong>Indicateur 5</strong></td>
            <td>Évaluation des acquis (positionnement + post)</td>
            <td><Badge val={evalPost?.score_moyen ?? 0} /></td>
          </tr>
          <tr>
            <td><strong>Indicateur 6</strong></td>
            <td>Satisfaction apprenant</td>
            <td><Badge val={satisfaction.taux_satisfaction_pct ?? 0} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Onglet Émargement ─────────────────────────────────────────────────────────

function TabEmargement({ sessions }) {
  const [sessionId, setSessionId]     = useState('');
  const [dateSeance, setDateSeance]   = useState(new Date().toISOString().slice(0, 10));
  const [emargements, setEmargements] = useState([]);
  const [apprenants, setApprenants]   = useState([]);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState('');

  const loadSession = useCallback(async (sid) => {
    if (!sid) return;
    try {
      const r = await api.get(`/qualiopi/sessions/${sid}/emargements`);
      setEmargements(r.data?.data?.emargements || []);
    } catch { setEmargements([]); }

    try {
      const r = await api.get(`/dossiers?session_id=${sid}`);
      const list = r.data?.data || r.data || [];
      setApprenants(list.map(d => ({
        dossier_id: d.id,
        nom: d.nom,
        prenom: d.prenom,
        present: true,
        motif_absence: '',
      })));
    } catch { setApprenants([]); }
  }, []);

  useEffect(() => { if (sessionId) loadSession(sessionId); }, [sessionId, loadSession]);

  function togglePresent(idx) {
    setApprenants(a => a.map((ap, i) => i === idx ? { ...ap, present: !ap.present } : ap));
  }

  async function handleSave() {
    if (!sessionId || !dateSeance || apprenants.length === 0) return;
    setSaving(true); setMsg('');
    try {
      await api.post(`/qualiopi/sessions/${sessionId}/emargements/bulk`, {
        date_seance: dateSeance,
        apprenants:  apprenants.map(a => ({ dossier_id: a.dossier_id, present: a.present, motif_absence: a.motif_absence || null })),
      });
      setMsg('✅ Émargements enregistrés.');
      loadSession(sessionId);
    } catch (e) {
      setMsg('❌ Erreur : ' + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    if (!sessionId) return;
    const r = await api.get(`/qualiopi/sessions/${sessionId}/emargements/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `emargement_session_${sessionId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Émargement numérique</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontWeight: 600 }}>
          Session<br />
          <select value={sessionId} onChange={e => setSessionId(e.target.value)} className="form-control" style={{ minWidth: 200 }}>
            <option value="">— Choisir —</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.code_session} — {s.formation_nom}</option>)}
          </select>
        </label>
        <label style={{ fontWeight: 600 }}>
          Date de séance<br />
          <input type="date" value={dateSeance} onChange={e => setDateSeance(e.target.value)} className="form-control" />
        </label>
        {sessionId && (
          <button onClick={downloadPdf} className="btn btn-secondary">📄 Feuille PDF</button>
        )}
      </div>

      {sessionId && apprenants.length === 0 && <p style={{ color: 'var(--muted)' }}>Aucun apprenant inscrit à cette session.</p>}

      {apprenants.length > 0 && (
        <>
          <table className="table" style={{ marginBottom: 12 }}>
            <thead>
              <tr><th>Apprenant</th><th>Présent</th><th>Motif absence</th></tr>
            </thead>
            <tbody>
              {apprenants.map((a, i) => (
                <tr key={a.dossier_id}>
                  <td>{a.nom} {a.prenom}</td>
                  <td>
                    <input type="checkbox" checked={a.present} onChange={() => togglePresent(i)} />
                  </td>
                  <td>
                    {!a.present && (
                      <input
                        type="text"
                        placeholder="Motif…"
                        value={a.motif_absence}
                        onChange={e => setApprenants(ap => ap.map((x, j) => j === i ? { ...x, motif_absence: e.target.value } : x))}
                        className="form-control"
                        style={{ maxWidth: 220 }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'Enregistrement…' : '💾 Enregistrer'}
          </button>
          {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
        </>
      )}
    </div>
  );
}

// ── Onglet Évaluations ────────────────────────────────────────────────────────

const QUESTIONS_POSITIONNEMENT = [
  'Maîtrisez-vous les bases de la conduite automobile ?',
  'Avez-vous déjà suivi une formation professionnelle dans ce domaine ?',
  'Quel est votre niveau d\'expérience général ?',
];

const QUESTIONS_POST = [
  'Avez-vous atteint les objectifs fixés en début de formation ?',
  'Les connaissances acquises sont-elles applicables dans votre travail ?',
  'Le contenu correspondait-il à vos attentes initiales ?',
];

function TabEvaluation({ sessions }) {
  const [sessionId, setSessionId]     = useState('');
  const [dossierId, setDossierId]     = useState('');
  const [typeEval, setTypeEval]       = useState('positionnement');
  const [reponses, setReponses]       = useState({});
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState('');

  const questions = typeEval === 'positionnement' ? QUESTIONS_POSITIONNEMENT : QUESTIONS_POST;

  function setReponse(idx, val) {
    setReponses(r => ({ ...r, [idx]: val }));
  }

  async function handleSave() {
    if (!sessionId || !dossierId) { setMsg('❌ Session et dossier requis.'); return; }
    const reponsesArr = questions.map((q, i) => ({ question: q, reponse: reponses[i] || '', note: null }));
    setSaving(true); setMsg('');
    try {
      await api.post(`/qualiopi/dossiers/${dossierId}/evaluations`, {
        session_id: parseInt(sessionId),
        type_eval:  typeEval,
        reponses:   reponsesArr,
      });
      setMsg('✅ Évaluation enregistrée.');
      setReponses({});
    } catch (e) {
      setMsg('❌ ' + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Évaluations des acquis</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600 }}>
          Session<br />
          <select value={sessionId} onChange={e => setSessionId(e.target.value)} className="form-control" style={{ minWidth: 200 }}>
            <option value="">— Choisir —</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.code_session}</option>)}
          </select>
        </label>
        <label style={{ fontWeight: 600 }}>
          ID Dossier apprenant<br />
          <input type="number" value={dossierId} onChange={e => setDossierId(e.target.value)} className="form-control" style={{ width: 120 }} />
        </label>
        <label style={{ fontWeight: 600 }}>
          Type<br />
          <select value={typeEval} onChange={e => setTypeEval(e.target.value)} className="form-control">
            <option value="positionnement">Positionnement (pré)</option>
            <option value="post_formation">Post-formation</option>
          </select>
        </label>
      </div>

      {questions.map((q, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{i + 1}. {q}</p>
          <textarea
            value={reponses[i] || ''}
            onChange={e => setReponse(i, e.target.value)}
            className="form-control"
            rows={2}
            style={{ width: '100%', maxWidth: 600 }}
          />
        </div>
      ))}

      <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ marginTop: 8 }}>
        {saving ? 'Enregistrement…' : '💾 Enregistrer'}
      </button>
      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

// ── Onglet Satisfaction ───────────────────────────────────────────────────────

function StarRating({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{
            fontSize: 22,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: value >= n ? '#f5a623' : '#ccc',
          }}
        >★</button>
      ))}
    </div>
  );
}

function TabSatisfaction({ sessions }) {
  const [sessionId, setSessionId]   = useState('');
  const [dossierId, setDossierId]   = useState('');
  const [notes, setNotes]           = useState({ note_contenu: 0, note_formateur: 0, note_organisation: 0, note_locaux: 0, note_globale: 0 });
  const [commentaire, setCommentaire] = useState('');
  const [recommande, setRecommande] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState('');
  const [stats, setStats]           = useState(null);

  function setNote(key, val) { setNotes(n => ({ ...n, [key]: val })); }

  async function loadStats(sid) {
    if (!sid) return;
    try {
      const r = await api.get(`/qualiopi/sessions/${sid}/satisfaction/stats`);
      setStats(r.data?.data || null);
    } catch { setStats(null); }
  }

  useEffect(() => { loadStats(sessionId); }, [sessionId]);

  async function handleSave() {
    if (!sessionId || !dossierId) { setMsg('❌ Session et dossier requis.'); return; }
    setSaving(true); setMsg('');
    try {
      await api.post(`/qualiopi/dossiers/${dossierId}/satisfaction`, {
        session_id:        parseInt(sessionId),
        ...notes,
        commentaire_libre: commentaire,
        recommande,
      });
      setMsg('✅ Satisfaction enregistrée.');
      setNotes({ note_contenu: 0, note_formateur: 0, note_organisation: 0, note_locaux: 0, note_globale: 0 });
      setCommentaire('');
      loadStats(sessionId);
    } catch (e) {
      setMsg('❌ ' + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Questionnaire de satisfaction</h2>

      {stats && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, marginBottom: 20, maxWidth: 500 }}>
          <h3 style={{ marginBottom: 10 }}>Statistiques session</h3>
          <p><strong>Répondants :</strong> {stats.nb_repondants}</p>
          <p><strong>Taux de satisfaction :</strong> <span style={{ color: 'var(--green)', fontWeight: 700 }}>{stats.taux_satisfaction_pct}%</span></p>
          <p><strong>Note globale moy. :</strong> {stats.avg_globale} / 5</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600 }}>
          Session<br />
          <select value={sessionId} onChange={e => setSessionId(e.target.value)} className="form-control" style={{ minWidth: 200 }}>
            <option value="">— Choisir —</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.code_session}</option>)}
          </select>
        </label>
        <label style={{ fontWeight: 600 }}>
          ID Dossier apprenant<br />
          <input type="number" value={dossierId} onChange={e => setDossierId(e.target.value)} className="form-control" style={{ width: 120 }} />
        </label>
      </div>

      {[
        { key: 'note_contenu',      label: 'Contenu de la formation' },
        { key: 'note_formateur',    label: 'Qualité du formateur' },
        { key: 'note_organisation', label: 'Organisation' },
        { key: 'note_locaux',       label: 'Locaux / matériel' },
        { key: 'note_globale',      label: 'Note globale' },
      ].map(({ key, label }) => (
        <div key={key} style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
          <StarRating value={notes[key]} onChange={v => setNote(key, v)} />
        </div>
      ))}

      <div style={{ marginBottom: 12 }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Commentaire libre</p>
        <textarea
          value={commentaire}
          onChange={e => setCommentaire(e.target.value)}
          className="form-control"
          rows={3}
          style={{ width: '100%', maxWidth: 500 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Recommanderiez-vous cette formation ?</p>
        <label style={{ marginRight: 12 }}>
          <input type="radio" name="recommande" checked={recommande === true} onChange={() => setRecommande(true)} /> Oui
        </label>
        <label>
          <input type="radio" name="recommande" checked={recommande === false} onChange={() => setRecommande(false)} /> Non
        </label>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn btn-primary">
        {saving ? 'Enregistrement…' : '💾 Enregistrer'}
      </button>
      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

// ── Onglet Documents ──────────────────────────────────────────────────────────

function TabDocuments({ sessions }) {
  const [dossierId, setDossierId]   = useState('');
  const [sessionId, setSessionId]   = useState('');
  const [documents, setDocuments]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState('');

  async function loadDocs() {
    if (!dossierId) return;
    setLoading(true);
    try {
      const r = await api.get(`/qualiopi/dossiers/${dossierId}/documents`);
      setDocuments(r.data?.data || []);
    } catch { setDocuments([]); }
    setLoading(false);
  }

  async function generate(type) {
    if (!dossierId || !sessionId) { setMsg('❌ Dossier et session requis.'); return; }
    setMsg('');
    try {
      const r = await api.post(`/qualiopi/dossiers/${dossierId}/documents/${type}`, { session_id: parseInt(sessionId) }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_dossier_${dossierId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('✅ PDF généré.');
      loadDocs();
    } catch (e) {
      setMsg('❌ ' + (e.response?.data?.message || e.message));
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Documents réglementaires</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontWeight: 600 }}>
          ID Dossier<br />
          <input type="number" value={dossierId} onChange={e => setDossierId(e.target.value)} className="form-control" style={{ width: 120 }} />
        </label>
        <label style={{ fontWeight: 600 }}>
          Session<br />
          <select value={sessionId} onChange={e => setSessionId(e.target.value)} className="form-control" style={{ minWidth: 200 }}>
            <option value="">— Choisir —</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.code_session}</option>)}
          </select>
        </label>
        <button onClick={loadDocs} className="btn btn-secondary">🔍 Charger</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={() => generate('attestation')} className="btn btn-primary">🎓 Attestation</button>
        <button onClick={() => generate('convention')}  className="btn btn-primary">📋 Convention</button>
        <button onClick={() => generate('convocation')} className="btn btn-primary">📬 Convocation</button>
      </div>

      {msg && <p style={{ marginBottom: 12 }}>{msg}</p>}

      {loading ? <p>Chargement…</p> : (
        documents.length > 0 ? (
          <table className="table">
            <thead>
              <tr><th>Type</th><th>Titre</th><th>Session</th><th>Généré le</th><th>Par</th></tr>
            </thead>
            <tbody>
              {documents.map(d => (
                <tr key={d.id}>
                  <td><span className="badge badge-blue">{d.type_document}</span></td>
                  <td>{d.titre}</td>
                  <td>{d.code_session || '—'}</td>
                  <td>{d.genere_at ? new Date(d.genere_at).toLocaleDateString('fr-FR') : '—'}</td>
                  <td>{d.genere_par_nom || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : dossierId ? <p style={{ color: 'var(--muted)' }}>Aucun document pour ce dossier.</p> : null
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function Qualiopi() {
  const { user }   = useAuthStore();
  const role       = user?.role || user?.role_nom || '';
  const isAdmin    = ['super_admin', 'role_admin', 'role_administratif'].includes(role);
  const canRead    = ['super_admin', 'role_admin', 'role_administratif', 'manager'].includes(role);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sessions, setSessions]   = useState([]);

  useEffect(() => {
    api.get('/parametrage/sessions')
      .then(r => setSessions(r.data?.data || r.data || []))
      .catch(() => setSessions([]));
  }, []);

  if (!canRead) {
    return (
      <div className="page-container">
        <p>Accès refusé.</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Module Qualiopi</h1>
        <span className="badge badge-green">Certifié</span>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === t.key ? 'var(--primary)' : 'var(--muted)',
              fontWeight: activeTab === t.key ? 700 : 400,
              cursor: 'pointer',
              fontSize: 14,
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {activeTab === 'dashboard'    && <TabDashboard />}
      {activeTab === 'emargement'   && <TabEmargement sessions={sessions} />}
      {activeTab === 'evaluation'   && <TabEvaluation sessions={sessions} />}
      {activeTab === 'satisfaction' && <TabSatisfaction sessions={sessions} />}
      {activeTab === 'documents'    && <TabDocuments sessions={sessions} />}
    </div>
  );
}
