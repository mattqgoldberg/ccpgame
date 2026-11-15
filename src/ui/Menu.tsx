import { CHAPTERS } from '../content/chapters';
import { COVERAGE } from '../content/coverage';
import { COMPANY, MISSIONS } from '../content/missions';
import { isMissionUnlocked, useGame } from '../game/store';

export function Menu() {
  const progress = useGame((s) => s.progress);
  const { startMission, resetProgress } = useGame.getState();
  const next = MISSIONS.find((m) => !(progress.stars[m.id] > 0)) ?? MISSIONS[0];
  return (
    <div className="menu">
      <header className="menu-head">
        <h1>Cloud Tycoon</h1>
        <p>
          You’ve just been hired as the first engineer at {COMPANY.name}, a small outdoor-gear store. Keep it running, grow it onto AWS, and don’t get
          fired. You’ll learn the cloud (and the AWS Cloud Practitioner exam) along the way.
        </p>
        <button className="primary big" onClick={() => startMission(next.id)}>
          {Object.keys(progress.stars).length ? `Continue: ${next.title}` : 'Start your first day'}
        </button>
        <p className="muted small">Codex: {progress.codex.length} of {COVERAGE.length} exam topics discovered</p>
      </header>
      {CHAPTERS.map((c) => {
        const missions = MISSIONS.filter((m) => m.chapter === c.id);
        return (
          <section key={c.id} className={`chapter-row ${missions.length ? '' : 'coming'}`}>
            <div className="chapter-label">
              <div className="eyebrow">Chapter {c.id}</div>
              <div className="chapter-name">{c.title}</div>
              <div className="small muted">{c.premise}</div>
            </div>
            <div className="mission-list">
              {missions.length === 0 && <span className="muted small">Coming soon</span>}
              {missions.map((m) => {
                const unlocked = isMissionUnlocked(progress, m.id);
                const stars = progress.stars[m.id] ?? 0;
                return (
                  <button key={m.id} className="mission-card" disabled={!unlocked} onClick={() => startMission(m.id)}>
                    <div className="eyebrow">Mission {m.id}</div>
                    <div className="mission-name">{unlocked ? m.title : '🔒 ' + m.title}</div>
                    <div className="small muted">{m.summary}</div>
                    <div className="stars small">{[1, 2, 3].map((n) => <span key={n} className={n <= stars ? 'on' : ''}>★</span>)}</div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <footer className="muted small">
        Not affiliated with or endorsed by Amazon Web Services. Prices are simplified approximations.{' '}
        <button className="ghost small-btn" onClick={() => confirm('Erase all progress?') && resetProgress()}>Reset progress</button>
      </footer>
    </div>
  );
}
