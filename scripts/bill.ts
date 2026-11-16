// Prints the end-of-mission bill for a mission's tutorial solution, and for doing nothing.
import { getMission } from '../src/content/missions';
import type { UiState } from '../src/content/tutorial';
import { createSim, runToEnd, step } from '../src/sim/engine';
import { expertDecide, makeSolver } from '../src/sim/testing/harness';
import type { SimState } from '../src/sim/types';

const m = getMission(process.argv[2])!;
const show = (label: string, s: SimState) => {
  const lines = Object.entries(s.bill).sort((a, b) => b[1] - a[1]);
  const total = lines.reduce((t, [, v]) => t + v, 0);
  console.log(`\n${label}: total $${total.toFixed(0)}, revenue $${s.stats.revenue.toFixed(0)}`);
  for (const [k, v] of lines) if (Math.abs(v) > 5) console.log(`  ${k.padEnd(34)} ${v.toFixed(0)}`);
};
const solved = createSim(m, 42);
const ui: UiState = { selectedId: null, tab: 'inspect', speed: 0 };
const api = makeSolver(solved, m, ui);
for (const st of m.steps) {
  st.solve?.(api);
  if (st.clock && st.done) while (!st.done({ sim: solved, ui }) && !solved.finished) { while (solved.notices.length) expertDecide(m)(solved); step(solved, m); }
}
show('tutorial solution', solved);
const idle = createSim(m, 42);
runToEnd(idle, m, expertDecide(m));
show('change nothing', idle);
