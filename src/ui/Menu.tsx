import { CAMPAIGN } from '../content/campaign';
import { CHAPTERS } from '../content/chapters';
import { COVERAGE } from '../content/coverage';
import { useGame } from '../game/store';

export function Menu() {
  const progress = useGame((s) => s.progress);
  const startChapter = useGame((s) => s.startChapter);
  return (
    <div className="menu">
      <header className="menu-head">
        <h1>Cloud Tycoon</h1>
        <p>Build an internet business on AWS. Survive traffic spikes, outages, and attackers, and learn the cloud along the way.</p>
        <p className="muted small">Codex: {progress.codex.length} of {COVERAGE.length} exam topics discovered</p>
      </header>
      <div className="chapter-grid">
        {CHAPTERS.map((c) => {
          const playable = CAMPAIGN.some((p) => p.id === c.id);
          const stars = progress.stars[c.id] ?? 0;
          return (
            <button key={c.id} className="chapter-card" disabled={!playable} onClick={() => startChapter(c.id)}>
              <div className="eyebrow">Chapter {c.id}</div>
              <div className="chapter-name">{c.title}</div>
              <div className="small muted">{c.premise}</div>
              <div className="stars small">
                {playable ? [1, 2, 3].map((n) => <span key={n} className={n <= stars ? 'on' : ''}>★</span>) : <span className="muted">Coming soon</span>}
              </div>
            </button>
          );
        })}
      </div>
      <footer className="muted small">Not affiliated with or endorsed by Amazon Web Services. Prices are simplified approximations.</footer>
    </div>
  );
}
