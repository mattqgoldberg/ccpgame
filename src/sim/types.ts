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
  | 'cloudwatch'
  | 'waf'
  | 'apigw'
  | 'lambda'
  | 'dynamodb'
  | 'sqs'
  | 'vpn'
  | 'dx';

export type Az = 'a' | 'b';
/** Simplified AWS Regions: us-east-1, eu-central-1, ap-southeast-2. `global` means a worldwide audience with no single home. */
export type Region = 'us' | 'eu' | 'ap';
export type StorageClass = 'standard' | 'standard-ia' | 'glacier' | 'intelligent';
export type SupportPlan = 'basic' | 'developer' | 'business' | 'enterprise-onramp' | 'enterprise';
export type InstanceSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface NodeConfig {
  size?: InstanceSize;
  az?: Az;
  multiAz?: boolean;
  /** Security group allows SSH (port 22) from 0.0.0.0/0. */
  sshOpen?: boolean;
  minSize?: number;
  maxSize?: number;
  /** Which AWS Region the resource lives in (default us). Customers nodes: where they are. */
  region?: Region;
  /** Customers nodes: share of total demand coming from here. */
  share?: number;
  /** Encryption in transit: HTTPS with an ACM certificate. */
  https?: boolean;
  /** Encryption at rest with a KMS key. */
  encrypted?: boolean;
  /** Auto Scaling group runs on Spot Instances. */
  spot?: boolean;
  /** S3: storage class for the bucket's data. */
  storageClass?: StorageClass;
  /** S3: gigabytes stored. */
  dataGb?: number;
  /** S3: the data is rarely read (archives, old logs). */
  coldData?: boolean;
  /** S3: anyone on the internet can list and read the bucket. */
  publicBucket?: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  /** What their IAM permissions allow. */
  access: 'admin' | 'least';
  mfa: boolean;
  /** Has long-term access keys. */
  keys: boolean;
}

/** Account-wide settings: support, security services, cost commitments, people. */
export interface Account {
  support: SupportPlan;
  shieldAdvanced: boolean;
  secretsManager: boolean;
  cloudtrail: boolean;
  config: boolean;
  guardduty: boolean;
  securityHub: boolean;
  inspector: boolean;
  macie: boolean;
  detective: boolean;
  backup: boolean;
  costAnomaly: boolean;
  /** Monthly budget in dollars; alert when the forecast goes over. */
  budget: number | null;
  budgetAlerted: boolean;
  /** Compute Savings Plan commitment, $/hour. */
  savingsPlan: number;
  /** Reserved database capacity, $/hour paid regardless of use (0 = none). */
  reservedDb: number;
  organizations: boolean;
  scp: boolean;
  identityCenter: boolean;
  /** EC2 uses IAM roles instead of access keys baked into servers. */
  ec2Roles: boolean;
  costTags: boolean;
  staff: StaffMember[];
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
  /** SQS: requests waiting in the queue (in requests-per-second-hours). */
  backlog?: number;
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
  /** Share of requests arriving here that failed here (over capacity, down, or nowhere to send them). */
  failRate?: number;
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

export type EffectKind = 'traffic-spike' | 'az-outage' | 'http-flood' | 'region-outage' | 'spot-reclaim';

export interface ActiveEffect {
  eventId: string;
  kind: EffectKind;
  since: number;
  until: number;
  magnitude: number;
  az?: Az;
  region?: Region;
  /** HTTP flood against pages CloudFront can't cache. */
  uncached?: boolean;
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
  /** The boss handed out a strike. */
  strike?: { count: number; max: number };
  /** Practice certification exam. */
  exam?: { questionIds: string[] };
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
  /** Requests from EU customers, and how many were processed outside the EU. */
  euDynamic: number;
  euOutside: number;
  /** Requests accepted by a queue but dropped because the queue overflowed. */
  queueDropped: number;
}

export interface SimState {
  missionId: string;
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
  account: Account;
  /** Revenue multiplier from features shipped via requests. */
  revenueBoost: number;
  /** Practice exam result (share correct), once taken. */
  examScore?: number;
  boss: {
    enabled: boolean;
    /** Strikes this month. Three and you're fired. */
    strikes: number;
    /** Consecutive hours the site has been failing. */
    badHours: number;
    log: { hour: number; reason: string }[];
  };
  /** Most recent hour's results. */
  last: {
    demand: Traffic;
    served: number;
    latencyMs: number;
    revenue: number;
    cost: number;
    nodes: Record<string, NodeMetrics>;
    edges: Record<string, number>;
    /** Per-connection traffic by type, for the map animation. */
    edgeMix?: Record<string, Traffic>;
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
