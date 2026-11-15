import type { InstanceSize, NodeConfig, ServiceKind, SimNode } from './types';

/**
 * How a node treats traffic in the request graph.
 * - source:  where customers come from
 * - dns:     forwards everything; nearly free
 * - cdn:     serves cacheable requests at the edge, forwards misses to origins
 * - lb:      splits across healthy targets (health checks)
 * - compute: runs the app; dynamic requests need a database behind it (unless it has one built in)
 * - storage: serves static files only
 * - cache:   answers most database reads, forwards misses
 * - db:      answers database queries
 * - monitor: not part of the request path
 */
export type Behavior = 'source' | 'dns' | 'cdn' | 'lb' | 'compute' | 'storage' | 'cache' | 'db' | 'monitor';

export type Category = 'customers' | 'compute' | 'storage' | 'database' | 'network' | 'management' | 'on-premises';

export interface ServiceDef {
  kind: ServiceKind;
  name: string;
  short: string;
  category: Category;
  behavior: Behavior;
  /** Coverage-matrix entry unlocked in the Codex when placed. */
  codexId?: string;
  /** Kinds this node may send traffic to. */
  connectsTo: ServiceKind[];
  /** Survives a single-AZ outage (regional or global service). */
  regional: boolean;
  maxCount?: number;
  /** Processing latency added per hop, in ms. */
  latencyMs: number;
  /** Compute only: serves dynamic requests without a separate database. */
  builtInDb?: boolean;
  defaultConfig: NodeConfig;
  /** One-time purchase (capital expense). */
  upfrontCost?: number;
  /** Hours until purchased hardware arrives. */
  deliveryHours?: number;
  pricingHint: string;
}

export const SIZES: Record<InstanceSize, { label: string; ec2Price: number; ec2Capacity: number; rdsPrice: number; rdsCapacity: number }> = {
  small: { label: 'Small (2 vCPU, 2 GiB)', ec2Price: 0.0208, ec2Capacity: 40, rdsPrice: 0.034, rdsCapacity: 150 },
  medium: { label: 'Medium (2 vCPU, 4 GiB)', ec2Price: 0.0416, ec2Capacity: 80, rdsPrice: 0.068, rdsCapacity: 300 },
  large: { label: 'Large (2 vCPU, 8 GiB)', ec2Price: 0.096, ec2Capacity: 160, rdsPrice: 0.171, rdsCapacity: 800 },
  xlarge: { label: 'XLarge (4 vCPU, 16 GiB)', ec2Price: 0.192, ec2Capacity: 320, rdsPrice: 0.342, rdsCapacity: 1600 },
};

/** Tuning constants shared by the engine. */
export const BALANCE = {
  /** A static request costs this fraction of a dynamic request on compute. */
  staticWeight: 0.2,
  /** Attack requests cost this much on compute. */
  junkWeight: 0.5,
  /** Round trip to the origin Region for a worldwide audience. */
  originRttMs: 110,
  /** Round trip to the nearest edge location. */
  edgeRttMs: 20,
  /** Edge to origin over the AWS backbone. */
  backboneMs: 45,
  cdnHitRate: 0.9,
  /** HTTP flood requests hit the same cacheable page, so the edge absorbs nearly all of them. */
  cdnJunkHitRate: 0.97,
  cacheHitRate: 0.8,
  bytesStaticMb: 0.1,
  bytesDynamicMb: 0.02,
  originTransferPerGb: 0.09,
  edgeTransferPerGb: 0.085,
  edgeFreeGbPerMonth: 1000,
  s3PerThousandGets: 0.0004,
  cloudfrontPerThousand: 0.001,
  freeTierHoursPerMonth: 750,
  asgTargetUtilization: 0.6,
  /** Requests reaching the site without a domain name, as a fraction. */
  noDnsFindability: 0.3,
  onpremCapacity: 25,
  lightsailCapacity: 25,
  elasticacheCapacity: 5000,
};

export const CATALOG: Record<ServiceKind, ServiceDef> = {
  users: {
    kind: 'users', name: 'Customers', short: 'Users', category: 'customers', behavior: 'source',
    connectsTo: ['route53', 'cloudfront', 'elb', 'ec2', 'asg', 's3', 'lightsail', 'onprem'],
    regional: true, maxCount: 1, latencyMs: 0, defaultConfig: {}, pricingHint: '',
  },
  onprem: {
    kind: 'onprem', name: 'Physical Server', short: 'SRV', category: 'on-premises', behavior: 'compute', builtInDb: true,
    connectsTo: [], regional: true, latencyMs: 25, defaultConfig: {},
    upfrontCost: 2500, deliveryHours: 72,
    pricingHint: '$2,500 upfront · $60/mo power & rack · ships in 3 days',
  },
  route53: {
    kind: 'route53', name: 'Route 53', short: 'R53', category: 'network', behavior: 'dns', codexId: 'route53',
    connectsTo: ['cloudfront', 'elb', 'ec2', 'asg', 's3', 'lightsail'],
    regional: true, maxCount: 1, latencyMs: 1, defaultConfig: {},
    pricingHint: '$0.50/mo per hosted zone',
  },
  cloudfront: {
    kind: 'cloudfront', name: 'CloudFront', short: 'CF', category: 'network', behavior: 'cdn', codexId: 'cloudfront',
    connectsTo: ['s3', 'elb', 'ec2', 'asg', 'lightsail'],
    regional: true, maxCount: 1, latencyMs: 2, defaultConfig: {},
    pricingHint: '$0.085/GB out · $0.01 per 10k requests · 1 TB/mo free',
  },
  s3: {
    kind: 's3', name: 'S3 Bucket', short: 'S3', category: 'storage', behavior: 'storage', codexId: 's3',
    connectsTo: [], regional: true, latencyMs: 15, defaultConfig: {},
    pricingHint: '$0.023/GB-mo · $0.0004 per 1k GETs',
  },
  lightsail: {
    kind: 'lightsail', name: 'Lightsail', short: 'LS', category: 'compute', behavior: 'compute', builtInDb: true, codexId: 'lightsail',
    connectsTo: [], regional: false, latencyMs: 20, defaultConfig: { az: 'a' },
    pricingHint: '$10/mo flat bundle (server + disk + database + transfer)',
  },
  ec2: {
    kind: 'ec2', name: 'EC2 Instance', short: 'EC2', category: 'compute', behavior: 'compute', codexId: 'ec2',
    connectsTo: ['rds', 'elasticache'], regional: false, latencyMs: 20,
    defaultConfig: { size: 'medium', az: 'a', sshOpen: true },
    pricingHint: 'From $0.0208/hr · Free Tier: 750 hrs/mo of Small',
  },
  elb: {
    kind: 'elb', name: 'Load Balancer', short: 'ELB', category: 'network', behavior: 'lb', codexId: 'elb',
    connectsTo: ['ec2', 'asg', 'lightsail'], regional: true, latencyMs: 3, defaultConfig: {},
    pricingHint: '$0.0225/hr + usage (LCUs)',
  },
  asg: {
    kind: 'asg', name: 'Auto Scaling Group', short: 'ASG', category: 'compute', behavior: 'compute', codexId: 'auto-scaling',
    connectsTo: ['rds', 'elasticache'], regional: false, latencyMs: 20,
    defaultConfig: { size: 'medium', az: 'a', multiAz: false, sshOpen: true, minSize: 1, maxSize: 4 },
    pricingHint: 'Free itself; you pay for the EC2 instances it runs',
  },
  rds: {
    kind: 'rds', name: 'RDS Database', short: 'RDS', category: 'database', behavior: 'db', codexId: 'rds',
    connectsTo: [], regional: false, latencyMs: 8,
    defaultConfig: { size: 'small', az: 'a', multiAz: false },
    pricingHint: 'From $0.034/hr · Multi-AZ doubles it · Free Tier: 750 hrs/mo of Small',
  },
  elasticache: {
    kind: 'elasticache', name: 'ElastiCache', short: 'EC$', category: 'database', behavior: 'cache', codexId: 'elasticache',
    connectsTo: ['rds'], regional: false, latencyMs: 1, defaultConfig: { az: 'a', multiAz: false },
    pricingHint: '$0.034/hr · Multi-AZ adds a replica',
  },
  cloudwatch: {
    kind: 'cloudwatch', name: 'CloudWatch Alarms', short: 'CW', category: 'management', behavior: 'monitor', codexId: 'cloudwatch',
    connectsTo: [], regional: true, maxCount: 1, latencyMs: 0, defaultConfig: {},
    pricingHint: '~$3/mo for a dashboard and alarms',
  },
};

/** Processing order: a node only sends traffic to higher ranks, so the graph is always acyclic. */
export const RANK: Record<ServiceKind, number> = {
  users: 0, route53: 1, cloudfront: 2, elb: 3,
  onprem: 4, lightsail: 4, ec2: 4, asg: 4, s3: 4,
  elasticache: 5, rds: 6, cloudwatch: 7,
};

export function canConnect(source: ServiceKind, target: ServiceKind): boolean {
  return CATALOG[source].connectsTo.includes(target);
}

/** Capacity in weighted requests (or queries) per second. */
export function nodeCapacity(node: SimNode): number {
  const size = SIZES[node.config.size ?? 'medium'];
  switch (node.kind) {
    case 'onprem': return BALANCE.onpremCapacity;
    case 'lightsail': return BALANCE.lightsailCapacity;
    case 'ec2': return size.ec2Capacity;
    case 'asg': return size.ec2Capacity * (node.instances ?? node.config.minSize ?? 1);
    case 'rds': return size.rdsCapacity;
    case 'elasticache': return BALANCE.elasticacheCapacity;
    default: return Infinity;
  }
}

/** Running cost per hour, excluding usage-based charges (requests, data transfer). */
export function nodeHourlyCost(node: SimNode, load = 0): number {
  const size = SIZES[node.config.size ?? 'medium'];
  switch (node.kind) {
    case 'onprem': return 60 / 720;
    case 'lightsail': return 10 / 720;
    case 'route53': return 0.5 / 720;
    case 'cloudwatch': return 3 / 720;
    case 'ec2': return size.ec2Price;
    case 'asg': return size.ec2Price * (node.instances ?? node.config.minSize ?? 1);
    case 'rds': return size.rdsPrice * (node.config.multiAz ? 2 : 1);
    case 'elasticache': return 0.034 * (node.config.multiAz ? 2 : 1);
    // One LCU covers roughly 25 new connections per second.
    case 'elb': return 0.0225 + 0.008 * Math.ceil(load / 25);
    default: return 0;
  }
}

export function isComputeKind(kind: ServiceKind): boolean {
  return CATALOG[kind].behavior === 'compute';
}
