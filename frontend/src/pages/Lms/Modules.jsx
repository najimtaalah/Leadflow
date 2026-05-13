import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const EPREUVE_MAP = {
  'm01-t3p-intro': { label: 'Épreuve A', color: '#3B82F6' },
  'm03-gestion':   { label: 'Épreuve B', color: '#10B981' },
  'm05-securite':  { label: 'Épreuve C', color: '#F59E0B' },
  'm07a-francais': { label: 'Épreuve D', color: '#8B5CF6' },
  'm07b-anglais':  { label: 'Épreuve E', color: '#EF4444' },
};

function progressColor(pct) {
  if (pct >= 80) return '#10B981';
  if (pct >= 40) return '#F59E0B';
  return '#6B7280';
}

export default function LmsModules() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('/api/lms/modules', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setModules(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingText}>Chargement des modules…</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>📚 Parcours T3P — Tronc commun</h1>
        <p style={styles.headerSub}>Épreuves A à E — communes aux filières Taxi, VTC et VMDTR</p>
      </div>

      {/* Module cards */}
      <div style={styles.grid}>
        {modules.map((mod) => {
          const meta = EPREUVE_MAP[mod.id] || {};
          const lessons = mod.lessons || [];
          const done = lessons.filter((l) => l.user_progress?.[0]?.status === 'done').length;
          const pct = lessons.length > 0 ? Math.round((done / lessons.length) * 100) : 0;

          return (
            <div
              key={mod.id}
              style={{ ...styles.card, borderTop: `4px solid ${meta.color || '#6B7280'}` }}
              onClick={() => navigate(`/lms/modules/${mod.id}`)}
            >
              <div style={styles.cardHeader}>
                {meta.label && (
                  <span style={{ ...styles.badge, background: meta.color || '#6B7280' }}>
                    {meta.label}
                  </span>
                )}
                <span style={styles.filiere}>
                  {mod.filiere === 'commun' ? '🎯 Tronc commun' : `📌 ${mod.filiere}`}
                </span>
              </div>

              <h2 style={styles.cardTitle}>{mod.titre}</h2>
              <p style={styles.cardObj}>{mod.objectif}</p>

              {/* Progress bar */}
              <div style={styles.progressRow}>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${pct}%`, background: progressColor(pct) }} />
                </div>
                <span style={styles.progressLabel}>{done}/{lessons.length} chapitres</span>
              </div>

              <div style={styles.cardFooter}>
                <span>⏱ {mod.duree_estimee} min</span>
                <span style={styles.cardCTA}>Voir les chapitres →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#F1F5F9',
    padding: '24px 16px',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 80,
    color: '#94A3B8',
    fontSize: 16,
  },
  header: {
    textAlign: 'center',
    marginBottom: 32,
    padding: '0 16px',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#F1F5F9',
    margin: '0 0 8px',
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 15,
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 20,
    maxWidth: 1100,
    margin: '0 auto',
  },
  card: {
    background: '#1E293B',
    borderRadius: 12,
    padding: 20,
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 20,
    letterSpacing: '0.5px',
  },
  filiere: {
    fontSize: 12,
    color: '#94A3B8',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#F1F5F9',
    margin: '0 0 6px',
    lineHeight: 1.3,
  },
  cardObj: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 1.5,
    margin: '0 0 16px',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  progressBar: {
    flex: 1,
    height: 6,
    background: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.4s ease',
  },
  progressLabel: {
    fontSize: 12,
    color: '#94A3B8',
    whiteSpace: 'nowrap',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    color: '#64748B',
  },
  cardCTA: {
    color: '#60A5FA',
    fontWeight: 600,
  },
};
