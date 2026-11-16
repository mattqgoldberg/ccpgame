import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { useTut } from '../game/store';
import { CATALOG, REGION_NAMES, SIZES, STORAGE_PRICES, nodeCapacity } from '../sim/catalog';
import { azName } from '../sim/engine';
import type { NodeMetrics, Region, SimNode, Traffic } from '../sim/types';
import { CustomerChatter } from './CustomerChatter';
import { compact } from './format';

export type ServiceNodeData = {
  node: SimNode;
  metrics?: NodeMetrics;
  /** Customers node only: current demand. */
  demand?: Traffic;
  /** Show connection dots (the player has learned to connect things). */
  connectable: boolean;
  /** Show the SSH warning (the player has learned about security groups). */
  showSsh: boolean;
};

export type ServiceRFNode = Node<ServiceNodeData, 'service'>;

function subtitle(node: SimNode): string {
  const c = node.config;
  const size = c.size ? SIZES[c.size].label.split(' ')[0] : '';
  const where = c.multiAz ? 'Multi-AZ' : c.az ? azName(c.az) : '';
  switch (node.kind) {
    case 'ec2':
    case 'rds':
      return `${size} · ${where}`;
    case 'asg':
      return `${node.instances ?? c.minSize} × ${size} · ${where}`;
    case 'lightsail':
    case 'elasticache':
      return where;
    case 'route53':
      return 'mystartup.com';
    case 'cloudfront':
    case 'waf':
      return 'Global · edge';
    case 'elb':
    case 's3':
    case 'apigw':
    case 'dynamodb':
    case 'sqs':
      return 'Regional · managed';
    case 'lambda':
      return 'Serverless · no servers to patch';
    case 'vpn':
      return 'Encrypted tunnel over the internet';
    case 'dx':
      return 'Private dedicated line';
    default:
      return '';
  }
}

const CUSTOMER_PLACES: Record<Region, string> = { us: 'Americas', eu: 'Europe', ap: 'Asia-Pacific' };

function NodeTags({ node }: { node: SimNode }) {
  const c = node.config;
  const tags: string[] = [];
  if (c.region && c.region !== 'us' && node.kind !== 'users') tags.push(`📍 ${REGION_NAMES[c.region].split(' ')[0]}`);
  if (c.https) tags.push('🔒 HTTPS');
  if (c.encrypted) tags.push('🔑 KMS');
  if (c.spot) tags.push('Spot');
  if (node.kind === 'sqs' && (node.backlog ?? 0) > 0.05) tags.push(`📬 ${compact((node.backlog ?? 0) * 3600)} waiting`);
  if (node.kind === 's3' && c.dataGb) tags.push(`${compact(c.dataGb / 1000)} TB · ${STORAGE_PRICES[c.storageClass ?? 'standard'].label.replace('S3 ', '')}`);
  if (!tags.length) return null;
  return <div className="svc-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>;
}

export function ServiceNode({ data, selected }: NodeProps<ServiceRFNode>) {
  const { node, metrics, demand, connectable, showSsh } = data;
  const def = CATALOG[node.kind];
  const tut = useTut(`node-${node.kind}`);
  const hasTarget = def.behavior !== 'source' && def.behavior !== 'monitor';
  const hasSource = def.connectsTo.length > 0;
  const capacity = metrics?.capacity ?? nodeCapacity(node);
  const limited = Number.isFinite(capacity) && capacity > 0;
  const overloaded = !!metrics && limited && metrics.load > metrics.capacity;
  const status = metrics?.down ? 'down' : overloaded || metrics?.warning ? 'hot' : 'ok';
  const util = metrics?.utilization ?? 0;

  return (
    <div className={`svc cat-${def.category} status-${status} ${selected ? 'selected' : ''}${tut}`}>
      {hasTarget && <Handle type="target" position={Position.Left} className={connectable ? '' : 'hidden-handle'} isConnectable={connectable} />}
      {node.kind === 'users' && <CustomerChatter />}
      <div className="svc-badge">{def.short}</div>
      <div className="svc-body">
        <div className="svc-name">{node.config.label ?? def.name}</div>
        {node.kind === 'users' && demand ? (
          <div className="svc-sub">
            {compact((demand.static + demand.dynamic) * (node.config.share ?? 1))} req/s{node.config.region ? ` · ${CUSTOMER_PLACES[node.config.region]}` : ''}
          </div>
        ) : (
          <div className="svc-sub">{subtitle(node)}</div>
        )}
        <NodeTags node={node} />
        {limited && !metrics?.down && (
          <div className="meter-row" title="How busy this service is. Red means it’s full and requests are failing.">
            <span className="meter-label">Load</span>
            <div className="meter">
              <div className={`meter-fill ${util >= 0.95 ? 'crit' : util >= 0.7 ? 'warn' : ''}`} style={{ width: `${Math.min(100, util * 100)}%` }} />
            </div>
            <span className="meter-pct">{Math.round(util * 100)}%</span>
          </div>
        )}
        {metrics?.down && <div className="svc-alert">⛔ {metrics.downReason}</div>}
        {!metrics?.down && overloaded && <div className="svc-alert">⚠ Over capacity</div>}
        {!metrics?.down && metrics?.warning && <div className="svc-alert">⚠ {metrics.warning}</div>}
        {showSsh && node.config.sshOpen && <div className="svc-flag">🔓 SSH open to internet</div>}
      </div>
      {hasSource && <Handle type="source" position={Position.Right} className={connectable ? '' : 'hidden-handle'} isConnectable={connectable} />}
    </div>
  );
}
