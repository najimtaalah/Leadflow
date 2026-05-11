import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../../store/authStore';

const STEPS = { LOADING: 'loading', QUIZ: 'quiz', RESULT: 'result', ERROR: 'error' };

export default function LmsQuiz() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { token }  = useAuthStore();

  const [step, setStep]         = useState(STEPS.LOADING);
  const [quiz, setQuiz]         = useState(null);
  const [answers, setAnswers]   = useState({});
  const [current, setCurrent]   = useState(0);
  const [selected, setSelected] = useState(null); // choice for current Q before confirm
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);

  useEffect(() => {
    axios
      .get(`/api/lms/quiz/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { setQuiz(r.data.data); setStep(STEPS.QUIZ); })
      .catch((e) => { setError(e.response?.data?.message || 'Erreur chargement quiz.'); setStep(STEPS.ERROR); });
  }, [id, token]);

  const question    = quiz?.questions?.[current];
  const totalQ      = quiz?.questions?.length ?? 0;
  const isLastQ     = current === totalQ - 1;

  function handleChoose(choice) {
    if (answers[question.id]) return; // already confirmed
    setSelected(choice);
  }

  async function handleConfirm() {
    if (!selected) return;
    const newAnswers = { ...answers, [question.id]: selected };
    setAnswers(newAnswers);

    if (!isLastQ) {
      setCurrent((c) => c + 1);
      setSelected(null);
      return;
    }

    // Submit all answers
    try {
      const r = await axios.post(`/api/lms/quiz/${id}`, { answers: newAnswers }, { headers: { Authorization: `Bearer ${token}` } });
      setResult(r.data.data);
      setStep(STEPS.RESULT);
    } catch (e) {
      setError(e.response?.data?.message || 'Erreur envoi quiz.');
      setStep(STEPS.ERROR);
    }
  }

  if (step === STEPS.LOADING) return <div className="lms-loading">Chargement…</div>;
  if (step === STEPS.ERROR)   return <div className="lms-error">{error}</div>;

  return (
    <div className="lms-quiz-page">
      <style>{`
        * { box-sizing: border-box; }
        .lms-quiz-page {
          min-height: 100vh;
          background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
          color: #f1f5f9;
          font-family: 'Segoe UI', system-ui, sans-serif;
          padding: 0 0 2rem;
          display: flex;
          flex-direction: column;
        }
        .lms-quiz-header {
          padding: 1rem 1.25rem .75rem;
          background: rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          gap: .75rem;
        }
        .lms-back-btn {
          background: none; border: none; color: #94a3b8;
          font-size: 1.25rem; cursor: pointer; padding: .25rem .5rem;
          border-radius: .5rem; transition: color .2s;
        }
        .lms-back-btn:hover { color: #f1f5f9; }
        .lms-quiz-title { font-size: .95rem; font-weight: 700; flex: 1; }
        .lms-quiz-counter { font-size: .8rem; color: #64748b; white-space: nowrap; }
        .lms-progress-bar {
          height: 3px;
          background: rgba(255,255,255,0.08);
        }
        .lms-progress-fill {
          height: 100%;
          background: #3b82f6;
          transition: width .4s ease;
        }
        .lms-quiz-body {
          flex: 1;
          max-width: 680px;
          margin: 0 auto;
          padding: 1.5rem 1.25rem;
          width: 100%;
        }
        .lms-question-text {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f8fafc;
          margin: 0 0 1.5rem;
          line-height: 1.5;
        }
        .lms-choices { display: flex; flex-direction: column; gap: .625rem; }
        .lms-choice-btn {
          background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: .75rem;
          padding: .875rem 1rem;
          color: #cbd5e1;
          font-size: .9rem;
          text-align: left;
          cursor: pointer;
          transition: background .15s, border-color .15s, color .15s;
          display: flex;
          align-items: center;
          gap: .75rem;
        }
        .lms-choice-btn:hover:not(:disabled) {
          background: rgba(59,130,246,0.12);
          border-color: #3b82f6;
          color: #f1f5f9;
        }
        .lms-choice-btn--selected {
          background: rgba(59,130,246,0.2) !important;
          border-color: #3b82f6 !important;
          color: #bfdbfe !important;
        }
        .lms-choice-btn--correct {
          background: rgba(16,185,129,0.15) !important;
          border-color: #10b981 !important;
          color: #6ee7b7 !important;
        }
        .lms-choice-btn--wrong {
          background: rgba(239,68,68,0.15) !important;
          border-color: #ef4444 !important;
          color: #fca5a5 !important;
        }
        .lms-choice-letter {
          width: 1.5rem; height: 1.5rem;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
          font-size: .75rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lms-confirm-btn {
          display: block; width: 100%;
          margin-top: 1.5rem;
          padding: .875rem;
          background: #3b82f6;
          color: #fff; font-weight: 700; font-size: 1rem;
          border: none; border-radius: .75rem;
          cursor: pointer; transition: opacity .2s;
        }
        .lms-confirm-btn:disabled { opacity: .4; cursor: not-allowed; }
        .lms-confirm-btn:not(:disabled):hover { opacity: .88; }

        /* ── Result screen ── */
        .lms-result-body {
          max-width: 680px; margin: 0 auto;
          padding: 2rem 1.25rem;
        }
        .lms-score-ring {
          width: 7rem; height: 7rem;
          border-radius: 50%;
          margin: 0 auto 1.5rem;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          border: 4px solid;
        }
        .lms-score-ring--pass { border-color: #10b981; background: rgba(16,185,129,0.1); }
        .lms-score-ring--fail { border-color: #ef4444; background: rgba(239,68,68,0.1); }
        .lms-score-number { font-size: 1.75rem; font-weight: 800; }
        .lms-score-label { font-size: .7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
        .lms-result-heading {
          text-align: center; font-size: 1.25rem; font-weight: 700;
          margin: 0 0 .5rem;
        }
        .lms-result-sub { text-align: center; font-size: .875rem; color: #64748b; margin: 0 0 2rem; }
        .lms-answers-review { display: flex; flex-direction: column; gap: 1rem; }
        .lms-answer-card {
          background: rgba(255,255,255,0.04);
          border-radius: .75rem;
          padding: 1rem;
          border-left: 3px solid;
        }
        .lms-answer-card--correct { border-color: #10b981; }
        .lms-answer-card--wrong   { border-color: #ef4444; }
        .lms-answer-q { font-size: .875rem; font-weight: 600; color: #cbd5e1; margin-bottom: .5rem; }
        .lms-answer-given { font-size: .8rem; margin-bottom: .25rem; }
        .lms-answer-given.correct { color: #6ee7b7; }
        .lms-answer-given.wrong   { color: #fca5a5; }
        .lms-answer-explain { font-size: .8rem; color: #94a3b8; margin-top: .5rem; line-height: 1.5; }
        .lms-result-actions { display: flex; flex-direction: column; gap: .75rem; margin-top: 2rem; }
        .lms-btn-primary, .lms-btn-secondary {
          padding: .875rem; border-radius: .75rem;
          font-weight: 700; font-size: .95rem;
          border: none; cursor: pointer;
          transition: opacity .2s; text-align: center;
        }
        .lms-btn-primary { background: #10b981; color: #fff; }
        .lms-btn-secondary { background: rgba(255,255,255,0.08); color: #cbd5e1; }
        .lms-btn-primary:hover, .lms-btn-secondary:hover { opacity: .85; }

        .lms-loading, .lms-error {
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; font-size: 1rem; color: #94a3b8;
          background: #0f172a;
        }
        @media (max-width: 480px) {
          .lms-question-text { font-size: 1rem; }
        }
      `}</style>

      {step === STEPS.QUIZ && (
        <>
          <header className="lms-quiz-header">
            <button className="lms-back-btn" onClick={() => navigate(`/lms/lessons/${id}`)} aria-label="Retour à la leçon">←</button>
            <span className="lms-quiz-title">Quiz — {quiz.titre}</span>
            <span className="lms-quiz-counter">
              {current + 1} / {totalQ}
            </span>
          </header>
          <div className="lms-progress-bar">
            <div className="lms-progress-fill" style={{ width: `${((current + 1) / totalQ) * 100}%` }} />
          </div>

          <div className="lms-quiz-body">
            <p className="lms-question-text">{question.question}</p>
            <div className="lms-choices">
              {question.choices.map((choice, i) => {
                const letter   = 'ABCD'[i];
                const isSelected = selected === choice || answers[question.id] === choice;
                return (
                  <button
                    key={choice}
                    className={`lms-choice-btn${isSelected ? ' lms-choice-btn--selected' : ''}`}
                    onClick={() => handleChoose(choice)}
                    disabled={!!answers[question.id]}
                  >
                    <span className="lms-choice-letter">{letter}</span>
                    {choice}
                  </button>
                );
              })}
            </div>
            <button
              className="lms-confirm-btn"
              disabled={!selected}
              onClick={handleConfirm}
            >
              {isLastQ ? 'Terminer le quiz' : 'Valider →'}
            </button>
          </div>
        </>
      )}

      {step === STEPS.RESULT && result && (
        <>
          <header className="lms-quiz-header">
            <button className="lms-back-btn" onClick={() => navigate(-1)} aria-label="Retour">←</button>
            <span className="lms-quiz-title">Résultats</span>
          </header>
          <div className="lms-result-body">
            <div className={`lms-score-ring ${result.score >= 60 ? 'lms-score-ring--pass' : 'lms-score-ring--fail'}`}>
              <span className="lms-score-number" style={{ color: result.score >= 60 ? '#10b981' : '#ef4444' }}>
                {result.score}%
              </span>
              <span className="lms-score-label">Score</span>
            </div>
            <h2 className="lms-result-heading">
              {result.score >= 60 ? '🎉 Bravo !' : 'Encore un effort !'}
            </h2>
            <p className="lms-result-sub">
              {result.score >= 60
                ? `${result.results.filter((r) => r.correct).length}/${result.results.length} bonnes réponses — leçon validée.`
                : `${result.results.filter((r) => r.correct).length}/${result.results.length} bonnes réponses — rejoue pour progresser.`}
            </p>

            <div className="lms-answers-review">
              {result.results.map((r) => (
                <div key={r.id} className={`lms-answer-card lms-answer-card--${r.correct ? 'correct' : 'wrong'}`}>
                  <p className="lms-answer-q">{r.question}</p>
                  <p className={`lms-answer-given ${r.correct ? 'correct' : 'wrong'}`}>
                    {r.correct ? '✓' : '✗'} Ta réponse : {r.given ?? '—'}
                    {!r.correct && <> · Bonne réponse : <strong>{r.correct_answer}</strong></>}
                  </p>
                  <p className="lms-answer-explain">{r.explanation}</p>
                </div>
              ))}
            </div>

            <div className="lms-result-actions">
              {result.score >= 60 ? (
                <button className="lms-btn-primary" onClick={() => navigate('/lms/flashcards?lesson_id=' + id)}>
                  Faire les flashcards →
                </button>
              ) : (
                <button className="lms-btn-primary" onClick={() => { setStep(STEPS.QUIZ); setCurrent(0); setAnswers({}); setSelected(null); }}>
                  Rejouer le quiz
                </button>
              )}
              <button className="lms-btn-secondary" onClick={() => navigate(`/lms/lessons/${id}`)}>
                Revoir la leçon
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
