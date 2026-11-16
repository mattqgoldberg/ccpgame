import type { ServiceKind, SimNode } from '../../sim/types';
import { all, allLinked, lacks, missionOver, type Mission } from '../tutorial';
import { DAY, TEAM, decide, edge, storeStack, users } from './shared';

const base = {
  chapter: 8, available: [] as ServiceKind[], latencyTargetMs: 150, requireDns: true, freeTier: false, cloud: true, strikes: true,
  requireHttps: true, revenue: { static: 0.000004, dynamic: 0.00002 },
};
const carriedOver = {
  staff: TEAM,
  secretsManager: true, support: 'business' as const, ec2Roles: true, organizations: true, scp: true,
  identityCenter: true, cloudtrail: true, config: true, guardduty: true, costTags: true, budget: 4000, backup: true,
};

// ── 8-1 ───────────────────────────────────────────────────────────────────

const store = storeStack({
  https: true, encrypted: true, waf: true, orders: true,
  customers: [{ ...users, config: { share: 0.88 }, position: { x: 0, y: 200 } }],
});
const summitUsers: SimNode = { id: 'summit', kind: 'users', config: { share: 0.12, label: 'Summit’s customers' }, position: { x: 0, y: 720 } };
const summitServers: SimNode[] = [
  { id: 'summit-1', kind: 'onprem', config: { label: 'Summit server 1' }, position: { x: 420, y: 660 } },
  { id: 'summit-2', kind: 'onprem', config: { label: 'Summit server 2' }, position: { x: 420, y: 800 } },
];

const summitMigrated: Parameters<typeof all>[0] = ({ sim }) =>
  sim.edges.some((e) => e.source === 'summit' && sim.nodes.find((n) => n.id === e.target)?.kind === 'route53');

const acquisition: Mission = {
  ...base,
  id: '8-1', title: 'The Acquisition',
  summary: 'We bought a rental company with its own data center. Plan the migration, then move in.',
  lengthHours: 14 * DAY, startingCash: 3000,
  initialNodes: [...store.nodes, summitUsers, ...summitServers],
  initialEdges: [...store.edges, edge('summit', 'summit-1'), edge('summit', 'summit-2')],
  initialAccount: carriedOver,
  traffic: { startPeak: 240, endPeak: 280, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99% of requests (ours and Summit’s)', target: 0.99 },
    { kind: 'cash', label: 'Finish with at least $3,000', target: 3000 },
  ],
  events: [
    decide('a-web', 1 * DAY, 'Summit’s rental website', 'Summit’s website runs on a few ordinary Linux servers. It works fine, and we need it moved fast. Which strategy?',
      'Rehost (lift and shift)', 'Right. Move it as is, quickly, with AWS Application Migration Service. You can modernize later.',
      [['Refactor it into microservices first', 'That would take months. When speed matters and the app works, rehost first.'], ['Retire it', 'Summit’s customers use it every day!']],
      ['migration-7rs', 'application-migration-service']),
    decide('a-db', 2 * DAY, 'Summit’s database', 'Summit runs its own database server, patched by hand. We want it managed, but without rewriting the app.',
      'Replatform to Amazon RDS, moving the data with AWS DMS', 'Right. Replatforming makes a few optimizations (managed database) without changing the core app. AWS Database Migration Service keeps the old database running during the move.',
      [['Rehost it on an EC2 instance', 'That works, but we’d still patch and back it up ourselves. A managed database is the better target here.'], ['Retain it in their data center', 'Their lease is ending. It has to move.']],
      ['migration-7rs', 'dms', 'db-on-ec2']),
    decide('a-email', 3 * DAY, 'Summit’s email server', 'Summit runs its own email server in a closet. Nobody likes maintaining it.',
      'Repurchase: switch to a hosted email service', 'Right. Repurchasing means replacing it with a SaaS product. No servers to move at all.',
      [['Rehost it on EC2', 'You’d still be running an email server. Buying it as a service is simpler.']],
      ['migration-7rs']),
    decide('a-snow', 4 * DAY, '400 TB of rental photos', 'Summit has 400 TB of gear photos and inspection videos. Their internet connection would take over a year to upload it all. How do we move it?',
      'Ship it on AWS Snowball Edge devices', 'Right. AWS ships rugged storage devices; you load them and ship them back. Petabytes in weeks instead of years.',
      [['Upload it over the VPN', 'At their speeds that’s more than a year. Physical transfer wins.'], ['Use CloudFront', 'CloudFront delivers content to users. For bulk offline transfer, use the Snow Family.']],
      ['snow-family']),
    decide('a-reports', 5 * DAY, 'An old reporting tool', 'There’s a reporting server nobody has logged into for two years.',
      'Retire it', 'Right. The cheapest migration is not migrating. Turn it off.',
      [['Rehost it just in case', 'Paying to run something nobody uses is pure waste.']],
      ['migration-7rs']),
    decide('a-license', 6 * DAY, 'The licensing server', 'One system is tied to a hardware license that expires next year. Moving it now would mean buying a new license.',
      'Retain it on-premises for now', 'Right. Retain means keeping it where it is until it makes sense to move.',
      [['Refactor it now', 'Rewriting it before the license expires wastes money.']],
      ['migration-7rs']),
    { id: 'a-board', at: 8 * DAY, kind: 'board', questionId: 'q-7rs' },
    { id: 'a-board-2', at: 11 * DAY, kind: 'board', questionId: 'q-snowball' },
  ],
  steps: [
    {
      id: 'intro', title: 'We bought a company!',
      body: [
        'We just acquired Summit Rentals: they rent out gear for trips, which fits us perfectly. Their customers are at the bottom of the map.',
        'The catch: Summit runs everything on two servers in a little data center, and their lease ends in six weeks.',
      ],
    },
    {
      id: 'seven-rs', speaker: 'guide', title: 'The 7 Rs of migration', codex: ['migration-7rs', 'caf'],
      body: [
        'Every system gets one of seven strategies:',
        '• Rehost: lift and shift as is. • Replatform: lift, tinker, and shift (e.g. onto a managed database).',
        '• Refactor: rebuild cloud-native. • Repurchase: switch to a SaaS product.',
        '• Retire: turn it off. • Retain: keep it on-premises for now. • Relocate: move VMware environments as they are.',
        'Over the next few days, Morgan will ask about each Summit system.',
      ],
    },
    {
      id: 'vpn', speaker: 'guide', title: 'Connect the data centers', unlock: ['svc:vpn', 'svc:dx'], highlight: 'palette-vpn', codex: ['vpn', 'direct-connect', 'deployment-models'],
      body: [
        'During a migration, the old data center and AWS need a private connection, a hybrid setup.',
        '• Site-to-Site VPN: an encrypted tunnel over the internet. Ready in minutes, cheap, but speed varies.',
        '• Direct Connect: a dedicated private line. Consistent and fast, but takes weeks to install.',
      ],
      task: 'Add a Site-to-Site VPN and connect it to both Summit servers.',
      done: allLinked('vpn', 'onprem'),
      solve: (a) => {
        a.add('vpn', 'tunnel');
        a.link('tunnel', 'summit-1');
        a.link('tunnel', 'summit-2');
      },
    },
    {
      id: 'plan', title: 'Plan the move', highlight: 'play',
      body: ['Let’s go through Summit’s systems one at a time.'],
      task: 'Run for a week.',
      done: ({ sim }) => sim.hour >= 7 * DAY, clock: true,
    },
    {
      id: 'move', title: 'Moving day',
      body: [
        'Everything Summit’s customers need now runs on our platform. Time to point them at our front door and switch off the old servers.',
      ],
      task: 'Connect Summit’s customers → Route 53, then delete (sell) both Summit servers and the VPN.',
      done: all(summitMigrated, lacks('onprem'), lacks('vpn')),
      why: 'Our platform scales and is backed up; their two old servers aren’t.',
      solve: (a) => {
        a.link('summit', 'route53');
        a.remove('onprem');
        a.remove('vpn');
      },
    },
    {
      id: 'run', title: 'One company', highlight: 'play',
      body: ['Summit’s customers are ours now.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['migration-hub', 'elastic-beanstalk', 'access-methods', 'documentdb'],
  outro: ['Six systems, six different strategies, and one data center shut down. Not everything needs the same migration.'],
};

// ── 8-2 ───────────────────────────────────────────────────────────────────

const warehouse: SimNode = { id: 'warehouse', kind: 'onprem', config: { label: 'Summit warehouse' }, position: { x: 420, y: 720 } };

const lightsOut: Mission = {
  ...base,
  id: '8-2', title: 'Lights Out',
  summary: 'Finish the hybrid leftovers: the warehouse, the office, and the people.',
  lengthHours: 10 * DAY, startingCash: 3000,
  initialNodes: [...store.nodes.map((n) => (n.id === 'users' ? { ...n, config: {} } : n)), warehouse],
  initialEdges: store.edges,
  initialAccount: carriedOver,
  traffic: { startPeak: 260, endPeak: 290, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'cash', label: 'Finish with at least $3,000', target: 3000 },
  ],
  events: [
    decide('l-files', 1 * DAY, 'The office file shares', 'Summit’s office staff use Windows file shares on an old server. We want the files in AWS, but staff should keep using them the same way.',
      'Amazon FSx for Windows File Server', 'Right. FSx gives a fully managed Windows file server, so the same shares keep working.',
      [['Amazon EBS', 'EBS volumes attach to one EC2 instance; they aren’t shared Windows file shares.'], ['Amazon S3 Glacier', 'Glacier is for archives, not files people open every day.']],
      ['fsx']),
    decide('l-gateway', 2 * DAY, 'The scanner in the warehouse', 'The warehouse scanner saves to a local network folder and can’t be changed. We still want those files stored in AWS.',
      'AWS Storage Gateway', 'Right. Storage Gateway looks like a local file share to the scanner but stores the data in S3. Hybrid storage.',
      [['Amazon EFS', 'EFS is a file system for AWS instances; the on-premises scanner needs a local gateway.']],
      ['storage-gateway']),
    decide('l-ad', 3 * DAY, 'Summit’s user directory', 'Summit’s staff sign in with Microsoft Active Directory, and several apps depend on it.',
      'AWS Directory Service (Managed Microsoft AD)', 'Right. A managed Active Directory in AWS, so apps keep working and nobody runs domain controllers.',
      [['Amazon Cognito', 'Cognito is for customer sign-in in your apps, not a Microsoft Active Directory.']],
      ['directory-service']),
    decide('l-outposts', 4 * DAY, 'The warehouse robots', 'The warehouse’s sorting robots need responses in a few milliseconds and must keep working if the internet drops. But we want to run AWS services for them.',
      'AWS Outposts in the warehouse', 'Right. Outposts puts AWS-managed racks on-premises: AWS services with local latency.',
      [['Move them to the nearest Region', 'Too far away for millisecond responses, and an internet outage would stop the robots.']],
      ['outposts']),
    decide('l-licenses', 5 * DAY, 'Windows Server licenses', 'Summit owns per-core Windows Server licenses it already paid for, and wants to keep using them on AWS.',
      'EC2 Dedicated Hosts (bring your own license)', 'Right. Dedicated Hosts give visibility into physical sockets and cores, which per-core BYOL licenses require.',
      [['Spot Instances', 'Spot is about price, not licensing. Per-core BYOL needs Dedicated Hosts.']],
      ['dedicated', 'licensing-byol']),
    decide('l-market', 6 * DAY, 'Rental management software', 'Instead of maintaining Summit’s custom rental-booking code, we could buy a ready-made product that runs on AWS.',
      'Find one in AWS Marketplace', 'Right. AWS Marketplace sells third-party software that deploys into your account and bills through AWS.',
      [['Build our own from scratch', 'Possible, but buying a proven product is faster and cheaper here.']],
      ['marketplace'], { revenueBoost: 1.03 }),
    decide('l-people', 7 * DAY, 'Summit’s team', 'Summit’s IT staff are nervous: they’ve never used the cloud. The AWS Cloud Adoption Framework groups this kind of challenge under which perspective?',
      'People', 'Right. The People perspective covers training, culture, and organizing teams for the cloud. We also hired an AWS Partner to run workshops.',
      [['Platform', 'Platform is about architecture and infrastructure. Skills and culture fall under People.'], ['Security', 'Security covers protecting data and workloads. Training staff is the People perspective.']],
      ['caf', 'partners']),
    { id: 'l-board', at: 8 * DAY, kind: 'board', questionId: 'q-dx' },
  ],
  steps: [
    {
      id: 'intro', title: 'Almost done',
      body: [
        'Summit’s website and customers are on our platform. What’s left: their warehouse system (we’re keeping it on-premises for now), their office, and their people.',
        'The warehouse syncs inventory with our database all day, and the VPN keeps dropping.',
      ],
    },
    {
      id: 'dx', speaker: 'guide', title: 'A dedicated line', highlight: 'palette-dx', codex: ['direct-connect'],
      body: [
        'For a permanent, busy connection, AWS Direct Connect is a private dedicated line with consistent speed that never touches the internet. It takes days to weeks to install, so order it early.',
      ],
      task: 'Add Direct Connect and connect it to the warehouse server.',
      done: allLinked('dx', 'onprem'),
      solve: (a) => {
        a.add('dx', 'line');
        a.link('line', 'warehouse');
      },
    },
    {
      id: 'run', title: 'Tie up loose ends', highlight: 'play',
      body: ['Expect a lot of questions this week.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['managed-services', 'efs', 'ebs', 'instance-store', 'end-user-computing'],
  outro: ['The acquisition is complete: one platform, one team, and a warehouse connected over a private line.'],
};

export const CHAPTER_8: Mission[] = [acquisition, lightsOut];
