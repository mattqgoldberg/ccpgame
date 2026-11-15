// Plays each mission's intended solution and each known-bad design, and prints outcomes. Used to tune numbers.
import { MISSIONS, getMission } from '../src/content/missions';
import type { UiState } from '../src/content/tutorial';
import { createSim, step } from '../src/sim/engine';
import { buildReport } from '../src/sim/report';
import { expertDecide, makeSolver, play } from '../src/sim/testing/harness';
import { FAILING_STRATEGIES } from '../src/sim/testing/strategies';
import type { SimState } from '../src/sim/types';

function line(id: string, name: string, s: SimState) {
  const m = getMission(id)!;
  const r = buildReport(s, m);
  const objs = r.objectives.map((o) => `${o.met ? '✓' : '✗'} ${o.value}`).join('  ');
  console.log(`${id} ${name.padEnd(34)} ${r.passed ? 'PASS' : 'fail'} ★${r.stars} strikes ${s.boss.strikes}  ${objs}${s.failed ? `  [${s.failed}]` : ''}`);
}

for (const m of MISSIONS) {
  const s = createSim(m, 42);
  const ui: UiState = { selectedId: null, tab: 'inspect', speed: 0 };
  const api = makeSolver(s, m, ui);
  const decide = expertDecide(m);
  for (const st of m.steps) {
    st.solve?.(api);
    if (st.clock && st.done) {
      while (!st.done({ sim: s, ui }) && !s.finished) {
        while (s.notices.length) decide(s);
        step(s, m);
      }
    }
  }
  line(m.id, `tutorial solution`, s);
}
for (const strat of FAILING_STRATEGIES) line(strat.mission, strat.name, play(getMission(strat.mission)!, strat.blueprint, strat.later));
