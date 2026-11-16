import type { Account, Az, Region, ServiceKind, SimEdge, SimNode, SimState, StaffMember } from './types';

/** What happens as a result of an event or decision. */
export interface Outcome {
  title: string;
  body: string[];
  tone?: 'info' | 'success' | 'warning' | 'danger';
  codexIds?: string[];
  /** Cash gained (positive) or lost (negative). */
  cash?: number;
  /** Multiplies revenue for the rest of the mission (1.05 = +5%). */
  revenueBoost?: number;
  /** The boss hands out a strike with this reason. */
  strike?: string;
  /** These kinds of nodes go down for `downHours`. */
  down?: { kinds: ServiceKind[]; hours: number };
}

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
    | { kind: 'http-flood'; rps: number; duration: number; debrief: string[]; codexIds?: string[]; /** Targets pages that can't be cached (login, search). */ uncached?: boolean }
    | { kind: 'ssh-bruteforce'; duration: number }
    | { kind: 'root-check'; loss: number }
    | { kind: 'compromise'; duration: number; title: string; body: string[]; codexIds?: string[] }
    | {
        kind: 'choice';
        title: string;
        body: string[];
        options: { label: string; correct: boolean; outcome: string[]; effect?: Pick<Outcome, 'cash' | 'revenueBoost' | 'strike'> }[];
        codexIds?: string[];
        /** Event scheduled if the player chooses wrong. */
        onWrong?: { eventId: string; delay: number };
      }
    | { kind: 'board'; questionId: string }
    /** Inspects the player's setup and reacts: audits, attacks, leaked keys… */
    | { kind: 'check'; test: (s: SimState) => boolean; pass: Outcome; fail: Outcome }
    | { kind: 'hire'; staff: StaffMember; title: string; body: string[] }
    | { kind: 'region-outage'; region: Region; duration: number; debrief: string[]; codexIds?: string[] }
    | { kind: 'spot-reclaim'; duration: number; debrief: string[] }
    | { kind: 'exam'; questionIds: string[] }
  );

export type ObjectiveKind =
  | 'availability'
  | 'latency'
  | 'cash'
  | 'served'
  /** At most this share of EU customers' requests processed outside the EU. */
  | 'residency'
  /** Practice exam score at least this share. */
  | 'exam'
  /** Total spend (bill) at most this many dollars. */
  | 'spend'
  /** Compute and database spend (after commitments) at most this many dollars. */
  | 'compute-spend';

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
  /** Checkout needs HTTPS: without it on every entry point, dynamic revenue drops. */
  requireHttps?: boolean;
  /** Account settings carried over from earlier missions. */
  initialAccount?: Partial<Account>;
  /** Strikes the intended play-through is expected to take (default 0). */
  expectedStrikes?: number;
  objectives: Objective[];
  events: GameEvent[];
}
