import { describe, expect, it } from 'vitest';
import { CATALOG } from '../sim/catalog';
import { CAMPAIGN } from './campaign';
import { CODEX_TEXT } from './codex';
import { COVERAGE } from './coverage';
import { QUESTIONS, getQuestion } from './questions';

const coverageIds = new Set(COVERAGE.map((e) => e.id));

/** Every Codex id the game can unlock in the playable chapters. */
function reachableCodexIds(): Set<string> {
  const ids = new Set<string>();
  for (const def of Object.values(CATALOG)) if (def.codexId) ids.add(def.codexId);
  for (const ch of CAMPAIGN) {
    [...ch.codexOnStart, ...ch.codexOnComplete].forEach((id) => ids.add(id));
    for (const ev of ch.events) if ('codexIds' in ev) ev.codexIds?.forEach((id) => ids.add(id));
  }
  for (const q of QUESTIONS) q.codexIds.forEach((id) => ids.add(id));
  // Unlocked directly by the engine.
  ['mfa', 'root-user', 'security-groups', 'shared-responsibility', 'availability-zones', 'health-dashboard', 'shield', 'cloudwatch', 'high-availability'].forEach((id) => ids.add(id));
  return ids;
}

describe('campaign content', () => {
  it('only unlocks Codex entries that exist in the coverage matrix and have text', () => {
    for (const id of reachableCodexIds()) {
      expect(coverageIds.has(id), `${id} missing from coverage matrix`).toBe(true);
      expect(CODEX_TEXT[id], `${id} missing Codex text`).toBeTruthy();
    }
  });

  it('references real board questions with a valid answer', () => {
    for (const ch of CAMPAIGN) {
      for (const ev of ch.events) {
        if (ev.kind !== 'board') continue;
        const q = getQuestion(ev.questionId);
        expect(q, ev.questionId).toBeDefined();
        expect(q!.answer).toBeLessThan(q!.options.length);
      }
    }
  });

  it('has exactly one correct option per choice event, and schedules only real events', () => {
    for (const ch of CAMPAIGN) {
      const ids = new Set(ch.events.map((e) => e.id));
      for (const ev of ch.events) {
        if (ev.kind !== 'choice') continue;
        expect(ev.options.filter((o) => o.correct)).toHaveLength(1);
        if (ev.onWrong) expect(ids.has(ev.onWrong.eventId)).toBe(true);
      }
    }
  });

  it('fires every timed event within the chapter', () => {
    for (const ch of CAMPAIGN) {
      for (const ev of ch.events) if (ev.at !== undefined) expect(ev.at, ev.id).toBeLessThan(ch.lengthHours);
    }
  });
});
