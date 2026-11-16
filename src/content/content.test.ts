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
    for (const st of m.steps) st.codex?.forEach((id) => ids.add(id));
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
  if (highlight === 'inspect-https') return 'config-https';
  if (highlight === 'inspect-encryption') return 'config-encryption';
  if (highlight === 'inspect-spot') return 'config-spot';
  if (highlight === 'inspect-storage') return 'config-storage';
  if (highlight === 'inspect-region') return 'config-region';
  if (highlight.startsWith('deploy-')) return 'cloudformation';
  if (prefix === 'acct') return `acct:${rest}` as Feature;
  if (prefix === 'node') return null;
  if (prefix === 'edge') return 'connect';
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

  it('only ask investor questions about things the player has already met', () => {
    /** Codex topics the player has met before `hour` of mission `index`. */
    const topicsBefore = (index: number, hour: number) => {
      const known = new Set<string>(['mfa', 'root-user']);
      MISSIONS.slice(0, index + 1).forEach((m, j) => {
        const current = j === index;
        m.available.forEach((k) => CATALOG[k].codexId && known.add(CATALOG[k].codexId!));
        m.codexOnStart.forEach((id) => known.add(id));
        m.steps.forEach((st) => st.codex?.forEach((id) => known.add(id)));
        if (!current) m.codexOnComplete.forEach((id) => known.add(id));
        for (const ev of m.events) {
          if (current && (ev.at === undefined || ev.at >= hour)) continue;
          if ('codexIds' in ev) ev.codexIds?.forEach((id) => known.add(id));
          if (ev.kind === 'board') getQuestion(ev.questionId)?.codexIds.forEach((id) => known.add(id));
        }
      });
      return known;
    };
    MISSIONS.forEach((m, i) => {
      for (const ev of m.events) {
        if (ev.kind !== 'board' || ev.at === undefined) continue;
        const known = topicsBefore(i, ev.at);
        for (const topic of getQuestion(ev.questionId)!.codexIds) {
          expect(known.has(topic), `${m.id}: "${ev.questionId}" asks about "${topic}" before it's taught`).toBe(true);
        }
      }
    });
  });

  it('let the player discover every exam topic somewhere in the campaign', () => {
    const missing = COVERAGE.map((e) => e.id).filter((id) => !reachableCodexIds().has(id));
    expect(missing, 'Add these to a mission’s codexOnComplete, a step’s codex, or an event').toEqual([]);
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
