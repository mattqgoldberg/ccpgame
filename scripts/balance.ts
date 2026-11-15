// Plays each chapter with a few strategies and prints outcomes. Used to tune numbers.
import { getChapter } from '../src/content/campaign';
import { buildReport } from '../src/sim/report';
import { play } from '../src/sim/testing/harness';
import { STRATEGIES } from '../src/sim/testing/strategies';

for (const strat of STRATEGIES) {
  const ch = getChapter(strat.chapter)!;
  const s = play(ch, strat.blueprint, strat.later);
  const r = buildReport(s, ch);
  const objs = r.objectives.map((o) => `${o.met ? '✓' : '✗'} ${o.value}`).join('  ');
  console.log(`ch${ch.id} ${strat.name.padEnd(22)} ${r.passed ? 'PASS' : 'fail'} ★${r.stars} overall ${r.overall}  ${objs}${s.failed ? `  [${s.failed}]` : ''}`);
  console.log(`      pillars: ${r.pillars.map((p) => `${p.name.split(' ')[0]} ${p.score}`).join(', ')}`);
}
