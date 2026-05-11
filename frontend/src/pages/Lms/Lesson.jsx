import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../../store/authStore';

const FILIERE_COLOR = { taxi: '#F59E0B', vtc: '#3B82F6', vmdtr: '#10B981', commun: '#8B5CF6' };

function ContentBlock({ block }) {
  if (block.type === 'heading') {
    const Tag = `h${block.level || 1}`;
    return <Tag className="lms-heading">{block.text}</Tag>;
  }
  if (block.type === 'paragraph') {
    return <p className="lms-para" dangerouslySetInnerHTML={{ __html: block.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />;
  }
  if (block.type === 'section') {
    return (
      <div className="lms-section">
        <h3 className="lms-section-heading">{block.heading}</h3>
        <ul className="lms-list">
          {block.items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          ))}
        </ul>
      </div>
    );
  }
  if (block.type === 'callout') {
    return <div className={`lms-callout lms-callout--${block.variant}`}>{block.text}</div>;
  }
  if (block.type === 'voix_off') {
    return null; // voix off — reserved for TTS, not shown in text flow
  }
  return null;
}

export default function LmsLesson() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { token }    = useAuthStore();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    axios
      .get(`/api/lms/lessons/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setLesson(r.data.data))
      .catch((e) => setError(e.response?.data?.message || 'Erreur chargement leçon.'))
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) return <div className="lms-loading">Chargement…</div>;
  if (error)   return <div className="lms-error">{error}</div>;
  if (!lesson)  return null;

  const color = FILIERE_COLOR[lesson.module?.filiere] ?? FILIERE_COLOR.commun;

  return (
    <div className="lms-lesson-page">
      <style>{`
        .lms-lesson-page {
          min-height: 100vh;
          background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
          color: #f1f5f9;
          font-family: 'Segoe UI', system-ui, sans-serif;
          padding: 0 0 2rem;
        }
        .lms-lesson-header {
          background: rgba(255,255,255,0.04);
          border-bottom: 2px solid ${color};
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          gap: .75rem;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .lms-back-btn {
          background: none; border: none;
          color: #94a3b8; font-size: 1.25rem;
          cursor: pointer; padding: .25rem .5rem;
          border-radius: .5rem;
          transition: color .2s;
        }
        .lms-back-btn:hover { color: #f1f5f9; }
        .lms-lesson-meta { flex: 1; min-width: 0; }
        .lms-module-badge {
          display: inline-block;
          background: ${color}22;
          border: 1px solid ${color};
          color: ${color};
          font-size: .7rem;
          font-weight: 700;
          letter-spacing: .05em;
          text-transform: uppercase;
          border-radius: 999px;
          padding: .2rem .6rem;
          margin-bottom: .25rem;
        }
        .lms-lesson-title {
          font-size: 1rem;
          font-weight: 700;
          color: #f8fafc;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lms-lesson-body {
          max-width: 680px;
          margin: 0 auto;
          padding: 1.5rem 1.25rem;
        }
        .lms-image-placeholder {
          width: 100%;
          border-radius: .75rem;
          aspect-ratio: 16/9;
          background: linear-gradient(135deg, ${color}22, ${color}44);
          border: 1px dashed ${color}88;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
          gap: .5rem;
        }
        .lms-image-placeholder span { font-size: .8rem; color: ${color}; text-align: center; padding: 0 1rem; }
        .lms-heading { font-size: 1.5rem; font-weight: 800; color: #f8fafc; margin: 0 0 1rem; }
        .lms-para { font-size: .95rem; line-height: 1.7; color: #cbd5e1; margin: 0 0 1rem; }
        .lms-section { margin: 1.25rem 0; }
        .lms-section-heading { font-size: 1.05rem; font-weight: 700; color: #f1f5f9; margin: 0 0 .5rem; }
        .lms-list { padding-left: 1.25rem; margin: 0; }
        .lms-list li { font-size: .9rem; line-height: 1.65; color: #cbd5e1; margin-bottom: .4rem; }
        .lms-callout {
          border-radius: .75rem;
          padding: .875rem 1rem;
          font-size: .875rem;
          line-height: 1.6;
          margin: 1.25rem 0;
        }
        .lms-callout--info {
          background: rgba(59,130,246,0.12);
          border-left: 3px solid #3b82f6;
          color: #93c5fd;
        }
        .lms-quiz-btn {
          display: block;
          width: 100%;
          margin-top: 2rem;
          padding: .875rem 1.5rem;
          background: ${color};
          color: #fff;
          font-weight: 700;
          font-size: 1rem;
          border: none;
          border-radius: .75rem;
          cursor: pointer;
          text-align: center;
          transition: opacity .2s;
        }
        .lms-quiz-btn:hover { opacity: .88; }
        .lms-loading, .lms-error {
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; font-size: 1rem; color: #94a3b8;
          background: #0f172a;
        }
        @media (max-width: 480px) {
          .lms-heading { font-size: 1.25rem; }
        }
      `}</style>

      <header className="lms-lesson-header">
        <button className="lms-back-btn" onClick={() => navigate(-1)} aria-label="Retour">←</button>
        <div className="lms-lesson-meta">
          <div className="lms-module-badge">{lesson.module?.titre?.split('—')[0]?.trim() || 'Module'}</div>
          <h1 className="lms-lesson-title">{lesson.titre}</h1>
        </div>
      </header>

      <div className="lms-lesson-body">
        {/* Image placeholder (en attente de génération) */}
        <div className="lms-image-placeholder">
          <span style={{ fontSize: '2rem' }}>🖼️</span>
          <span>{lesson.media_prompt ? 'Illustration en cours de génération…' : 'Pas d\'image pour cette leçon'}</span>
        </div>

        {/* Blocs de contenu */}
        {Array.isArray(lesson.content_blocks) &&
          lesson.content_blocks.map((block, i) => <ContentBlock key={i} block={block} />)}

        {/* CTA → Quiz */}
        <button className="lms-quiz-btn" onClick={() => navigate(`/lms/quiz/${id}`)}>
          Passer au quiz →
        </button>
      </div>
    </div>
  );
}
