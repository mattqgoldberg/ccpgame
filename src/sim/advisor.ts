import type { ChapterDef } from './chapter';
import type { SimState } from './types';

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
  if (ch.id === 0) return [];
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
  checks.push(
    { id: 'low-util', category: 'Cost optimization', title: 'Low utilization EC2 instances', status: 'locked', detail: LOCKED },
    { id: 'rds-multi-az', category: 'Fault tolerance', title: 'RDS Multi-AZ', status: 'locked', detail: LOCKED },
    { id: 'az-balance', category: 'Fault tolerance', title: 'EC2 Availability Zone balance', status: 'locked', detail: LOCKED },
    { id: 'cdn', category: 'Performance', title: 'CloudFront content delivery optimization', status: 'locked', detail: LOCKED },
  );
  return checks;
}
