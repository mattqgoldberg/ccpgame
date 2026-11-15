import type { SimEdge, SimNode } from '../sim/types';
import {
  all,
  allLinked,
  every,
  featuresAt,
  has,
  hourAtLeast,
  lacks,
  linked,
  mfaOn,
  missionOver,
  playing,
  selected,
  servicesIn,
  tabOpen,
  unlinked,
  type Check,
  type Mission,
} from './tutorial';

const DAY = 24;

/** The player's boss for the whole game. */
export const COMPANY = { name: 'Trailhead Outfitters', boss: 'Morgan Reyes', bossTitle: 'Founder & CEO' };

const users: SimNode = { id: 'users', kind: 'users', config: {}, position: { x: 0, y: 160 } };
const edge = (source: string, target: string): SimEdge => ({ id: `e-${source}-${target}`, source, target });

// ── Chapter 0: The Garage ─────────────────────────────────────────────────

const firstDay: Mission = {
  id: '0-1', chapter: 0, title: 'First Day',
  summary: 'Meet your boss and the one server that runs the whole store.',
  lengthHours: 5 * DAY, startingCash: 4000, available: [],
  initialNodes: [users, { id: 'server1', kind: 'onprem', config: {}, position: { x: 320, y: 160 } }],
  initialEdges: [edge('users', 'server1')],
  traffic: { startPeak: 8, endPeak: 10, staticShare: 0.5 },
  revenue: { static: 0.000025, dynamic: 0.00015 },
  latencyTargetMs: 200, requireDns: false, freeTier: false, cloud: false, strikes: false,
  objectives: [{ kind: 'availability', label: 'Keep the store up (95% of requests served)', target: 0.95 }],
  events: [],
  steps: [
    {
      id: 'welcome', title: `Welcome to ${COMPANY.name}`,
      body: [
        `Hi, I’m Morgan. I started ${COMPANY.name} in my garage, selling hiking and camping gear online. You’re our first engineer. Welcome aboard!`,
        'This screen is a map of our system. Customers are on the left. On the right is the server that runs the whole store. It lives in a closet next to my water heater.',
      ],
    },
    {
      id: 'select-server', title: 'Meet the server',
      body: ['Every time a customer loads a page or adds a tent to their cart, that request goes to our server.'],
      task: 'Click the Physical Server on the map.',
      done: selected('onprem'), unlock: ['tab-inspect'], highlight: 'node-onprem',
      success: 'The Inspect panel on the right shows details about whatever you select.',
      solve: (a) => a.select('onprem'),
    },
    {
      id: 'read-inspector', title: 'Reading the inspector', highlight: 'inspect-metrics',
      body: [
        'Load is how much work the server is doing right now. Capacity is the most it can handle: about 25 requests per second for this one.',
        'On the map, the bar labeled “Load” on the server fills up as it gets busier. Green is fine, yellow is busy, and red means it’s full and extra requests are failing.',
      ],
    },
    {
      id: 'press-play', speaker: 'guide', title: 'Start the clock',
      body: [
        'The game is paused. Time only moves when you press Play, and it pauses on its own whenever something important happens.',
        'One second of real time is about two hours at the store.',
      ],
      task: 'Press ▶ Play at the top of the screen.',
      done: playing, unlock: ['play'], highlight: 'play', clock: true, auto: true,
      solve: (a) => a.play(),
    },
    {
      id: 'watch-day', title: 'Watch the traffic',
      body: [
        'Each dot moving along the line is a request: blue for pages, green for files like photos. Red dots are requests that are failing. The number on the line is requests per second.',
        'Customers react above the Customers box. Mornings are quiet, and traffic peaks in the evening when people shop after work.',
      ],
      task: 'Let one full day go by.',
      done: hourAtLeast(DAY), clock: true,
    },
    {
      id: 'money', title: 'Keeping score', unlock: ['stat-cash', 'stat-traffic'], highlight: 'stat-cash',
      body: [
        'That was a normal day: busy evening, quiet morning. Two numbers just appeared at the top.',
        'Cash is the company’s money. Every order earns a little; electricity and the internet line for the closet cost a little.',
        'Traffic is requests per second, plus the percentage we served successfully. 100% means nobody saw an error.',
      ],
    },
    {
      id: 'finish', speaker: 'guide', title: 'Speed it up', highlight: 'play', unlock: ['speed-2x', 'speed-4x'],
      body: [
        'You can now run time at 2× or 4× speed. Pause whenever you like with ⏸ or the Space bar.',
        'Things pause on their own when something happens, so it’s safe to go fast.',
      ],
      task: 'Press 4× and finish the week.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: [],
  outro: ['A quiet first week. The server handled everything with room to spare… for now.'],
};

const theRush: Mission = {
  id: '0-2', chapter: 0, title: 'The Rush',
  summary: 'A blog is about to send a wave of customers. Is one server enough?',
  lengthHours: 21 * DAY, startingCash: 4000, available: [],
  initialNodes: [users, { id: 'server1', kind: 'onprem', config: {}, position: { x: 320, y: 100 } }],
  initialEdges: [edge('users', 'server1')],
  traffic: { startPeak: 10, endPeak: 18, staticShare: 0.5 },
  revenue: { static: 0.00005, dynamic: 0.0003 },
  latencyTargetMs: 200, requireDns: false, freeTier: false, cloud: false, strikes: true,
  objectives: [
    { kind: 'availability', label: 'Serve at least 97% of requests', target: 0.97 },
    { kind: 'cash', label: 'Finish with at least $3,000', target: 3000 },
  ],
  events: [
    {
      id: 'rush-spike', at: 11 * DAY + 14, kind: 'traffic-spike', multiplier: 3, duration: 3 * DAY,
      title: 'We’re on the front page!',
      body: ['The hiking blog published its feature. Customers are pouring in.'],
      debrief: [
        'Owning hardware means guessing capacity in advance. Guess low and customers get errors. Guess high and expensive servers sit idle for the rest of the year.',
      ],
    },
    { id: 'rush-board', at: 16 * DAY, kind: 'board', questionId: 'q-guess-capacity' },
  ],
  steps: [
    {
      id: 'goals', title: 'Goals for the month',
      body: ['Big month ahead. I’ve written our goals down for you.'],
      task: 'Open the Goals tab on the right.',
      done: tabOpen('goals'), unlock: ['tab-goals'], highlight: 'tab-goals',
      success: 'Goals turn green while you’re on track. They’re checked for real at the end of the mission.',
      solve: (a) => a.tab('goals'),
    },
    {
      id: 'strikes', title: 'How I work', unlock: ['boss'], highlight: 'boss',
      body: [
        'One more thing, and I’ll be straight with you.',
        'If the store is failing for 3 hours in a row, that’s a strike. If someone hacks us, that’s a strike. Three strikes in one month and I’ll have to let you go.',
        'Your strikes are shown at the top. When the store starts failing, a countdown shows how long you have to fix it before I notice.',
      ],
    },
    {
      id: 'run-1', speaker: 'guide', title: 'Business as usual', highlight: 'play', unlock: ['speed-8x'],
      body: ['Run the store for a few days. 8× speed is unlocked for quiet stretches like this.'],
      task: 'Press Play and run until Morgan has news.',
      done: hourAtLeast(5 * DAY), clock: true,
    },
    {
      id: 'news', title: 'Big news!',
      body: [
        'A popular hiking blog is featuring us around day 12! Traffic could triple for a few days.',
        'Our server handles about 25 requests per second and we already peak around 15. Triple that and we’re in trouble.',
        'A new server costs $2,500 and takes 3 days to arrive. Once we buy it, it’s ours, even if we never need it again.',
      ],
    },
    {
      id: 'buy', speaker: 'guide', title: 'Buy a server', unlock: ['svc:onprem'], highlight: 'palette-onprem',
      body: ['The Supplier panel on the left lists what you can buy.'],
      task: 'Buy a Physical Server from the Supplier panel.',
      done: has('onprem', 2),
      why: 'It takes three days to arrive, so you have to decide before the rush. That’s what “guessing capacity” means.',
      success: 'Ordered! It shows “Shipping” until it arrives.',
      solve: (a) => a.add('onprem', 'server2'),
    },
    {
      id: 'connect', speaker: 'guide', title: 'Plug it in', unlock: ['connect'], highlight: 'node-users',
      body: ['Traffic only flows along connections. Every service has a dot on its right side (traffic out) and on its left side (traffic in).'],
      task: 'Drag from the dot on the right of Customers to the dot on the left of the new server.',
      done: allLinked('users', 'onprem'),
      why: 'Without a connection, the new server just sits in the closet doing nothing.',
      success: 'Customers are now split between both servers. Until the new one arrives, the old one handles everything.',
      solve: (a) => a.link('users', 'server2'),
    },
    {
      id: 'run-2', speaker: 'guide', title: 'Ride the wave', unlock: ['speed-16x', 'chart', 'report-card'], highlight: 'chart',
      body: [
        'The Goals tab now has a chart of demand versus requests served. If the lines split apart, customers are getting errors.',
        '16× speed is unlocked too. The game still pauses when something happens.',
      ],
      task: 'Run until the end of the month.',
      done: missionOver, clock: true,
    },
  ],
  teachReport: true,
  codexOnStart: [], codexOnComplete: [],
  outro: [
    'We survived the rush. But look at what it cost: two servers, and for most of the month the second one sat idle.',
    'That’s the problem with owning hardware. You pay up front, wait days for it, and have to guess how much you’ll need.',
  ],
};

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
        'The closet is full, and buying servers was painful. So I’ve opened an account with Amazon Web Services (AWS). We rent what we need, by the hour, and AWS runs the data centers.',
        'Let’s start small: a blog with hiking guides to bring in new customers. The store stays in the closet for now.',
      ],
    },
    {
      id: 'why-cloud', title: 'Why the cloud?', codex: ['capex-opex', 'agility'],
      body: [
        'Remember the rush? We paid $2,500 up front, waited three days, guessed how big the spike would be, and then the server sat idle. With AWS:',
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
      id: 'advisor', speaker: 'guide', title: 'Secure the account', unlock: ['tab-advisor'], highlight: 'tab-advisor',
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

// ── Chapter 2: The Store Goes Online ──────────────────────────────────────

const blogStack: SimNode[] = [
  users,
  { id: 'dns', kind: 'route53', config: {}, position: { x: 220, y: 160 } },
  { id: 'cdn', kind: 'cloudfront', config: {}, position: { x: 440, y: 160 } },
  { id: 'blog', kind: 's3', config: {}, position: { x: 680, y: 40 } },
];
const blogEdges = [edge('users', 'dns'), edge('dns', 'cdn'), edge('cdn', 'blog')];

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

export const MISSIONS: Mission[] = [firstDay, theRush, helloAws, findUs, aroundTheWorld, movingTheStore, realServers, twoOfEverything, goingViral];

const MFA_MISSION = 1 + MISSIONS.findIndex((m) => m.steps.some((st) => st.done === mfaOn));
MISSIONS.forEach((m, i) => {
  // The engine validates placements against `available`: everything unlocked by the end of the mission.
  m.available = servicesIn(featuresAt(MISSIONS, i, m.steps.length - 1));
  // Same AWS account all game: once the tutorial has you enable root MFA, it stays on.
  m.startsWithMfa = MFA_MISSION > 0 && i >= MFA_MISSION;
});

export function getMission(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function missionIndex(id: string): number {
  return MISSIONS.findIndex((m) => m.id === id);
}
