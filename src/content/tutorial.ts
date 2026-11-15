import type { ChapterDef } from '../sim/chapter';
import type { NodeConfig, ServiceKind, SimNode, SimState } from '../sim/types';

/** UI features that start hidden and are unlocked by tutorial steps. Once unlocked, they stay unlocked in later missions. */
export type Feature =
  | 'play'
  | 'speed-2x'
  | 'speed-4x'
  | 'stat-cash'
  | 'stat-traffic'
  | 'stat-latency'
  | 'stat-satisfaction'
  | 'boss'
  | 'tab-inspect'
  | 'tab-goals'
  | 'tab-bill'
  | 'tab-advisor'
  | 'tab-codex'
  | 'chart'
  | 'alerts'
  | 'report-card'
  | 'connect'
  | 'delete'
  | 'config-size'
  | 'config-az'
  | 'config-multiaz'
  | 'config-ssh'
  | 'config-asg-range'
  | `svc:${ServiceKind}`;

export type Tab = 'goals' | 'inspect' | 'bill' | 'advisor' | 'codex';

export interface UiState {
  selectedId: string | null;
  tab: Tab;
  speed: number;
}

export interface StepContext {
  sim: SimState;
  ui: UiState;
}

/** Returns true once the player has done what the step asks. */
export type Check = (c: StepContext) => boolean;

/**
 * Scripted player actions that complete a step. Used by tests to prove every tutorial can be finished.
 * `ref` is an alias given to `add`, or a service kind (meaning the first node of that kind; for `remove`/`configure`, all of them).
 */
export interface SolveApi {
  add(kind: ServiceKind, alias?: string, config?: Partial<NodeConfig>): void;
  link(from: string, to: string): void;
  unlink(from: string, to: string): void;
  remove(ref: string): void;
  configure(ref: string, patch: Partial<NodeConfig>): void;
  select(ref: string): void;
  tab(tab: Tab): void;
  play(): void;
  enableMfa(): void;
}

export interface Step {
  id: string;
  /** Who is talking. Defaults to the boss. */
  speaker?: 'boss' | 'guide';
  title: string;
  body: string[];
  /** The action the player must take, shown as a checklist item. Omit for read-and-continue steps. */
  task?: string;
  /** Verifies the task. Steps without one complete when the player presses Continue. */
  done?: Check;
  /** Why this matters; shown under the task. */
  why?: string;
  /** Shown after the task is verified. */
  success?: string;
  /** Features revealed when this step starts. */
  unlock?: Feature[];
  /** `data-tut` key of the element to pulse. */
  highlight?: string;
  /** Time may pass during this step. Otherwise the clock is frozen while the player builds. */
  clock?: boolean;
  /** Move straight to the next step once done, without pausing. */
  auto?: boolean;
  solve?: (a: SolveApi) => void;
}

export interface Mission extends ChapterDef {
  /** One-line description for the menu. */
  summary: string;
  steps: Step[];
  /** Features from earlier missions that don't apply here (e.g. buying physical servers once you're in the cloud). */
  hide?: Feature[];
  /** Explain the Well-Architected report card (first time it appears). */
  teachReport?: boolean;
  codexOnStart: string[];
  codexOnComplete: string[];
  outro: string[];
}

// ── Checks ────────────────────────────────────────────────────────────────

const nodesOf = (s: SimState, kind: ServiceKind) => s.nodes.filter((n) => n.kind === kind);
const kindOf = (s: SimState, id: string) => s.nodes.find((n) => n.id === id)?.kind;

export const has = (kind: ServiceKind, count = 1): Check => ({ sim }) => nodesOf(sim, kind).length >= count;
export const lacks = (kind: ServiceKind): Check => ({ sim }) => nodesOf(sim, kind).length === 0;
export const linked = (from: ServiceKind, to: ServiceKind): Check => ({ sim }) =>
  sim.edges.some((e) => kindOf(sim, e.source) === from && kindOf(sim, e.target) === to);
export const unlinked = (from: ServiceKind, to: ServiceKind): Check => (c) => !linked(from, to)(c);
/** Every node of `to` kind receives traffic from some `from` node. */
export const allLinked = (from: ServiceKind, to: ServiceKind): Check => ({ sim }) => {
  const targets = nodesOf(sim, to);
  return targets.length > 0 && targets.every((t) => sim.edges.some((e) => e.target === t.id && kindOf(sim, e.source) === from));
};
export const every = (kind: ServiceKind, pred: (n: SimNode) => boolean): Check => ({ sim }) => {
  const list = nodesOf(sim, kind);
  return list.length > 0 && list.every(pred);
};
export const selected = (kind: ServiceKind): Check => ({ sim, ui }) => kindOf(sim, ui.selectedId ?? '') === kind;
export const tabOpen = (tab: Tab): Check => ({ ui }) => ui.tab === tab;
export const playing: Check = ({ ui }) => ui.speed > 0;
export const hourAtLeast = (hour: number): Check => ({ sim }) => sim.hour >= hour;
export const missionOver: Check = ({ sim }) => sim.finished;
export const mfaOn: Check = ({ sim }) => sim.flags.rootMfa;
export const all = (...checks: Check[]): Check => (c) => checks.every((f) => f(c));

// ── Feature bookkeeping ───────────────────────────────────────────────────

/** Features unlocked by every step of the given missions. */
export function unlocksOf(missions: Mission[]): Set<Feature> {
  const set = new Set<Feature>();
  for (const m of missions) for (const st of m.steps) st.unlock?.forEach((f) => set.add(f));
  return set;
}

/** Features available in `missions[index]` once `stepIndex` has started. */
export function featuresAt(missions: Mission[], index: number, stepIndex: number): Set<Feature> {
  const mission = missions[index];
  const set = unlocksOf(missions.slice(0, index));
  mission.steps.slice(0, stepIndex + 1).forEach((st) => st.unlock?.forEach((f) => set.add(f)));
  mission.hide?.forEach((f) => set.delete(f));
  return set;
}

export function servicesIn(features: Set<Feature>): ServiceKind[] {
  return [...features].filter((f) => f.startsWith('svc:')).map((f) => f.slice(4) as ServiceKind);
}
