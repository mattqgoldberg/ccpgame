import { getMission } from '../src/content/missions';
import type { UiState } from '../src/content/tutorial';
import { createSim, step } from '../src/sim/engine';
import { expertDecide, makeSolver } from '../src/sim/testing/harness';
const m = getMission(process.argv[2])!;
const s = createSim(m, 42);
const ui: UiState = { selectedId: null, tab: 'inspect', speed: 0 };
const api = makeSolver(s, m, ui);
const decide = expertDecide(m);
for (const st of m.steps) {
  st.solve?.(api);
  if (st.clock && st.done) while (!st.done({ sim: s, ui }) && !s.finished) { while (s.notices.length) decide(s); step(s, m);
    const w = s.last.demand.static + s.last.demand.dynamic; const a = s.last.served / w;
    if (a < 0.995) console.log(`h${s.hour - 1} avail ${(a * 100).toFixed(1)}% demand ${w.toFixed(0)} ` + s.nodes.map((n) => { const x = s.last.nodes[n.id]; return x && (x.failRate ?? 0) > 0.01 ? `${n.id}:${((x.failRate ?? 0) * 100).toFixed(0)}%${x.warning ? '(' + x.warning + ')' : ''}${x.down ? '(down)' : ''} load ${x.load.toFixed(0)}/${x.capacity.toFixed(0)}` : '' }).filter(Boolean).join(' ')); }
}
