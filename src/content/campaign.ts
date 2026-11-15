import type { ChapterDef } from '../sim/chapter';
import { CHAPTERS } from './chapters';

const DAY = 24;
const MONTH = 30 * DAY;

/** Extra Codex unlocks tied to chapter start/end. */
export interface ChapterExtras {
  codexOnStart: string[];
  codexOnComplete: string[];
  outro: string[];
}

export type PlayableChapter = ChapterDef & ChapterExtras;

function meta(id: number) {
  const c = CHAPTERS.find((x) => x.id === id)!;
  return { id, title: c.title, premise: c.premise };
}

const garage: PlayableChapter = {
  ...meta(0),
  intro: [
    'You’ve started a small online shop. It runs on one server in your garage that cost you $2,500.',
    'More servers can be ordered from the supplier at $2,500 each, and they take 3 days to arrive. Once bought, they’re yours, whether you use them or not.',
    'Keep the site up and don’t lose money this month.',
  ],
  tips: [
    'Each server handles about 25 dynamic requests per second.',
    'Hover over a server to see how busy it is.',
    'Buying a server is a gamble: too few and customers get errors; too many and you’ve wasted cash.',
  ],
  lengthHours: MONTH,
  startingCash: 4000,
  available: ['onprem'],
  initialNodes: [
    { id: 'users', kind: 'users', config: {}, position: { x: 0, y: 120 } },
    { id: 'server1', kind: 'onprem', config: {}, position: { x: 320, y: 120 } },
  ],
  initialEdges: [{ id: 'e-users-server1', source: 'users', target: 'server1' }],
  traffic: { startPeak: 10, endPeak: 22, staticShare: 0.5 },
  revenue: { static: 0.000025, dynamic: 0.00015 },
  latencyTargetMs: 200,
  requireDns: false,
  freeTier: false,
  objectives: [
    { kind: 'availability', label: 'Serve at least 97% of requests', target: 0.97 },
    { kind: 'cash', label: 'Finish with at least $4,000', target: 4000 },
  ],
  events: [
    { id: 'g-board', at: 6 * DAY, kind: 'board', questionId: 'q-benefits' },
    {
      id: 'g-heads-up', at: 12 * DAY, kind: 'info', tone: 'warning',
      title: 'A tech blog wants to feature you',
      body: [
        'A popular blog will feature your shop around day 18. Traffic could triple for a few days. Or it might not.',
        'New servers take 3 days to arrive. Do you buy now, or hope you can cope?',
      ],
    },
    {
      id: 'g-spike', at: 17 * DAY + 14, kind: 'traffic-spike', multiplier: 3, duration: 3 * DAY,
      title: 'You’re on the front page!',
      body: ['The feature went live. Traffic is pouring in.'],
      debrief: [
        'With your own hardware you have to guess capacity in advance. Guess low and you turn customers away. Guess high and expensive servers sit idle for the rest of the year.',
      ],
    },
  ],
  codexOnStart: [],
  codexOnComplete: ['six-benefits', 'capex-opex', 'agility'],
  outro: [
    'Running your own hardware meant paying upfront (CapEx), waiting days for capacity, and guessing how much you’d need.',
    'The cloud flips all three: pay as you go (OpEx), get capacity in seconds, and scale with demand. These are among the six advantages of cloud computing, now in your Codex.',
    'Next: you open an AWS account.',
  ],
};

const staticSite: PlayableChapter = {
  ...meta(1),
  intro: [
    'You’ve opened an AWS account. First project: a travel blog with readers all over the world.',
    'Pages and images are static files, so there’s no application code to run.',
    'Build it from the palette on the left, then drag from one service’s right edge to another’s left edge to send traffic between them. Customers need a domain name to find you.',
  ],
  tips: [
    'Customers → Route 53 gives you a domain name. Without one, most readers never find you.',
    'S3 can host static files cheaply and scales on its own.',
    'Readers are worldwide. CloudFront serves them from nearby edge locations.',
    'Open Trusted Advisor (right panel) and fix anything red.',
  ],
  lengthHours: MONTH,
  startingCash: 300,
  available: ['route53', 'cloudfront', 's3', 'lightsail', 'ec2'],
  initialNodes: [{ id: 'users', kind: 'users', config: {}, position: { x: 0, y: 160 } }],
  initialEdges: [],
  traffic: { startPeak: 30, endPeak: 80, staticShare: 1 },
  revenue: { static: 0.00003, dynamic: 0 },
  latencyTargetMs: 80,
  requireDns: true,
  freeTier: true,
  objectives: [
    { kind: 'served', label: 'Serve 60 million page views', target: 60_000_000 },
    { kind: 'availability', label: 'Serve at least 99% of requests', target: 0.99 },
    { kind: 'latency', label: 'Average latency under 80 ms', target: 80 },
    { kind: 'cash', label: 'Finish with at least $300', target: 300 },
  ],
  events: [
    {
      id: 's-account', at: 1, kind: 'info',
      title: 'Welcome to AWS',
      body: [
        'Your new account comes with a root user that can do anything, including closing the account.',
        'Trusted Advisor is already flagging it. Check the Advisor tab on the right.',
      ],
      codexIds: ['root-user', 'trusted-advisor'],
    },
    { id: 's-board', at: 9 * DAY, kind: 'board', questionId: 'q-static-hosting' },
    {
      id: 's-spike', at: 15 * DAY + 10, kind: 'traffic-spike', multiplier: 4, duration: 18,
      title: 'Your post hit the front page!',
      body: ['A link aggregator picked up your latest post. Readers are flooding in from every continent.'],
      debrief: [
        'Static content cached at edge locations scales almost without limit, and S3 scales automatically. A single server has a hard ceiling.',
      ],
      codexIds: ['edge-locations'],
    },
    { id: 's-board-2', at: 19 * DAY, kind: 'board', questionId: 'q-edge' },
    { id: 's-root', at: 22 * DAY, kind: 'root-check', loss: 400 },
  ],
  codexOnStart: ['regions', 'free-tier'],
  codexOnComplete: ['edge-locations', 'on-demand', 'well-architected'],
  outro: [
    'S3 + CloudFront + Route 53 is the classic serverless static site: no servers to patch, near-unlimited scale, pennies per month.',
    'Next: your app needs logins and a database.',
  ],
};

const dynamicApp: PlayableChapter = {
  ...meta(2),
  intro: [
    'Your blog is now a members-only app with accounts, saved trips, and comments. That means application code and a database.',
    'Most requests are now dynamic: an app server runs code and queries a database. Only images and stylesheets are static.',
    'Domain name’s already set up. Build the rest.',
  ],
  tips: [
    'Dynamic requests need compute (EC2 or Lightsail). EC2 also needs a database (RDS) connected behind it.',
    'S3 can still serve your static files, but it can’t run code. Put CloudFront in front of both.',
    'New EC2 instances allow SSH from anywhere. Select the instance and close the port.',
    'Small EC2 and RDS instances are covered by the Free Tier.',
  ],
  lengthHours: MONTH,
  startingCash: 600,
  available: ['route53', 'cloudfront', 's3', 'lightsail', 'ec2', 'rds'],
  initialNodes: [
    { id: 'users', kind: 'users', config: {}, position: { x: 0, y: 160 } },
    { id: 'dns', kind: 'route53', config: {}, position: { x: 200, y: 160 } },
  ],
  initialEdges: [{ id: 'e-users-dns', source: 'users', target: 'dns' }],
  traffic: { startPeak: 15, endPeak: 45, staticShare: 0.3 },
  revenue: { static: 0.00001, dynamic: 0.00006 },
  latencyTargetMs: 150,
  requireDns: true,
  freeTier: true,
  objectives: [
    { kind: 'availability', label: 'Serve at least 98% of requests', target: 0.98 },
    { kind: 'latency', label: 'Average latency under 150 ms', target: 150 },
    { kind: 'cash', label: 'Finish with at least $600', target: 600 },
  ],
  events: [
    {
      id: 'd-syn', at: 4 * DAY, kind: 'info', tone: 'success',
      title: 'A network flood was blocked automatically',
      body: [
        'Someone aimed a SYN flood (a layer 3/4 DDoS attack) at your site. You didn’t notice a thing.',
        'AWS Shield Standard protects every AWS customer from common network-layer attacks automatically, at no extra cost.',
      ],
      codexIds: ['shield'],
    },
    { id: 'd-ssh', at: 7 * DAY, kind: 'ssh-bruteforce', duration: 12 },
    { id: 'd-board', at: 10 * DAY, kind: 'board', questionId: 'q-shared' },
    {
      id: 'd-patch', at: 12 * DAY, kind: 'choice',
      title: 'Critical OS vulnerability announced',
      body: [
        'A serious Linux kernel vulnerability is all over the news. Your app servers run Linux on EC2.',
        'Who is responsible for patching the operating system on your EC2 instances?',
      ],
      options: [
        {
          label: 'AWS: they run the servers', correct: false,
          outcome: [
            'Under the shared responsibility model, AWS secures the cloud itself: hardware, the hypervisor, and facilities.',
            'With EC2, the guest operating system is yours. Nobody patched it…',
          ],
        },
        {
          label: 'Me: the guest OS is my responsibility', correct: true,
          outcome: [
            'Right. AWS handles security OF the cloud (hardware, hypervisor, facilities). You handle security IN the cloud, including the EC2 guest OS. You patched overnight with no downtime.',
            'Tip: AWS Systems Manager can patch a whole fleet at once.',
          ],
        },
      ],
      codexIds: ['shared-responsibility', 'shared-responsibility-by-service'],
      onWrong: { eventId: 'd-exploited', delay: 48 },
    },
    {
      id: 'd-exploited', kind: 'compromise', duration: 10,
      title: 'Unpatched servers exploited',
      body: [
        'Attackers used the kernel vulnerability on your unpatched EC2 instances. They’re offline while you rebuild them.',
        'Patching the guest OS on EC2 is the customer’s job.',
      ],
      codexIds: ['shared-responsibility'],
    },
    {
      id: 'd-rds-patch', at: 18 * DAY, kind: 'choice',
      title: 'Database engine update',
      body: ['A security update is out for the database engine your RDS instance runs. Who installs it?'],
      options: [
        {
          label: 'Me: I log in to the database server and install it', correct: false,
          outcome: [
            'You can’t: RDS doesn’t give you access to the underlying server. AWS patches the OS and engine during the maintenance window you choose.',
            'That’s the trade-off of a managed service: less control, far less work.',
          ],
        },
        {
          label: 'AWS: RDS is a managed service', correct: true,
          outcome: [
            'Correct. AWS patches the RDS host and engine during your maintenance window. You still own your data, who can access it, and the database’s network rules.',
          ],
        },
      ],
      codexIds: ['shared-responsibility-by-service', 'managed-services-economics'],
    },
    { id: 'd-root', at: 21 * DAY, kind: 'root-check', loss: 1500 },
    { id: 'd-board-2', at: 25 * DAY, kind: 'board', questionId: 'q-rds' },
  ],
  codexOnStart: ['shared-responsibility'],
  codexOnComplete: ['shared-responsibility-by-service', 'managed-services-economics', 'instance-types'],
  outro: [
    'You split the app into tiers (static files on S3, code on EC2, data in RDS) and learned where AWS’s responsibilities end and yours begin.',
    'Next: you go viral.',
  ],
};

const goingViral: PlayableChapter = {
  ...meta(3),
  intro: [
    'Your app is taking off. Traffic will grow about 4× this month, and the press is circling.',
    'One server in one Availability Zone won’t survive what’s coming. Load balancers, Auto Scaling, caching, and monitoring are now unlocked.',
    'Your 12-month Free Tier has ended, so everything is billed at full price.',
  ],
  tips: [
    'Customers → … → Load Balancer → Auto Scaling Group → RDS. The group adds instances as load grows.',
    'Turn on Multi-AZ for the Auto Scaling group, cache, and database to survive an AZ outage.',
    'ElastiCache between your app and RDS absorbs most database reads.',
    'Add CloudWatch Alarms so you hear about problems immediately.',
  ],
  lengthHours: MONTH,
  startingCash: 1500,
  available: ['route53', 'cloudfront', 's3', 'lightsail', 'ec2', 'rds', 'elb', 'asg', 'elasticache', 'cloudwatch'],
  initialNodes: [
    { id: 'users', kind: 'users', config: {}, position: { x: 0, y: 200 } },
    { id: 'dns', kind: 'route53', config: {}, position: { x: 180, y: 200 } },
    { id: 'cdn', kind: 'cloudfront', config: {}, position: { x: 360, y: 200 } },
    { id: 'bucket', kind: 's3', config: {}, position: { x: 580, y: 60 } },
    { id: 'web', kind: 'ec2', config: { size: 'large', az: 'a', sshOpen: false }, position: { x: 580, y: 260 } },
    { id: 'db', kind: 'rds', config: { size: 'medium', az: 'a', multiAz: false }, position: { x: 820, y: 260 } },
  ],
  initialEdges: [
    { id: 'e-users-dns', source: 'users', target: 'dns' },
    { id: 'e-dns-cdn', source: 'dns', target: 'cdn' },
    { id: 'e-cdn-bucket', source: 'cdn', target: 'bucket' },
    { id: 'e-cdn-web', source: 'cdn', target: 'web' },
    { id: 'e-web-db', source: 'web', target: 'db' },
  ],
  traffic: { startPeak: 60, endPeak: 250, staticShare: 0.3 },
  revenue: { static: 0.000004, dynamic: 0.00002 },
  latencyTargetMs: 150,
  requireDns: true,
  freeTier: false,
  objectives: [
    { kind: 'availability', label: 'Serve at least 99.5% of requests', target: 0.995 },
    { kind: 'latency', label: 'Average latency under 150 ms', target: 150 },
    { kind: 'cash', label: 'Finish with at least $1,500', target: 1500 },
  ],
  events: [
    { id: 'v-board', at: 7 * DAY, kind: 'board', questionId: 'q-elasticity' },
    {
      id: 'v-spike', at: 10 * DAY + 12, kind: 'traffic-spike', multiplier: 3, duration: 60,
      title: 'A celebrity just posted about you',
      body: ['Millions of new followers are checking you out. Expect 3× traffic for a couple of days.'],
      debrief: ['Elasticity means capacity follows demand automatically, up for the rush and back down after, so you only pay for what you use.'],
      codexIds: ['elasticity'],
    },
    {
      id: 'v-outage', at: 17 * DAY + 15, kind: 'az-outage', az: 'a', duration: 8,
      debrief: [
        'Each Availability Zone is one or more separate data centers. AZs fail independently, so running in two or more is the standard way to stay up.',
        'Load balancers route around unhealthy targets, Auto Scaling replaces lost instances, and Multi-AZ RDS fails over to its standby automatically.',
      ],
      codexIds: ['high-availability', 'availability-zones'],
    },
    { id: 'v-board-2', at: 19 * DAY, kind: 'board', questionId: 'q-multi-az' },
    {
      id: 'v-flood', at: 23 * DAY + 18, kind: 'http-flood', rps: 3000, duration: 6,
      debrief: [
        'Shield Standard (free, automatic) stops network-layer floods, but this was an application-layer HTTP flood.',
        'Because the attack targeted a cacheable page, CloudFront answered it at the edge before it reached your servers. Later you’ll unlock AWS WAF rate-based rules and Shield Advanced for attacks caching can’t stop.',
      ],
      codexIds: ['shield', 'cloudfront'],
    },
    { id: 'v-board-3', at: 26 * DAY, kind: 'board', questionId: 'q-shield' },
    { id: 'v-root', at: 27 * DAY, kind: 'root-check', loss: 2500 },
  ],
  codexOnStart: ['data-transfer-pricing'],
  codexOnComplete: ['elasticity', 'high-availability', 'well-architected'],
  outro: [
    'You scaled with demand, survived losing a data center, and shrugged off an attack: elasticity, high availability, and edge protection.',
    'Chapter 4 (E-Commerce: payments, WAF, encryption, and auditors) is coming in the next milestone.',
  ],
};

export const CAMPAIGN: PlayableChapter[] = [garage, staticSite, dynamicApp, goingViral];

export function getChapter(id: number): PlayableChapter | undefined {
  return CAMPAIGN.find((c) => c.id === id);
}
