import { getQuestion } from '../../content/questions';
import type { ChapterDef } from '../chapter';
import { addNode, answerQuestion, connect, createSim, dismissNotice, enableRootMfa, removeNode, resolveChoice, runToEnd, step, updateConfig } from '../engine';
import type { NodeConfig, ServiceKind, SimState } from '../types';

export interface Blueprint {
  nodes: Record<string, { kind: ServiceKind; config?: NodeConfig }>;
  /** Pairs of blueprint keys. 'users' and initial node ids refer to existing nodes. */
  edges: [string, string][];
  /** Existing node ids to delete first. */
  remove?: string[];
  rootMfa?: boolean;
}

/** Applies a blueprint to a fresh or running sim. Throws on invalid moves so tests fail loudly. */
export function applyBlueprint(s: SimState, ch: ChapterDef, bp: Blueprint) {
  for (const id of bp.remove ?? []) removeNode(s, id);
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
    } else {
      dismissNotice(s);
    }
  };
}

/** Plays a chapter: builds `bp` at the start, optionally `later` at a given hour, then runs to the end. */
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
