import type { GameEvent } from '../../sim/chapter';
import type { NodeConfig, Region, SimEdge, SimNode } from '../../sim/types';

export const DAY = 24;

/** The player's boss for the whole game. */
export const COMPANY = { name: 'Trailhead Outfitters', boss: 'Morgan Reyes', bossTitle: 'Founder & CEO' };

export const users: SimNode = { id: 'users', kind: 'users', config: {}, position: { x: 0, y: 160 } };
export const edge = (source: string, target: string): SimEdge => ({ id: `e-${source}-${target}`, source, target });

export interface StackOptions {
  /** HTTPS on CloudFront and the load balancer. */
  https?: boolean;
  /** KMS encryption on S3 and RDS. */
  encrypted?: boolean;
  /** AWS WAF in front of CloudFront. */
  waf?: boolean;
  /** Serverless orders path: API Gateway → SQS → Lambda → DynamoDB. */
  orders?: boolean;
  asg?: Partial<NodeConfig>;
  rds?: Partial<NodeConfig>;
  /** Customers nodes to use instead of the default worldwide one. */
  customers?: SimNode[];
}

/** The store as it stands at the end of chapter 3, plus optional later additions. */
export function storeStack(o: StackOptions = {}): { nodes: SimNode[]; edges: SimEdge[] } {
  const sec = { https: o.https, encrypted: o.encrypted };
  const customers = o.customers ?? [{ ...users, position: { x: 0, y: 240 } }];
  const nodes: SimNode[] = [
    ...customers,
    { id: 'dns', kind: 'route53', config: {}, position: { x: 200, y: 240 } },
    { id: 'cdn', kind: 'cloudfront', config: { https: sec.https }, position: { x: 560, y: 240 } },
    { id: 'blog', kind: 's3', config: { encrypted: sec.encrypted }, position: { x: 800, y: 60 } },
    { id: 'lb', kind: 'elb', config: { https: sec.https }, position: { x: 800, y: 240 } },
    {
      id: 'group', kind: 'asg', position: { x: 1040, y: 240 }, instances: 2,
      config: { size: 'medium', multiAz: true, sshOpen: false, minSize: 2, maxSize: 10, ...o.asg },
    },
    { id: 'cache', kind: 'elasticache', config: { multiAz: true }, position: { x: 1280, y: 240 } },
    { id: 'db', kind: 'rds', config: { size: 'medium', multiAz: true, encrypted: sec.encrypted, ...o.rds }, position: { x: 1520, y: 240 } },
    { id: 'cw', kind: 'cloudwatch', config: {}, position: { x: 200, y: 480 } },
  ];
  const edges: SimEdge[] = [
    ...customers.map((c) => edge(c.id, 'dns')),
    edge('cdn', 'blog'), edge('cdn', 'lb'), edge('lb', 'group'), edge('group', 'cache'), edge('cache', 'db'),
  ];
  if (o.waf) {
    nodes.push({ id: 'fw', kind: 'waf', config: {}, position: { x: 380, y: 240 } });
    edges.push(edge('dns', 'fw'), edge('fw', 'cdn'));
  } else {
    edges.push(edge('dns', 'cdn'));
  }
  if (o.orders) {
    nodes.push(
      { id: 'api', kind: 'apigw', config: { https: sec.https }, position: { x: 800, y: 440 } },
      { id: 'orders', kind: 'sqs', config: {}, position: { x: 1040, y: 440 } },
      { id: 'fn', kind: 'lambda', config: {}, position: { x: 1280, y: 440 } },
      { id: 'carts', kind: 'dynamodb', config: { encrypted: sec.encrypted }, position: { x: 1520, y: 440 } },
    );
    edges.push(edge('cdn', 'api'), edge('api', 'orders'), edge('orders', 'fn'), edge('fn', 'carts'));
  }
  return { nodes, edges };
}

const REGIONAL_KINDS = ['elb', 'asg', 'ec2', 'rds', 'elasticache', 'apigw', 'lambda', 'dynamodb', 'sqs'];

/** Copies a stack's regional resources into another Region, the way the CloudFormation button does in-game. */
export function withRegion(stack: { nodes: SimNode[]; edges: SimEdge[] }, region: Region, offsetY: number) {
  const copies = stack.nodes
    .filter((n) => REGIONAL_KINDS.includes(n.kind) && (n.config.region ?? 'us') === 'us')
    .map((n) => ({ ...n, id: `${n.id}-${region}`, config: { ...n.config, region }, position: { x: n.position.x, y: n.position.y + offsetY } }));
  const ids = new Set(copies.map((c) => c.id.replace(`-${region}`, '')));
  const edges = stack.edges.flatMap((e) => {
    if (ids.has(e.source) && ids.has(e.target)) return [edge(`${e.source}-${region}`, `${e.target}-${region}`)];
    if (!ids.has(e.source) && ids.has(e.target)) return [edge(e.source, `${e.target}-${region}`)];
    return [];
  });
  return { nodes: [...stack.nodes, ...copies], edges: [...stack.edges, ...edges] };
}

export function customers(region: Region, share: number, y: number): SimNode {
  const names = { us: 'usa', eu: 'eu', ap: 'apac' };
  return { id: `users-${names[region]}`, kind: 'users', config: { region, share }, position: { x: 0, y } };
}

/** A quick decision with one right answer. */
export function decide(
  id: string, at: number, title: string, body: string, right: string, rightWhy: string,
  wrong: [string, string][], codexIds: string[], reward: { cash?: number; revenueBoost?: number } = { cash: 300 },
): GameEvent {
  const options: Extract<GameEvent, { kind: 'choice' }>['options'] = wrong.map(([label, why]) => ({ label, correct: false, outcome: [why], effect: { cash: -300 } }));
  // Put the right answer somewhere different each time (stable per decision), so position isn't a giveaway.
  const slot = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % (options.length + 1);
  options.splice(slot, 0, { label: right, correct: true, outcome: [rightWhy], effect: reward });
  return { id, at, kind: 'choice', title, body: [body], codexIds, options };
}

