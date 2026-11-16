import type { SimNode } from '../../sim/types';
import {
  all,
  allLinked,
  every,
  has,
  hourAtLeast,
  lacks,
  linked,
  missionOver,
  type Mission,
} from '../tutorial';

import { DAY, edge, users } from './shared';

// ── Chapter 2: The Store Goes Online ──────────────────────────────────────

export const blogStack: SimNode[] = [
  users,
  { id: 'dns', kind: 'route53', config: {}, position: { x: 220, y: 160 } },
  { id: 'cdn', kind: 'cloudfront', config: {}, position: { x: 440, y: 160 } },
  { id: 'blog', kind: 's3', config: {}, position: { x: 680, y: 40 } },
];
export const blogEdges = [edge('users', 'dns'), edge('dns', 'cdn'), edge('cdn', 'blog')];

const movingTheStore: Mission = {
  id: '2-1', chapter: 2, title: 'Moving the Store',
  summary: 'The closet server is dying. Run the store on Lightsail.',
  lengthHours: 14 * DAY, startingCash: 600, available: [],
  initialNodes: blogStack, initialEdges: blogEdges,
  traffic: { startPeak: 12, endPeak: 40, staticShare: 0.3 },
  revenue: { static: 0.00001, dynamic: 0.00006 },
  latencyTargetMs: 150, requireDns: true, freeTier: true, cloud: true, strikes: true,
  objectives: [
    { kind: 'availability', label: 'Serve 98% of requests', target: 0.98 },
    { kind: 'latency', label: 'Average latency under 150 ms', target: 150 },
    { kind: 'cash', label: 'Finish with at least $600', target: 600 },
  ],
  events: [
    {
      id: 'm-syn', at: 3 * DAY, kind: 'info', tone: 'success',
      title: 'An attack was blocked automatically',
      body: [
        'Someone aimed a SYN flood (a network-layer DDoS attack) at the store. You didn’t notice a thing.',
        'AWS Shield Standard protects every AWS customer from common network-layer attacks, automatically and at no extra cost.',
      ],
      codexIds: ['shield'],
    },
    { id: 'm-board', at: 5 * DAY, kind: 'board', questionId: 'q-shield' },
  ],
  hide: ['svc:onprem'],
  steps: [
    {
      id: 'intro', title: 'The closet is dying',
      body: [
        'The closet server is making a grinding noise. It’s time to move the store itself to AWS.',
        'Unlike the blog, the store isn’t just files. Every page is built by code: what’s in your cart, prices, stock. Those are dynamic requests, and they need a server running our code.',
      ],
    },
    {
      id: 'lightsail', speaker: 'guide', title: 'A simple server', unlock: ['svc:lightsail'], highlight: 'palette-lightsail',
      body: ['Amazon Lightsail is the easiest way to get a server on AWS: one fixed monthly price, with a database included.'],
      task: 'Add Lightsail.',
      done: has('lightsail'), solve: (a) => a.add('lightsail', 'ls1'),
    },
    {
      id: 'wire', speaker: 'guide', title: 'Route the store traffic',
      body: ['CloudFront already sends file requests to S3. Connect it to Lightsail too, and CloudFront sends each request to an origin that can handle it.'],
      task: 'Connect CloudFront → Lightsail.',
      done: linked('cloudfront', 'lightsail'),
      why: 'S3 can only hand out files. Without an app server, every page in the store would fail.',
      solve: (a) => a.link('cloudfront', 'ls1'),
    },
    {
      id: 'satisfaction', title: 'Happy customers', unlock: ['stat-satisfaction'], highlight: 'stat-satisfaction',
      body: [
        'Customer satisfaction just appeared at the top. A fast, reliable store makes customers happy, and happy customers tell their friends, so traffic grows.',
        'Errors and slow pages make it drop fast.',
      ],
    },
    {
      id: 'run-1', title: 'Open for business', highlight: 'play',
      body: ['Let’s see how Lightsail does.'],
      task: 'Run the store for six days.',
      done: hourAtLeast(6 * DAY), clock: true,
    },
    {
      id: 'scale', title: 'Growing pains', highlight: 'node-lightsail',
      body: [
        'Look at Lightsail’s load bar. Traffic keeps growing, and in a day or two our evening peak will be more than one server can handle.',
        'When a server is over capacity, requests fail. Three hours of that and… you know the rule.',
      ],
      task: 'Add a second Lightsail and connect CloudFront to it too.',
      done: all(has('lightsail', 2), allLinked('cloudfront', 'lightsail')),
      why: 'CloudFront spreads requests across every origin connected to it, so two servers share the load.',
      solve: (a) => {
        a.add('lightsail', 'ls2');
        a.link('cloudfront', 'ls2');
      },
    },
    {
      id: 'run-2', title: 'See it through',
      body: ['Watch the load bars as traffic climbs.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['agility'],
  outro: ['The store is in the cloud, and the closet server can finally retire. When traffic grew, you added a server in seconds instead of waiting three days.'],
};

const realServers: Mission = {
  id: '2-2', chapter: 2, title: 'Real Servers',
  summary: 'Graduate to EC2 and RDS, and find out where AWS’s job ends and yours begins.',
  lengthHours: 14 * DAY, startingCash: 600, available: [],
  initialNodes: [
    ...blogStack,
    { id: 'ls1', kind: 'lightsail', config: { az: 'a' }, position: { x: 680, y: 180 } },
    { id: 'ls2', kind: 'lightsail', config: { az: 'a' }, position: { x: 680, y: 300 } },
  ],
  initialEdges: [...blogEdges, edge('cdn', 'ls1'), edge('cdn', 'ls2')],
  traffic: { startPeak: 30, endPeak: 55, staticShare: 0.3 },
  revenue: { static: 0.00001, dynamic: 0.00006 },
  latencyTargetMs: 150, requireDns: true, freeTier: true, cloud: true, strikes: true,
  objectives: [
    { kind: 'availability', label: 'Serve 98% of requests', target: 0.98 },
    { kind: 'latency', label: 'Average latency under 150 ms', target: 150 },
    { kind: 'cash', label: 'Finish with at least $600', target: 600 },
  ],
  events: [
    { id: 'r-ssh', at: 2 * DAY, kind: 'ssh-bruteforce', duration: 12 },
    { id: 'r-board', at: 4 * DAY, kind: 'board', questionId: 'q-shared' },
    {
      id: 'r-patch', at: 5 * DAY, kind: 'choice',
      title: 'Critical OS vulnerability announced',
      body: [
        'A serious Linux vulnerability is all over the news. Our app runs on Linux on EC2.',
        'Who is responsible for patching the operating system on our EC2 instances?',
      ],
      options: [
        {
          label: 'AWS: they run the servers', correct: false,
          outcome: [
            'Under the shared responsibility model, AWS secures the cloud itself: hardware, the hypervisor, and the buildings.',
            'With EC2, the operating system on your instance is yours. Nobody patched it…',
          ],
        },
        {
          label: 'Me: the instance’s OS is my responsibility', correct: true,
          outcome: [
            'Right. AWS handles security OF the cloud (hardware, hypervisor, facilities). You handle security IN the cloud, including the operating system on EC2. You patched overnight.',
            'Tip: AWS Systems Manager can patch a whole fleet at once.',
          ],
        },
      ],
      codexIds: ['shared-responsibility', 'shared-responsibility-by-service'],
      onWrong: { eventId: 'r-exploited', delay: 48 },
    },
    {
      id: 'r-exploited', kind: 'compromise', duration: 10,
      title: 'Unpatched servers exploited',
      body: ['Attackers used the vulnerability on our unpatched EC2 instances. They’re offline while you rebuild them.', 'Patching the operating system on EC2 is the customer’s job.'],
      codexIds: ['shared-responsibility'],
    },
    {
      id: 'r-rds', at: 8 * DAY, kind: 'choice',
      title: 'Database engine update',
      body: ['A security update is out for the database engine our RDS database runs. Who installs it?'],
      options: [
        {
          label: 'Me: I log in to the database server and install it', correct: false,
          outcome: [
            'You can’t: RDS doesn’t give you access to the underlying server. AWS patches it during a maintenance window you choose.',
            'That’s the trade-off with a managed service: less control, much less work.',
          ],
        },
        {
          label: 'AWS: RDS is a managed service', correct: true,
          outcome: ['Correct. AWS patches the RDS host and database engine. You still own your data, who can access it, and the database’s network rules.'],
        },
      ],
      codexIds: ['shared-responsibility-by-service', 'managed-services-economics'],
    },
    { id: 'r-board-2', at: 10 * DAY, kind: 'board', questionId: 'q-rds' },
  ],
  hide: ['svc:onprem'],
  steps: [
    {
      id: 'intro', title: 'More control',
      body: [
        'Lightsail got us online, but we’ve outgrown it. We need servers we can size exactly, and a real database that’s backed up properly.',
        'So: Amazon EC2 for the app, and Amazon RDS for the database.',
      ],
    },
    {
      id: 'ec2', speaker: 'guide', title: 'Launch an instance', unlock: ['svc:ec2'], highlight: 'palette-ec2',
      body: ['Amazon EC2 gives you virtual servers, called instances. You choose the size and operating system, and you’re responsible for keeping that operating system patched.'],
      task: 'Add an EC2 Instance.',
      done: has('ec2'), solve: (a) => a.add('ec2', 'web'),
    },
    {
      id: 'vpc', speaker: 'guide', title: 'Where servers live', codex: ['vpc', 'subnets', 'internet-gateway', 'nat-gateway'],
      body: [
        'Every EC2 instance lives inside a VPC (Virtual Private Cloud): your own private network in AWS.',
        'A VPC is split into subnets. Public subnets route to the internet through an internet gateway. Private subnets don’t, which is where databases belong. A NAT gateway lets private servers download updates without being reachable from the internet.',
        'The map keeps this simple, but your servers are inside a VPC from now on.',
      ],
    },
    {
      id: 'ssh', speaker: 'guide', title: 'Check the firewall', unlock: ['config-ssh'], highlight: 'inspect-ssh', codex: ['security-groups'],
      body: [
        'See the 🔓 warning on the instance? Its security group (the instance’s firewall) lets anyone on the internet try to log in over SSH, on port 22.',
        'Customers only need web traffic, and that arrives through CloudFront.',
      ],
      task: 'Select the instance and untick “allow SSH from 0.0.0.0/0”.',
      done: every('ec2', (n) => !n.config.sshOpen),
      why: 'Bots scan the whole internet for open SSH ports all day long. An open port is an invitation.',
      success: 'Locked down. Only the traffic you need gets in.',
      solve: (a) => a.configure('ec2', { sshOpen: false }),
    },
    {
      id: 'size', speaker: 'guide', title: 'Pick a size', unlock: ['config-size'], highlight: 'inspect-size',
      body: [
        'Instance types trade power for price. Small is covered by the Free Tier (750 hours a month), but it handles only about 40 requests per second.',
        'Our evening peak will pass 50.',
      ],
      task: 'Set the instance type to Medium or bigger.',
      done: every('ec2', (n) => n.config.size !== 'small'),
      why: 'An undersized server gets overloaded and drops requests; an oversized one wastes money. Pick the smallest size that fits.',
      solve: (a) => a.configure('ec2', { size: 'medium' }),
    },
    {
      id: 'rds', speaker: 'guide', title: 'A managed database', unlock: ['svc:rds'], highlight: 'palette-rds',
      body: ['Unlike Lightsail, EC2 doesn’t come with a database. Amazon RDS is a managed database: AWS installs it, patches it, and backs it up.'],
      task: 'Add an RDS Database and connect EC2 → RDS.',
      done: linked('ec2', 'rds'),
      why: 'Every page in the store reads from the database. Without one, every dynamic request fails.',
      solve: (a) => {
        a.add('rds', 'db');
        a.link('web', 'db');
      },
    },
    {
      id: 'switch', speaker: 'guide', title: 'Switch over',
      body: ['Now send the store’s traffic to EC2 instead of Lightsail.'],
      task: 'Connect CloudFront → EC2, then delete both Lightsail servers.',
      done: all(linked('cloudfront', 'ec2'), lacks('lightsail')),
      solve: (a) => {
        a.link('cloudfront', 'web');
        a.remove('lightsail');
      },
    },
    {
      id: 'run', title: 'Go live', highlight: 'play',
      body: ['You’re responsible for more now. Expect some tough calls.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: ['shared-responsibility'], codexOnComplete: ['shared-responsibility-by-service', 'managed-services-economics', 'instance-types'],
  outro: ['You split the store into layers (files on S3, code on EC2, data in RDS) and learned where AWS’s job ends and yours begins.'],
};

export const CHAPTER_2: Mission[] = [movingTheStore, realServers];
