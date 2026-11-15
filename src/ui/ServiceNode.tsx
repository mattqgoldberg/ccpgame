import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { CATALOG, SIZES } from '../sim/catalog';
import { azName } from '../sim/engine';
import type { NodeMetrics, SimNode, Traffic } from '../sim/types';
import { compact } from './format';

export type ServiceNodeData = {
  node: SimNode;
  metrics?: NodeMetrics;
  /** Customers node only: current demand. */
  demand?: Traffic;
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
    case 'elb':
    case 's3':
      return 'Regional · managed';
    default:
      return '';
  }
}

export function ServiceNode({ data, selected }: NodeProps<ServiceRFNode>) {
  const { node, metrics, demand } = data;
  const def = CATALOG[node.kind];
  const hasTarget = def.behavior !== 'source' && def.behavior !== 'monitor';
  const hasSource = def.connectsTo.length > 0;
  const limited = metrics && metrics.capacity > 0;
  const overloaded = !!metrics && limited && metrics.load > metrics.capacity;
  const status = metrics?.down ? 'down' : overloaded || metrics?.warning ? 'hot' : 'ok';
  const util = metrics?.utilization ?? 0;

  return (
    <div className={`svc cat-${def.category} status-${status} ${selected ? 'selected' : ''}`}>
      {hasTarget && <Handle type="target" position={Position.Left} />}
      <div className="svc-badge">{def.short}</div>
      <div className="svc-body">
        <div className="svc-name">{def.name}</div>
        {node.kind === 'users' && demand ? (
          <div className="svc-sub">{compact(demand.static + demand.dynamic)} req/s</div>
        ) : (
          <div className="svc-sub">{subtitle(node)}</div>
        )}
        {limited && !metrics.down && (
          <div className="meter" title={`${Math.round(util * 100)}% utilized`}>
            <div className={`meter-fill ${util >= 0.95 ? 'crit' : util >= 0.7 ? 'warn' : ''}`} style={{ width: `${Math.min(100, util * 100)}%` }} />
          </div>
        )}
        {metrics?.down && <div className="svc-alert">⛔ {metrics.downReason}</div>}
        {!metrics?.down && overloaded && <div className="svc-alert">⚠ Over capacity</div>}
        {!metrics?.down && metrics?.warning && <div className="svc-alert">⚠ {metrics.warning}</div>}
        {node.config.sshOpen && <div className="svc-flag">🔓 SSH open to internet</div>}
      </div>
      {hasSource && <Handle type="source" position={Position.Right} />}
    </div>
  );
}
