import { COMPANY } from '../content/missions';
import { clockAllowed, currentStep, useGame } from '../game/store';

export function Coach() {
  const mission = useGame((s) => s.mission)!;
  const stepIndex = useGame((s) => s.stepIndex);
  const stepDone = useGame((s) => s.stepDone);
  const open = useGame((s) => s.coachOpen);
  const speed = useGame((s) => s.speed);
  const finished = useGame((s) => s.sim?.finished);
  const { nextStep, setCoachOpen } = useGame.getState();
  const step = currentStep({ mission, stepIndex });
  if (!step || finished) return null;

  const boss = (step.speaker ?? 'boss') === 'boss';
  const canRun = clockAllowed({ mission, stepIndex, stepDone });
  const waitingForPlay = canRun && speed === 0;
  const showNext = !step.done || stepDone;

  if (!open) {
    return (
      <button className="coach-tab" onClick={() => setCoachOpen(true)}>
        {boss ? '💬' : '🧭'} {step.title} {step.task && !stepDone ? '· task pending' : ''}
      </button>
    );
  }

  return (
    <div className={`coach ${boss ? 'coach-boss' : 'coach-guide'}`}>
      <div className="coach-head">
        <span className="avatar">{boss ? 'MR' : '🧭'}</span>
        <div>
          <div className="coach-who">{boss ? `${COMPANY.boss} · ${COMPANY.bossTitle}` : 'Guide'}</div>
          <div className="coach-title">{step.title}</div>
        </div>
        <span className="coach-count">
          Step {stepIndex + 1} of {mission.steps.length}
        </span>
        <button className="ghost small-btn" onClick={() => setCoachOpen(false)} title="Minimize">–</button>
      </div>
      {step.body.map((p) => <p key={p}>{p}</p>)}
      {step.task && (
        <div className={`task ${stepDone ? 'task-done' : ''}`}>
          <span className="task-box">{stepDone ? '✓' : ''}</span>
          <span>{step.task}</span>
        </div>
      )}
      {step.why && !stepDone && <p className="why"><strong>Why:</strong> {step.why}</p>}
      {stepDone && step.success && <p className="success">{step.success}</p>}
      <div className="coach-actions">
        {waitingForPlay && !stepDone && step.done && <span className="muted small">Time is paused. Press ▶ Play when you’re ready.</span>}
        {!showNext && !waitingForPlay && !canRun && <span className="muted small">The clock is frozen until you finish this.</span>}
        {showNext && (
          <button className="primary" onClick={nextStep} autoFocus>
            {step.done ? 'Next →' : 'Continue →'}
          </button>
        )}
      </div>
    </div>
  );
}
