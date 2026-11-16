import { allHttps } from '../../sim/engine';
import type { ServiceKind, SimState } from '../../sim/types';
import { QUESTIONS } from '../questions';
import { acct, missionOver, type Mission } from '../tutorial';
import { DAY, decide, storeStack } from './shared';

const base = {
  chapter: 10, available: [] as ServiceKind[], latencyTargetMs: 150, requireDns: true, freeTier: false, cloud: true, strikes: true,
  requireHttps: true, revenue: { static: 0.000004, dynamic: 0.00002 },
};
const carriedOver = {
  secretsManager: true, support: 'business' as const, ec2Roles: true, organizations: true, scp: true,
  identityCenter: true, cloudtrail: true, config: true, guardduty: true, costTags: true, budget: 5000, backup: true,
};
const stack = storeStack({ https: true, encrypted: true, waf: true, orders: true });
const encrypted = (s: SimState) => s.nodes.filter((n) => ['rds', 's3', 'dynamodb'].includes(n.kind)).every((n) => n.config.encrypted);

// ── 10-1 ──────────────────────────────────────────────────────────────────

const health: Mission = {
  ...base,
  id: '10-1', title: 'Trailhead Health',
  summary: 'Launch an app that stores medical information. HIPAA applies, and so does everything you’ve learned.',
  lengthHours: 14 * DAY, startingCash: 4000,
  initialNodes: stack.nodes, initialEdges: stack.edges,
  initialAccount: carriedOver,
  traffic: { startPeak: 300, endPeak: 360, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'cash', label: 'Finish with at least $4,000', target: 4000 },
  ],
  events: [
    decide('t-baa', 1 * DAY, 'Before we store health data', 'HIPAA requires a Business Associate Agreement with any vendor that handles patient data. Where do we sign one with AWS?',
      'Accept the AWS BAA in AWS Artifact', 'Right. AWS Artifact handles agreements like the Business Associate Addendum (BAA), not just reports.',
      [['It’s automatic for every account', 'It isn’t. You accept the BAA yourself, in AWS Artifact.'], ['Email AWS Support', 'It’s self-service: AWS Artifact.']],
      ['artifact', 'compliance-programs']),
    {
      id: 't-macie', at: 3 * DAY, kind: 'check',
      test: (s) => s.account.macie,
      pass: {
        title: 'Macie found patient data where it shouldn’t be',
        body: ['A debug log in S3 contained patient names and allergies. Amazon Macie flagged it the same day, and we deleted it and fixed the logging.'],
        tone: 'success', codexIds: ['macie'],
      },
      fail: {
        title: 'Patient data in the logs',
        body: ['A debug log in S3 contained patient names and allergies for weeks before anyone noticed.'],
        cash: -4000, strike: 'Patient data leaked into our logs. Under HIPAA that’s serious. Strike.', codexIds: ['macie'],
      },
    },
    {
      id: 't-cve', at: 5 * DAY, kind: 'check',
      test: (s) => s.account.inspector,
      pass: {
        title: 'Vulnerability patched before attackers arrived',
        body: ['A critical vulnerability was announced in a library our servers use. Amazon Inspector listed exactly which instances were affected, and we patched them that afternoon.'],
        tone: 'success', codexIds: ['inspector'],
      },
      fail: {
        title: 'Vulnerable servers exploited',
        body: ['A critical vulnerability hit a library on our servers. Without Inspector we didn’t know which ones were affected until attackers found them.'],
        down: { kinds: ['asg'], hours: 4 }, strike: 'Attackers exploited a known vulnerability on our servers. Strike.', codexIds: ['inspector'],
      },
    },
    decide('t-audit', 7 * DAY, 'Audit evidence', 'The HIPAA auditor will want months of evidence that our controls work. Which service collects it continuously?',
      'AWS Audit Manager', 'Right. Audit Manager maps your AWS activity to frameworks like HIPAA and gathers evidence automatically.',
      [['AWS Trusted Advisor', 'Trusted Advisor gives best-practice recommendations, not audit evidence.'], ['Amazon Detective', 'Detective investigates security findings.']],
      ['audit-manager']),
    decide('t-hsm', 9 * DAY, 'A hospital’s requirement', 'A hospital partner requires encryption keys stored in single-tenant hardware security modules that we control (FIPS 140 Level 3).',
      'AWS CloudHSM', 'Right. CloudHSM gives you dedicated hardware security modules. KMS is multi-tenant and AWS-managed.',
      [['AWS KMS with default keys', 'KMS is great for most cases, but this partner specifically requires dedicated HSMs you control: CloudHSM.']],
      ['cloudhsm', 'kms']),
    { id: 't-board', at: 10 * DAY, kind: 'board', questionId: 'q-macie' },
    {
      id: 't-hipaa', at: 12 * DAY, kind: 'check',
      test: (s) => allHttps(s) && encrypted(s) && s.account.cloudtrail && s.account.macie && s.account.inspector && s.account.securityHub,
      pass: {
        title: 'HIPAA assessment passed',
        body: ['Encrypted everywhere, a full audit trail, continuous scanning, and one dashboard for every finding. Trailhead Health is cleared to launch nationwide.'],
        tone: 'success', cash: 3000, revenueBoost: 1.08, codexIds: ['compliance-programs'],
      },
      fail: {
        title: 'HIPAA assessment failed',
        body: ['The assessor found gaps in how we protect and monitor health data. The launch is on hold.'],
        cash: -3000, strike: 'We failed the HIPAA assessment. Strike.', codexIds: ['compliance-programs'],
      },
    },
  ],
  steps: [
    {
      id: 'intro', title: 'Trailhead Health',
      body: [
        'Our biggest launch yet: Trailhead Health, an app where hikers store allergies, medications, and emergency contacts so rescuers can help them faster.',
        'That’s health data, so HIPAA applies. Everything you’ve learned about security is about to be tested at once.',
      ],
    },
    {
      id: 'scanners', speaker: 'guide', title: 'Find problems before attackers do', unlock: ['acct:macie', 'acct:inspector'], highlight: 'acct-macie', codex: ['macie', 'inspector'],
      body: [
        '• Amazon Macie discovers sensitive data (like personal or health information) in S3.',
        '• Amazon Inspector continuously scans servers, containers, and functions for known software vulnerabilities.',
      ],
      task: 'Turn on Macie and Inspector.',
      done: acct((a) => a.macie && a.inspector),
      solve: (a) => a.account({ macie: true, inspector: true }),
    },
    {
      id: 'hub', speaker: 'guide', title: 'One place for every finding', unlock: ['acct:securityHub', 'acct:detective'], highlight: 'acct-securityHub', codex: ['security-hub', 'detective'],
      body: [
        '• AWS Security Hub collects findings from GuardDuty, Inspector, Macie and more into one view, and checks best practices.',
        '• Amazon Detective helps investigate a finding back to its root cause.',
      ],
      task: 'Turn on Security Hub and Detective.',
      done: acct((a) => a.securityHub && a.detective),
      solve: (a) => a.account({ securityHub: true, detective: true }),
    },
    {
      id: 'run', title: 'Launch', highlight: 'play',
      body: ['The assessor arrives on day 13.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['well-architected-tool', 'security-resources'],
  outro: ['Trailhead Health passed its HIPAA assessment. Every security tool you learned played a part.'],
};

// ── 10-2 ──────────────────────────────────────────────────────────────────

const certificationDay: Mission = {
  ...base,
  id: '10-2', title: 'Certification Day',
  summary: 'One last week of chaos, then the practice AWS Certified Cloud Practitioner exam.',
  lengthHours: 7 * DAY, startingCash: 4000,
  initialNodes: stack.nodes, initialEdges: stack.edges,
  initialAccount: { ...carriedOver, macie: true, inspector: true, securityHub: true, detective: true },
  traffic: { startPeak: 320, endPeak: 380, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'exam', label: 'Score 70% or more on the practice exam', target: 0.7 },
  ],
  events: [
    {
      id: 'x-outage', at: 1 * DAY + 17, kind: 'az-outage', az: 'a', duration: 6,
      debrief: ['Multi-AZ everything: barely a blip. Two years ago this would have taken the store down for a day.'],
      codexIds: ['high-availability'],
    },
    {
      id: 'x-flood', at: 2 * DAY + 20, kind: 'http-flood', rps: 3000, duration: 4, uncached: true,
      debrief: ['WAF blocked the bots, CloudFront absorbed the rest, and Shield Standard handled the network layer. Defense in depth.'],
      codexIds: ['waf', 'shield'],
    },
    {
      id: 'x-spike', at: 3 * DAY + 18, kind: 'traffic-spike', multiplier: 2.5, duration: 6,
      title: 'Trailhead Health is trending',
      body: ['A news story about a rescue made possible by our app is going viral.'],
      debrief: ['Auto Scaling, Lambda, and the queue absorbed it without anyone touching anything. Elasticity.'],
      codexIds: ['elasticity'],
    },
    { id: 'x-exam', at: 5 * DAY, kind: 'exam', questionIds: QUESTIONS.map((q) => q.id) },
  ],
  steps: [
    {
      id: 'intro', title: 'Look how far we’ve come',
      body: [
        'Two years ago this company was one server next to my water heater. Now we run on three continents, pass audits, and survive things that would have ended us.',
        'You did that. This week, let’s make it official: I’ve signed you up for the AWS Certified Cloud Practitioner exam. The practice test is on day 6.',
      ],
    },
    {
      id: 'exam', speaker: 'guide', title: 'About the practice exam', unlock: ['tab-codex'],
      body: [
        'The practice exam uses every question from the game: cloud concepts, security, technology, and billing and support, like the real exam.',
        'Score 70% or more to pass. (The real exam is scored from 100 to 1,000 and you need 700.)',
        'Review your Codex before then: it has a card for every exam topic you met along the way.',
      ],
    },
    {
      id: 'run', title: 'One last week', highlight: 'play',
      body: ['Keep the store running. The exam starts on day 6.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: [],
  outro: [
    'You kept the store up through an outage, an attack, and a viral spike, and passed the practice exam.',
    'Morgan: “From one server in a closet to three continents. I couldn’t have done it without you. Now go pass the real one.”',
  ],
};

export const CHAPTER_10: Mission[] = [health, certificationDay];
