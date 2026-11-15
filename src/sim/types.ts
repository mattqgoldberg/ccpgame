export type ServiceKind =
  | 'users'
  | 'onprem'
  | 'route53'
  | 'cloudfront'
  | 's3'
  | 'lightsail'
  | 'ec2'
  | 'elb'
  | 'asg'
  | 'rds'
  | 'elasticache'
  | 'cloudwatch';

export type Az = 'a' | 'b';
export type InstanceSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface NodeConfig {
  size?: InstanceSize;
  az?: Az;
  multiAz?: boolean;
  /** Security group allows SSH (port 22) from 0.0.0.0/0. */
  sshOpen?: boolean;
  minSize?: number;
  maxSize?: number;
}

export interface SimNode {
  id: string;
  kind: ServiceKind;
  config: NodeConfig;
  position: { x: number; y: number };
  /** Auto Scaling group: instances currently running. */
  instances?: number;
  /** On-premises hardware: hour it arrives and starts serving. */
  readyAt?: number;
  /** Hour until which the node is down after being compromised. */
  compromisedUntil?: number;
}

export interface SimEdge {
  id: string;
  source: string;
  target: string;
}

/** Requests per second of each traffic type. */
export interface Traffic {
  static: number;
  dynamic: number;
  /** Attack traffic: consumes capacity, earns nothing, not counted as demand. */
  junk: number;
}

export interface NodeMetrics {
  /** Weighted load (capacity units / s). */
  load: number;
  capacity: number;
  utilization: number;
  down: boolean;
  downReason?: string;
  /** Structural problem, e.g. dynamic requests with no database behind the app. */
  warning?: string;
  /** Requests per second handled (not dropped). */
  throughput: number;
  costPerHour: number;
}

export interface HourSample {
  hour: number;
  demand: number;
  served: number;
  latencyMs: number;
  revenue: number;
  cost: number;
}

export type EffectKind = 'traffic-spike' | 'az-outage' | 'http-flood';

export interface ActiveEffect {
  eventId: string;
  kind: EffectKind;
  since: number;
  until: number;
  magnitude: number;
  az?: Az;
}

export interface Notice {
  id: string;
  title: string;
  body: string[];
  tone: 'info' | 'warning' | 'danger' | 'success';
  codexIds?: string[];
  /** Shared-responsibility style decision. */
  choice?: { eventId: string; options: { label: string }[] };
  /** Optional board-meeting question. */
  questionId?: string;
}

export interface ChapterStats {
  demand: number;
  served: number;
  latencyWeighted: number;
  revenue: number;
  cost: number;
  capex: number;
  computeLoad: number;
  computeCapacity: number;
  outageDemand: number;
  outageServed: number;
  outageOccurred: boolean;
  compromises: number;
  choicesCorrect: number;
  choicesTotal: number;
  alarmHours: number;
  edgeServed: number;
  questionsCorrect: number;
  questionsTotal: number;
}

export interface SimState {
  chapterId: number;
  hour: number;
  cash: number;
  /** Customer satisfaction, 0–100. Scales demand. */
  satisfaction: number;
  nodes: SimNode[];
  edges: SimEdge[];
  effects: ActiveEffect[];
  /** Scripted events already fired. */
  fired: string[];
  /** Deferred event triggers (e.g. consequences of a wrong choice). */
  scheduled: { at: number; eventId: string }[];
  notices: Notice[];
  /** Non-blocking log messages (CloudWatch alarms and similar). Newest last. */
  alerts: { hour: number; text: string; tone: 'info' | 'warning' | 'danger' }[];
  /** Hour each alarm key last fired, to avoid repeats. */
  alarmFiredAt: Record<string, number>;
  flags: { rootMfa: boolean };
  /** Most recent hour's results. */
  last: {
    demand: Traffic;
    served: number;
    latencyMs: number;
    revenue: number;
    cost: number;
    nodes: Record<string, NodeMetrics>;
    edges: Record<string, number>;
  };
  history: HourSample[];
  /** Month-to-date bill line items, in dollars. */
  bill: Record<string, number>;
  freeTierHours: Record<string, number>;
  freeTierEdgeGb: number;
  stats: ChapterStats;
  /** Per-effect tallies, used in debriefs. */
  eventStats: Record<string, { demand: number; served: number; junk: number; junkAtEdge: number }>;
  codex: string[];
  finished: boolean;
  failed?: string;
  rng: number;
  nextId: number;
}
