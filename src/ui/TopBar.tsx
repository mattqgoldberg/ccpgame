import { useGame, type Speed } from '../game/store';
import { clock, compact, money, pct } from './format';

const SPEEDS: { value: Speed; label: string }[] = [
  { value: 0, label: '⏸' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
];

export function TopBar() {
  const sim = useGame((s) => s.sim)!;
  const chapter = useGame((s) => s.chapter)!;
  const speed = useGame((s) => s.speed);
  const { setSpeed, exitToMenu } = useGame.getState();
  const wanted = sim.last.demand.static + sim.last.demand.dynamic;
  const success = wanted > 0 ? Math.min(1, sim.last.served / wanted) : 1;
  const net = sim.last.revenue - sim.last.cost;

  return (
    <header className="topbar">
      <button className="ghost" onClick={exitToMenu} title="Back to chapters">☰</button>
      <div className="chapter-title">
        <span className="muted">Chapter {chapter.id}</span> {chapter.title}
      </div>
      <div className="clock">
        <div>{clock(Math.min(sim.hour, chapter.lengthHours - 1))}</div>
        <div className="progress"><div style={{ width: `${(sim.hour / chapter.lengthHours) * 100}%` }} /></div>
      </div>
      <div className="speed">
        {SPEEDS.map((s) => (
          <button key={s.value} className={speed === s.value ? 'active' : ''} onClick={() => setSpeed(s.value)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="stats">
        <Stat label="Cash" value={money(sim.cash)} sub={`${net >= 0 ? '+' : ''}${money(net)}/h`} tone={net >= 0 ? 'good' : 'bad'} />
        <Stat label="Traffic" value={`${compact(sim.last.served)}/s`} sub={`${pct(success)} served`} tone={success >= 0.99 ? 'good' : success >= 0.95 ? 'warn' : 'bad'} />
        <Stat label="Latency" value={`${Math.round(sim.last.latencyMs)} ms`} sub={`target ${chapter.latencyTargetMs}`} tone={sim.last.latencyMs <= chapter.latencyTargetMs ? 'good' : 'warn'} />
        <Stat label="Satisfaction" value={`${Math.round(sim.satisfaction)}`} sub="/ 100" tone={sim.satisfaction >= 60 ? 'good' : sim.satisfaction >= 40 ? 'warn' : 'bad'} />
      </div>
    </header>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-sub tone-${tone}`}>{sub}</div>
    </div>
  );
}
