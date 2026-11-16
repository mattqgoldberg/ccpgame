import type { ServiceKind, SimNode, SimState } from '../../sim/types';
import { acct, all, every, missionOver, node, tabOpen, type Mission } from '../tutorial';
import { DAY, TEAM, edge, storeStack } from './shared';

const base = {
  chapter: 6, available: [] as ServiceKind[], latencyTargetMs: 150, requireDns: true, freeTier: false, cloud: true, strikes: true,
  requireHttps: true, revenue: { static: 0.000004, dynamic: 0.00002 },
};
const carriedOver = {
  staff: TEAM,
  secretsManager: true, support: 'business' as const, ec2Roles: true, organizations: true, scp: true,
  identityCenter: true, cloudtrail: true, config: true, guardduty: true, costTags: true,
};
const archive: SimNode = {
  id: 'archive', kind: 's3', position: { x: 1100, y: 40 },
  config: { encrypted: true, dataGb: 60000, coldData: true, storageClass: 'standard', label: 'Order archive' },
};

// ── 6-1 ───────────────────────────────────────────────────────────────────

const bloated = storeStack({
  https: true, encrypted: true, waf: true, orders: true,
  asg: { size: 'xlarge', minSize: 6, maxSize: 12 },
  rds: { size: 'xlarge' },
});

const theBill: Mission = {
  ...base,
  id: '6-1', title: 'The Bill',
  summary: 'Investors want profit. Find out where the money goes and stop wasting it.',
  lengthHours: 21 * DAY, startingCash: 3000,
  initialNodes: [...bloated.nodes, archive], initialEdges: bloated.edges,
  initialAccount: carriedOver,
  traffic: { startPeak: 200, endPeak: 240, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'spend', label: 'Keep total AWS spend under $3,300', target: 3300 },
  ],
  events: [
    { id: 'b-board', at: 5 * DAY, kind: 'board', questionId: 'q-cost-explorer' },
    { id: 'b-board-2', at: 12 * DAY, kind: 'board', questionId: 'q-storage-class' },
    {
      id: 'b-anomaly', at: 15 * DAY, kind: 'choice',
      title: 'A strange spike on the bill',
      body: ['Sam noticed our data transfer costs jumped overnight. Which service would have alerted us automatically when spending looked unusual?'],
      options: [
        { label: 'AWS Cost Anomaly Detection', correct: true, outcome: ['Right: it uses machine learning to spot unusual spending and alerts you. (This time it was just a big newsletter, nothing malicious.)'] },
        { label: 'AWS Pricing Calculator', correct: false, outcome: ['The Pricing Calculator estimates costs before you build. Cost Anomaly Detection watches for unusual spending afterward.'] },
        { label: 'Amazon Inspector', correct: false, outcome: ['Inspector scans for software vulnerabilities. For unusual spending, use AWS Cost Anomaly Detection.'] },
      ],
      codexIds: ['cost-anomaly-detection'],
    },
  ],
  steps: [
    {
      id: 'intro', title: 'Where did the money go?',
      body: [
        'Our investors want us profitable by next quarter. Our AWS bill has doubled and nobody can tell me why.',
        'Before the flash sale someone cranked everything up to the biggest sizes “just to be safe”. I think it was me.',
      ],
    },
    {
      id: 'explorer', speaker: 'guide', title: 'Cost Explorer', unlock: ['cost-explorer'], highlight: 'tab-bill', codex: ['cost-explorer'],
      body: ['AWS Cost Explorer breaks spending down by service and forecasts the rest of the month. The Bill tab now shows it.'],
      task: 'Open the Bill tab and look at what costs the most.',
      done: tabOpen('bill'),
      solve: (a) => a.tab('bill'),
    },
    {
      id: 'budget', speaker: 'guide', title: 'Set a budget', unlock: ['acct:budget'], highlight: 'acct-budget', codex: ['budgets'],
      body: ['AWS Budgets alerts you when actual or forecasted spending passes a limit you set, before the bill arrives.'],
      task: 'In the Account tab, set a monthly budget.',
      done: acct((a) => a.budget !== null),
      solve: (a) => a.account({ budget: 2500 }),
    },
    {
      id: 'rightsize', speaker: 'guide', title: 'Rightsizing', highlight: 'node-asg', codex: ['rightsizing', 'compute-optimizer'],
      body: [
        'Trusted Advisor and AWS Compute Optimizer agree: our servers average about 15% busy. We’re paying for six extra-large instances around the clock.',
        'Auto Scaling will add instances when it’s busy. Start small and let it grow.',
      ],
      task: 'Set the Auto Scaling Group to Medium instances with Min 2, and the RDS database to Medium.',
      done: all(
        every('asg', (n) => (n.config.size === 'small' || n.config.size === 'medium') && (n.config.minSize ?? 1) <= 2),
        every('rds', (n) => n.config.size === 'small' || n.config.size === 'medium'),
      ),
      why: 'Idle capacity is pure waste. With Auto Scaling, a small baseline still grows to meet peaks.',
      solve: (a) => {
        a.configure('asg', { size: 'medium', minSize: 2 });
        a.configure('rds', { size: 'medium' });
      },
    },
    {
      id: 'archive', speaker: 'guide', title: 'Cold storage', unlock: ['config-storage'], highlight: 'node-s3', codex: ['s3-storage-classes', 's3-lifecycle'],
      body: [
        'The archive bucket holds 60 TB of old order records that we must keep for seven years and almost never read. It’s in S3 Standard, the most expensive class.',
        'S3 Glacier Deep Archive costs about 4% as much, with retrieval in hours instead of milliseconds.',
      ],
      task: 'Select the archive bucket and change its storage class to Glacier Deep Archive (or Intelligent-Tiering).',
      done: node('archive', (n) => n.config.storageClass === 'glacier' || n.config.storageClass === 'intelligent'),
      solve: (a) => a.configure('archive', { storageClass: 'glacier' }),
    },
    {
      id: 'run', title: 'Lean month', highlight: 'play',
      body: ['Let’s see what the bill looks like now.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['cost-anomaly-detection', 'cur', 'pricing-calculator'],
  outro: ['Same store, same customers, a fraction of the bill. Most cloud savings come from not paying for things you don’t use.'],
};

// ── 6-2 ───────────────────────────────────────────────────────────────────

// A bigger steady baseline than 6-1: the store has grown, so commitments are worth it.
const lean = storeStack({ https: true, encrypted: true, waf: true, orders: true, asg: { size: 'large', minSize: 4 }, rds: { size: 'large' } });
// Order processing runs on a group of EC2 workers instead of Lambda here.
const workers: SimNode = {
  id: 'workers', kind: 'asg', position: { x: 1100, y: 420 }, instances: 2,
  config: { size: 'large', multiAz: true, sshOpen: false, minSize: 2, maxSize: 8, label: 'Order workers' },
};
const leanNodes = [...lean.nodes.filter((n) => n.id !== 'fn'), workers, { ...archive, config: { ...archive.config, storageClass: 'glacier' as const } }];
const leanEdges = [
  ...lean.edges.filter((e) => e.source !== 'fn' && e.target !== 'fn'),
  edge('orders', 'workers'), edge('workers', 'carts'),
];

const workersOnSpot = (s: SimState) => {
  const behindQueue = s.nodes.filter((n) => n.kind === 'asg' && s.edges.some((e) => e.target === n.id && s.nodes.find((x) => x.id === e.source)?.kind === 'sqs'));
  const web = s.nodes.filter((n) => n.kind === 'asg' && !behindQueue.includes(n));
  return behindQueue.length > 0 && behindQueue.every((n) => n.config.spot) && web.every((n) => !n.config.spot);
};

const commitments: Mission = {
  ...base,
  id: '6-2', title: 'Commitments',
  summary: 'Pay less for the capacity you always use, and much less for work that can wait.',
  lengthHours: 21 * DAY, startingCash: 3000,
  initialNodes: leanNodes, initialEdges: leanEdges,
  initialAccount: { ...carriedOver, budget: 2500 },
  traffic: { startPeak: 210, endPeak: 250, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'compute-spend', label: 'Keep server and database spend under $360', target: 360 },
  ],
  events: [
    { id: 'c-board', at: 3 * DAY, kind: 'board', questionId: 'q-savings' },
    { id: 'c-reclaim', at: 6 * DAY + 19, kind: 'spot-reclaim', duration: 3, debrief: ['Orders waited in the queue a little longer while Spot capacity came back. Customers never noticed. That’s why Spot suits work that can wait.'] },
    {
      id: 'c-web-spot', at: 9 * DAY, kind: 'choice',
      title: 'Spot for everything?',
      body: ['Priya loves the Spot savings and wants to move the web servers to Spot too. Customers load pages from those directly. Good idea?'],
      options: [
        { label: 'No: customer-facing servers shouldn’t disappear with 2 minutes’ notice', correct: true, outcome: ['Exactly. Spot suits flexible, interruptible work like queue workers and batch jobs. For the steady web tier, a Savings Plan is the safer discount.'] },
        {
          label: 'Yes, save money everywhere', correct: false, effect: { cash: -800 },
          outcome: ['The next Spot reclaim took out half the web servers in the middle of the evening rush. We rolled it back, but lost sales.'],
        },
      ],
      codexIds: ['spot'],
    },
    { id: 'c-board-2', at: 12 * DAY, kind: 'board', questionId: 'q-spot' },
  ],
  steps: [
    {
      id: 'intro', title: 'Commit and save',
      body: [
        'The bill’s much better. Now Sam asks: if we know we’ll always run at least a few servers and a database, can we get a discount for promising to?',
        'Yes. On-Demand is the most flexible way to pay, and the most expensive.',
      ],
    },
    {
      id: 'savings', speaker: 'guide', title: 'Savings Plans', unlock: ['acct:savingsPlan'], highlight: 'acct-savingsPlan', codex: ['savings-plans', 'on-demand'],
      body: [
        'A Compute Savings Plan is a promise to spend a certain amount per hour on compute for 1 or 3 years. In return, that usage is up to ~72% cheaper (about 28% here), across any instance type, Region, or Lambda.',
        'Commit to what you’ll always use, not your peak: you pay the commitment even when you use less.',
      ],
      task: 'Commit to a Savings Plan of at least $0.25 per hour.',
      done: acct((a) => a.savingsPlan >= 0.25),
      solve: (a) => a.account({ savingsPlan: 0.3 }),
    },
    {
      id: 'reserve', speaker: 'guide', title: 'Reserve the database', unlock: ['acct:reservedDb'], highlight: 'acct-reservedDb', codex: ['reserved-instances'],
      body: ['Our database runs 24/7 at the same size. Reserved Instances give a big discount (about 40% here) for a 1- or 3-year commitment to that capacity.'],
      task: 'Reserve the database’s current capacity.',
      done: acct((a) => a.reservedDb > 0),
      solve: (a) => a.account({ reservedDb: 0.2 }),
    },
    {
      id: 'spot', speaker: 'guide', title: 'Spot for work that can wait', unlock: ['config-spot'], highlight: 'inspect-spot', codex: ['spot'],
      body: [
        'Spot Instances use AWS’s spare capacity for up to 90% off, but AWS can take them back with a two-minute warning.',
        'The order workers behind the queue are perfect for Spot: if they vanish, orders just wait in the queue a bit longer.',
      ],
      task: 'Select the workers group (the Auto Scaling Group behind SQS) and switch it to Spot. Leave the web servers On-Demand.',
      done: ({ sim }) => workersOnSpot(sim),
      solve: (a) => a.configure('workers', { spot: true }),
    },
    {
      id: 'run', title: 'Lean and mean', highlight: 'play',
      body: ['Let’s see the savings add up.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['dedicated', 'capacity-reservations', 'batch'],
  outro: ['Savings Plans for the steady baseline, a reserved database, Spot for work that can wait, and On-Demand for spikes. That’s how grown-up companies pay for AWS.'],
};

export const CHAPTER_6: Mission[] = [theBill, commitments];
