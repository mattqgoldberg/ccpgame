import { describe, expect, it } from 'vitest';
import { CHAPTERS } from './chapters';
import { COVERAGE } from './coverage';
import { entriesByChapter, uncoveredTasks } from './coverageSummary';
import { TASKS } from './exam';

describe('coverage matrix', () => {
  it('has unique ids', () => {
    const ids = COVERAGE.map((e) => e.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('covers every task statement in the exam guide', () => {
    expect(uncoveredTasks()).toEqual([]);
  });

  it('only references real tasks and chapters', () => {
    const chapterIds = new Set(CHAPTERS.map((c) => c.id));
    for (const e of COVERAGE) {
      expect(TASKS, e.id).toHaveProperty(e.task);
      expect(chapterIds.has(e.chapter), `${e.id} chapter ${e.chapter}`).toBe(true);
    }
  });

  it('gives tier 1/2 entries a gameplay mechanic and keeps tier 3 recognition-only', () => {
    const recognition = new Set(['codex', 'board']);
    for (const e of COVERAGE) {
      const playable = e.mechanics.filter((m) => !recognition.has(m));
      if (e.tier === 3) expect(playable, e.id).toEqual([]);
      else expect(playable.length, e.id).toBeGreaterThan(0);
    }
  });

  it('gives every entry a hook and at least one exam trigger', () => {
    for (const e of COVERAGE) {
      expect(e.hook.length, e.id).toBeGreaterThan(0);
      expect(e.triggers.length, e.id).toBeGreaterThan(0);
    }
  });

  it('introduces something new in every chapter', () => {
    for (const [chapter, entries] of entriesByChapter()) {
      expect(entries.length, `chapter ${chapter}`).toBeGreaterThan(0);
    }
  });

  it('has Codex text for every topic', async () => {
    const { CODEX_TEXT } = await import('./codex');
    expect(COVERAGE.filter((e) => !CODEX_TEXT[e.id]).map((e) => e.id)).toEqual([]);
  });
});
