import type { ServiceKind } from '../../sim/types';
import { acct, inRegion, missionOver, type Mission } from '../tutorial';
import { DAY, customers, storeStack, withRegion } from './shared';

const base = {
  chapter: 7, available: [] as ServiceKind[], latencyTargetMs: 150, requireDns: true, freeTier: false, cloud: true, strikes: true,
  requireHttps: true, revenue: { static: 0.000004, dynamic: 0.00002 },
};
const carriedOver = {
  secretsManager: true, support: 'business' as const, ec2Roles: true, organizations: true, scp: true,
  identityCenter: true, cloudtrail: true, config: true, guardduty: true, costTags: true, budget: 4000,
};

// ── 7-1 ───────────────────────────────────────────────────────────────────

const transatlantic = storeStack({
  https: true, encrypted: true, waf: true, orders: true,
  customers: [customers('us', 0.55, 140), customers('eu', 0.45, 360)],
});

const helloEurope: Mission = {
  ...base,
  id: '7-1', title: 'Hello, Europe',
  summary: 'Half our new customers are in Europe, and their data has to stay there.',
  lengthHours: 14 * DAY, startingCash: 3000,
  initialNodes: transatlantic.nodes, initialEdges: transatlantic.edges,
  initialAccount: carriedOver,
  traffic: { startPeak: 220, endPeak: 280, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'residency', label: 'Keep EU customers’ data in the EU (under 5% processed elsewhere)', target: 0.05 },
    { kind: 'latency', label: 'Average latency under 100 ms', target: 100 },
  ],
  events: [
    {
      id: 'e-translate', at: 3 * DAY, kind: 'choice',
      title: 'Sprechen Sie Deutsch?',
      body: ['German customers keep asking for the store in German. We have 4,000 product pages. Which service should we use?'],
      options: [
        { label: 'Amazon Translate', correct: true, effect: { revenueBoost: 1.06 }, outcome: ['Amazon Translate did the whole catalog in an afternoon. German sales are up.'] },
        { label: 'Amazon Polly', correct: false, outcome: ['Polly turns text into speech. For translating text between languages, use Amazon Translate.'] },
        { label: 'Amazon Comprehend', correct: false, outcome: ['Comprehend analyzes text (sentiment, key phrases). Translation is Amazon Translate.'] },
      ],
      codexIds: ['translate'],
    },
    { id: 'e-board', at: 6 * DAY, kind: 'board', questionId: 'q-region-choice' },
    { id: 'e-board-2', at: 10 * DAY, kind: 'board', questionId: 'q-cloudformation' },
  ],
  steps: [
    {
      id: 'intro', title: 'Guten Tag!',
      body: [
        'A big German outdoor magazine featured us, and now almost half our new customers are in Europe.',
        'Two problems. Every request from Europe crosses the Atlantic to Virginia, which is slow. And under GDPR, our lawyer says EU customers’ personal data should stay in the EU.',
      ],
    },
    {
      id: 'regions', speaker: 'guide', title: 'Choosing a Region', codex: ['regions', 'data-residency'],
      body: [
        'AWS has Regions all over the world, and your data stays in the Region you choose. Pick a Region based on four things:',
        '• Compliance and data residency: where the law says data must live.',
        '• Latency: how close it is to your customers.',
        '• Service availability: not every service is in every Region.',
        '• Pricing, which varies a little by Region.',
        'For EU customers, that points to Frankfurt (eu-central-1).',
      ],
    },
    {
      id: 'deploy', speaker: 'guide', title: 'Infrastructure as code', unlock: ['cloudformation', 'config-region'], highlight: 'deploy-eu', codex: ['cloudformation'],
      body: [
        'Rebuilding everything by hand in a second Region would take days and invite mistakes. AWS CloudFormation describes our infrastructure as a template, so we can deploy an identical copy anywhere in minutes.',
      ],
      task: 'In the Account tab, use CloudFormation to deploy our stack to Frankfurt.',
      done: inRegion('elb', 'eu'),
      solve: (a) => a.deploy('eu'),
    },
    {
      id: 'routing', speaker: 'guide', title: 'Sending customers to the nearest Region', codex: ['route53', 'global-accelerator'],
      body: [
        'Route 53 latency-based routing (and CloudFront) now send each customer to the closest healthy Region: Americans to Virginia, Europeans to Frankfurt.',
        'Watch the map: European requests now flow into the Frankfurt copy.',
      ],
    },
    {
      id: 'run', title: 'Two continents', highlight: 'play',
      body: ['Let’s see how Europe likes us.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['local-zones', 'wavelength', 'automation-economics'],
  outro: ['Two Regions from one template, with each customer routed to the nearest one and European data staying in Europe. Going global really did take minutes.'],
};

// ── 7-2 ───────────────────────────────────────────────────────────────────

const twoRegions = withRegion(
  storeStack({
    https: true, encrypted: true, waf: true, orders: true,
    customers: [customers('us', 0.45, 100), customers('eu', 0.35, 300), customers('ap', 0.2, 500)],
  }),
  'eu',
  300,
);

const regionDown: Mission = {
  ...base,
  id: '7-2', title: 'Region Down',
  summary: 'Australia joins, and an entire AWS Region goes dark.',
  lengthHours: 14 * DAY, startingCash: 3000,
  initialNodes: twoRegions.nodes, initialEdges: twoRegions.edges,
  initialAccount: carriedOver,
  traffic: { startPeak: 260, endPeak: 320, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99% of requests, even if a Region fails', target: 0.99 },
    { kind: 'residency', label: 'Keep EU customers’ data in the EU (under 5% processed elsewhere)', target: 0.05 },
    { kind: 'latency', label: 'Average latency under 100 ms', target: 100 },
  ],
  events: [
    {
      id: 'r-dr', at: 2 * DAY, kind: 'choice',
      title: 'What’s our disaster recovery strategy?',
      body: ['Our investors ask which disaster recovery strategy we use now that we run full copies of the store in two Regions at once.'],
      options: [
        { label: 'Backup and restore', correct: false, outcome: ['That’s the cheapest and slowest: restore from backups after a disaster (hours or days). We’re doing much more than that.'] },
        { label: 'Pilot light', correct: false, outcome: ['Pilot light keeps only the core (like a replicated database) running in a second Region and scales it up after a disaster. We run everything in both.'] },
        { label: 'Multi-site active-active', correct: true, effect: { cash: 500 }, outcome: ['Right: both Regions serve customers all the time, so losing one barely matters. Fastest recovery, highest cost. The investors were impressed.'] },
      ],
      codexIds: ['multi-region-dr'],
    },
    { id: 'r-board', at: 5 * DAY, kind: 'board', questionId: 'q-dr' },
    {
      id: 'r-sync', at: 6 * DAY, kind: 'choice',
      title: 'Keeping Regions in sync',
      body: ['Shared data like the product catalog needs to stay in sync across Regions. What’s the AWS way?'],
      options: [
        { label: 'Aurora Global Database or DynamoDB global tables', correct: true, effect: { revenueBoost: 1.03 }, outcome: ['Both replicate data across Regions automatically, usually within a second. No more stale prices in Europe.'] },
        { label: 'Export it by hand every night', correct: false, effect: { cash: -500 }, outcome: ['Manual copies go stale and break. Aurora Global Database and DynamoDB global tables replicate across Regions automatically.'] },
      ],
      codexIds: ['aurora', 'dynamodb'],
    },
    {
      id: 'r-outage', at: 8 * DAY + 14, kind: 'region-outage', region: 'us', duration: 10,
      debrief: [
        'Route 53 health checks noticed Virginia was down and sent American customers to Frankfurt. It was slower for them, but the store stayed up.',
        'Region-wide outages are rare, but they happen. Multi-Region is the strongest protection there is.',
      ],
      codexIds: ['multi-region-dr', 'route53'],
    },
    {
      id: 'r-backup', at: 11 * DAY, kind: 'check',
      test: (s) => s.account.backup,
      pass: {
        title: 'Restored from backup',
        body: ['A bad script deleted a day’s worth of orders, in both Regions, because replication faithfully copied the deletion. AWS Backup had a copy from an hour before. Restored in minutes.'],
        tone: 'success', codexIds: ['backup'],
      },
      fail: {
        title: 'Replication isn’t a backup',
        body: ['A bad script deleted a day’s worth of orders, and replication copied the deletion to every Region. With no backups, those orders are gone.'],
        cash: -3000, codexIds: ['backup'],
      },
    },
  ],
  steps: [
    {
      id: 'intro', title: 'G’day, and what if?',
      body: [
        'Australia loves us too: one in five customers is now there, 170 ms away from our nearest Region.',
        'And our investors keep asking: what happens if an entire AWS Region goes down?',
      ],
    },
    {
      id: 'dr', speaker: 'guide', title: 'Disaster recovery strategies', codex: ['multi-region-dr'],
      body: [
        'Four standard strategies, from cheapest and slowest to fastest and most expensive:',
        '• Backup and restore: rebuild from backups. Hours to days.',
        '• Pilot light: core data replicated; scale it up in a disaster. Tens of minutes.',
        '• Warm standby: a smaller full copy always running. Minutes.',
        '• Multi-site active-active: full copies serving traffic everywhere. Near zero.',
        'RTO is how long recovery takes. RPO is how much data you can afford to lose.',
      ],
    },
    {
      id: 'backup', speaker: 'guide', title: 'Backups, too', unlock: ['acct:backup'], highlight: 'acct-backup', codex: ['backup'],
      body: ['Replication copies mistakes as faithfully as good data. AWS Backup takes scheduled, versioned backups across services, so you can go back in time.'],
      task: 'Turn on AWS Backup.',
      done: acct((a) => a.backup),
      solve: (a) => a.account({ backup: true }),
    },
    {
      id: 'sydney', speaker: 'guide', title: 'A third Region', highlight: 'deploy-ap',
      body: ['Australian customers wait 170 ms for every request. Deploy the stack to Sydney (ap-southeast-2) and they’ll be served next door.'],
      task: 'Use CloudFormation to deploy the stack to Sydney.',
      done: inRegion('elb', 'ap'),
      solve: (a) => a.deploy('ap'),
    },
    {
      id: 'run', title: 'Around the world', highlight: 'play',
      body: ['Three Regions on three continents.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['transit-gateway', 'vpc-peering-privatelink', 'memorydb'],
  outro: ['A whole Region failed and the store stayed open. Customers on three continents get fast pages, and European data stays in Europe.'],
};

export const CHAPTER_7: Mission[] = [helloEurope, regionDown];
