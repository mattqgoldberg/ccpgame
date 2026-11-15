# Cloud Tycoon: Design Document

A tycoon game where you run an internet business on a simulated AWS. Playing it well teaches what the AWS Certified Cloud Practitioner exam (CLF-C02) tests.

## Design pillars

1. **Game first.** It should be fun for someone with no interest in the exam. Learning comes through mechanics: you remember that Shield stops DDoS because a DDoS nearly bankrupted you. Quizzes never block play.
2. **Every service earns its place.** If a service is in the game, there's a situation where picking it is clearly the smart move, and picking something else is visibly worse.
3. **Consequences, then explanation.** Let the player fail, then explain in one or two sentences what would have helped, using the exam's vocabulary.
4. **Abstract simulation.** Requests, capacity, latency, and dollars. Nothing packet-level. Readable at a glance.
5. **Slow, guided, one thing at a time.** Every tab, stat, setting, and service starts hidden and is introduced by a tutorial step that asks the player to use it and verifies they did. Nothing appears unexplained.
6. **One person, one company.** You are the first engineer at Trailhead Outfitters, an outdoor-gear store, working for its founder Morgan Reyes for the whole game.
7. **Full exam coverage, checked automatically.** `src/content/coverage.ts` maps every exam topic to the mechanic that teaches it; tests fail if a task statement is uncovered.

## Core loop

```
Build / adjust architecture  →  Run time (traffic, events, billing)  →  React to events / requests
        ↑                                                                        │
        └──────────── End of month: bill, profit, Well-Architected report ───────┘
```

Real-time with pause. 1× is two in-game hours per second; 2× and 4× unlock later. The game **starts paused** and **pauses itself** whenever something happens (a message, a warning, a finished step), and the player is taught to press Play.

**Win condition per mission:** meet the mission's goals (availability, latency, cash, traffic) by the end, without getting fired. Stars come from the Well-Architected report card, which is introduced in mission 0-2.

## Missions and tutorials

Each chapter is split into short missions (5–21 in-game days). A mission is a list of **steps**, shown in a coach panel at the bottom of the map:

- Each step has a speaker (Morgan, or a neutral guide), a short explanation, and usually a **task** ("Connect Customers → S3 Bucket").
- A task is **verified** by a check against the game state (`done` in `src/content/tutorial.ts`). The checkbox ticks, a success line explains what happened, and the player presses Next.
- A step can include **why** text: the consequence of skipping it ("Without a domain name, only about 30% of readers find the blog").
- Steps **unlock features**: tabs, top-bar stats, speed buttons, palette services, inspector settings, connecting, and deleting. Unlocks carry over to later missions. Some later missions hide earlier features (you stop buying physical servers once you're in the cloud).
- Steps **highlight** the thing to click with a pulsing outline.
- The clock is **frozen during build steps**. Only steps marked `clock` let time pass, usually "run until X".

Every step also carries a scripted `solve`. Tests replay every mission step by step and check three things: each task is not already done before the player acts, its solution completes it, and the mission passes with zero strikes.

## The boss and strikes

Morgan tolerates a slow afternoon, not a broken store:

- **Failing** means fewer than 90% of requests succeed in an hour. The first failing hour pauses the game and shows a warning, and a countdown appears under the strike meter.
- **3 failing hours in a row** earns a **strike**. Another strike follows every 12 hours the store stays down.
- A **security breach** is an instant strike: open SSH exploited, unpatched servers exploited, or the root account taken over.
- **3 strikes in a month and you're fired.** The mission ends and must be retried. Strikes reset monthly.
- The strike meter (✕ ✕ ✕) is always visible once Morgan explains it (mission 0-2). The first real strike shows a full explanation, and every strike notice lists what is broken right now.

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
- **Investor questions:** an occasional exam-style multiple-choice question tied to what just happened. A correct answer earns a cash investment. Always skippable, never a gate.
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

Playable now (milestone 1):

| Mission | Title | What the player learns and does |
|---|---|---|
| 0-1 | First Day | Select a node, read the inspector, press Play, read Cash/Traffic. |
| 0-2 | The Rush | Goals tab, Morgan's strike rule, buy and wire a physical server before a traffic spike, 2×, the report card. |
| 1-1 | Hello, AWS | Trusted Advisor, root MFA, first S3 bucket, the Codex. |
| 1-2 | Find Us | Route 53, deleting a connection, the Bill tab and Free Tier. |
| 1-3 | Around the World | Latency, CloudFront and edge locations, 4×, first investor questions. |
| 2-1 | Moving the Store | Dynamic vs. static requests, Lightsail, satisfaction, scaling out before the peak, Shield Standard. |
| 2-2 | Real Servers | EC2, security groups (SSH), instance types, RDS, shared responsibility decisions. |
| 3-1 | Two of Everything | Availability Zones, load balancer, second AZ, RDS Multi-AZ, CloudWatch, an AZ outage. |
| 3-2 | Going Viral | Auto Scaling (multi-AZ, max size), ElastiCache, a 3× spike, an HTTP flood. |

Planned chapters 4–10 (`src/content/chapters.ts`) follow the same mission-and-step format: e-commerce security, a growing team, a cost crunch, going global, an acquisition, data and AI, and a health-tech finale.

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

### Code layout

```
src/
  content/   exam structure, coverage matrix, missions + tutorial steps, board questions, Codex text
  sim/       simulation engine: pure TypeScript, no React, deterministic, unit-tested
    testing/ headless harness + scripted strategies used by balance tests and `npm run balance`
  game/      Zustand store, save/load
  ui/        canvas, node components, panels (goals, inspector, bill, advisor, Codex), modals
```

**Balancing:** `balance.test.ts` replays every mission's tutorial solution, which must pass with no strikes. `src/sim/testing/strategies.ts` lists tempting wrong designs that must fail, such as skipping the domain name, no CloudFront, an undersized EC2 instance, a single AZ, or no cache under viral load. `npm run balance` prints the outcomes.

### Other notes

- Draw our own service icons rather than using AWS's official icon set, and show a "not affiliated with Amazon Web Services" notice.
- Check the coverage matrix against the current official CLF-C02 exam guide before release; AWS revises the in-scope service list.

## Milestones

1. ✅ **Vertical slice** (done): the simulation engine, plus chapters 0–3 as 9 guided missions with feature gating and boss strikes. Covers about 12 Tier-1 services, the monthly bill, one attack event, an AZ outage, one board question, and the report card. Goal: prove the core loop is fun.
2. **Security and events:** chapters 4–5, the incident framework, shared-responsibility cards, IAM hiring, and the Codex.
3. **Economy depth:** chapter 6, pricing commitments, support plans as the hint system, Trusted Advisor, and cost tooling.
4. **Breadth:** chapters 7–10, the request system, the readiness meter, study mode, and the mock exam.
