import type { Blueprint } from './harness';

export interface Strategy {
  chapter: number;
  name: string;
  blueprint: Blueprint;
  later?: { at: number; bp: Blueprint };
  /** Whether a player using this strategy should complete the chapter. */
  expect: 'pass' | 'fail';
}

const none: Blueprint = { nodes: {}, edges: [] };

export const STRATEGIES: Strategy[] = [
  // Chapter 0: The Garage
  { chapter: 0, name: 'do nothing', blueprint: none, expect: 'fail' },
  {
    chapter: 0, name: 'buy after heads-up', blueprint: none, expect: 'pass',
    later: { at: 12 * 24 + 1, bp: { nodes: { s2: { kind: 'onprem' } }, edges: [['users', 's2']] } },
  },
  {
    chapter: 0, name: 'overbuy (2 extra)', expect: 'fail',
    blueprint: { nodes: { s2: { kind: 'onprem' } }, edges: [['users', 's2']] },
    later: { at: 12 * 24 + 1, bp: { nodes: { s3: { kind: 'onprem' } }, edges: [['users', 's3']] } },
  },

  // Chapter 1: Static Site
  {
    chapter: 1, name: 'S3 + CloudFront + DNS', expect: 'pass',
    blueprint: {
      nodes: { dns: { kind: 'route53' }, cdn: { kind: 'cloudfront' }, b: { kind: 's3' } },
      edges: [['users', 'dns'], ['dns', 'cdn'], ['cdn', 'b']],
      rootMfa: true,
    },
  },
  {
    chapter: 1, name: 'Lightsail only', expect: 'fail',
    blueprint: { nodes: { dns: { kind: 'route53' }, ls: { kind: 'lightsail' } }, edges: [['users', 'dns'], ['dns', 'ls']], rootMfa: true },
  },
  {
    chapter: 1, name: 'S3 direct (no CDN)', expect: 'fail',
    blueprint: { nodes: { dns: { kind: 'route53' }, b: { kind: 's3' } }, edges: [['users', 'dns'], ['dns', 'b']], rootMfa: true },
  },
  {
    chapter: 1, name: 'no domain name', expect: 'fail',
    blueprint: { nodes: { cdn: { kind: 'cloudfront' }, b: { kind: 's3' } }, edges: [['users', 'cdn'], ['cdn', 'b']], rootMfa: true },
  },
  {
    chapter: 1, name: 'good but no MFA', expect: 'pass',
    blueprint: {
      nodes: { dns: { kind: 'route53' }, cdn: { kind: 'cloudfront' }, b: { kind: 's3' } },
      edges: [['users', 'dns'], ['dns', 'cdn'], ['cdn', 'b']],
    },
  },

  // Chapter 2: Dynamic App
  {
    chapter: 2, name: 'CF + S3 + EC2 + RDS', expect: 'pass',
    blueprint: {
      nodes: {
        cdn: { kind: 'cloudfront' }, b: { kind: 's3' },
        web: { kind: 'ec2', config: { size: 'small', sshOpen: false } },
        db: { kind: 'rds', config: { size: 'small' } },
      },
      edges: [['dns', 'cdn'], ['cdn', 'b'], ['cdn', 'web'], ['web', 'db']],
      rootMfa: true,
    },
  },
  {
    chapter: 2, name: 'Lightsail behind CF', expect: 'fail',
    blueprint: {
      nodes: { cdn: { kind: 'cloudfront' }, ls: { kind: 'lightsail' } },
      edges: [['dns', 'cdn'], ['cdn', 'ls']],
      rootMfa: true,
    },
  },
  {
    chapter: 2, name: 'EC2 without database', expect: 'fail',
    blueprint: {
      nodes: { cdn: { kind: 'cloudfront' }, b: { kind: 's3' }, web: { kind: 'ec2', config: { sshOpen: false } } },
      edges: [['dns', 'cdn'], ['cdn', 'b'], ['cdn', 'web']],
      rootMfa: true,
    },
  },
  {
    chapter: 2, name: 'good arch, SSH open, no MFA', expect: 'pass',
    blueprint: {
      nodes: {
        cdn: { kind: 'cloudfront' }, b: { kind: 's3' },
        web: { kind: 'ec2', config: { size: 'small' } },
        db: { kind: 'rds', config: { size: 'small' } },
      },
      edges: [['dns', 'cdn'], ['cdn', 'b'], ['cdn', 'web'], ['web', 'db']],
    },
  },

  // Chapter 3: Going Viral
  { chapter: 3, name: 'keep starting stack', blueprint: { ...none, rootMfa: true }, expect: 'fail' },
  {
    chapter: 3, name: 'ELB + multi-AZ ASG + cache', expect: 'pass',
    blueprint: {
      nodes: {
        lb: { kind: 'elb' },
        asg: { kind: 'asg', config: { size: 'large', multiAz: true, sshOpen: false, minSize: 2, maxSize: 10 } },
        cache: { kind: 'elasticache', config: { multiAz: true } },
        db2: { kind: 'rds', config: { size: 'medium', multiAz: true } },
        cw: { kind: 'cloudwatch' },
      },
      edges: [['cdn', 'lb'], ['lb', 'asg'], ['asg', 'cache'], ['cache', 'db2']],
      remove: ['web', 'db'],
      rootMfa: true,
    },
  },
  {
    chapter: 3, name: 'ASG single-AZ', expect: 'fail',
    blueprint: {
      nodes: {
        lb: { kind: 'elb' },
        asg: { kind: 'asg', config: { size: 'large', sshOpen: false, minSize: 2, maxSize: 10 } },
        cache: { kind: 'elasticache' },
        db2: { kind: 'rds', config: { size: 'medium' } },
      },
      edges: [['cdn', 'lb'], ['lb', 'asg'], ['asg', 'cache'], ['cache', 'db2']],
      remove: ['web', 'db'],
      rootMfa: true,
    },
  },
  {
    chapter: 3, name: 'huge fixed fleet', expect: 'pass',
    blueprint: {
      nodes: {
        lb: { kind: 'elb' },
        asg: { kind: 'asg', config: { size: 'xlarge', multiAz: true, sshOpen: false, minSize: 10, maxSize: 10 } },
        db2: { kind: 'rds', config: { size: 'xlarge', multiAz: true } },
      },
      edges: [['cdn', 'lb'], ['lb', 'asg'], ['asg', 'db2']],
      remove: ['web', 'db'],
      rootMfa: true,
    },
  },
];
