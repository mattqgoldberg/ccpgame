import type { ServiceKind, StaffMember } from '../../sim/types';
import { acct, all, everyone, missionOver, type Mission } from '../tutorial';
import { DAY, storeStack } from './shared';

const base = {
  chapter: 5, available: [] as ServiceKind[], latencyTargetMs: 150, requireDns: true, freeTier: false, cloud: true, strikes: true,
  requireHttps: true, revenue: { static: 0.000004, dynamic: 0.00002 },
};
const stack = storeStack({ https: true, encrypted: true, waf: true, orders: true });
const carriedOver = { secretsManager: true, support: 'business' as const };

const priya: StaffMember = { id: 'priya', name: 'Priya', role: 'Developer', access: 'admin', mfa: false, keys: true };
const sam: StaffMember = { id: 'sam', name: 'Sam', role: 'Bookkeeper', access: 'admin', mfa: false, keys: true };
const alex: StaffMember = { id: 'alex', name: 'Alex', role: 'Contractor (1 month)', access: 'admin', mfa: false, keys: true };

// ── 5-1 ───────────────────────────────────────────────────────────────────

const newHires: Mission = {
  ...base,
  id: '5-1', title: 'New Hires',
  summary: 'Three people need AWS access. Give them exactly what they need, and nothing more.',
  lengthHours: 14 * DAY, startingCash: 2500,
  initialNodes: stack.nodes, initialEdges: stack.edges,
  initialAccount: { ...carriedOver, staff: [priya, sam, alex] },
  traffic: { startPeak: 190, endPeak: 230, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'cash', label: 'Finish with at least $2,500', target: 2500 },
  ],
  events: [
    {
      id: 'h-leak', at: 3 * DAY, kind: 'check',
      test: (s) => !s.account.staff.some((p) => p.keys && p.access === 'admin') && s.account.ec2Roles,
      pass: {
        title: 'Leaked key, no damage',
        body: [
          'Priya accidentally pushed code containing an access key to a public GitHub repository. Bots found it within minutes.',
          'But the key only had least-privilege permissions, and our servers use IAM roles instead of keys, so the attackers couldn’t do anything useful. Priya rotated the key.',
        ],
        tone: 'success', codexIds: ['access-keys', 'least-privilege'],
      },
      fail: {
        title: 'Leaked admin key: crypto miners!',
        body: [
          'Priya accidentally pushed code containing an access key to a public GitHub repository. It had administrator access.',
          'Within minutes, attackers launched hundreds of GPU instances to mine cryptocurrency on our bill.',
        ],
        cash: -5000, strike: 'Someone used our leaked admin keys to run up a huge bill. That’s a strike.', codexIds: ['access-keys', 'least-privilege'],
      },
    },
    {
      id: 'h-phish', at: 6 * DAY, kind: 'check',
      test: (s) => s.account.staff.every((p) => p.mfa),
      pass: {
        title: 'Phishing attempt failed',
        body: ['Sam got a convincing fake “AWS sign-in” email and typed in a password. Without Sam’s MFA device, the attacker couldn’t get in.'],
        tone: 'success', codexIds: ['mfa'],
      },
      fail: {
        title: 'Account phished',
        body: ['Sam got a convincing fake “AWS sign-in” email and typed in a password. With no MFA, the attacker walked right in.'],
        cash: -2000, strike: 'An attacker logged in as one of our staff. MFA would have stopped it. That’s a strike.', codexIds: ['mfa'],
      },
    },
    {
      id: 'h-offboard', at: 9 * DAY, kind: 'choice',
      title: 'Alex’s contract is over',
      body: ['Alex finished the project today. What do we do with Alex’s AWS access?'],
      options: [
        { label: 'Remove it today', correct: true, outcome: ['Right. Remove access the day someone leaves. Unused accounts with live credentials are a favorite way in for attackers.'] },
        {
          label: 'Leave it in case Alex comes back', correct: false, effect: { cash: -1500 },
          outcome: ['A month later Alex’s old laptop was stolen with the credentials still on it. Always remove access when people leave.'],
        },
      ],
      codexIds: ['iam', 'least-privilege'],
    },
    { id: 'h-board', at: 11 * DAY, kind: 'board', questionId: 'q-least-privilege' },
    { id: 'h-board-2', at: 12 * DAY, kind: 'board', questionId: 'q-roles' },
  ],
  steps: [
    {
      id: 'intro', title: 'We’re hiring!',
      body: [
        'Welcome our first hires: Priya, a developer; Sam, who keeps the books; and Alex, a contractor for one month.',
        'To get them started quickly I made everyone an administrator, with access keys. I have a feeling you’re going to tell me that was a bad idea.',
      ],
    },
    {
      id: 'team', speaker: 'guide', title: 'Least privilege', unlock: ['tab-account', 'acct:staff'], highlight: 'acct-staff', codex: ['iam', 'least-privilege'],
      body: [
        'AWS Identity and Access Management (IAM) controls who can do what. Each person should get only the permissions their job needs: Sam needs billing, not the ability to delete databases.',
        'Every person here is an administrator right now.',
      ],
      task: 'In the Account tab’s Team section, set everyone to “Least privilege”.',
      done: everyone((p) => p.access === 'least'),
      why: 'If any one account is compromised, the damage is limited to what that person could do.',
      solve: (a) => ['priya', 'sam', 'alex'].forEach((id) => a.staff(id, { access: 'least' })),
    },
    {
      id: 'mfa', speaker: 'guide', title: 'MFA for everyone', codex: ['mfa'], highlight: 'acct-staff',
      body: ['MFA isn’t just for the root user. Every human with AWS access should have it.'],
      task: 'Turn on MFA for every person.',
      done: everyone((p) => p.mfa),
      solve: (a) => ['priya', 'sam', 'alex'].forEach((id) => a.staff(id, { mfa: true })),
    },
    {
      id: 'keys', speaker: 'guide', title: 'Fewer keys, fewer leaks', unlock: ['acct:ec2Roles'], highlight: 'acct-ec2Roles', codex: ['access-keys', 'iam-roles'],
      body: [
        'Access keys are long-term passwords for programs. Only Priya writes code, so only Priya needs one.',
        'Our servers also use an access key pasted into a config file. An IAM role gives them temporary credentials that rotate automatically, so there’s nothing to leak.',
      ],
      task: 'Turn off access keys for Sam and Alex, and switch EC2 to IAM roles.',
      done: all(
        ({ sim }) => sim.account.staff.filter((p) => p.id !== 'priya').every((p) => !p.keys),
        acct((a) => a.ec2Roles),
      ),
      solve: (a) => {
        a.staff('sam', { keys: false });
        a.staff('alex', { keys: false });
        a.account({ ec2Roles: true });
      },
    },
    {
      id: 'run', title: 'Back to work', highlight: 'play',
      body: ['Let’s see how the team settles in.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['cognito', 'directory-service'],
  outro: ['A leaked key and a phishing attempt, and neither did any real damage. That’s least privilege and MFA doing their jobs.'],
};

// ── 5-2 ───────────────────────────────────────────────────────────────────

const manyAccounts: Mission = {
  ...base,
  id: '5-2', title: 'Many Accounts',
  summary: 'Separate accounts for experiments, guardrails, and a record of who did what.',
  lengthHours: 14 * DAY, startingCash: 2500,
  initialNodes: stack.nodes, initialEdges: stack.edges,
  initialAccount: {
    ...carriedOver, ec2Roles: true,
    staff: [{ ...priya, access: 'least', mfa: true }, { ...sam, access: 'least', mfa: true, keys: false }],
  },
  traffic: { startPeak: 200, endPeak: 240, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'cash', label: 'Finish with at least $2,500', target: 2500 },
  ],
  events: [
    {
      id: 'm-trail', at: 3 * DAY, kind: 'check',
      test: (s) => s.account.cloudtrail,
      pass: {
        title: 'Mystery solved by CloudTrail',
        body: ['Half the product photos vanished overnight. CloudTrail’s log showed exactly which script deleted them, and when. We restored them in an hour.'],
        tone: 'success', codexIds: ['cloudtrail'],
      },
      fail: {
        title: 'Who deleted the photos?',
        body: ['Half the product photos vanished overnight, and there’s no record of who or what did it. We spent days rebuilding the catalog by hand.'],
        cash: -1500, codexIds: ['cloudtrail'],
      },
    },
    {
      id: 'm-config', at: 6 * DAY, kind: 'check',
      test: (s) => s.account.config,
      pass: {
        title: 'Public bucket caught in minutes',
        body: ['A test made one of our S3 buckets public. An AWS Config rule flagged the change within minutes and we locked it back down.'],
        tone: 'success', codexIds: ['config'],
      },
      fail: {
        title: 'A bucket was public for a week',
        body: ['A test made one of our S3 buckets public, and nobody noticed for a week. A security researcher emailed us about it.'],
        cash: -2000, strike: 'Customer files sat in a public bucket for a week. That’s a strike.', codexIds: ['config'],
      },
    },
    {
      id: 'm-guard', at: 9 * DAY, kind: 'check',
      test: (s) => s.account.guardduty,
      pass: {
        title: 'GuardDuty spotted something',
        body: ['GuardDuty noticed one of our servers talking to a known crypto-mining pool. A compromised software library! We replaced it the same day.'],
        tone: 'success', codexIds: ['guardduty'],
      },
      fail: {
        title: 'A server was secretly mining crypto',
        body: ['A compromised software library had one of our servers mining cryptocurrency for weeks. We only noticed when it slowed down.'],
        cash: -1500, codexIds: ['guardduty'],
      },
    },
    { id: 'm-board', at: 11 * DAY, kind: 'board', questionId: 'q-cloudtrail' },
    { id: 'm-board-2', at: 12 * DAY, kind: 'board', questionId: 'q-organizations' },
  ],
  steps: [
    {
      id: 'intro', title: 'Growing up',
      body: [
        'Priya wants a separate place to experiment, where a mistake can’t touch the live store. Sam wants to know which features cost what.',
        'And honestly, I’d like to know if anything weird happens in our account.',
      ],
    },
    {
      id: 'org', speaker: 'guide', title: 'Many accounts, one organization', unlock: ['acct:organizations', 'acct:scp'], highlight: 'acct-organizations', codex: ['organizations', 'consolidated-billing', 'scp'],
      body: [
        'AWS Organizations groups many AWS accounts (production, development, security) under one roof, with one consolidated bill.',
        'Service control policies (SCPs) set the maximum permissions for an account: even an admin in the dev account can’t launch huge instances if an SCP says no.',
      ],
      task: 'Turn on AWS Organizations, then add a service control policy for the dev account.',
      done: acct((a) => a.organizations && a.scp),
      solve: (a) => a.account({ organizations: true, scp: true }),
    },
    {
      id: 'sso', speaker: 'guide', title: 'One sign-in', unlock: ['acct:identityCenter'], highlight: 'acct-identityCenter', codex: ['identity-center'],
      body: ['With several accounts, separate passwords for each get messy. IAM Identity Center gives every person one sign-in for all accounts.'],
      task: 'Turn on IAM Identity Center.',
      done: acct((a) => a.identityCenter),
      solve: (a) => a.account({ identityCenter: true }),
    },
    {
      id: 'watch', speaker: 'guide', title: 'See everything', unlock: ['acct:cloudtrail', 'acct:config', 'acct:guardduty'], highlight: 'acct-cloudtrail', codex: ['cloudtrail', 'config', 'guardduty'],
      body: [
        'Three services every account should run:',
        '• CloudTrail records every API call: who did what, and when.',
        '• AWS Config records how resources are configured, and flags rule violations like a public bucket.',
        '• GuardDuty watches logs for threats like stolen credentials or crypto-mining.',
      ],
      task: 'Turn on CloudTrail, AWS Config, and GuardDuty.',
      done: acct((a) => a.cloudtrail && a.config && a.guardduty),
      solve: (a) => a.account({ cloudtrail: true, config: true, guardduty: true }),
    },
    {
      id: 'tags', speaker: 'guide', title: 'Who spent what?', unlock: ['acct:costTags'], highlight: 'acct-costTags', codex: ['cost-allocation-tags'],
      body: ['Cost allocation tags label resources by team or feature, so the bill can be split up the same way.'],
      task: 'Turn on cost allocation tags.',
      done: acct((a) => a.costTags),
      solve: (a) => a.account({ costTags: true }),
    },
    {
      id: 'run', title: 'Watch and learn', highlight: 'play',
      body: ['Let’s see what our new tools catch.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['control-tower', 'billing-conductor', 'service-catalog', 'devtools', 'systems-manager', 'access-methods'],
  outro: ['Separate accounts, guardrails, and a full audit trail. When something goes wrong now, we find out fast and know exactly what happened.'],
};

export const CHAPTER_5: Mission[] = [newHires, manyAccounts];
