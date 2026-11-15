import { describe, expect, it } from 'vitest';
import { getChapter } from '../content/campaign';
import { buildReport } from './report';
import { play } from './testing/harness';
import { STRATEGIES } from './testing/strategies';

describe('chapter balance', () => {
  for (const strat of STRATEGIES) {
    it(`chapter ${strat.chapter}: "${strat.name}" should ${strat.expect}`, () => {
      const ch = getChapter(strat.chapter)!;
      const s = play(ch, strat.blueprint, strat.later);
      const report = buildReport(s, ch);
      const summary = report.objectives.map((o) => `${o.met ? 'met' : 'missed'} ${o.label}: ${o.value}`).join('; ');
      expect(report.passed, summary).toBe(strat.expect === 'pass');
    });
  }

  it('rewards the best chapter 3 architecture with more stars than brute force', () => {
    const ch = getChapter(3)!;
    const [good, brute] = ['ELB + multi-AZ ASG + cache', 'huge fixed fleet'].map((name) => {
      const strat = STRATEGIES.find((x) => x.name === name)!;
      return buildReport(play(ch, strat.blueprint), ch);
    });
    expect(good.stars).toBeGreaterThan(brute.stars);
  });
});
