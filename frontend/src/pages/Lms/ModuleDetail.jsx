import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const STATUS_LABEL = {
  done:        { text: '✅ Terminé',    color: '#10B981' },
  in_progress: { text: '▶ En cours',   color: '#F59E0B' },
  not_started: { text: '○ À faire',    color: '#64748B' },
};

function lessonStatus(lesson) {
  const prog = lesson.user_progress?.[0];
  if (!prog) return 'not_started';
  return prog.status;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}

export default function ModuleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get(`/api/lms/modules/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setModule(r.data.data))
      .catch(() => navigate('/lms/modules'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingText}>Chargement…</div>
      </div>
    );
  }

  if (!module) return null;

  const lessons = module.lessons || [];
  const done = lessons.filter((l) => lessonStatus(l) === 'done').length;
  const pct = lessons.length > 0 ? Math.round((done / lessons.length) * 100) : 0;

  return (
    <div style={styles.page}>
      {/* Back */}
      <button style={styles.back} onClick={() => navigate('/lms/modules')}>
        ← Tous les modules
      </button>

      {/* Module header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{module.titre}</h1>
        <p style={styles.objectif}>{module.objectif}</p>
        <div style={styles.progressRow}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${pct}%` }} />
          </div>
          <span style={styles.progressLabel}>{done}/{lessons.length} terminés</span>
        </div>
      </div>

      {/* Lesson list */}
      <div style={styles.list}>
        {lessons.map((lesson, idx) => {
          const status = lessonStatus(lesson);
          const st = STATUS_LABEL[status] || STATUS_LABEL.not_started;
          const score = lesson.user_progress?.[0]?.score;

          return (
            <div key={lesson.id} style={styles.card}>
              <div style={styles.cardLeft}>
                <div style={styles.chapNum}>Ch{idx + 1}</div>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.cardTop}>
                  <h2 style={styles.lessonTitle}>{lesson.titre}</h2>
                  <span style={{ ...styles.statusBadge, color: st.color }}>{st.text}</span>
                </div>
                <p style={styles.lessonObj}>{lesson.objectif}</p>
                <div style={styles.meta}>
                  <span>⏱ {formatDuration(lesson.duration_seconds)}</span>
                  <span>❓ {lesson._count?.quiz_questions || 0} questions</span>
                  <span>🎴 {lesson._count?.flashcards || 0} flashcards</span>
                  {score != null && <span>🏆 {score}%</span>}
                </div>
              </div>
              <div style={styles.actions}>
                <button
                  style={styles.btnLesson}
                  onClick={() => navigate(`/lms/lessons/${lesson.id}`)}
                >
                  Leçon
                </button>
                {(lesson._count?.quiz_questions || 0) > 0 && (
                  <button
                    style={styles.btnQuiz}
                    onClick={() => navigate(`/lms/quiz/${lesson.id}`)}
                  >
                    Quiz
                  </button>
                )}
                {(lesson._count?.flashcards || 0) > 0 && (
                  <button
                    style={styles.btnFC}
                    onClick={() => navigate(`/lms/flashcards?lesson_id=${lesson.id}`)}
                  >
                    Cartes
                  </button>
                )}
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
    padding: '20px 16px',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  loadingText: { textAlign: 'center', marginTop: 80, color: '#94A3B8', fontSize: 16 },
  back: {
    background: 'none',
    border: 'none',
    color: '#60A5FA',
    fontSize: 14,
    cursor: 'pointer',
    padding: '0 0 16px',
    display: 'block',
  },
  header: {
    background: '#1E293B',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 20,
    maxWidth: 860,
    margin: '0 auto 24px',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#F1F5F9',
    margin: '0 0 8px',
  },
  objectif: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 1.5,
    margin: '0 0 14px',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    background: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#10B981',
    borderRadius: 4,
    transition: 'width 0.4s ease',
  },
  progressLabel: { fontSize: 13, color: '#94A3B8', whiteSpace: 'nowrap' },
  list: {
    maxWidth: 860,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    background: '#1E293B',
    borderRadius: 10,
    padding: '16px 18px',
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
  },
  cardLeft: {
    flexShrink: 0,
  },
  chapNum: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#94A3B8',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  lessonTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#F1F5F9',
    margin: 0,
    lineHeight: 1.3,
  },
  statusBadge: { fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 },
  lessonObj: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 1.4,
    margin: '0 0 10px',
  },
  meta: {
    display: 'flex',
    gap: 14,
    fontSize: 12,
    color: '#64748B',
    flexWrap: 'wrap',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexShrink: 0,
  },
  btnLesson: {
    background: '#3B82F6',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnQuiz: {
    background: '#10B981',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnFC: {
    background: '#8B5CF6',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
