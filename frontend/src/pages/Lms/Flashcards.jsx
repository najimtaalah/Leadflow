import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../../store/authStore';

function FlipCard({ card, onReview }) {
  const [flipped, setFlipped] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function handleFlip() { setFlipped((f) => !f); }

  function handleReview(difficulty) {
    setLeaving(true);
    setTimeout(() => {
      setFlipped(false);
      setLeaving(false);
      onReview(card.id, difficulty);
    }, 320);
  }

  return (
    <div className={`fc-scene${leaving ? ' fc-leaving' : ''}`}>
      <style>{`
        .fc-scene {
          width: 100%;
          perspective: 900px;
          transition: opacity .3s, transform .3s;
        }
        .fc-leaving {
          opacity: 0;
          transform: scale(.92);
        }
        .fc-card {
          position: relative;
          width: 100%;
          min-height: 16rem;
          transform-style: preserve-3d;
          transition: transform .55s cubic-bezier(.4,0,.2,1);
          cursor: pointer;
        }
        .fc-card.is-flipped { transform: rotateY(180deg); }
        .fc-face {
          position: absolute; inset: 0;
          backface-visibility: hidden;
          border-radius: 1rem;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 1.5rem;
          text-align: center;
        }
        .fc-front {
          background: rgba(255,255,255,0.07);
          border: 1.5px solid rgba(255,255,255,0.14);
        }
        .fc-back {
          background: rgba(99,102,241,0.18);
          border: 1.5px solid rgba(99,102,241,0.4);
          transform: rotateY(180deg);
        }
        .fc-label {
          font-size: .7rem;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: .75rem;
          font-weight: 700;
        }
        .fc-text {
          font-size: 1.15rem;
          font-weight: 700;
          color: #f8fafc;
          line-height: 1.5;
        }
        .fc-back .fc-text {
          font-size: .95rem;
          font-weight: 400;
          color: #c7d2fe;
          line-height: 1.65;
        }
        .fc-hint {
          position: absolute;
          bottom: .875rem;
          font-size: .72rem;
          color: #475569;
        }
      `}</style>

      <div
        className={`fc-card${flipped ? ' is-flipped' : ''}`}
        onClick={handleFlip}
        role="button"
        aria-label={flipped ? 'Voir le recto' : 'Voir le verso'}
      >
        <div className="fc-face fc-front">
          <div className="fc-label">Recto</div>
          <div className="fc-text">{card.front}</div>
          <div className="fc-hint">Appuyer pour retourner</div>
        </div>
        <div className="fc-face fc-back">
          <div className="fc-label">Verso</div>
          <div className="fc-text">{card.back}</div>
          <div className="fc-hint">Appuyer pour retourner</div>
        </div>
      </div>

      {flipped && (
        <div className="fc-actions">
          <button className="fc-btn fc-btn--hard" onClick={() => handleReview('hard')}>
            😓 Difficile
          </button>
          <button className="fc-btn fc-btn--easy" onClick={() => handleReview('easy')}>
            😊 Facile
          </button>
        </div>
      )}
    </div>
  );
}

export default function LmsFlashcards() {
  const navigate   = useNavigate();
  const { token }  = useAuthStore();
  const [params]   = useSearchParams();
  const lessonId   = params.get('lesson_id');

  const [cards, setCards]       = useState([]);
  const [index, setIndex]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [done, setDone]         = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  useEffect(() => {
    const url = lessonId ? `/api/lms/flashcards?lesson_id=${lessonId}` : '/api/lms/flashcards';
    axios
      .get(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setCards(r.data.data))
      .catch((e) => setError(e.response?.data?.message || 'Erreur chargement flashcards.'))
      .finally(() => setLoading(false));
  }, [lessonId, token]);

  async function handleReview(cardId, difficulty) {
    try {
      await axios.patch(`/api/lms/flashcards/${cardId}`, { difficulty }, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // non-blocking — continue anyway
    }
    setReviewedCount((n) => n + 1);
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  }

  if (loading) return <div className="lms-loading">Chargement…</div>;
  if (error)   return <div className="lms-error">{error}</div>;

  const current = cards[index];

  return (
    <div className="lms-fc-page">
      <style>{`
        .lms-fc-page {
          min-height: 100vh;
          background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
          color: #f1f5f9;
          font-family: 'Segoe UI', system-ui, sans-serif;
          display: flex; flex-direction: column;
        }
        .lms-fc-header {
          padding: 1rem 1.25rem;
          background: rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; gap: .75rem;
        }
        .lms-back-btn {
          background: none; border: none; color: #94a3b8;
          font-size: 1.25rem; cursor: pointer; padding: .25rem .5rem;
          border-radius: .5rem; transition: color .2s;
        }
        .lms-back-btn:hover { color: #f1f5f9; }
        .lms-fc-title { font-size: .95rem; font-weight: 700; flex: 1; }
        .lms-fc-counter { font-size: .8rem; color: #64748b; }
        .lms-fc-body {
          flex: 1;
          max-width: 680px;
          margin: 0 auto;
          padding: 2rem 1.25rem;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .fc-actions {
          display: flex;
          gap: .75rem;
          margin-top: 1rem;
        }
        .fc-btn {
          flex: 1;
          padding: .875rem;
          border: none;
          border-radius: .75rem;
          font-weight: 700;
          font-size: .9rem;
          cursor: pointer;
          transition: opacity .2s;
        }
        .fc-btn--hard {
          background: rgba(239,68,68,0.15);
          border: 1.5px solid rgba(239,68,68,0.4);
          color: #fca5a5;
        }
        .fc-btn--easy {
          background: rgba(16,185,129,0.15);
          border: 1.5px solid rgba(16,185,129,0.4);
          color: #6ee7b7;
        }
        .fc-btn:hover { opacity: .8; }
        .lms-progress-dots {
          display: flex;
          justify-content: center;
          gap: .4rem;
        }
        .lms-dot {
          width: .5rem; height: .5rem;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          transition: background .3s;
        }
        .lms-dot.active { background: #6366f1; }
        .lms-dot.reviewed { background: #10b981; }

        /* Done screen */
        .lms-done {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem 1.25rem;
          gap: 1rem;
        }
        .lms-done-emoji { font-size: 3.5rem; }
        .lms-done h2 { font-size: 1.5rem; font-weight: 800; color: #f8fafc; margin: 0; }
        .lms-done p { font-size: .9rem; color: #64748b; margin: 0; }
        .lms-done-actions { display: flex; flex-direction: column; gap: .75rem; width: 100%; max-width: 360px; }
        .lms-btn-primary, .lms-btn-secondary {
          padding: .875rem; border-radius: .75rem;
          font-weight: 700; font-size: .95rem;
          border: none; cursor: pointer;
          transition: opacity .2s; width: 100%;
        }
        .lms-btn-primary { background: #6366f1; color: #fff; }
        .lms-btn-secondary { background: rgba(255,255,255,0.08); color: #cbd5e1; }
        .lms-btn-primary:hover, .lms-btn-secondary:hover { opacity: .85; }

        .lms-loading, .lms-error {
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; font-size: 1rem; color: #94a3b8;
          background: #0f172a;
        }
        @media (max-width: 480px) {
          .lms-fc-body { padding: 1.25rem 1rem; }
        }
      `}</style>

      <header className="lms-fc-header">
        <button className="lms-back-btn" onClick={() => navigate(-1)} aria-label="Retour">←</button>
        <span className="lms-fc-title">Flashcards</span>
        {!done && <span className="lms-fc-counter">{reviewedCount}/{cards.length}</span>}
      </header>

      {!done && current ? (
        <div className="lms-fc-body">
          <div className="lms-progress-dots">
            {cards.map((_, i) => (
              <div
                key={i}
                className={`lms-dot${i === index ? ' active' : i < index ? ' reviewed' : ''}`}
              />
            ))}
          </div>
          <FlipCard key={current.id} card={current} onReview={handleReview} />
        </div>
      ) : done ? (
        <div className="lms-done">
          <div className="lms-done-emoji">🎴</div>
          <h2>Session terminée !</h2>
          <p>{cards.length} flashcard{cards.length > 1 ? 's' : ''} passée{cards.length > 1 ? 's' : ''} en revue.</p>
          <div className="lms-done-actions">
            {lessonId && (
              <button className="lms-btn-primary" onClick={() => { setIndex(0); setDone(false); setReviewedCount(0); }}>
                Recommencer
              </button>
            )}
            <button className="lms-btn-secondary" onClick={() => navigate(lessonId ? `/lms/lessons/${lessonId}` : '/')}>
              {lessonId ? 'Retour à la leçon' : 'Retour accueil'}
            </button>
          </div>
        </div>
      ) : (
        <div className="lms-done">
          <p>Aucune flashcard disponible.</p>
          <button className="lms-btn-secondary" onClick={() => navigate(-1)}>Retour</button>
        </div>
      )}
    </div>
  );
}
