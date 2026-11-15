# Cloud Tycoon: Design Document

A tycoon game where you run an internet business on a simulated AWS. Playing it well teaches what the AWS Certified Cloud Practitioner exam (CLF-C02) tests.

## Design pillars

1. **Game first.** It should be fun for someone with no interest in the exam. Learning comes through mechanics: you remember that Shield stops DDoS because a DDoS nearly bankrupted you. Quizzes never block play.
2. **Every service earns its place.** If a service is in the game, there's a situation where picking it is clearly the smart move, and picking something else is visibly worse.
3. **Consequences, then explanation.** Let the player fail, then explain in one or two sentences what would have helped, using the exam's vocabulary.
4. **Abstract simulation.** Requests, capacity, latency, and dollars. Nothing packet-level. Readable at a glance.
5. **Full exam coverage, checked automatically.** `src/content/coverage.ts` maps every exam topic to the mechanic that teaches it; tests fail if a task statement is uncovered.

## Core loop

```
Build / adjust architecture  →  Run time (traffic, events, billing)  →  React to events / requests
        ↑                                                                        │
        └──────────── End of month: bill, profit, Well-Architected report ───────┘
```

Real-time with pause and 1×/2×/4× speed. One in-game month passes in a few real minutes, so the bill comes around often.

**Win condition per chapter:** reach a profit and customer-count target before a deadline while meeting the chapter's requirements (e.g. "pass the PCI audit"). Stars come from the Well-Architected report card.

## Gameplay layers

| Layer | What the player does | Primary exam coverage |
|---|---|---|
| **Architecture canvas** | Drag service nodes onto a diagram, wire them, configure them (instance size, AZ, encryption, rules) | Compute, storage, database, networking, global infrastructure, HA |
| **Incidents** | Respond to attacks, outages, audits, and "whose job is it?" shared-responsibility cards | Security services, shared responsibility, monitoring, DR |
| **Business** | Monthly bill, pricing commitments, support plan, hiring staff and granting IAM access, accounts and organization | Billing/pricing/support, IAM, Organizations |
| **Requests** | CEO / customer / auditor asks for a capability; choose the service that fits | AI/ML, analytics, migration, niche services |
| **Report card** | End-of-chapter grade on the 6 Well-Architected pillars | Well-Architected Framework, design principles |
| **Skill tree** | Company upgrades between chapters, one branch per CAF perspective | Cloud Adoption Framework |

### Learning features (light and optional)

- **Codex:** each service or concept the player meets unlocks a card with what it does, when to use it, and the exam "trigger phrases" (from `triggers` in the coverage matrix). The finished Codex doubles as a study guide.
- **Board meetings:** an occasional exam-style multiple-choice question tied to what just happened. Correct answers earn investor confidence (a currency for perks). Always skippable, never a gate.
- **Post-incident debrief:** one screen after each incident: what happened, what would have stopped it, and the exam keyword.
- **Exam readiness meter:** per-domain mastery weighted by exam percentage (24/30/34/12), based on Codex unlocks, correct board answers, and incidents handled well.
- **Study mode** (separate from the campaign): drill missed questions and take a mock exam.

## Coverage tiers

| Tier | Meaning | Examples |
|---|---|---|
| 1, simulated | Real stats in the engine (capacity, latency, cost, failure modes) | EC2, ELB, Auto Scaling, S3, CloudFront, RDS, DynamoDB, SQS, WAF, Shield, pricing models |
| 2, event/decision | Chosen to resolve an incident or request; simple effect | GuardDuty, Macie, Snowball, Rekognition, Athena, DMS |
| 3, recognition | Codex card + board questions only | WorkSpaces, Ground Station, Device Farm, CloudHSM |

The full list, with hooks and exam trigger phrases, lives in `src/content/coverage.ts`. Run `npm run coverage:report` for a summary.

## Campaign

| # | Chapter | Premise | Key topics |
|---|---|---|---|
| 0 | The Garage | Self-hosted server; guess capacity wrong; discover the cloud | Six benefits, CapEx vs OpEx, root user, MFA |
| 1 | Static Site | Cheap, fast blog | S3, CloudFront, Route 53, Lightsail, Free Tier, Pricing Calculator, Regions |
| 2 | Dynamic App | Logins and a database | EC2, VPC, subnets, security groups, EBS, RDS, shared responsibility, Cognito |
| 3 | Going Viral | Traffic explodes | ELB, Auto Scaling, Multi-AZ, ElastiCache, CloudWatch, Trusted Advisor, AZ outage |
| 4 | E-Commerce | Payments, attackers, PCI | WAF, Shield, ACM, KMS, Secrets Manager, SQS, SNS, Lambda, DynamoDB, Artifact, support plans |
| 5 | Growing Team | Staff and accounts | IAM, Identity Center, Organizations, SCPs, CloudTrail, Config, GuardDuty, tags, consolidated billing |
| 6 | Cost Crunch | Investors demand profit | Reserved Instances, Savings Plans, Spot, Cost Explorer, Budgets, storage classes, rightsizing |
| 7 | Go Global | New continents | Region choice, data residency, Route 53 routing, Aurora Global, CloudFormation, DR strategies |
| 8 | The Acquisition | Migrate a legacy data center | 7 Rs, DMS, Snowball, Direct Connect, VPN, Storage Gateway, Outposts, CAF, Marketplace |
| 9 | Data & AI | Insight and AI features | Kinesis, Glue, Athena, Redshift, QuickSight, SageMaker, Bedrock, AI services |
| 10 | Health-Tech Finale | HIPAA-eligible launch | Macie, Inspector, Detective, Security Hub, Audit Manager, final review, mock exam |

Afterwards: **sandbox mode** with everything unlocked and random events.

> Balance note: chapters 8 and 9 currently introduce the most topics (~25 each), many of them Tier 2 requests. If they feel like a checklist, move some requests earlier as side quests (e.g. Translate in ch. 7 already, Rekognition could appear in ch. 4).

## Simulation model

- **Traffic:** requests/sec per customer region (NA, SA, EU, AP, ...), following a daily curve plus event spikes. Customer count grows with satisfaction and marketing.
- **Graph:** the architecture is a directed graph from `Customers` to services. Each tick, traffic flows along edges, split by load balancers or routing policies.
- **Node stats:** capacity (req/s), base latency, cost (per hour, per request, per GB), AZ/Region placement, and failure modes (e.g. single-AZ, Spot interruption, unpatched).
- **Per tick:** compute utilization → latency and error rate → satisfaction → revenue. Costs accrue continuously; the bill is itemized by service and by data transfer type.
- **Security posture:** flags derived from configuration (open SSH to 0.0.0.0/0, no WAF, public bucket, IAM wildcard, root without MFA, unencrypted store). Attack events check these flags to decide damage.
- **Determinism:** seeded RNG, so a chapter can be replayed and tested.

## Tech stack

- **TypeScript + React + Vite.** Static site, no backend; saves go to `localStorage`.
- **React Flow (`@xyflow/react`):** the library that powers the architecture canvas. It provides draggable nodes, connectable edges, pan/zoom, and custom node components, so we don't build a diagram editor from scratch.
- **Zustand:** game state store shared between the simulation and the UI.
- **Vitest:** unit tests, especially for the simulation engine and content integrity.

### Code layout (planned)

```
src/
  content/   exam structure, chapters, coverage matrix, services, events, questions (pure data)
  sim/       simulation engine: pure TypeScript, no React, deterministic, unit-tested
  game/      store, chapter scripting, save/load
  ui/        canvas, node components, panels (bill, Codex, events, report card)
```

### Other notes

- Draw our own service icons rather than using AWS's official icon set, and show a "not affiliated with Amazon Web Services" notice.
- Check the coverage matrix against the current official CLF-C02 exam guide before release; AWS revises the in-scope service list.

## Milestones

1. **Vertical slice:** the simulation engine and chapters 0–3. Covers about 12 Tier-1 services, the monthly bill, one attack event, an AZ outage, one board question, and the report card. Goal: prove the core loop is fun.
2. **Security and events:** chapters 4–5, the incident framework, shared-responsibility cards, IAM hiring, and the Codex.
3. **Economy depth:** chapter 6, pricing commitments, support plans as the hint system, Trusted Advisor, and cost tooling.
4. **Breadth:** chapters 7–10, the request system, the readiness meter, study mode, and the mock exam.
