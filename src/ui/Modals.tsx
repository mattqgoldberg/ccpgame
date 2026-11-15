import { useState, type ReactNode } from 'react';
import { CHAPTERS } from '../content/chapters';
import { COVERAGE } from '../content/coverage';
import { COMPANY, MISSIONS } from '../content/missions';
import { getQuestion } from '../content/questions';
import { useFeatures, useGame } from '../game/store';
import { BOSS } from '../sim/engine';
import type { Notice } from '../sim/types';
import { money } from './format';

const coverageName = (id: string) => COVERAGE.find((e) => e.id === id)?.name ?? id;

function Modal({ children, tone = 'info', wide }: { children: ReactNode; tone?: string; wide?: boolean }) {
  return (
    <div className="modal-backdrop">
      <div className={`modal tone-border-${tone} ${wide ? 'wide' : ''}`}>{children}</div>
    </div>
  );
}

function CodexChips({ ids }: { ids?: string[] }) {
  const known = useGame((s) => s.progress.codex);
  const hasCodex = useFeatures().has('tab-codex');
  if (!ids?.length || !hasCodex) return null;
  return (
    <div className="codex-unlocks">
      {ids.map((id) => (
        <span key={id} className="chip">📘 {coverageName(id)}{known.includes(id) ? '' : ' (new in Codex)'}</span>
      ))}
    </div>
  );
}

const PAUSE_NOTE = 'The game is paused. Press ▶ Play when you’re ready to continue.';

export function NoticeModal({ notice }: { notice: Notice }) {
  const { dismissNotice, choose } = useGame.getState();
  if (notice.questionId) return <QuestionModal key={notice.id} questionId={notice.questionId} />;
  if (notice.strike) return <StrikeModal notice={notice} />;
  return (
    <Modal tone={notice.tone}>
      <h3>{notice.title}</h3>
      {notice.body.map((p) => <p key={p}>{p}</p>)}
      <CodexChips ids={notice.codexIds} />
      {!notice.choice && <p className="muted small">{PAUSE_NOTE}</p>}
      <div className="modal-actions">
        {notice.choice ? (
          notice.choice.options.map((o, i) => (
            <button key={o.label} className="choice" onClick={() => choose(i)}>{o.label}</button>
          ))
        ) : (
          <button className="primary" onClick={dismissNotice} autoFocus>Got it</button>
        )}
      </div>
    </Modal>
  );
}

export function StrikePips({ count, max }: { count: number; max: number }) {
  return (
    <div className="strike-pips">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < count ? 'pip on' : 'pip'}>✕</span>
      ))}
    </div>
  );
}

function StrikeModal({ notice }: { notice: Notice }) {
  const { dismissNotice } = useGame.getState();
  const firstTime = !useGame((s) => s.progress.seenStrikeIntro);
  const { count, max } = notice.strike!;
  const fired = count >= max;
  return (
    <Modal tone="danger">
      <div className="eyebrow">{COMPANY.boss} · {COMPANY.bossTitle}</div>
      <h2>{notice.title}</h2>
      <StrikePips count={count} max={max} />
      {notice.body.map((p) => <p key={p}>{p}</p>)}
      {firstTime && !fired && (
        <div className="explainer">
          <h4>How strikes work</h4>
          <ul>
            <li>If the store is failing (fewer than {Math.round(BOSS.failingAvailability * 100)}% of requests succeeding) for {BOSS.hoursBeforeStrike} hours in a row, you get a strike.</li>
            <li>If it stays down, you get another strike every {BOSS.repeatEvery} hours.</li>
            <li>A security breach is an instant strike.</li>
            <li><strong>{BOSS.maxStrikes} strikes in one month and you’re fired</strong>: the mission ends and you have to retry it.</li>
            <li>Strikes reset at the start of each month. The ✕ marks at the top of the screen show where you stand.</li>
          </ul>
        </div>
      )}
      {!fired && <p className="muted small">The game is paused. Fix what’s broken, then press ▶ Play.</p>}
      <div className="modal-actions">
        <button className="primary" onClick={dismissNotice} autoFocus>{fired ? 'See what happened' : 'I’ll fix it'}</button>
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
      <div className="eyebrow">Investor meeting · optional</div>
      <p className="small muted">An investor stops by with a question. Answer correctly and they invest a little more. Skipping costs nothing.</p>
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
          {correct ? `Correct! They invest ${money(q.reward)}. ` : 'Not quite. '}
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
  const mission = useGame((s) => s.mission)!;
  const missionIdx = useGame((s) => s.missionIdx);
  const sim = useGame((s) => s.sim)!;
  const showPillars = useFeatures().has('report-card');
  const { startMission, exitToMenu } = useGame.getState();
  const [openPillar, setOpenPillar] = useState<string | null>(null);
  const next = MISSIONS[missionIdx + 1];
  const chapter = CHAPTERS.find((c) => c.id === mission.chapter);

  return (
    <Modal wide tone={report.passed ? 'success' : 'danger'}>
      <div className="eyebrow">{chapter?.title} · Mission {mission.id} · {mission.title}</div>
      <h2>{report.passed ? 'Mission complete' : sim.failed?.includes('let you go') ? 'You’re fired' : 'Mission failed'}</h2>
      {sim.failed && <p className="tone-danger">{sim.failed}</p>}
      {showPillars && <div className="stars">{[1, 2, 3].map((n) => <span key={n} className={n <= report.stars ? 'on' : ''}>★</span>)}</div>}
      <h4>Goals</h4>
      <ul className="objectives">
        {report.objectives.map((o) => (
          <li key={o.label} className={o.met ? 'met' : 'missed'}>{o.met ? '✓' : '✗'} {o.label} <span className="muted">({o.value})</span></li>
        ))}
      </ul>
      {showPillars && (
        <>
          <h4>Well-Architected review · {report.overall}/100</h4>
          {mission.teachReport && (
            <p className="small explainer">
              New: at the end of every mission, your design is graded on the six pillars of the AWS Well-Architected Framework. Click a pillar to see why it scored
              the way it did. Meeting the goals earns ★; scoring 60+ earns ★★; 80+ earns ★★★.
            </p>
          )}
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
        </>
      )}
      {report.passed && mission.outro.map((p) => <p key={p}>{p}</p>)}
      {!report.passed && <p className="muted">Retry the mission. The steps are the same, and you can take it slower this time.</p>}
      <div className="modal-actions">
        <button className="ghost" onClick={exitToMenu}>Missions</button>
        <button onClick={() => startMission(mission.id)}>Retry</button>
        {report.passed && next && <button className="primary" onClick={() => startMission(next.id)}>Next mission →</button>}
      </div>
    </Modal>
  );
}
