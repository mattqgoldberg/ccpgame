import { getQuestion } from '../../content/questions';
import type { SolveApi, UiState } from '../../content/tutorial';
import type { ChapterDef } from '../chapter';
import {
  addNode,
  answerQuestion,
  connect,
  createSim,
  deployStack,
  dismissNotice,
  recordExam,
  removeStaff,
  setAccount,
  updateStaff,
  enableRootMfa,
  removeNode,
  resolveChoice,
  runToEnd,
  step,
  updateConfig,
} from '../engine';
import type { NodeConfig, ServiceKind, SimState } from '../types';

export interface Blueprint {
  nodes: Record<string, { kind: ServiceKind; config?: NodeConfig }>;
  /** Pairs of blueprint keys or existing node ids. */
  edges: [string, string][];
  /** Existing node ids to delete first. */
  remove?: string[];
  /** Existing node ids to reconfigure. */
  configure?: Record<string, NodeConfig>;
  rootMfa?: boolean;
}

/** Applies a blueprint to a sim. Throws on invalid moves so tests fail loudly. */
export function applyBlueprint(s: SimState, ch: ChapterDef, bp: Blueprint) {
  for (const id of bp.remove ?? []) removeNode(s, id);
  for (const [id, cfg] of Object.entries(bp.configure ?? {})) updateConfig(s, id, cfg);
  const ids: Record<string, string> = Object.fromEntries(s.nodes.map((n) => [n.id, n.id]));
  for (const [key, spec] of Object.entries(bp.nodes)) {
    const err = addNode(s, ch, spec.kind, { x: 0, y: 0 });
    if (err) throw new Error(err);
    const node = s.nodes[s.nodes.length - 1];
    if (spec.config) updateConfig(s, node.id, spec.config);
    ids[key] = node.id;
  }
  for (const [a, b] of bp.edges) {
    const err = connect(s, ids[a] ?? a, ids[b] ?? b);
    if (err) throw new Error(err);
  }
  if (bp.rootMfa) enableRootMfa(s);
}

/** A player who answers every prompt correctly. */
export function expertDecide(ch: ChapterDef) {
  return (s: SimState) => {
    const n = s.notices[0];
    if (n.choice) {
      const ev = ch.events.find((e) => e.id === n.choice!.eventId);
      const idx = ev && ev.kind === 'choice' ? ev.options.findIndex((o) => o.correct) : 0;
      resolveChoice(s, ch, idx);
    } else if (n.questionId) {
      const q = getQuestion(n.questionId)!;
      answerQuestion(s, true, q.reward, q.codexIds);
    } else if (n.exam) {
      recordExam(s, n.exam.questionIds.length, n.exam.questionIds.length);
    } else {
      dismissNotice(s);
    }
  };
}

/** Plays a mission without its tutorial: builds `bp` at the start, optionally `later` at an hour, then runs to the end. */
export function play(ch: ChapterDef, bp: Blueprint, later?: { at: number; bp: Blueprint }) {
  const s = createSim(ch, 42);
  applyBlueprint(s, ch, bp);
  const decide = expertDecide(ch);
  if (later) {
    while (s.hour < later.at && !s.finished) {
      while (s.notices.length) decide(s);
      step(s, ch);
    }
    applyBlueprint(s, ch, later.bp);
  }
  runToEnd(s, ch, decide);
  return s;
}

/** Implements tutorial `solve` scripts directly against a sim and a fake UI state. */
export function makeSolver(s: SimState, ch: ChapterDef, ui: UiState): SolveApi {
  const aliases: Record<string, string> = {};
  const all = (ref: string): string[] => {
    if (aliases[ref]) return [aliases[ref]];
    if (s.nodes.some((n) => n.id === ref)) return [ref];
    return s.nodes.filter((n) => n.kind === ref).map((n) => n.id);
  };
  const one = (ref: string): string => {
    const id = all(ref)[0];
    if (!id) throw new Error(`No node for "${ref}"`);
    return id;
  };
  return {
    add(kind, alias, config) {
      const err = addNode(s, ch, kind, { x: 0, y: 0 });
      if (err) throw new Error(err);
      const id = s.nodes[s.nodes.length - 1].id;
      if (config) updateConfig(s, id, config);
      if (alias) aliases[alias] = id;
    },
    link(from, to) {
      const err = connect(s, one(from), one(to));
      if (err) throw new Error(err);
    },
    unlink(from, to) {
      const a = new Set(all(from));
      const b = new Set(all(to));
      s.edges = s.edges.filter((e) => !(a.has(e.source) && b.has(e.target)));
    },
    remove: (ref) => all(ref).forEach((id) => removeNode(s, id)),
    configure: (ref, patch) => all(ref).forEach((id) => updateConfig(s, id, patch)),
    select: (ref) => void (ui.selectedId = one(ref)),
    tab: (tab) => void (ui.tab = tab),
    play: () => void (ui.speed = 1),
    enableMfa: () => enableRootMfa(s),
    account(patch) {
      const err = setAccount(s, patch);
      if (err) throw new Error(err);
    },
    staff: (id, patch) => updateStaff(s, id, patch),
    removeStaff: (id) => removeStaff(s, id),
    deploy(region) {
      const err = deployStack(s, region);
      if (err) throw new Error(err);
    },
  };
}
