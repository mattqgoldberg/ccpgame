import { SUPPORT_PLANS } from './catalog';
import type { ChapterDef } from './chapter';
import type { ServiceKind, SimState } from './types';

export interface AdvisorCheck {
  id: string;
  category: 'Security' | 'Fault tolerance' | 'Cost optimization' | 'Performance';
  title: string;
  status: 'ok' | 'warning' | 'error' | 'locked';
  detail: string;
  action?: 'enable-mfa';
}

const LOCKED = 'Requires the Business Support plan or higher.';

/** Trusted Advisor checks. Basic Support only includes the core security checks. */
export function advisorChecks(s: SimState, ch: ChapterDef): AdvisorCheck[] {
  if (!ch.cloud) return [];
  const checks: AdvisorCheck[] = [
    s.flags.rootMfa
      ? { id: 'root-mfa', category: 'Security', title: 'MFA on root account', status: 'ok', detail: 'The root user is protected with MFA.' }
      : {
          id: 'root-mfa', category: 'Security', title: 'MFA on root account', status: 'error',
          detail: 'The root user has full access to everything and no MFA. Enable it now.',
          action: 'enable-mfa',
        },
  ];
  const servers = s.nodes.filter((n) => n.kind === 'ec2' || n.kind === 'asg');
  if (servers.length) {
    const open = servers.filter((n) => n.config.sshOpen);
    checks.push(
      open.length
        ? {
            id: 'ssh', category: 'Security', title: 'Security groups: specific ports unrestricted', status: 'error',
            detail: `${open.length} server group(s) allow SSH (port 22) from 0.0.0.0/0. Select them and close the port.`,
          }
        : { id: 'ssh', category: 'Security', title: 'Security groups: specific ports unrestricted', status: 'ok', detail: 'No sensitive ports are open to the internet.' },
    );
  }
  // Checks that need a higher support plan, shown only once the player has met the service they're about.
  const lockedChecks: (AdvisorCheck & { needs: ServiceKind })[] = [
    { id: 'cdn', category: 'Performance', title: 'CloudFront content delivery optimization', status: 'locked', detail: LOCKED, needs: 'cloudfront' },
    { id: 'low-util', category: 'Cost optimization', title: 'Low utilization EC2 instances', status: 'locked', detail: LOCKED, needs: 'ec2' },
    { id: 'rds-multi-az', category: 'Fault tolerance', title: 'RDS Multi-AZ', status: 'locked', detail: LOCKED, needs: 'rds' },
    { id: 'az-balance', category: 'Fault tolerance', title: 'EC2 Availability Zone balance', status: 'locked', detail: LOCKED, needs: 'elb' },
  ];
  if (!SUPPORT_PLANS[s.account.support].allChecks) {
    for (const { needs, ...check } of lockedChecks) if (ch.available.includes(needs)) checks.push(check);
    return checks;
  }
  // Business Support and higher: every check runs against the real setup.
  const kindOf = (id: string) => s.nodes.find((n) => n.id === id)?.kind;
  const bypassesCdn = s.edges.some((e) => ['users', 'route53', 'waf'].includes(kindOf(e.source) ?? '') && ['s3', 'elb', 'ec2', 'asg', 'lightsail'].includes(kindOf(e.target) ?? ''));
  checks.push(
    bypassesCdn
      ? { id: 'cdn', category: 'Performance', title: 'CloudFront content delivery optimization', status: 'warning', detail: 'Some traffic reaches origins directly. Put CloudFront in front for lower latency and less origin load.' }
      : { id: 'cdn', category: 'Performance', title: 'CloudFront content delivery optimization', status: 'ok', detail: 'Content is served through CloudFront.' },
  );
  const idle = s.nodes.filter((n) => (n.kind === 'ec2' || n.kind === 'asg') && (s.last.nodes[n.id]?.utilization ?? 1) < 0.25 && s.hour > 0);
  checks.push(
    idle.length
      ? { id: 'low-util', category: 'Cost optimization', title: 'Low utilization EC2 instances', status: 'warning', detail: `${idle.length} server group(s) under 25% busy. Consider smaller instance sizes (Compute Optimizer agrees).` }
      : { id: 'low-util', category: 'Cost optimization', title: 'Low utilization EC2 instances', status: 'ok', detail: 'Servers are reasonably busy.' },
  );
  const singleDb = s.nodes.filter((n) => n.kind === 'rds' && !n.config.multiAz);
  checks.push(
    singleDb.length
      ? { id: 'rds-multi-az', category: 'Fault tolerance', title: 'RDS Multi-AZ', status: 'warning', detail: `${singleDb.length} database(s) have no standby in another AZ.` }
      : { id: 'rds-multi-az', category: 'Fault tolerance', title: 'RDS Multi-AZ', status: 'ok', detail: 'Databases have Multi-AZ standbys.' },
  );
  const singleAzWeb = s.nodes.some((n) => n.kind === 'asg' && !n.config.multiAz) || (s.nodes.some((n) => n.kind === 'ec2') && new Set(s.nodes.filter((n) => n.kind === 'ec2').map((n) => n.config.az)).size < 2);
  checks.push(
    singleAzWeb
      ? { id: 'az-balance', category: 'Fault tolerance', title: 'EC2 Availability Zone balance', status: 'warning', detail: 'Some servers all live in one Availability Zone.' }
      : { id: 'az-balance', category: 'Fault tolerance', title: 'EC2 Availability Zone balance', status: 'ok', detail: 'Servers are spread across Availability Zones.' },
  );
  return checks;
}
