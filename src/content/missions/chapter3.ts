import type { SimNode } from '../../sim/types';
import {
  all,
  allLinked,
  every,
  has,
  lacks,
  linked,
  missionOver,
  unlinked,
  type Check,
  type Mission,
} from '../tutorial';

import { DAY, edge } from './shared';
import { blogEdges, blogStack } from './chapter2';

// ── Chapter 3: Going Viral ────────────────────────────────────────────────

const ec2Stack: SimNode[] = [
  ...blogStack,
  { id: 'web', kind: 'ec2', config: { size: 'medium', az: 'a', sshOpen: false }, position: { x: 680, y: 220 } },
  { id: 'db', kind: 'rds', config: { size: 'small', az: 'a', multiAz: false }, position: { x: 920, y: 220 } },
];

const twoOfEverything: Mission = {
  id: '3-1', chapter: 3, title: 'Two of Everything',
  summary: 'One server in one building is a single point of failure. Spread out.',
  lengthHours: 14 * DAY, startingCash: 1500, available: [],
  initialNodes: ec2Stack,
  initialEdges: [...blogEdges, edge('cdn', 'web'), edge('web', 'db')],
  traffic: { startPeak: 40, endPeak: 80, staticShare: 0.3 },
  revenue: { static: 0.000006, dynamic: 0.00003 },
  latencyTargetMs: 150, requireDns: true, freeTier: false, cloud: true, strikes: true,
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'latency', label: 'Average latency under 150 ms', target: 150 },
    { kind: 'cash', label: 'Finish with at least $1,500', target: 1500 },
  ],
  events: [
    {
      id: 't-outage', at: 10 * DAY + 16, kind: 'az-outage', az: 'a', duration: 8,
      debrief: [
        'Each Availability Zone is one or more separate data centers. They fail independently, so running in two is the standard way to stay up.',
        'The load balancer stopped sending traffic to the dead server, and Multi-AZ RDS switched to its standby automatically.',
      ],
      codexIds: ['high-availability', 'availability-zones'],
    },
    { id: 't-board', at: 12 * DAY, kind: 'board', questionId: 'q-multi-az' },
  ],
  hide: ['svc:onprem'],
  steps: [
    {
      id: 'intro', title: 'One of everything',
      body: [
        'Good news: we raised money! Bad news: a competitor’s site went down for a whole day last week when their data center lost power.',
        'Right now we have one web server and one database, both in the same building. If that building has a bad day, so do we.',
      ],
    },
    {
      id: 'azs', speaker: 'guide', title: 'Availability Zones',
      body: [
        'An AWS Region (like us-east-1, in Virginia) is made of several Availability Zones (AZs). Each AZ is one or more separate data centers with their own power and networking.',
        'AZs fail independently. Spread across two, and one going dark won’t take you down.',
      ],
    },
    {
      id: 'elb', speaker: 'guide', title: 'A load balancer', unlock: ['svc:elb'], highlight: 'palette-elb',
      body: ['An Elastic Load Balancer spreads requests across several servers and checks their health. If a server stops answering, it stops getting traffic.'],
      task: 'Put a Load Balancer between CloudFront and EC2: CloudFront → Load Balancer → EC2, and delete CloudFront → EC2.',
      done: all(linked('cloudfront', 'elb'), linked('elb', 'ec2'), unlinked('cloudfront', 'ec2')),
      solve: (a) => {
        a.add('elb', 'lb');
        a.unlink('cloudfront', 'ec2');
        a.link('cloudfront', 'lb');
        a.link('lb', 'web');
      },
    },
    {
      id: 'second', speaker: 'guide', title: 'A second server, somewhere else', unlock: ['config-az'], highlight: 'inspect-az',
      body: ['Add a second EC2 instance in the other Availability Zone, us-east-1b. Give it the same settings as the first: Medium, SSH closed.'],
      task: 'Add an EC2 instance in us-east-1b, then connect Load Balancer → it and it → RDS.',
      done: twoAzWebTier,
      why: 'If both servers are in us-east-1a, one power cut takes out both.',
      solve: (a) => {
        a.add('ec2', 'webB', { az: 'b', size: 'medium', sshOpen: false });
        a.link('lb', 'webB');
        a.link('webB', 'db');
      },
    },
    {
      id: 'multiaz', speaker: 'guide', title: 'A standby database', unlock: ['config-multiaz'], highlight: 'inspect-multiaz',
      body: ['The database is still in just one AZ. RDS Multi-AZ keeps a standby copy in another AZ and switches to it automatically. It costs twice as much.'],
      task: 'Select the RDS database and turn on Multi-AZ.',
      done: every('rds', (n) => !!n.config.multiAz),
      solve: (a) => a.configure('rds', { multiAz: true }),
    },
    {
      id: 'alarms', speaker: 'guide', title: 'Get alerts', unlock: ['svc:cloudwatch', 'alerts'], highlight: 'palette-cloudwatch',
      body: ['Amazon CloudWatch collects metrics from everything. Alarms tell you the moment something crosses a line, instead of you hearing it from angry customers.'],
      task: 'Add CloudWatch Alarms.',
      done: has('cloudwatch'), solve: (a) => a.add('cloudwatch'),
    },
    {
      id: 'run', title: 'Stress test', highlight: 'play',
      body: ['Our Free Tier year is over, so everything bills at full price now. Let’s see how the new design holds up.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: ['availability-zones'], codexOnComplete: ['high-availability'],
  outro: ['A data center went dark and customers barely noticed. That’s high availability: no single point of failure.'],
};

function twoAzWebTier(c: Parameters<Check>[0]): boolean {
  const web = c.sim.nodes.filter((n) => n.kind === 'ec2');
  const azs = new Set(web.map((n) => n.config.az));
  return (
    web.length >= 2 &&
    azs.size >= 2 &&
    web.every((n) => !n.config.sshOpen) &&
    allLinked('elb', 'ec2')(c) &&
    web.every((n) => c.sim.edges.some((e) => e.source === n.id && c.sim.nodes.find((x) => x.id === e.target)?.kind === 'rds'))
  );
}

const goingViral: Mission = {
  id: '3-2', chapter: 3, title: 'Going Viral',
  summary: 'Traffic triples. Scale automatically, cache the database, and survive an attack.',
  lengthHours: 21 * DAY, startingCash: 1500, available: [],
  initialNodes: [
    ...blogStack,
    { id: 'lb', kind: 'elb', config: {}, position: { x: 680, y: 240 } },
    { id: 'web', kind: 'ec2', config: { size: 'medium', az: 'a', sshOpen: false }, position: { x: 900, y: 180 } },
    { id: 'webB', kind: 'ec2', config: { size: 'medium', az: 'b', sshOpen: false }, position: { x: 900, y: 320 } },
    { id: 'db', kind: 'rds', config: { size: 'small', az: 'a', multiAz: true }, position: { x: 1140, y: 240 } },
    { id: 'cw', kind: 'cloudwatch', config: {}, position: { x: 0, y: 360 } },
  ],
  initialEdges: [...blogEdges, edge('cdn', 'lb'), edge('lb', 'web'), edge('lb', 'webB'), edge('web', 'db'), edge('webB', 'db')],
  traffic: { startPeak: 80, endPeak: 250, staticShare: 0.3 },
  revenue: { static: 0.000004, dynamic: 0.00002 },
  latencyTargetMs: 150, requireDns: true, freeTier: false, cloud: true, strikes: true,
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'latency', label: 'Average latency under 150 ms', target: 150 },
    { kind: 'cash', label: 'Finish with at least $1,500', target: 1500 },
  ],
  events: [
    {
      id: 'v-spike', at: 8 * DAY + 12, kind: 'traffic-spike', multiplier: 3, duration: 60,
      title: 'The video dropped',
      body: ['Millions of people just watched our influencer’s video. Expect 3× traffic for a couple of days.'],
      debrief: ['Elasticity means capacity follows demand automatically: up for the rush, back down after, so you only pay for what you use.'],
      codexIds: ['elasticity'],
    },
    { id: 'v-board', at: 11 * DAY + 6, kind: 'board', questionId: 'q-elasticity' },
    {
      id: 'v-flood', at: 15 * DAY + 18, kind: 'http-flood', rps: 3000, duration: 6,
      debrief: [
        'Shield Standard (free and automatic) stops network-layer floods, but this was an application-layer flood of normal-looking web requests.',
        'The attack targeted a page CloudFront had cached, so the edge absorbed it before it reached your servers. Later you’ll unlock AWS WAF and Shield Advanced for attacks caching can’t stop.',
      ],
      codexIds: ['shield', 'cloudfront'],
    },
    { id: 'v-board-2', at: 17 * DAY, kind: 'board', questionId: 'q-cache' },
  ],
  hide: ['svc:onprem'],
  steps: [
    {
      id: 'intro', title: 'Brace yourself',
      body: [
        'A famous outdoor influencer just signed with us. Traffic will roughly triple this month, with a huge spike when the first video drops.',
        'Two servers won’t cut it. And I don’t want to pay for twenty servers sitting idle at 4 a.m.',
      ],
    },
    {
      id: 'asg', speaker: 'guide', title: 'Auto Scaling', unlock: ['svc:asg', 'config-asg-range'], highlight: 'palette-asg',
      body: ['An Auto Scaling group runs as many EC2 instances as needed: more when it’s busy, fewer when it’s quiet, always between a minimum and maximum you choose. You only pay for what’s running.'],
      task: 'Add an Auto Scaling Group, then connect Load Balancer → it and it → RDS.',
      done: all(linked('elb', 'asg'), linked('asg', 'rds')),
      solve: (a) => {
        a.add('asg', 'group');
        a.link('lb', 'group');
        a.link('group', 'db');
      },
    },
    {
      id: 'asg-config', speaker: 'guide', title: 'Configure the group', highlight: 'inspect-multiaz',
      body: ['Set it up to survive an AZ outage, and give it room to grow for the spike.'],
      task: 'In the group’s settings: turn on “Spread across multiple AZs”, close SSH, and set Max to 8 or more.',
      done: every('asg', (n) => !!n.config.multiAz && !n.config.sshOpen && (n.config.maxSize ?? 0) >= 8),
      why: 'A group in one AZ has the same weakness as a single server. A low maximum caps how far it can grow.',
      solve: (a) => a.configure('asg', { multiAz: true, sshOpen: false, maxSize: 10 }),
    },
    {
      id: 'retire', speaker: 'guide', title: 'Retire the old servers',
      body: ['The group replaces both hand-made instances.'],
      task: 'Delete both EC2 instances.',
      done: lacks('ec2'), solve: (a) => a.remove('ec2'),
    },
    {
      id: 'cache', speaker: 'guide', title: 'Take load off the database', unlock: ['svc:elasticache'], highlight: 'palette-elasticache',
      body: ['With this much traffic, the database becomes the bottleneck. Amazon ElastiCache keeps frequently read data in memory and answers most queries in under a millisecond.'],
      task: 'Make it Auto Scaling Group → ElastiCache → RDS, delete the direct line, and turn on Multi-AZ for the cache.',
      done: all(linked('asg', 'elasticache'), linked('elasticache', 'rds'), unlinked('asg', 'rds'), every('elasticache', (n) => !!n.config.multiAz)),
      why: 'Our database handles about 150 queries per second. At the peak we’ll send it several times that.',
      solve: (a) => {
        a.add('elasticache', 'cache', { multiAz: true });
        a.unlink('asg', 'rds');
        a.link('group', 'cache');
        a.link('cache', 'db');
      },
    },
    {
      id: 'run', title: 'Go viral', highlight: 'play',
      body: ['Here we go.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['elasticity'],
  outro: [
    'You scaled with demand, cached the hot data, and shrugged off an attack.',
    'Chapter 4 (payments, encryption, WAF, and auditors) is coming next.',
  ],
};

export const CHAPTER_3: Mission[] = [twoOfEverything, goingViral];
