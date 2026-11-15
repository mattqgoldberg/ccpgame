import { CHAPTERS } from './chapters';
import { COVERAGE, type CoverageEntry, type Tier } from './coverage';
import { DOMAINS, TASKS, domainOfTask, type DomainId, type TaskId } from './exam';

export interface DomainSummary {
  id: DomainId;
  name: string;
  weight: number;
  total: number;
  byTier: Record<Tier, number>;
}

export function summarizeByDomain(entries: CoverageEntry[] = COVERAGE): DomainSummary[] {
  return DOMAINS.map((d) => {
    const inDomain = entries.filter((e) => domainOfTask(e.task).id === d.id);
    return {
      id: d.id,
      name: d.name,
      weight: d.weight,
      total: inDomain.length,
      byTier: {
        1: inDomain.filter((e) => e.tier === 1).length,
        2: inDomain.filter((e) => e.tier === 2).length,
        3: inDomain.filter((e) => e.tier === 3).length,
      },
    };
  });
}

export function entriesByChapter(entries: CoverageEntry[] = COVERAGE): Map<number, CoverageEntry[]> {
  const map = new Map<number, CoverageEntry[]>(CHAPTERS.map((c) => [c.id, []]));
  for (const e of entries) map.get(e.chapter)?.push(e);
  return map;
}

export function uncoveredTasks(entries: CoverageEntry[] = COVERAGE): TaskId[] {
  const covered = new Set(entries.map((e) => e.task));
  return (Object.keys(TASKS) as TaskId[]).filter((t) => !covered.has(t));
}
