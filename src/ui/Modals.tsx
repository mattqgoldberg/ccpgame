import { useState } from 'react';
import { getChapter } from '../content/campaign';
import { COVERAGE } from '../content/coverage';
import { getQuestion } from '../content/questions';
import { useGame } from '../game/store';
import type { Notice } from '../sim/types';
import { money } from './format';

const coverageName = (id: string) => COVERAGE.find((e) => e.id === id)?.name ?? id;

function Modal({ children, tone = 'info', wide }: { children: React.ReactNode; tone?: string; wide?: boolean }) {
  return (
    <div className="modal-backdrop">
      <div className={`modal tone-border-${tone} ${wide ? 'wide' : ''}`}>{children}</div>
    </div>
  );
}

function CodexChips({ ids, known }: { ids?: string[]; known: string[] }) {
  if (!ids?.length) return null;
  return (
    <div className="codex-unlocks">
      {ids.map((id) => (
        <span key={id} className="chip">📘 {coverageName(id)}{known.includes(id) ? '' : ' (new)'}</span>
      ))}
    </div>
  );
}

export function IntroModal() {
  const chapter = useGame((s) => s.chapter)!;
  const closeIntro = useGame((s) => s.closeIntro);
  return (
    <Modal wide>
      <div className="eyebrow">Chapter {chapter.id}</div>
      <h2>{chapter.title}</h2>
      {chapter.intro.map((p) => <p key={p}>{p}</p>)}
      <h4>To win</h4>
      <ul className="objectives">{chapter.objectives.map((o) => <li key={o.label}>○ {o.label}</li>)}</ul>
      <div className="modal-actions">
        <button className="primary" onClick={closeIntro}>Start</button>
      </div>
    </Modal>
  );
}

export function NoticeModal({ notice }: { notice: Notice }) {
  const { dismissNotice, choose } = useGame.getState();
  const known = useGame((s) => s.progress.codex);
  if (notice.questionId) return <QuestionModal key={notice.id} questionId={notice.questionId} />;
  return (
    <Modal tone={notice.tone}>
      <h3>{notice.title}</h3>
      {notice.body.map((p) => <p key={p}>{p}</p>)}
      <CodexChips ids={notice.codexIds} known={known} />
      <div className="modal-actions">
        {notice.choice ? (
          notice.choice.options.map((o, i) => (
            <button key={o.label} className="choice" onClick={() => choose(i)}>{o.label}</button>
          ))
        ) : (
          <button className="primary" onClick={dismissNotice} autoFocus>Continue</button>
        )}
      </div>
    </Modal>
  );
}

function QuestionModal({ questionId }: { questionId: string }) {
  const q = getQuestion(questionId)!;
  const { answer, dismissNotice } = useGame.getState();
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked === q.answer;
  return (
    <Modal>
      <div className="eyebrow">Board meeting · optional</div>
      <h3>{q.prompt}</h3>
      <div className="options">
        {q.options.map((o, i) => (
          <button
            key={o}
            className={`option ${picked === null ? '' : i === q.answer ? 'right' : i === picked ? 'wrong' : 'faded'}`}
            disabled={picked !== null}
            onClick={() => setPicked(i)}
          >
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <p className={correct ? 'tone-good' : 'tone-warning'}>
          {correct ? `Correct! The board invests ${money(q.reward)}. ` : 'Not quite. '}
          {q.explanation}
        </p>
      )}
      <div className="modal-actions">
        {picked === null ? (
          <button className="ghost" onClick={dismissNotice}>Skip</button>
        ) : (
          <button className="primary" onClick={() => answer(picked)} autoFocus>Continue</button>
        )}
      </div>
    </Modal>
  );
}

export function ReportModal() {
  const report = useGame((s) => s.report)!;
  const chapter = useGame((s) => s.chapter)!;
  const sim = useGame((s) => s.sim)!;
  const { startChapter, exitToMenu } = useGame.getState();
  const [openPillar, setOpenPillar] = useState<string | null>(null);
  const next = getChapter(chapter.id + 1);

  return (
    <Modal wide tone={report.passed ? 'success' : 'danger'}>
      <div className="eyebrow">Chapter {chapter.id} · {chapter.title}</div>
      <h2>{report.passed ? 'Chapter complete' : 'Chapter failed'}</h2>
      {sim.failed && <p className="tone-danger">{sim.failed}</p>}
      <div className="stars">{[1, 2, 3].map((n) => <span key={n} className={n <= report.stars ? 'on' : ''}>★</span>)}</div>
      <ul className="objectives">
        {report.objectives.map((o) => (
          <li key={o.label} className={o.met ? 'met' : 'missed'}>{o.met ? '✓' : '✗'} {o.label} <span className="muted">({o.value})</span></li>
        ))}
      </ul>
      <h4>Well-Architected review · {report.overall}/100</h4>
      <div className="pillars">
        {report.pillars.map((p) => (
          <div key={p.name} className="pillar">
            <button className="pillar-head" onClick={() => setOpenPillar(openPillar === p.name ? null : p.name)}>
              <span>{p.name}</span>
              <span className="pillar-bar"><span style={{ width: `${p.score}%` }} className={p.score >= 80 ? 'good' : p.score >= 50 ? 'warn' : 'bad'} /></span>
              <span className="pillar-score">{p.score}</span>
            </button>
            {openPillar === p.name && (
              <ul className="criteria">
                {p.criteria.map((c) => (
                  <li key={c.label}><strong>{c.label}</strong> {c.score}/100: <span className="muted">{c.detail}</span></li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {report.passed && chapter.outro.map((p) => <p key={p}>{p}</p>)}
      {!report.passed && <p className="muted">Check the Tips on the Goals tab, then try a different design.</p>}
      <div className="modal-actions">
        <button className="ghost" onClick={exitToMenu}>Chapters</button>
        <button onClick={() => startChapter(chapter.id)}>Retry</button>
        {report.passed && next && <button className="primary" onClick={() => startChapter(next.id)}>Next chapter →</button>}
      </div>
    </Modal>
  );
}
