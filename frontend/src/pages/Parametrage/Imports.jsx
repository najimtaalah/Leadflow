import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../utils/api';

// ── Column letter helpers ─────────────────────────────────────────────────────
function indexToLetter(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ── Fields available for Gestion mapping ─────────────────────────────────────
const GESTION_FIELDS = [
  { key: 'reference',           label: 'Référence' },
  { key: 'nom',                 label: 'Nom' },
  { key: 'prenom',              label: 'Prénom' },
  { key: 'telephone',           label: 'Téléphone' },
  { key: 'email',               label: 'Email' },
  { key: 'formation_souhaitee', label: 'Formation souhaitée' },
  { key: 'cout_total_formation',label: 'Coût total formation' },
  { key: 'part_financeur',      label: 'Part financeur' },
  { key: 'frais_cma',           label: 'Frais CMA' },
];

const MODES = [
  { value: 'creer_seulement', label: 'Créer seulement (ignorer existants)' },
  { value: 'mettre_a_jour',   label: 'Mettre à jour seulement (ignorer nouveaux)' },
  { value: 'upsert',          label: 'Créer et mettre à jour (upsert)' },
];

// ── File Drop Zone ─────────────────────────────────────────────────────────────
function DropZone({ accept, file, onFile }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }

  return (
    <div
      className={`drop-zone${dragging ? ' dragging' : ''}`}
      style={{
        border: `2px dashed ${dragging ? 'var(--brand)' : 'var(--border2)'}`,
        borderRadius: 10,
        padding: '32px 24px',
        textAlign: 'center',
        background: dragging ? 'var(--brand-dim)' : 'var(--surface2)',
        cursor: 'pointer',
        transition: 'all .2s',
      }}
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }}
      />
      <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
      {file ? (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--brand)' }}>{file.name}</div>
          <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 4 }}>
            {(file.size / 1024).toFixed(1)} Ko — cliquer pour changer
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--txt)' }}>
            Glisser-déposer le fichier ici
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 4 }}>
            ou cliquer pour parcourir — {accept}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Preview table ─────────────────────────────────────────────────────────────
function PreviewTable({ colonnes, apercu }) {
  if (!colonnes?.length) return null;
  return (
    <div style={{ overflowX: 'auto', marginTop: 16 }}>
      <table className="table" style={{ fontSize: 12, minWidth: 400 }}>
        <thead>
          <tr>
            <th style={{ background: 'var(--surface2)', color: 'var(--txt3)' }}>#</th>
            {colonnes.map((col, i) => (
              <th key={i} style={{ background: 'var(--surface2)' }}>
                <span style={{ color: 'var(--brand)', fontFamily: 'monospace', marginRight: 4 }}>
                  {indexToLetter(i)}
                </span>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {apercu.map((row, ri) => (
            <tr key={ri}>
              <td style={{ color: 'var(--txt3)', textAlign: 'center' }}>{ri + 1}</td>
              {colonnes.map((_, ci) => (
                <td key={ci}>{row[ci] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Stats result banner ───────────────────────────────────────────────────────
function StatsBanner({ stats }) {
  if (!stats) return null;
  return (
    <div
      style={{
        marginTop: 16,
        padding: '16px 20px',
        borderRadius: 10,
        background: 'var(--green-dim)',
        border: '1px solid var(--green)',
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>
        Import terminé
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
        <span>
          <span className="badge badge-green">{stats.importes}</span> créé(s)
        </span>
        <span>
          <span className="badge badge-blue">{stats.mis_a_jour}</span> mis à jour
        </span>
        {stats.liens_leads > 0 && (
          <span>
            <span className="badge badge-purple">{stats.liens_leads}</span> lié(s) à un lead
          </span>
        )}
        <span>
          <span className="badge">{stats.ignores}</span> ignoré(s)
        </span>
        {stats.erreurs?.length > 0 && (
          <span>
            <span className="badge badge-red">{stats.erreurs.length}</span> erreur(s)
          </span>
        )}
      </div>
      {stats.erreurs?.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>
            Voir les erreurs ({stats.erreurs.length})
          </summary>
          <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
            {stats.erreurs.map((e, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--txt2)', padding: '2px 0' }}>
                Ligne {e.ligne} : {e.message}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Historique section ────────────────────────────────────────────────────────
function Historique() {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/imports/historique');
      setRows(Array.isArray(data) ? data : data.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function formatDate(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Historique des imports</h3>
        <button className="btn" style={{ fontSize: 12 }} onClick={load}>Actualiser</button>
      </div>
      {loading ? (
        <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Chargement...</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Aucun import effectué.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Fichier</th>
                <th>Lignes</th>
                <th>Créés</th>
                <th>Mis à jour</th>
                <th>Erreurs</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.created_at)}</td>
                  <td>
                    <span className={`badge ${r.type === 'edof' ? 'badge-purple' : 'badge-blue'}`}>
                      {r.type?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.fichier || r.fichier_nom || '—'}
                  </td>
                  <td>{r.nb_lignes ?? r.lignes_lues ?? '—'}</td>
                  <td>
                    <span className="badge badge-green">{r.nb_importes ?? r.nb_crees ?? 0}</span>
                  </td>
                  <td>
                    <span className="badge badge-blue">{r.nb_maj ?? 0}</span>
                  </td>
                  <td>
                    {(r.nb_erreurs || r.nb_rejetes || 0) > 0 ? (
                      <span className="badge badge-red">{r.nb_erreurs ?? r.nb_rejetes ?? 0}</span>
                    ) : (
                      <span className="badge badge-green">0</span>
                    )}
                  </td>
                  <td>{r.importe_par || r.declenche_par || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Gestion Tab ───────────────────────────────────────────────────────────────
function GestionTab() {
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState(null); // { colonnes, apercu, total_lignes }
  const [previewing, setPreviewing] = useState(false);
  const [mapping, setMapping]   = useState({});
  const [mode, setMode]         = useState('upsert');
  const [importing, setImporting] = useState(false);
  const [stats, setStats]       = useState(null);
  const [error, setError]       = useState('');

  function handleFileChange(f) {
    setFile(f);
    setPreview(null);
    setStats(null);
    setError('');
    setMapping({});
  }

  async function handlePreview() {
    if (!file) return;
    setPreviewing(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/imports/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.success) {
        setPreview(data.data);
      } else {
        setError(data.message || 'Erreur lors de la prévisualisation.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur réseau.');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError('');
    setStats(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mapping', JSON.stringify(mapping));
      fd.append('mode', mode);
      const { data } = await api.post('/imports/gestion', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.message || 'Erreur lors de l\'import.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur réseau.');
    } finally {
      setImporting(false);
    }
  }

  const colOptions = preview
    ? preview.colonnes.map((col, i) => ({
        letter: indexToLetter(i),
        label: `${indexToLetter(i)} — ${col}`,
      }))
    : [];

  return (
    <div>
      {/* Step 1 : File */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--txt2)' }}>
          1. Sélectionner le fichier Excel
        </h3>
        <DropZone
          accept=".xlsx,.xls"
          file={file}
          onFile={handleFileChange}
        />
        {file && (
          <div style={{ marginTop: 12 }}>
            <button
              className="btn-primary"
              onClick={handlePreview}
              disabled={previewing}
            >
              {previewing ? 'Analyse...' : 'Prévisualiser les colonnes'}
            </button>
          </div>
        )}
      </div>

      {/* Step 2 : Preview */}
      {preview && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--txt2)' }}>
            2. Aperçu — {preview.total_lignes} ligne(s) de données
          </h3>
          <PreviewTable colonnes={preview.colonnes} apercu={preview.apercu} />
        </div>
      )}

      {/* Step 3 : Mapping */}
      {preview && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--txt2)' }}>
            3. Associer les colonnes aux champs
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {GESTION_FIELDS.map((field) => (
              <div key={field.key} className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{field.label}</label>
                <select
                  className="form-select"
                  value={mapping[field.key] || ''}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field.key]: e.target.value }))
                  }
                >
                  <option value="">— Ignorer —</option>
                  {colOptions.map((o) => (
                    <option key={o.letter} value={o.letter}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4 : Mode */}
      {preview && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--txt2)' }}>
            4. Mode d'import
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODES.map((m) => (
              <label
                key={m.value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}
              >
                <input
                  type="radio"
                  name="mode-gestion"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 5 : Import button */}
      {preview && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn-primary"
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? 'Import en cours...' : 'Importer'}
          </button>
          {importing && (
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
              Traitement des {preview.total_lignes} ligne(s)...
            </span>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--red-dim)',
            color: 'var(--red)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <StatsBanner stats={stats} />
    </div>
  );
}

// ── EDOF Tab ──────────────────────────────────────────────────────────────────
function EdofTab() {
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [mode, setMode]           = useState('upsert');
  const [importing, setImporting] = useState(false);
  const [stats, setStats]         = useState(null);
  const [error, setError]         = useState('');

  function handleFileChange(f) {
    setFile(f);
    setPreview(null);
    setStats(null);
    setError('');
  }

  async function handlePreview() {
    if (!file) return;
    setPreviewing(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/imports/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.success) {
        setPreview(data.data);
      } else {
        setError(data.message || 'Erreur lors de la prévisualisation.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur réseau.');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError('');
    setStats(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);
      const { data } = await api.post('/imports/edof', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.message || 'Erreur lors de l\'import.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur réseau.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      {/* Step 1 : File */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--txt2)' }}>
          1. Sélectionner le fichier EDOF
        </h3>
        <p style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 12 }}>
          Format CSV (séparateur <code>;</code>) ou XLS/XLSX exporté depuis EDOF.
          Les colonnes sont détectées automatiquement depuis l'en-tête (NUMERO_DOSSIER, NOM, PRENOM, etc.).
        </p>
        <DropZone
          accept=".csv,.xlsx,.xls"
          file={file}
          onFile={handleFileChange}
        />
        {file && (
          <div style={{ marginTop: 12 }}>
            <button
              className="btn-primary"
              onClick={handlePreview}
              disabled={previewing}
            >
              {previewing ? 'Analyse...' : 'Prévisualiser les colonnes'}
            </button>
          </div>
        )}
      </div>

      {/* Step 2 : Preview */}
      {preview && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--txt2)' }}>
            2. Aperçu — {preview.total_lignes} dossier(s) détecté(s)
          </h3>
          <div
            style={{
              marginBottom: 12,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--brand-dim)',
              fontSize: 12,
              color: 'var(--brand)',
            }}
          >
            Colonnes reconnues automatiquement depuis l'en-tête EDOF. Aucun mapping manuel requis.
          </div>
          <PreviewTable colonnes={preview.colonnes} apercu={preview.apercu} />
        </div>
      )}

      {/* Step 3 : Mode */}
      {preview && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--txt2)' }}>
            3. Mode d'import
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODES.map((m) => (
              <label
                key={m.value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}
              >
                <input
                  type="radio"
                  name="mode-edof"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 4 : Import */}
      {preview && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn-primary"
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? 'Import en cours...' : 'Importer les dossiers EDOF'}
          </button>
          {importing && (
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
              Traitement des {preview.total_lignes} dossier(s)...
            </span>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--red-dim)',
            color: 'var(--red)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <StatsBanner stats={stats} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ParamImports() {
  const [tab, setTab] = useState('gestion');

  const tabs = [
    { key: 'gestion', label: 'Gestion (Excel)', icon: '📊' },
    { key: 'edof',    label: 'EDOF (CSV)',       icon: '🏛️' },
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Import de dossiers
        </h1>
        <p style={{ color: 'var(--txt2)', fontSize: 13 }}>
          Importez des dossiers depuis un fichier Excel Gestion ou un export CSV EDOF.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '2px solid var(--border)',
          marginBottom: 20,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: tab === t.key ? 'var(--brand)' : 'var(--txt2)',
              borderBottom: tab === t.key ? '2px solid var(--brand)' : '2px solid transparent',
              marginBottom: -2,
              transition: 'all .18s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'gestion' && <GestionTab />}
      {tab === 'edof'    && <EdofTab />}

      {/* Historique */}
      <Historique />
    </div>
  );
}
