import { describe, expect, it } from 'vitest';
import { MISSIONS, getMission } from '../content/missions';
import type { UiState } from '../content/tutorial';
import { createSim, step as advance } from './engine';
import { buildReport } from './report';
import { expertDecide, makeSolver, play } from './testing/harness';
import { FAILING_STRATEGIES } from './testing/strategies';

describe('tutorial walkthroughs', () => {
  for (const mission of MISSIONS) {
    it(`mission ${mission.id} (${mission.title}): every step can be completed, and the mission passes with no strikes`, () => {
      const s = createSim(mission, 42);
      const ui: UiState = { selectedId: null, tab: 'inspect', speed: 0 };
      const api = makeSolver(s, mission, ui);
      const decide = expertDecide(mission);
      for (const st of mission.steps) {
        if (!st.done) continue;
        const ctx = () => ({ sim: s, ui });
        if (!st.clock) expect(st.done(ctx()), `step "${st.id}" is already done before the player acts`).toBe(false);
        st.solve?.(api);
        if (st.clock) {
          ui.speed = 1;
          for (let guard = 0; guard < 5000 && !st.done(ctx()) && !s.finished; guard++) {
            while (s.notices.length) decide(s);
            advance(s, mission);
          }
        }
        while (s.notices.length) decide(s);
        expect(st.done(ctx()), `step "${st.id}" not completed by its solution`).toBe(true);
        if (!st.clock) ui.speed = 0;
      }
      expect(s.finished).toBe(true);
      const report = buildReport(s, mission);
      const summary = report.objectives.map((o) => `${o.met ? 'met' : 'MISSED'} ${o.label}: ${o.value}`).join('; ');
      expect(report.passed, summary).toBe(true);
      expect(s.boss.strikes, s.boss.log.map((l) => l.reason).join(' | ')).toBe(0);
    });
  }
});

describe('designs that should fail', () => {
  for (const strat of FAILING_STRATEGIES) {
    it(`mission ${strat.mission}: "${strat.name}" fails`, () => {
      const m = getMission(strat.mission)!;
      const s = play(m, strat.blueprint, strat.later);
      const report = buildReport(s, m);
      const summary = report.objectives.map((o) => `${o.met ? 'met' : 'missed'} ${o.label}: ${o.value}`).join('; ');
      expect(report.passed, `${summary} strikes=${s.boss.strikes}`).toBe(false);
    });
  }
});
