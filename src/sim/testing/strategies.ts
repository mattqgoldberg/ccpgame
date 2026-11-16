import type { Blueprint } from './harness';

/** Designs a player might try that should NOT complete the mission. (The intended designs are proven by the tutorial walkthrough tests.) */
export interface Strategy {
  mission: string;
  name: string;
  blueprint: Blueprint;
  later?: { at: number; bp: Blueprint };
}

export const FAILING_STRATEGIES: Strategy[] = [
  { mission: '0-2', name: 'never buy a second server', blueprint: { nodes: {}, edges: [] } },
  {
    mission: '1-2', name: 'skip the domain name',
    blueprint: { nodes: {}, edges: [], rootMfa: true },
  },
  {
    mission: '1-3', name: 'no CloudFront',
    blueprint: { nodes: {}, edges: [], rootMfa: true },
  },
  {
    mission: '2-1', name: 'one Lightsail server',
    blueprint: { nodes: { ls: { kind: 'lightsail' } }, edges: [['cdn', 'ls']], rootMfa: true },
  },
  {
    mission: '2-2', name: 'EC2 left at Small',
    blueprint: {
      nodes: { web: { kind: 'ec2', config: { size: 'small', sshOpen: false } }, db: { kind: 'rds' } },
      edges: [['cdn', 'web'], ['web', 'db']],
      remove: ['ls1', 'ls2'],
      rootMfa: true,
    },
  },
  {
    mission: '3-1', name: 'keep one server in one AZ',
    blueprint: { nodes: { cw: { kind: 'cloudwatch' } }, edges: [], rootMfa: true },
  },
  {
    mission: '3-2', name: 'keep the two fixed servers',
    blueprint: { nodes: {}, edges: [], rootMfa: true },
  },
  {
    mission: '3-2', name: 'Auto Scaling without a cache',
    blueprint: {
      nodes: { group: { kind: 'asg', config: { size: 'medium', multiAz: true, sshOpen: false, minSize: 2, maxSize: 10 } } },
      edges: [['lb', 'group'], ['group', 'db']],
      remove: ['web', 'webB'],
      rootMfa: true,
    },
  },
  { mission: '4-1', name: 'skip encryption and secrets', blueprint: { nodes: {}, edges: [] } },
  { mission: '4-2', name: 'no web application firewall', blueprint: { nodes: {}, edges: [] } },
  { mission: '4-3', name: 'no queue, no support plan', blueprint: { nodes: {}, edges: [] } },
  { mission: '5-1', name: 'everyone stays an admin without MFA', blueprint: { nodes: {}, edges: [] } },
  { mission: '6-1', name: 'leave everything oversized', blueprint: { nodes: {}, edges: [] } },
  { mission: '6-2', name: 'no commitments or Spot', blueprint: { nodes: {}, edges: [] } },
  { mission: '7-1', name: 'serve Europe from Virginia', blueprint: { nodes: {}, edges: [] } },
  { mission: '10-1', name: 'skip the security scanners', blueprint: { nodes: {}, edges: [] } },
];
