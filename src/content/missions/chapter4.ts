import { allHttps } from '../../sim/engine';
import type { ServiceKind, SimState } from '../../sim/types';
import { acct, all, every, hourAtLeast, linked, missionOver, unlinked, type Mission } from '../tutorial';
import { DAY, storeStack } from './shared';

const encryptedAtRest = (s: SimState) =>
  s.nodes.filter((n) => n.kind === 'rds' || n.kind === 's3' || n.kind === 'dynamodb').every((n) => n.config.encrypted);

const wafInFront = (s: SimState) =>
  s.edges.some((e) => s.nodes.find((n) => n.id === e.source)?.kind === 'waf');

const base = {
  chapter: 4, available: [] as ServiceKind[], latencyTargetMs: 150, requireDns: true, freeTier: false, cloud: true, strikes: true,
  requireHttps: true, revenue: { static: 0.000004, dynamic: 0.00002 },
};

// ── 4-1 ───────────────────────────────────────────────────────────────────

const checkoutStack = storeStack();

const checkout: Mission = {
  ...base,
  id: '4-1', title: 'Checkout',
  summary: 'Start taking card payments: encrypt everything and pass a PCI audit.',
  lengthHours: 14 * DAY, startingCash: 2000,
  initialNodes: checkoutStack.nodes, initialEdges: checkoutStack.edges,
  traffic: { startPeak: 150, endPeak: 200, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'cash', label: 'Finish with at least $2,000', target: 2000 },
  ],
  events: [
    {
      id: 'c-artifact', at: 4 * DAY, kind: 'choice',
      title: 'The auditor wants AWS’s paperwork',
      body: [
        'Our PCI DSS auditor wants proof that AWS’s data centers meet the standard. Where do we get AWS’s compliance reports?',
      ],
      options: [
        { label: 'Download them from AWS Artifact', correct: true, outcome: ['Right. AWS Artifact is a self-service portal for AWS’s compliance reports (PCI, SOC, ISO) and agreements. The auditor has what they need.'] },
        {
          label: 'Ask our account manager to email them', correct: false, effect: { cash: -300 },
          outcome: ['We don’t have one, and it’s self-service anyway: AWS Artifact. You lost a few days and paid the auditor to wait.'],
        },
        {
          label: 'Run Amazon Inspector and send its report', correct: false, effect: { cash: -300 },
          outcome: ['Inspector scans our servers for vulnerabilities. It says nothing about AWS’s own compliance. The answer is AWS Artifact.'],
        },
      ],
      codexIds: ['artifact', 'compliance-programs'],
    },
    { id: 'c-board', at: 7 * DAY, kind: 'board', questionId: 'q-acm' },
    {
      id: 'c-audit', at: 11 * DAY, kind: 'check',
      test: (s) => allHttps(s) && encryptedAtRest(s) && s.account.secretsManager,
      pass: {
        title: 'PCI DSS audit passed!',
        body: [
          'Encrypted in transit, encrypted at rest, no passwords lying around in config files. The auditor signed off.',
          'Remember: AWS’s certifications cover their infrastructure. Making our own app compliant was our job, and we did it.',
        ],
        tone: 'success', cash: 1500, revenueBoost: 1.05, codexIds: ['compliance-programs'],
      },
      fail: {
        title: 'PCI DSS audit failed',
        body: ['The auditor found card data that isn’t properly protected. We’re fined, and the bank is threatening to stop processing our payments.'],
        cash: -3000, strike: 'We failed the PCI audit. That’s on us, and it’s a strike.',
      },
    },
  ],
  steps: [
    {
      id: 'intro', title: 'Real money',
      body: [
        'Big step: we’re launching our own checkout. Customers will type card numbers into our site.',
        'That means two things. Customers need to trust us, and in two weeks an auditor will check that we meet the PCI DSS standard for handling cards.',
      ],
    },
    {
      id: 'https', speaker: 'guide', title: 'Encryption in transit', unlock: ['config-https'], highlight: 'inspect-https', codex: ['acm', 'encryption'],
      body: [
        'HTTPS encrypts traffic between customers and us. AWS Certificate Manager (ACM) gives you TLS certificates for free on CloudFront and load balancers, and renews them automatically.',
      ],
      task: 'Select CloudFront and turn on HTTPS, then do the same for the Load Balancer.',
      done: all(every('cloudfront', (n) => !!n.config.https), every('elb', (n) => !!n.config.https)),
      why: 'Without HTTPS, browsers label checkout “Not secure” and most shoppers leave. Card numbers would also cross the internet readable by anyone in between.',
      solve: (a) => {
        a.configure('cloudfront', { https: true });
        a.configure('elb', { https: true });
      },
    },
    {
      id: 'encrypt', speaker: 'guide', title: 'Encryption at rest', unlock: ['config-encryption'], highlight: 'inspect-encryption', codex: ['kms'],
      body: ['Data sitting on disk should be encrypted too. AWS Key Management Service (KMS) manages the keys; turning it on is one setting per data store.'],
      task: 'Turn on encryption for the RDS database and the S3 bucket.',
      done: all(every('rds', (n) => !!n.config.encrypted), every('s3', (n) => !!n.config.encrypted)),
      why: 'If someone ever got a copy of the disks or backups, encrypted data would be useless to them.',
      solve: (a) => {
        a.configure('rds', { encrypted: true });
        a.configure('s3', { encrypted: true });
      },
    },
    {
      id: 'secrets', speaker: 'guide', title: 'No more passwords in files', unlock: ['tab-account', 'acct:secretsManager'], highlight: 'tab-account', codex: ['secrets-manager'],
      body: [
        'Right now the database password sits in a config file on every server. Anyone who sees that file can read every order.',
        'AWS Secrets Manager stores secrets and can rotate them automatically. The new Account tab is where account-wide settings live.',
      ],
      task: 'Open the Account tab and turn on Secrets Manager.',
      done: acct((a) => a.secretsManager),
      solve: (a) => a.account({ secretsManager: true }),
    },
    {
      id: 'run', title: 'Open the checkout', highlight: 'play',
      body: ['Let’s take some payments.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: ['shared-responsibility'], codexOnComplete: ['cloudhsm', 'security-resources'],
  outro: ['We’re a real store now, with encrypted traffic, encrypted data, and a passed PCI audit.'],
};

// ── 4-2 ───────────────────────────────────────────────────────────────────

const secureStack = storeStack({ https: true, encrypted: true });

const underAttack: Mission = {
  ...base,
  id: '4-2', title: 'Under Attack',
  summary: 'Hackers have noticed us. Put a web application firewall in front.',
  lengthHours: 14 * DAY, startingCash: 2000,
  initialNodes: secureStack.nodes, initialEdges: secureStack.edges,
  initialAccount: { secretsManager: true },
  traffic: { startPeak: 170, endPeak: 220, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'cash', label: 'Finish with at least $2,000', target: 2000 },
  ],
  events: [
    {
      id: 'a-sqli', at: 3 * DAY, kind: 'check',
      test: wafInFront,
      pass: {
        title: 'SQL injection blocked',
        body: ['Someone tried to sneak database commands into our search box. AWS WAF’s managed rules recognized the pattern and blocked every attempt.'],
        tone: 'success', codexIds: ['waf'],
      },
      fail: {
        title: 'SQL injection!',
        body: ['Attackers slipped database commands into our search box and dumped thousands of customer emails.'],
        cash: -4000, strike: 'We leaked customer data to a SQL injection attack. That’s a strike.', codexIds: ['waf'],
      },
    },
    {
      id: 'a-flood', at: 6 * DAY + 19, kind: 'http-flood', rps: 2500, duration: 5, uncached: true,
      debrief: [
        'This time the bots hammered the login page. Logins can’t be cached, so CloudFront had to pass every request through.',
        'AWS WAF rate-based rules blocked the IPs sending far more requests than any human would.',
      ],
      codexIds: ['waf', 'shield'],
    },
    { id: 'a-board', at: 9 * DAY, kind: 'board', questionId: 'q-waf' },
    {
      id: 'a-shield', at: 11 * DAY, kind: 'choice',
      title: 'Should we buy Shield Advanced?',
      body: [
        'A competitor got hit with a huge DDoS and their AWS bill exploded. Priya from accounting forwarded me a Shield Advanced brochure: $3,000 a month, a 24/7 DDoS response team, and cost protection.',
        'For a store our size, what should we do?',
      ],
      options: [
        {
          label: 'Not yet. Shield Standard + CloudFront + WAF covers us', correct: true,
          outcome: ['Good call. Shield Advanced makes sense for big, high-profile targets. Shield Standard is already protecting us for free, and WAF handles application attacks.'],
        },
        {
          label: 'Buy it now, just in case', correct: false, effect: { cash: -3000 },
          outcome: ['It’s a great service, but $36,000 a year is more than our whole AWS bill. Not every service is worth buying at every size.'],
        },
      ],
      codexIds: ['shield'],
    },
  ],
  steps: [
    {
      id: 'intro', title: 'We’re a target now',
      body: [
        'Someone posted about our checkout on a hacking forum. We’re seeing weird searches with code in them, and bursts of login attempts.',
        'CloudFront and Shield Standard handle floods of cacheable pages. They don’t read what’s inside each request.',
      ],
    },
    {
      id: 'waf', speaker: 'guide', title: 'A web application firewall', unlock: ['svc:waf'], highlight: 'palette-waf', codex: ['waf'],
      body: [
        'AWS WAF inspects every web request and blocks common attacks like SQL injection and cross-site scripting. Rate-based rules block anyone sending far too many requests.',
        'It attaches to CloudFront, load balancers, or API Gateway. Here, put it in front of CloudFront.',
      ],
      task: 'Add AWS WAF, make it Route 53 → WAF → CloudFront, and delete Route 53 → CloudFront.',
      done: all(linked('route53', 'waf'), linked('waf', 'cloudfront'), unlinked('route53', 'cloudfront')),
      why: 'Every request passes through WAF before it reaches anything that can be exploited or that costs money.',
      solve: (a) => {
        a.add('waf', 'fw');
        a.unlink('route53', 'cloudfront');
        a.link('route53', 'fw');
        a.link('fw', 'cloudfront');
      },
    },
    {
      id: 'shield', speaker: 'guide', title: 'Shield Standard vs. Advanced', unlock: ['acct:shieldAdvanced'], highlight: 'acct-shieldAdvanced', codex: ['shield'],
      body: [
        'In the Account tab you’ll now see Shield Advanced. Shield Standard is free and automatic for everyone. Advanced costs $3,000 a month and adds a 24/7 response team, protection for bigger attacks, and refunds for scaling costs caused by a DDoS.',
        'You don’t have to buy it. Knowing when not to buy something is part of the job.',
      ],
    },
    {
      id: 'run', title: 'Hold the line', highlight: 'play',
      body: ['Let’s see what the attackers try.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['firewall-manager', 'network-firewall', 'nacl', 'marketplace-security'],
  outro: ['WAF stopped the injection attempts and the login flood. Defense in depth: Shield for the network, WAF for the application, CloudFront at the edge.'],
};

// ── 4-3 ───────────────────────────────────────────────────────────────────

const wafStack = storeStack({ https: true, encrypted: true, waf: true });
const ordersOk = (s: SimState) => {
  const api = s.nodes.filter((n) => n.kind === 'apigw');
  return api.length > 0 && api.every((n) => n.config.https);
};

const flashSale: Mission = {
  ...base,
  id: '4-3', title: 'Flash Sale',
  summary: 'One evening of 5× traffic. Build a serverless checkout that can’t be overwhelmed.',
  lengthHours: 10 * DAY, startingCash: 2000,
  initialNodes: wafStack.nodes, initialEdges: wafStack.edges,
  initialAccount: { secretsManager: true },
  traffic: { startPeak: 180, endPeak: 220, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 98.5% of requests, even during the sale', target: 0.985 },
    { kind: 'cash', label: 'Finish with at least $2,000', target: 2000 },
  ],
  events: [
    { id: 'f-board', at: 3 * DAY, kind: 'board', questionId: 'q-sqs' },
    {
      id: 'f-sale', at: 5 * DAY + 18, kind: 'traffic-spike', multiplier: 5, duration: 6,
      title: 'The flash sale is live!',
      body: ['50% off every tent for six hours. Everyone is checking out at once.'],
      debrief: [
        'The queue accepted every order instantly, and Lambda worked through them as fast as it could. Nothing was dropped, even when orders arrived faster than they could be processed.',
        'That’s decoupling: the front end and the order processing don’t have to keep pace with each other.',
      ],
      codexIds: ['sqs', 'design-for-failure'],
    },
    {
      id: 'f-support', at: 7 * DAY + 10, kind: 'check',
      test: (s) => ['business', 'enterprise-onramp', 'enterprise'].includes(s.account.support),
      pass: {
        title: 'AWS Support to the rescue',
        body: [
          'Our load balancer started returning strange errors that weren’t our fault. With Business Support, we called AWS 24/7 and an engineer had it fixed in under an hour.',
        ],
        tone: 'success', codexIds: ['support-plans'],
      },
      fail: {
        title: 'Production is down and no one can help',
        body: [
          'Our load balancer started returning strange errors that weren’t our fault. With Basic Support we can’t open a technical case, so we waited for it to clear up on its own.',
        ],
        down: { kinds: ['elb'], hours: 8 }, codexIds: ['support-plans'],
      },
    },
  ],
  steps: [
    {
      id: 'intro', title: 'Flash sale',
      body: [
        'Next week we’re running our first flash sale: half off every tent, for one evening only. Expect five times the usual traffic.',
        'Last year two of our competitors crashed during their sales. Our servers scale, but not that fast.',
      ],
    },
    {
      id: 'serverless', speaker: 'guide', title: 'Serverless checkout', unlock: ['svc:apigw', 'svc:lambda'], highlight: 'palette-lambda', codex: ['lambda', 'api-gateway'],
      body: [
        'AWS Lambda runs code without servers: each request gets its own copy of the function, and you pay per request. Amazon API Gateway is its front door.',
        'Let’s move checkout there.',
      ],
      task: 'Add API Gateway and a Lambda Function. Connect CloudFront → API Gateway → Lambda.',
      done: all(linked('cloudfront', 'apigw'), linked('apigw', 'lambda')),
      solve: (a) => {
        a.add('apigw', 'api', { https: true });
        a.add('lambda', 'fn');
        a.link('cloudfront', 'api');
        a.link('api', 'fn');
      },
    },
    {
      id: 'dynamo', speaker: 'guide', title: 'A database that keeps up', unlock: ['svc:dynamodb'], highlight: 'palette-dynamodb', codex: ['dynamodb'],
      body: ['Lambda can scale to thousands of copies in seconds. Our RDS database can’t take that many connections. Amazon DynamoDB is a serverless NoSQL database that scales automatically: perfect for shopping carts and orders.'],
      task: 'Add a DynamoDB Table and connect Lambda → DynamoDB. Turn on its encryption too.',
      done: all(linked('lambda', 'dynamodb'), every('dynamodb', (n) => !!n.config.encrypted)),
      solve: (a) => {
        a.add('dynamodb', 'carts', { encrypted: true });
        a.link('fn', 'carts');
      },
    },
    {
      id: 'queue', speaker: 'guide', title: 'Never drop an order', unlock: ['svc:sqs'], highlight: 'palette-sqs', codex: ['sqs'],
      body: [
        'Even Lambda has a limit on how many copies run at once. Amazon SQS is a queue: it accepts every order instantly, and Lambda works through the queue at its own pace.',
      ],
      task: 'Make it API Gateway → SQS Queue → Lambda, and delete API Gateway → Lambda. Make sure API Gateway uses HTTPS.',
      done: all(linked('apigw', 'sqs'), linked('sqs', 'lambda'), unlinked('apigw', 'lambda'), ({ sim }) => ordersOk(sim)),
      why: 'Without the queue, any orders beyond Lambda’s limit would fail. With it, they wait a few seconds instead.',
      solve: (a) => {
        a.add('sqs', 'orders');
        a.unlink('apigw', 'lambda');
        a.link('api', 'orders');
        a.link('orders', 'fn');
        a.configure('apigw', { https: true });
      },
    },
    {
      id: 'support', speaker: 'guide', title: 'Who do we call?', unlock: ['acct:support'], highlight: 'acct-support', codex: ['support-plans'],
      body: [
        'If something on AWS’s side breaks during the sale, Basic Support can’t help: no technical cases at all.',
        'Business Support costs $100 a month: 24/7 phone and chat, under 1 hour for production down, and all Trusted Advisor checks.',
      ],
      task: 'In the Account tab, switch to the Business support plan.',
      done: acct((a) => a.support === 'business' || a.support === 'enterprise-onramp' || a.support === 'enterprise'),
      solve: (a) => a.account({ support: 'business' }),
    },
    {
      id: 'run-1', title: 'Countdown', highlight: 'play',
      body: ['The sale starts on day 6 at 6 p.m.'],
      task: 'Run until the morning of the sale.',
      done: hourAtLeast(5 * DAY + 9), clock: true,
    },
    {
      id: 'prewarm', speaker: 'guide', title: 'Scale before the rush', highlight: 'node-asg',
      body: [
        'Auto Scaling reacts to load, but launching instances takes time, so the first hour of a sudden spike can still overwhelm the web servers.',
        'When you know exactly when a spike is coming, scale out ahead of time. (AWS calls this scheduled scaling.)',
      ],
      task: 'Select the Auto Scaling Group and raise its Min to 6.',
      done: every('asg', (n) => (n.config.minSize ?? 1) >= 6),
      solve: (a) => a.configure('asg', { minSize: 6 }),
    },
    {
      id: 'run-1b', title: 'Almost time',
      body: ['Six instances are warming up.'],
      task: 'Run until the sale starts.',
      done: hourAtLeast(5 * DAY + 18), clock: true,
    },
    {
      id: 'run-2', title: 'Sale!',
      body: ['Watch the queue: orders pile up, then drain.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['sns', 'eventbridge', 'tam', 'support-resources', 'containers', 'fargate'],
  outro: ['A flash sale with zero lost orders. Serverless and queues let us handle a spike our servers never could.'],
};

export const CHAPTER_4: Mission[] = [checkout, underAttack, flashSale];
