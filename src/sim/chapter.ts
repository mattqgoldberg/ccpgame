import type { Az, ServiceKind, SimEdge, SimNode } from './types';

interface EventBase {
  id: string;
  /** Hour the event fires. Omit for events that only fire when scheduled by another event. */
  at?: number;
}

export type GameEvent = EventBase &
  (
    | { kind: 'info'; title: string; body: string[]; tone?: 'info' | 'success' | 'warning'; codexIds?: string[] }
    | { kind: 'traffic-spike'; multiplier: number; duration: number; title: string; body: string[]; debrief?: string[]; codexIds?: string[] }
    | { kind: 'az-outage'; az: Az; duration: number; debrief: string[]; codexIds?: string[] }
    | { kind: 'http-flood'; rps: number; duration: number; debrief: string[]; codexIds?: string[] }
    | { kind: 'ssh-bruteforce'; duration: number }
    | { kind: 'root-check'; loss: number }
    | { kind: 'compromise'; duration: number; title: string; body: string[]; codexIds?: string[] }
    | {
        kind: 'choice';
        title: string;
        body: string[];
        options: { label: string; correct: boolean; outcome: string[] }[];
        codexIds?: string[];
        /** Event scheduled if the player chooses wrong. */
        onWrong?: { eventId: string; delay: number };
      }
    | { kind: 'board'; questionId: string }
  );

export type ObjectiveKind = 'availability' | 'latency' | 'cash' | 'served';

export interface Objective {
  kind: ObjectiveKind;
  label: string;
  target: number;
}

/** A playable scenario: one mission's world, economy, goals, and scripted events. */
export interface ChapterDef {
  /** Mission id, e.g. "1-2". */
  id: string;
  /** Chapter the mission belongs to (see content/chapters.ts). */
  chapter: number;
  title: string;
  lengthHours: number;
  startingCash: number;
  available: ServiceKind[];
  initialNodes: SimNode[];
  initialEdges: SimEdge[];
  traffic: {
    /** Peak requests/s at the start and end of the chapter (before spikes and satisfaction). */
    startPeak: number;
    endPeak: number;
    staticShare: number;
  };
  /** Dollars earned per served request. */
  revenue: { static: number; dynamic: number };
  latencyTargetMs: number;
  /** Without Route 53 in front, most customers can't find the site. */
  requireDns: boolean;
  freeTier: boolean;
  /** The company has an AWS account (enables Trusted Advisor and account-security scoring). */
  cloud: boolean;
  /** Downtime and breaches earn strikes from the boss. */
  strikes: boolean;
  /** Root MFA was already enabled in an earlier mission (same company account). */
  startsWithMfa?: boolean;
  objectives: Objective[];
  events: GameEvent[];
}
