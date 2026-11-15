import { COMPANY } from '../content/missions';
import { CHAPTERS } from '../content/chapters';
import { useFeatures, useGame, useTut, type Speed } from '../game/store';
import { BOSS } from '../sim/engine';
import { clock, compact, money, pct } from './format';
import { setMuted, useMuted } from './sound';

export function TopBar() {
  const sim = useGame((s) => s.sim)!;
  const mission = useGame((s) => s.mission)!;
  const speed = useGame((s) => s.speed);
  const { setSpeed, exitToMenu } = useGame.getState();
  const f = useFeatures();
  const playTut = useTut('play');
  const tut = { cash: useTut('stat-cash'), latency: useTut('stat-latency'), satisfaction: useTut('stat-satisfaction'), boss: useTut('boss') };
  const wanted = sim.last.demand.static + sim.last.demand.dynamic;
  const success = wanted > 0 ? Math.min(1, sim.last.served / wanted) : 1;
  const net = sim.last.revenue - sim.last.cost;
  const chapter = CHAPTERS.find((c) => c.id === mission.chapter);
  const muted = useMuted();

  const speeds: { value: Speed; label: string; show: boolean }[] = [
    { value: 1, label: '▶ Play', show: f.has('play') },
    { value: 2, label: '2×', show: f.has('speed-2x') },
    { value: 4, label: '4×', show: f.has('speed-4x') },
    { value: 8, label: '8×', show: f.has('speed-8x') },
    { value: 16, label: '16×', show: f.has('speed-16x') },
  ];

  return (
    <header className="topbar">
      <button className="ghost" onClick={exitToMenu} title="Back to missions">☰</button>
      <div className="chapter-title">
        <div className="muted small">{chapter?.title} · Mission {mission.id}</div>
        <div>{mission.title}</div>
      </div>
      <div className="clock">
        <div>{clock(Math.min(sim.hour, mission.lengthHours - 1))}</div>
        <div className="progress"><div style={{ width: `${(sim.hour / mission.lengthHours) * 100}%` }} /></div>
      </div>
      {f.has('play') && (
        <div className={`speed${playTut}`} data-tut="play">
          <button className={speed === 0 ? 'active paused' : ''} onClick={() => setSpeed(0)} title="Pause (Space)">⏸</button>
          {speeds.filter((s) => s.show).map((s) => (
            <button key={s.value} className={speed === s.value ? 'active' : ''} onClick={() => setSpeed(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="stats">
        {f.has('boss') && <BossMeter className={tut.boss} />}
        {f.has('stat-cash') && (
          <Stat cls={tut.cash} label="Cash" value={money(sim.cash)} sub={`${net >= 0 ? '+' : ''}${money(net)}/h`} tone={net >= 0 ? 'good' : 'bad'} />
        )}
        {f.has('stat-traffic') && (
          <Stat label="Traffic" value={`${compact(sim.last.served)}/s`} sub={`${pct(success)} served`} tone={success >= 0.99 ? 'good' : success >= 0.9 ? 'warn' : 'bad'} />
        )}
        {f.has('stat-latency') && (
          <Stat cls={tut.latency} label="Latency" value={`${Math.round(sim.last.latencyMs)} ms`} sub={`target ${mission.latencyTargetMs}`} tone={sim.last.latencyMs <= mission.latencyTargetMs ? 'good' : 'warn'} />
        )}
        {f.has('stat-satisfaction') && (
          <Stat cls={tut.satisfaction} label="Satisfaction" value={`${Math.round(sim.satisfaction)}`} sub="/ 100" tone={sim.satisfaction >= 60 ? 'good' : sim.satisfaction >= 40 ? 'warn' : 'bad'} />
        )}
        <button className="ghost mute" onClick={() => setMuted(!muted)} title={muted ? 'Sound off' : 'Sound on'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  );
}

function BossMeter({ className }: { className: string }) {
  const boss = useGame((s) => s.sim!.boss);
  const left = BOSS.hoursBeforeStrike - boss.badHours;
  return (
    <div className={`boss-meter${className}`} data-tut="boss" title={`${BOSS.maxStrikes} strikes in a month and you’re fired. Strikes reset each month.`}>
      <div className="stat-label">{COMPANY.boss.split(' ')[0]}’s patience</div>
      <div className="strikes">
        {Array.from({ length: BOSS.maxStrikes }, (_, i) => (
          <span key={i} className={i < boss.strikes ? 'pip on' : 'pip'}>✕</span>
        ))}
        <span className="strike-label">{boss.strikes}/{BOSS.maxStrikes} strikes</span>
      </div>
      {boss.badHours > 0 ? (
        <div className="stat-sub tone-bad countdown">
          ⚠ Site failing · {left > 0 ? `strike in ${left}h` : 'strike given'}
        </div>
      ) : (
        <div className="stat-sub muted">this month</div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone, cls = '' }: { label: string; value: string; sub: string; tone: 'good' | 'warn' | 'bad'; cls?: string }) {
  const key = `stat-${label.toLowerCase()}`;
  return (
    <div className={`stat${cls}`} data-tut={key}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-sub tone-${tone}`}>{sub}</div>
    </div>
  );
}
