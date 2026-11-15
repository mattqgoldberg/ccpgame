import { describe, expect, it } from 'vitest';
import { CATALOG } from '../sim/catalog';
import { CODEX_TEXT } from './codex';
import { COVERAGE } from './coverage';
import { MISSIONS } from './missions';
import { QUESTIONS, getQuestion } from './questions';
import { featuresAt, type Feature } from './tutorial';

const coverageIds = new Set(COVERAGE.map((e) => e.id));

/** Every Codex id the game can unlock in the playable missions. */
function reachableCodexIds(): Set<string> {
  const ids = new Set<string>();
  for (const def of Object.values(CATALOG)) if (def.codexId) ids.add(def.codexId);
  for (const m of MISSIONS) {
    [...m.codexOnStart, ...m.codexOnComplete].forEach((id) => ids.add(id));
    for (const ev of m.events) if ('codexIds' in ev) ev.codexIds?.forEach((id) => ids.add(id));
  }
  for (const q of QUESTIONS) q.codexIds.forEach((id) => ids.add(id));
  // Unlocked directly by the engine.
  ['mfa', 'root-user', 'security-groups', 'shared-responsibility', 'availability-zones', 'health-dashboard', 'shield', 'cloudwatch', 'high-availability'].forEach((id) => ids.add(id));
  return ids;
}

/** The feature that must be unlocked for a highlight target to be on screen. */
function featureFor(highlight: string): Feature | null {
  const [prefix, rest] = [highlight.split('-')[0], highlight.split('-').slice(1).join('-')];
  if (prefix === 'palette') return `svc:${rest}` as Feature;
  if (prefix === 'tab') return highlight as Feature;
  if (prefix === 'stat') return highlight as Feature;
  if (highlight === 'play' || highlight === 'boss' || highlight === 'chart') return highlight;
  if (highlight === 'inspect-metrics') return 'tab-inspect';
  if (highlight === 'inspect-ssh') return 'config-ssh';
  if (highlight === 'inspect-size') return 'config-size';
  if (highlight === 'inspect-az') return 'config-az';
  if (highlight === 'inspect-multiaz') return 'config-multiaz';
  if (highlight === 'advisor-mfa') return 'tab-advisor';
  if (prefix === 'node') return null;
  throw new Error(`Unknown highlight "${highlight}"`);
}

describe('missions', () => {
  it('have unique ids and steps', () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const m of MISSIONS) expect(new Set(m.steps.map((s) => s.id)).size, m.id).toBe(m.steps.length);
  });

  it('only highlight things that are already unlocked at that step', () => {
    MISSIONS.forEach((m, i) => {
      m.steps.forEach((st, j) => {
        if (!st.highlight) return;
        const needed = featureFor(st.highlight);
        if (needed) expect(featuresAt(MISSIONS, i, j).has(needed), `${m.id}/${st.id} highlights ${st.highlight}`).toBe(true);
      });
    });
  });

  it('end with a step that runs the clock to the end of the mission', () => {
    for (const m of MISSIONS) expect(m.steps.at(-1)?.clock, m.id).toBe(true);
  });

  it('teach Play before anything needs the clock', () => {
    MISSIONS.forEach((m, i) => {
      m.steps.forEach((st, j) => {
        if (st.clock) expect(featuresAt(MISSIONS, i, j).has('play'), `${m.id}/${st.id}`).toBe(true);
      });
    });
  });

  it('only unlock Codex entries that exist in the coverage matrix and have text', () => {
    for (const id of reachableCodexIds()) {
      expect(coverageIds.has(id), `${id} missing from coverage matrix`).toBe(true);
      expect(CODEX_TEXT[id], `${id} missing Codex text`).toBeTruthy();
    }
  });

  it('reference real board questions with a valid answer', () => {
    for (const m of MISSIONS) {
      for (const ev of m.events) {
        if (ev.kind !== 'board') continue;
        const q = getQuestion(ev.questionId);
        expect(q, ev.questionId).toBeDefined();
        expect(q!.answer).toBeLessThan(q!.options.length);
      }
    }
  });

  it('have exactly one correct option per choice event, and schedule only real events', () => {
    for (const m of MISSIONS) {
      const ids = new Set(m.events.map((e) => e.id));
      for (const ev of m.events) {
        if (ev.kind !== 'choice') continue;
        expect(ev.options.filter((o) => o.correct)).toHaveLength(1);
        if (ev.onWrong) expect(ids.has(ev.onWrong.eventId)).toBe(true);
      }
    }
  });

  it('fire every timed event within the mission', () => {
    for (const m of MISSIONS) {
      for (const ev of m.events) if (ev.at !== undefined) expect(ev.at, ev.id).toBeLessThan(m.lengthHours);
    }
  });
});
