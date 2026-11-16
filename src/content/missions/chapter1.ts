import {
  all,
  has,
  hourAtLeast,
  linked,
  mfaOn,
  missionOver,
  tabOpen,
  unlinked,
  type Mission,
} from '../tutorial';

import { DAY, edge, users } from './shared';

// ── Chapter 1: Into the Cloud ─────────────────────────────────────────────

const helloAws: Mission = {
  id: '1-1', chapter: 1, title: 'Hello, AWS',
  summary: 'Open an AWS account, lock it down, and put the blog in an S3 bucket.',
  lengthHours: 7 * DAY, startingCash: 500, available: [],
  initialNodes: [users], initialEdges: [],
  traffic: { startPeak: 4, endPeak: 8, staticShare: 1 },
  revenue: { static: 0.0001, dynamic: 0 },
  latencyTargetMs: 150, requireDns: false, freeTier: true, cloud: true, strikes: true,
  objectives: [{ kind: 'availability', label: 'Serve 99% of blog requests', target: 0.99 }],
  events: [
    { id: 'h-board', at: 2 * DAY, kind: 'board', questionId: 'q-benefits' },
    { id: 'h-board-2', at: 5 * DAY, kind: 'board', questionId: 'q-static-hosting' },
  ],
  hide: ['svc:onprem'],
  steps: [
    {
      id: 'intro', title: 'Into the cloud',
      body: [
        'After the TV disaster, I’m done buying servers. I’ve opened an account with Amazon Web Services (AWS). We rent what we need, by the hour, get more in minutes, and AWS runs the data centers.',
        'Let’s start small: a blog with hiking guides to bring in new customers. The store stays in the closet for now.',
      ],
    },
    {
      id: 'why-cloud', title: 'Why the cloud?', codex: ['capex-opex', 'agility'],
      body: [
        'Remember the rush and the TV show? We paid $2,500 up front, waited three days, guessed how much we’d need, and still went down. With AWS:',
        '• Pay as you go. We rent by the hour instead of buying up front. That trades a fixed (capital) expense for a variable one.',
        '• Stop guessing capacity. Add servers in minutes when it’s busy, and turn them off when it’s quiet.',
        '• Speed. New resources take minutes, not days, so we can try ideas quickly.',
      ],
    },
    {
      id: 'why-cloud-2', title: 'And a few more reasons', codex: ['six-benefits'],
      body: [
        '• Economies of scale. AWS buys hardware for millions of customers, so it costs far less per server than anything we could buy.',
        '• No more data center chores. AWS handles the power, cooling, and broken disks. No more grinding noises in my closet.',
        '• Go global in minutes. AWS has data centers all over the world.',
        'Those are the six advantages of cloud computing. They come up a lot on the AWS Cloud Practitioner exam, and investors love to ask about them.',
      ],
    },
    {
      id: 'advisor', speaker: 'guide', title: 'Secure the account', unlock: ['tab-advisor'], highlight: 'tab-advisor', codex: ['trusted-advisor'],
      body: [
        'Every AWS account starts with a root user that can do anything, including deleting everything. Attackers love root users with weak passwords.',
        'AWS Trusted Advisor checks your account for risks like this.',
      ],
      task: 'Open the Advisor tab.',
      done: tabOpen('advisor'), solve: (a) => a.tab('advisor'),
    },
    {
      id: 'mfa', speaker: 'guide', title: 'Turn on MFA', highlight: 'advisor-mfa',
      body: ['Trusted Advisor found a problem: the root user has no multi-factor authentication (MFA).'],
      task: 'Click “Enable MFA on root user”.',
      done: mfaOn,
      why: 'With MFA, a stolen password isn’t enough. An attacker would also need your phone or security key.',
      success: 'Root user protected.',
      solve: (a) => a.enableMfa(),
    },
    {
      id: 's3', speaker: 'guide', title: 'Your first bucket', unlock: ['svc:s3'], highlight: 'palette-s3',
      body: [
        'The blog is just files: pages, photos, and stylesheets. No code needs to run.',
        'Amazon S3 stores files (called objects) in containers (called buckets) and can serve them straight to the web. There are no servers for you to manage.',
      ],
      task: 'Add an S3 Bucket from the AWS services panel on the left.',
      done: has('s3'), solve: (a) => a.add('s3', 'blog'),
    },
    {
      id: 'link', speaker: 'guide', title: 'Connect it', highlight: 'node-users',
      body: ['Same as before: drag from the dot on the right of Customers to the dot on the left of the bucket.'],
      task: 'Connect Customers → S3 Bucket.',
      done: linked('users', 's3'),
      why: 'Customers can only reach what they’re connected to.',
      solve: (a) => a.link('users', 'blog'),
    },
    {
      id: 'codex', speaker: 'guide', title: 'Your field guide', unlock: ['tab-codex'], highlight: 'tab-codex',
      body: ['Every AWS service you use goes into your Codex: what it does, plus the phrases that point to it on the AWS Certified Cloud Practitioner exam.'],
      task: 'Open the Codex tab.',
      done: tabOpen('codex'), solve: (a) => a.tab('codex'),
    },
    {
      id: 'run', title: 'Launch!', highlight: 'play',
      body: ['Let’s see how it does.'],
      task: 'Press Play and run the blog for a week.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: ['regions', 'free-tier'], codexOnComplete: ['on-demand'],
  outro: ['The blog is live, and we didn’t buy a single server. S3 grows on its own and we pay per request. Pennies.'],
};

const findUs: Mission = {
  id: '1-2', chapter: 1, title: 'Find Us',
  summary: 'Give the blog a real domain name with Route 53, and read your first AWS bill.',
  lengthHours: 10 * DAY, startingCash: 500, available: [],
  initialNodes: [users, { id: 'blog', kind: 's3', config: {}, position: { x: 420, y: 160 } }],
  initialEdges: [edge('users', 'blog')],
  traffic: { startPeak: 8, endPeak: 15, staticShare: 1 },
  revenue: { static: 0.0001, dynamic: 0 },
  latencyTargetMs: 150, requireDns: true, freeTier: true, cloud: true, strikes: true,
  objectives: [
    { kind: 'served', label: 'Serve 4 million page views', target: 4_000_000 },
    { kind: 'availability', label: 'Serve 99% of requests', target: 0.99 },
  ],
  events: [{ id: 'f-board', at: 6 * DAY, kind: 'board', questionId: 'q-dns' }],
  hide: ['svc:onprem'],
  steps: [
    {
      id: 'intro', title: 'Nobody can find the blog',
      body: [
        'Readers keep asking me where the blog is. Right now its address is a long, random S3 web address. Nobody remembers that, so most people never find us.',
      ],
    },
    {
      id: 'route53', speaker: 'guide', title: 'A domain name', unlock: ['svc:route53'], highlight: 'palette-route53',
      body: ['Amazon Route 53 is AWS’s DNS service. DNS turns a name people can remember, like trailhead.blog, into an address computers can use.'],
      task: 'Add Route 53.',
      done: has('route53'), solve: (a) => a.add('route53'),
    },
    {
      id: 'delete', speaker: 'guide', title: 'Out with the old', unlock: ['delete'], highlight: 'edge-users-s3',
      body: ['Customers should look up our name in Route 53 first, so the direct connection has to go.'],
      task: 'Click the line from Customers to S3 to select it, then click the ✕ that appears on it.',
      why: 'You can also press Delete or Backspace, or use “Delete connection” in the Inspect tab.',
      done: unlinked('users', 's3'), success: 'Connection removed.',
      solve: (a) => a.unlink('users', 's3'),
    },
    {
      id: 'rewire', speaker: 'guide', title: 'Rewire through DNS',
      body: ['Now customers find us by name, then get the files from S3.'],
      task: 'Connect Customers → Route 53, then Route 53 → S3 Bucket.',
      done: all(linked('users', 'route53'), linked('route53', 's3')),
      why: 'Without a domain name, only about 30% of readers ever find the blog.',
      solve: (a) => {
        a.link('users', 'route53');
        a.link('route53', 's3');
      },
    },
    {
      id: 'run-1', title: 'Back in business', highlight: 'play',
      body: ['Let’s see if more readers show up.'],
      task: 'Run for three days.',
      done: hourAtLeast(3 * DAY), clock: true,
    },
    {
      id: 'bill', speaker: 'guide', title: 'Your first AWS bill', unlock: ['tab-bill'], highlight: 'tab-bill',
      body: ['AWS bills by the hour for what you actually use. Sending data out to the internet costs a little per gigabyte; data coming in is free.'],
      task: 'Open the Bill tab.',
      done: tabOpen('bill'),
      success: 'See the Free Tier line? New accounts get some usage free each month.',
      solve: (a) => a.tab('bill'),
    },
    {
      id: 'run-2', title: 'Finish the stretch',
      body: ['Keep it running.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['data-transfer-pricing'],
  outro: ['Readers can find us now. Route 53 answers lookups for our domain from locations all over the world.'],
};

const aroundTheWorld: Mission = {
  id: '1-3', chapter: 1, title: 'Around the World',
  summary: 'Readers everywhere say the blog is slow. Put CloudFront in front.',
  lengthHours: 14 * DAY, startingCash: 500, available: [],
  initialNodes: [
    users,
    { id: 'dns', kind: 'route53', config: {}, position: { x: 240, y: 160 } },
    { id: 'blog', kind: 's3', config: {}, position: { x: 700, y: 160 } },
  ],
  initialEdges: [edge('users', 'dns'), edge('dns', 'blog')],
  traffic: { startPeak: 15, endPeak: 30, staticShare: 1 },
  revenue: { static: 0.00005, dynamic: 0 },
  latencyTargetMs: 80, requireDns: true, freeTier: true, cloud: true, strikes: true,
  objectives: [
    { kind: 'availability', label: 'Serve 99% of requests', target: 0.99 },
    { kind: 'latency', label: 'Average latency under 80 ms', target: 80 },
    { kind: 'cash', label: 'Don’t lose money (finish with $500+)', target: 500 },
  ],
  events: [
    {
      id: 'w-spike', at: 8 * DAY + 10, kind: 'traffic-spike', multiplier: 4, duration: 18,
      title: 'A guide went viral!',
      body: ['Our “10 best hikes in Patagonia” post hit the front page of a news site. Readers are flooding in from every continent.'],
      debrief: ['CloudFront and S3 both scale automatically. A single server would have had a hard ceiling.'],
      codexIds: ['edge-locations'],
    },
    { id: 'w-board-2', at: 10 * DAY, kind: 'board', questionId: 'q-edge' },
    { id: 'w-root', at: 12 * DAY, kind: 'root-check', loss: 400 },
  ],
  hide: ['svc:onprem'],
  steps: [
    {
      id: 'latency', title: 'Too slow', unlock: ['stat-latency'], highlight: 'stat-latency',
      body: [
        'Readers are coming from all over the world now, and people in Sydney and Berlin say the blog feels slow.',
        'Latency is how long a request takes, in milliseconds. Our files are in Virginia, so every request travels there and back. I want it under 80 ms.',
      ],
    },
    {
      id: 'cloudfront', speaker: 'guide', title: 'Edge locations', unlock: ['svc:cloudfront'], highlight: 'palette-cloudfront',
      body: ['Amazon CloudFront is a content delivery network (CDN). It keeps copies of your files at edge locations in hundreds of cities, so readers get them from somewhere nearby.'],
      task: 'Add CloudFront.',
      done: has('cloudfront'), solve: (a) => a.add('cloudfront'),
    },
    {
      id: 'wire', speaker: 'guide', title: 'Put CloudFront in front', highlight: 'edge-route53-s3',
      body: ['Route 53 should send readers to CloudFront. CloudFront fetches anything it doesn’t have yet from S3, which is called the origin.'],
      task: 'Make it Route 53 → CloudFront → S3 Bucket, and delete the direct Route 53 → S3 line.',
      done: all(linked('route53', 'cloudfront'), linked('cloudfront', 's3'), unlinked('route53', 's3')),
      why: 'Readers far from Virginia wait over 100 ms for every file. From a nearby edge location it’s about 20 ms.',
      solve: (a) => {
        a.unlink('route53', 's3');
        a.link('route53', 'cloudfront');
        a.link('cloudfront', 's3');
      },
    },
    {
      id: 'run', speaker: 'guide', title: 'Launch the edge', highlight: 'play',
      body: ['Some things will happen this month. The game pauses for each one, so take your time.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['edge-locations', 'well-architected'],
  outro: ['S3 + CloudFront + Route 53 is the classic static website on AWS: no servers to patch, nearly unlimited scale, and fast everywhere.'],
};

export const CHAPTER_1: Mission[] = [helloAws, findUs, aroundTheWorld];
