import { ACCOUNT_PRICES, BALANCE, CATALOG, COMMIT_COVERAGE, RANK, REGION_NAMES, RTT, SIZES, SUPPORT_PLANS, canConnect, isComputeKind, nodeCapacity, nodeHourlyCost } from './catalog';
import type { ChapterDef, GameEvent, Outcome } from './chapter';
import { nextRandom } from './rng';
import type { Account, ChapterStats, NodeConfig, NodeMetrics, Notice, Region, ServiceKind, SimNode, SimState, StaffMember, Traffic } from './types';

/** How the boss reacts to trouble. */
export const BOSS = {
  /** An hour counts as failing when fewer than this share of requests succeed. */
  failingAvailability: 0.9,
  /** Consecutive failing hours before a strike. */
  hoursBeforeStrike: 3,
  /** While the site stays down, another strike every this many hours. */
  repeatEvery: 12,
  maxStrikes: 3,
  name: 'Morgan',
};

const ALARM_COOLDOWN_HOURS = 12;
const COMPLAINT_DELAY_HOURS = 3;
const ONPREM_RESALE = 0.3;
const HOURS_PER_MONTH = 720;

type FlowType = 'static' | 'dynamic' | 'junk';

interface Flow {
  type: FlowType;
  rps: number;
  latency: number;
  viaEdge: boolean;
  /** Where the customer is. */
  origin: Region | 'global';
  /** Region the request is currently in (null: still on the internet or at an edge location). */
  at: Region | null;
  /** Already answered by a queue; this is background work. */
  counted?: boolean;
}

function emptyStats(): ChapterStats {
  return {
    demand: 0, served: 0, latencyWeighted: 0, revenue: 0, cost: 0, capex: 0,
    computeLoad: 0, computeCapacity: 0, outageDemand: 0, outageServed: 0, outageOccurred: false,
    compromises: 0, choicesCorrect: 0, choicesTotal: 0, alarmHours: 0, edgeServed: 0,
    questionsCorrect: 0, questionsTotal: 0, euDynamic: 0, euOutside: 0, queueDropped: 0,
  };
}

export function defaultAccount(): Account {
  return {
    support: 'basic', shieldAdvanced: false, secretsManager: false,
    cloudtrail: false, config: false, guardduty: false, securityHub: false, inspector: false, macie: false, detective: false,
    backup: false, costAnomaly: false, budget: null, budgetAlerted: false, savingsPlan: 0, reservedDb: 0,
    organizations: false, scp: false, identityCenter: false, ec2Roles: false, costTags: false, staff: [],
  };
}

export function createSim(ch: ChapterDef, seed = 1): SimState {
  const nodes = structuredClone(ch.initialNodes);
  const codex = new Set<string>();
  for (const n of nodes) {
    const id = CATALOG[n.kind].codexId;
    if (id) codex.add(id);
  }
  return {
    missionId: ch.id,
    hour: 0,
    cash: ch.startingCash,
    satisfaction: 50,
    nodes,
    edges: structuredClone(ch.initialEdges),
    effects: [],
    fired: [],
    scheduled: [],
    notices: [],
    alerts: [],
    alarmFiredAt: {},
    flags: { rootMfa: !!ch.startsWithMfa },
    account: { ...defaultAccount(), ...structuredClone(ch.initialAccount ?? {}) },
    revenueBoost: 1,
    boss: { enabled: ch.strikes, strikes: 0, badHours: 0, log: [] },
    last: { demand: { static: 0, dynamic: 0, junk: 0 }, served: 0, latencyMs: 0, revenue: 0, cost: 0, nodes: {}, edges: {} },
    history: [],
    bill: {},
    freeTierHours: {},
    freeTierEdgeGb: 0,
    stats: emptyStats(),
    eventStats: {},
    codex: [...codex],
    finished: false,
    rng: seed,
    nextId: 1,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function unlockCodex(s: SimState, ids: string[] | undefined) {
  for (const id of ids ?? []) if (!s.codex.includes(id)) s.codex.push(id);
}

function addBill(s: SimState, item: string, amount: number) {
  if (amount === 0) return;
  s.bill[item] = (s.bill[item] ?? 0) + amount;
}

function random(s: SimState): number {
  const [value, next] = nextRandom(s.rng);
  s.rng = next;
  return value;
}

function hasKind(s: SimState, kind: ServiceKind): boolean {
  return s.nodes.some((n) => n.kind === kind);
}

export function azName(az: string): string {
  return `us-east-1${az}`;
}

export function dayAndHour(hour: number): { day: number; hourOfDay: number } {
  return { day: Math.floor(hour / 24) + 1, hourOfDay: hour % 24 };
}

/** Edge services that aren't tied to one Region. */
export function isGlobalKind(kind: ServiceKind): boolean {
  return kind === 'users' || kind === 'route53' || kind === 'cloudfront' || kind === 'waf';
}

export function regionOf(n: SimNode): Region {
  return n.config.region ?? 'us';
}

function activeOutage(s: SimState) {
  return s.effects.find((e) => e.kind === 'az-outage');
}

export function downReason(s: SimState, node: SimNode): string | undefined {
  if (node.readyAt !== undefined && s.hour < node.readyAt) {
    return `${node.kind === 'dx' ? 'Being installed' : 'Shipping'}: ready in ${node.readyAt - s.hour}h`;
  }
  if (node.compromisedUntil !== undefined && s.hour < node.compromisedUntil) {
    return 'Compromised: being rebuilt';
  }
  const regionDown = s.effects.find((e) => e.kind === 'region-outage');
  if (regionDown?.region && !isGlobalKind(node.kind) && node.kind !== 'onprem' && regionOf(node) === regionDown.region) {
    return `${REGION_NAMES[regionDown.region].split(' ')[0]} Region outage`;
  }
  const outage = activeOutage(s);
  if (outage?.az && !CATALOG[node.kind].regional && node.config.az === outage.az && regionOf(node) === 'us') {
    if (node.config.multiAz) return undefined;
    return `${azName(outage.az)} outage`;
  }
  return undefined;
}

function effectiveCapacity(s: SimState, node: SimNode): number {
  const outage = activeOutage(s);
  let cap = nodeCapacity(node);
  // A Multi-AZ group loses the instances in the failed AZ until it relaunches them elsewhere.
  if (node.kind === 'asg' && node.config.multiAz && outage && outage.since === s.hour) cap /= 2;
  if (node.kind === 'asg' && node.config.spot && s.effects.some((e) => e.kind === 'spot-reclaim')) cap *= BALANCE.spotReclaimKeep;
  return cap;
}

function weightFor(node: SimNode, type: FlowType): number {
  if (!isComputeKind(node.kind)) return 1;
  if (type === 'static') return BALANCE.staticWeight;
  if (type === 'junk') return BALANCE.junkWeight;
  return 1;
}

function latencyScore(latencyMs: number, targetMs: number): number {
  if (latencyMs <= targetMs) return 1;
  return Math.max(0, (3 * targetMs - latencyMs) / (2 * targetMs));
}

/** Round trip from customers to a Region. A worldwide audience pays the old flat cost. */
function rtt(origin: Region | 'global', region: Region): number {
  return origin === 'global' ? BALANCE.originRttMs : RTT[origin][region];
}

/** From an edge location near the customer to a Region, over the AWS backbone. */
function backbone(origin: Region | 'global', region: Region): number {
  return origin === 'global' ? BALANCE.backboneMs : Math.round(RTT[origin][region] * 0.5);
}

// ── Demand ────────────────────────────────────────────────────────────────

export function computeDemand(s: SimState, ch: ChapterDef): Traffic {
  const progress = Math.min(1, s.hour / ch.lengthHours);
  const peak = ch.traffic.startPeak + (ch.traffic.endPeak - ch.traffic.startPeak) * progress;
  const hourOfDay = s.hour % 24;
  // Busiest at 20:00, quietest at 08:00.
  const daily = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos((2 * Math.PI * (hourOfDay - 20)) / 24));
  const noise = 1 + (random(s) - 0.5) * 0.1;
  const spike = s.effects.filter((e) => e.kind === 'traffic-spike').reduce((m, e) => m * e.magnitude, 1);
  const satisfaction = 0.6 + (0.8 * s.satisfaction) / 100;
  const sources = s.nodes.filter((n) => n.kind === 'users');
  const hasDns = sources.some((u) => s.edges.some((e) => e.source === u.id && s.nodes.find((n) => n.id === e.target)?.kind === 'route53'));
  const findability = ch.requireDns && !hasDns ? BALANCE.noDnsFindability : 1;
  const total = peak * daily * noise * spike * satisfaction * findability;
  const junk = s.effects.filter((e) => e.kind === 'http-flood').reduce((sum, e) => sum + e.magnitude, 0);
  return { static: total * ch.traffic.staticShare, dynamic: total * (1 - ch.traffic.staticShare), junk };
}

// ── Request flow ──────────────────────────────────────────────────────────

interface FlowResult {
  servedStatic: number;
  servedDynamic: number;
  latencyWeighted: number;
  edgeServed: number;
  junkAtEdge: number;
  originMb: number;
  edgeMb: number;
  s3Gets: number;
  cloudfrontRequests: number;
  euDynamic: number;
  euOutside: number;
  queueDropped: number;
  /** New SQS backlogs, by node id. */
  backlogs: Record<string, number>;
  nodes: Record<string, NodeMetrics>;
  edges: Record<string, number>;
  edgeMix: Record<string, Traffic>;
}

export function simulateFlow(s: SimState, demand: Traffic): FlowResult {
  const r: FlowResult = {
    servedStatic: 0, servedDynamic: 0, latencyWeighted: 0, edgeServed: 0, junkAtEdge: 0,
    originMb: 0, edgeMb: 0, s3Gets: 0, cloudfrontRequests: 0, euDynamic: 0, euOutside: 0, queueDropped: 0,
    backlogs: {}, nodes: {}, edges: {}, edgeMix: {},
  };
  const byId = new Map(s.nodes.map((n) => [n.id, n]));
  const down = new Map(s.nodes.map((n) => [n.id, downReason(s, n)]));
  const outgoing = new Map<string, { edgeId: string; node: SimNode }[]>();
  for (const e of s.edges) {
    const target = byId.get(e.target);
    if (!target || !byId.has(e.source)) continue;
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push({ edgeId: e.id, node: target });
  }
  const incoming = new Map<string, Flow[]>();
  const order = [...s.nodes].sort((a, b) => RANK[a.kind] - RANK[b.kind]);
  const sources = s.nodes.filter((n) => n.kind === 'users');

  const serve = (node: SimNode, f: Flow, rps: number) => {
    if (f.type === 'dynamic' && f.origin === 'eu' && node.kind !== 'sqs') {
      r.euDynamic += rps;
      if (isGlobalKind(node.kind) || regionOf(node) !== 'eu') r.euOutside += rps;
    }
    // Work pulled from a queue was already answered when the queue accepted it.
    if (f.counted) return;
    const mb = f.type === 'dynamic' ? BALANCE.bytesDynamicMb : BALANCE.bytesStaticMb;
    if (f.viaEdge) r.edgeMb += rps * mb;
    else if (node.kind !== 'onprem' && node.kind !== 'lightsail') r.originMb += rps * mb;
    if (f.type === 'junk') return;
    if (f.type === 'static') r.servedStatic += rps;
    else r.servedDynamic += rps;
    r.latencyWeighted += rps * (f.latency + (f.viaEdge ? BALANCE.edgeRttMs : 0));
    if (f.viaEdge) r.edgeServed += rps;
  };

  for (const node of order) {
    const def = CATALOG[node.kind];
    if (def.behavior === 'monitor') continue;
    const sourceShare = node.config.share ?? 1 / sources.length;
    const origin: Region | 'global' = node.config.region ?? 'global';
    const flows: Flow[] =
      def.behavior === 'source'
        ? (['static', 'dynamic', 'junk'] as const).map((type) => ({ type, rps: demand[type] * sourceShare, latency: 0, viaEdge: false, origin, at: null }))
        : incoming.get(node.id) ?? [];
    const reason = down.get(node.id);
    const capacity = reason ? 0 : effectiveCapacity(s, node);
    const load = flows.reduce((sum, f) => sum + f.rps * weightFor(node, f.type), 0);
    const kept = load > 0 ? Math.min(1, capacity / load) : 1;
    const arriving = flows.reduce((sum, f) => sum + f.rps, 0);
    let dropped = arriving * (1 - kept);
    const utilization = capacity > 0 && Number.isFinite(capacity) ? Math.min(1, load / capacity) : load > 0 && capacity === 0 ? 1 : 0;
    const hopLatency = def.latencyMs * (1 + 3 * utilization ** 4);
    let warning: string | undefined;
    let throughput = 0;

    const children = outgoing.get(node.id) ?? [];
    /** Route 53 and CloudFront send each customer to the nearest healthy Region (latency routing + health checks). */
    const nearest = (f: Flow, targets: { edgeId: string; node: SimNode }[]) => {
      const regional = targets.filter((t) => !isGlobalKind(t.node.kind));
      if (regional.length < 2) return targets;
      const healthyOnes = regional.filter((t) => !down.get(t.node.id));
      const pool = healthyOnes.length ? healthyOnes : regional;
      if (f.origin === 'global') return pool;
      const best = Math.min(...pool.map((t) => RTT[f.origin as Region][regionOf(t.node)]));
      return pool.filter((t) => RTT[f.origin as Region][regionOf(t.node)] === best);
    };
    const forward = (
      f: Flow, rps: number, latency: number, viaEdge: boolean,
      eligible: (n: SimNode) => boolean, missing: string, routing?: 'nearest',
    ) => {
      let targets = children.filter((c) => eligible(c.node));
      if (routing === 'nearest') targets = nearest(f, targets);
      if (targets.length === 0) {
        if (rps > 0.01 && !f.counted) warning = missing;
        dropped += rps;
        return;
      }
      const share = rps / targets.length;
      for (const t of targets) {
        r.edges[t.edgeId] = (r.edges[t.edgeId] ?? 0) + share;
        const mix = (r.edgeMix[t.edgeId] ??= { static: 0, dynamic: 0, junk: 0 });
        mix[f.type] += share;
        // Entering a Region from the internet or an edge location, or hopping between Regions, costs latency.
        let lat = latency;
        let at = f.at;
        if (!isGlobalKind(t.node.kind) && t.node.kind !== 'onprem') {
          const region = regionOf(t.node);
          if (at === null) lat += viaEdge ? backbone(f.origin, region) : rtt(f.origin, region);
          else if (at !== region) lat += RTT[at][region];
          at = region;
        } else if (t.node.kind === 'onprem' && at === null) {
          lat += rtt(f.origin, 'us');
          at = 'us';
        }
        if (!incoming.has(t.node.id)) incoming.set(t.node.id, []);
        incoming.get(t.node.id)!.push({ ...f, rps: share, latency: lat, viaEdge, at });
      }
    };
    // Hardware that hasn't arrived isn't plugged in yet, so nothing routes to it.
    const installed = (n: SimNode) => n.readyAt === undefined || s.hour >= n.readyAt;
    const canTake = (type: FlowType) => (n: SimNode) => {
      if (!installed(n)) return false;
      const b = CATALOG[n.kind].behavior;
      if (b === 'storage') return type !== 'dynamic';
      if (b === 'queue') return type === 'dynamic';
      return true;
    };
    const healthy = (type: FlowType) => (n: SimNode) => canTake(type)(n) && !down.get(n.id);
    const isData = (n: SimNode) => ['db', 'cache'].includes(CATALOG[n.kind].behavior);
    const noRoute = 'Not connected to anything that can handle this traffic';

    if (def.behavior === 'queue') {
      // Accept everything now; feed workers only as fast as they can go; keep the rest for later.
      const workers = children.filter((c) => !down.get(c.node.id) && installed(c.node));
      const drain = workers.reduce((sum, c) => sum + effectiveCapacity(s, c.node) * 0.95, 0);
      let accepted = 0;
      for (const f of flows) {
        if (f.rps <= 0) continue;
        if (!f.counted) serve(node, { ...f, latency: f.latency + hopLatency }, f.rps);
        accepted += f.rps;
      }
      const pending = (node.backlog ?? 0) + accepted;
      const sent = Math.min(pending, drain);
      let backlog = pending - sent;
      const max = Math.max(drain, accepted) * BALANCE.queueMaxHours;
      if (backlog > max) {
        const expired = backlog - max;
        backlog = max;
        r.queueDropped += expired;
        r.servedDynamic -= expired;
        dropped += expired;
        warning = 'Queue overflowing: old orders are expiring';
      }
      r.backlogs[node.id] = backlog;
      throughput = accepted;
      if (sent > 0) {
        const template = flows.find((f) => f.rps > 0) ?? { type: 'dynamic' as const, rps: 0, latency: 0, viaEdge: false, origin: 'global' as const, at: null };
        forward({ ...template, type: 'dynamic', counted: true }, sent, 0, false, (n) => isComputeKind(n.kind), 'No workers to process the queue');
      } else if (pending > 0 && !workers.length) warning = 'No workers to process the queue';
    }

    for (const f of def.behavior === 'queue' ? [] : flows) {
      const rps = f.rps * kept;
      if (rps <= 0) continue;
      throughput += rps;
      const latency = f.latency + hopLatency;
      switch (def.behavior) {
        case 'source':
        case 'dns':
          forward(f, rps, latency, f.viaEdge, canTake(f.type), noRoute, 'nearest');
          break;
        case 'filter': {
          // WAF rate-based rules drop most attack traffic before it reaches anything that costs money.
          const pass = f.type === 'junk' ? rps * (1 - BALANCE.wafBlockRate) : rps;
          if (f.type === 'junk') r.junkAtEdge += rps - pass;
          forward(f, pass, latency, f.viaEdge, canTake(f.type), noRoute);
          break;
        }
        case 'lb':
        case 'link':
          forward(f, rps, latency, f.viaEdge, healthy(f.type), 'No healthy targets');
          break;
        case 'cdn': {
          r.cloudfrontRequests += rps;
          const hitRate = f.type === 'static' ? BALANCE.cdnHitRate : f.type === 'junk' ? BALANCE.cdnJunkHitRate : 0;
          const hits = rps * hitRate;
          if (hits > 0) {
            serve(node, { ...f, latency, viaEdge: true }, hits);
            if (f.type === 'junk') r.junkAtEdge += hits;
          }
          forward(f, rps - hits, latency, true, canTake(f.type), 'No origin configured', 'nearest');
          break;
        }
        case 'compute':
          if (f.type === 'dynamic' && !def.builtInDb) {
            forward(f, rps, latency, f.viaEdge, isData, 'No database connected: dynamic requests fail');
          } else {
            serve(node, { ...f, latency }, rps);
          }
          break;
        case 'storage':
          if (f.type === 'dynamic') {
            warning = 'S3 only serves files; it can’t run application code';
            throughput -= rps;
            dropped += rps;
          } else {
            r.s3Gets += rps;
            serve(node, { ...f, latency }, rps);
          }
          break;
        case 'cache': {
          const hits = rps * BALANCE.cacheHitRate;
          serve(node, { ...f, latency }, hits);
          forward(f, rps - hits, latency, f.viaEdge, (n) => n.kind === 'rds', 'No database behind the cache');
          break;
        }
        case 'db':
          serve(node, { ...f, latency }, rps);
          break;
      }
    }

    r.nodes[node.id] = {
      load,
      capacity: Number.isFinite(capacity) ? capacity : 0,
      utilization,
      down: !!reason,
      downReason: reason,
      warning,
      throughput,
      failRate: arriving > 0 ? Math.min(1, dropped / arriving) : 0,
      costPerHour: nodeHourlyCost(node, node.kind === 'sqs' ? throughput : load),
    };
  }
  return r;
}

// ── Events ────────────────────────────────────────────────────────────────

function pushNotice(s: SimState, notice: Omit<Notice, 'id'>) {
  s.notices.push({ id: `notice-${s.nextId++}`, ...notice });
  unlockCodex(s, notice.codexIds);
}

function computeNodes(s: SimState) {
  return s.nodes.filter((n) => n.kind === 'ec2' || n.kind === 'asg');
}

function alarmOrComplain(s: SimState, eventId: string, alarm: Omit<Notice, 'id'>) {
  if (hasKind(s, 'cloudwatch')) {
    pushNotice(s, alarm);
  } else {
    s.scheduled.push({ at: s.hour + COMPLAINT_DELAY_HOURS, eventId: `complaint:${eventId}` });
  }
}

/** Plain-language list of what's currently broken, used in strike notices. */
export function diagnose(s: SimState): string[] {
  const problems: string[] = [];
  for (const n of s.nodes) {
    const m = s.last.nodes[n.id];
    if (!m) continue;
    const name = CATALOG[n.kind].name;
    if (m.down) problems.push(`${name} is down (${m.downReason}).`);
    else if (m.capacity > 0 && m.load > m.capacity) problems.push(`${name} is over capacity: it’s getting ${Math.round((m.load / m.capacity) * 100)}% of what it can handle.`);
    else if (m.warning) problems.push(`${name}: ${m.warning}.`);
  }
  return problems;
}

/** The boss hands out a strike. Three in a month and you're fired. */
export function addStrike(s: SimState, reason: string) {
  if (!s.boss.enabled || s.finished) return;
  s.boss.strikes += 1;
  s.boss.log.push({ hour: s.hour, reason });
  const fired = s.boss.strikes >= BOSS.maxStrikes;
  const problems = diagnose(s);
  pushNotice(s, {
    title: fired ? 'You’re fired' : `Strike ${s.boss.strikes} of ${BOSS.maxStrikes}`,
    body: [
      reason,
      ...(fired
        ? [`${BOSS.name}: “That’s three this month. I’m sorry, but I need someone who can keep the store running.”`]
        : problems.length
          ? ['What’s wrong right now:', ...problems.map((p) => `• ${p}`)]
          : []),
    ],
    tone: 'danger',
    strike: { count: s.boss.strikes, max: BOSS.maxStrikes },
  });
  if (fired) {
    s.finished = true;
    s.failed = `${BOSS.name} let you go after ${BOSS.maxStrikes} strikes this month.`;
  }
}

export function fireEvent(s: SimState, ev: GameEvent) {
  switch (ev.kind) {
    case 'info':
      pushNotice(s, { title: ev.title, body: ev.body, tone: ev.tone ?? 'info', codexIds: ev.codexIds });
      break;
    case 'traffic-spike':
      s.effects.push({ eventId: ev.id, kind: 'traffic-spike', since: s.hour, until: s.hour + ev.duration, magnitude: ev.multiplier });
      pushNotice(s, { title: ev.title, body: ev.body, tone: 'warning', codexIds: ev.codexIds });
      break;
    case 'az-outage': {
      s.effects.push({ eventId: ev.id, kind: 'az-outage', since: s.hour, until: s.hour + ev.duration, magnitude: 1, az: ev.az });
      s.stats.outageOccurred = true;
      const hit = s.nodes.filter((n) => !CATALOG[n.kind].regional && n.config.az === ev.az && !n.config.multiAz);
      alarmOrComplain(s, ev.id, {
        title: `ALARM: Availability Zone ${azName(ev.az)} is impaired`,
        body: [
          'The AWS Health Dashboard reports a power event in one Availability Zone. AWS is working on it.',
          hit.length
            ? `Affected: ${hit.map((n) => CATALOG[n.kind].name).join(', ')}.`
            : 'None of your single-AZ resources live there. Your Multi-AZ design is holding.',
        ],
        tone: hit.length ? 'danger' : 'success',
        codexIds: ['availability-zones', 'health-dashboard'],
      });
      break;
    }
    case 'http-flood':
      s.effects.push({ eventId: ev.id, kind: 'http-flood', since: s.hour, until: s.hour + ev.duration, magnitude: ev.rps });
      alarmOrComplain(s, ev.id, {
        title: 'ALARM: Request rate is 20× normal',
        body: [
          'A botnet is hammering your homepage with HTTP requests: an application-layer DDoS attack.',
          'Requests that reach your servers use up capacity that real customers need.',
        ],
        tone: 'danger',
        codexIds: ['shield'],
      });
      break;
    case 'ssh-bruteforce': {
      const exposed = computeNodes(s).filter((n) => n.config.sshOpen);
      if (exposed.length) {
        for (const n of exposed) n.compromisedUntil = s.hour + ev.duration;
        s.stats.compromises += 1;
        pushNotice(s, {
          title: 'Breach! Attackers got in over SSH',
          body: [
            `A bot scanning the internet found port 22 open to 0.0.0.0/0 on your ${exposed.map((n) => CATALOG[n.kind].name).join(', ')} and guessed a weak password.`,
            `The compromised servers must be rebuilt (${ev.duration} hours offline).`,
            'Lesson: security groups are instance-level firewalls. Under the shared responsibility model, configuring them is YOUR job. Only allow the ports you need, from the sources that need them.',
          ],
          tone: 'danger',
          codexIds: ['security-groups', 'shared-responsibility'],
        });
        addStrike(s, 'Attackers broke into our servers through an open SSH port.');
      } else if (computeNodes(s).length) {
        pushNotice(s, {
          title: 'Attack blocked by your security groups',
          body: [
            'A bot scanned your servers for open SSH ports and found nothing. Your security groups only allow web traffic.',
            'Security groups are stateful, allow-only firewalls attached to instances.',
          ],
          tone: 'success',
          codexIds: ['security-groups'],
        });
      }
      break;
    }
    case 'root-check':
      if (s.flags.rootMfa) {
        pushNotice(s, {
          title: 'Phishing attempt failed',
          body: [
            'Someone phished your root user password, but MFA stopped them from signing in.',
            'The root user has unrestricted access to the account. Protect it with MFA and don’t use it for everyday work.',
          ],
          tone: 'success',
          codexIds: ['mfa', 'root-user'],
        });
      } else {
        s.cash -= ev.loss;
        addBill(s, 'Unauthorized usage (crypto mining)', ev.loss);
        s.stats.cost += ev.loss;
        s.stats.compromises += 1;
        pushNotice(s, {
          title: 'Your root user was taken over',
          body: [
            `An attacker phished your root password and launched crypto-mining servers. It cost you $${ev.loss.toLocaleString()} before you shut them down.`,
            'The root user can do anything in the account. Always enable MFA on it (see Trusted Advisor) and use IAM identities for daily work.',
          ],
          tone: 'danger',
          codexIds: ['mfa', 'root-user'],
        });
        addStrike(s, 'Someone took over our AWS account because the root user had no MFA.');
      }
      break;
    case 'compromise': {
      const targets = computeNodes(s);
      if (!targets.length) break;
      for (const n of targets) n.compromisedUntil = s.hour + ev.duration;
      s.stats.compromises += 1;
      pushNotice(s, { title: ev.title, body: ev.body, tone: 'danger', codexIds: ev.codexIds });
      addStrike(s, 'Attackers broke into our unpatched servers.');
      break;
    }
    case 'choice':
      pushNotice(s, {
        title: ev.title,
        body: ev.body,
        tone: 'info',
        codexIds: ev.codexIds,
        choice: { eventId: ev.id, options: ev.options.map((o) => ({ label: o.label })) },
      });
      break;
    case 'board':
      pushNotice(s, { title: 'The board would like a word', body: [], tone: 'info', questionId: ev.questionId });
      break;
    case 'check':
      applyOutcome(s, ev.test(s) ? ev.pass : ev.fail);
      break;
    case 'hire':
      s.account.staff.push(structuredClone(ev.staff));
      pushNotice(s, { title: ev.title, body: ev.body, tone: 'info', codexIds: ['iam'] });
      break;
    case 'region-outage': {
      s.effects.push({ eventId: ev.id, kind: 'region-outage', since: s.hour, until: s.hour + ev.duration, magnitude: 1, region: ev.region });
      const hit = s.nodes.filter((n) => !isGlobalKind(n.kind) && n.kind !== 'onprem' && regionOf(n) === ev.region);
      const elsewhere = s.nodes.some((n) => isComputeKind(n.kind) && n.kind !== 'onprem' && regionOf(n) !== ev.region);
      alarmOrComplain(s, ev.id, {
        title: `ALARM: the ${REGION_NAMES[ev.region]} Region is having a major outage`,
        body: [
          'The AWS Health Dashboard reports problems across several services in the Region. This is rare, but it happens.',
          hit.length ? `Down: ${hit.map((n) => CATALOG[n.kind].name).join(', ')}.` : 'Nothing of yours runs there.',
          elsewhere ? 'Route 53 health checks are sending customers to your other Region.' : 'You have nothing running in another Region to fail over to.',
        ],
        tone: elsewhere ? 'warning' : 'danger',
        codexIds: ['regions', 'health-dashboard'],
      });
      break;
    }
    case 'spot-reclaim': {
      s.effects.push({ eventId: ev.id, kind: 'spot-reclaim', since: s.hour, until: s.hour + ev.duration, magnitude: 1 });
      const spot = s.nodes.filter((n) => n.kind === 'asg' && n.config.spot);
      if (spot.length) {
        pushNotice(s, {
          title: 'AWS is reclaiming Spot capacity',
          body: [
            'Another customer needs the spare capacity your Spot Instances were using. AWS gave your instances a 2-minute warning and is taking most of them back.',
            'Spot is up to 90% cheaper because it can be interrupted like this.',
          ],
          tone: 'warning',
          codexIds: ['spot'],
        });
      }
      break;
    }
    case 'exam':
      pushNotice(s, { title: 'AWS Certified Cloud Practitioner: practice exam', body: [], tone: 'info', exam: { questionIds: ev.questionIds } });
      break;
  }
}

/** Shows an outcome and applies its consequences. */
export function applyOutcome(s: SimState, o: Outcome) {
  pushNotice(s, { title: o.title, body: o.body, tone: o.tone ?? (o.strike ? 'danger' : 'info'), codexIds: o.codexIds });
  if (o.cash) {
    s.cash += o.cash;
    if (o.cash < 0) {
      addBill(s, 'Fines & incident costs', -o.cash);
      s.stats.cost += -o.cash;
    }
  }
  if (o.revenueBoost) s.revenueBoost *= o.revenueBoost;
  if (o.down) {
    for (const n of s.nodes) if (o.down.kinds.includes(n.kind)) n.compromisedUntil = s.hour + o.down.hours;
  }
  if (o.strike) {
    s.stats.compromises += 1;
    addStrike(s, o.strike);
  }
}

function endEffect(s: SimState, ch: ChapterDef, eventId: string) {
  const ev = ch.events.find((e) => e.id === eventId);
  const st = s.eventStats[eventId];
  if (!ev) return;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  if (ev.kind === 'az-outage') {
    const rate = st && st.demand > 0 ? st.served / st.demand : 1;
    pushNotice(s, {
      title: `${azName(ev.az)} has recovered`,
      body: [`During the outage you served ${pct(rate)} of customer requests.`, ...ev.debrief],
      tone: rate >= 0.95 ? 'success' : 'warning',
      codexIds: ev.codexIds,
    });
  } else if (ev.kind === 'http-flood') {
    const absorbed = st && st.junk > 0 ? st.junkAtEdge / st.junk : 0;
    const rate = st && st.demand > 0 ? st.served / st.demand : 1;
    pushNotice(s, {
      title: 'The attack has stopped',
      body: [
        `${pct(absorbed)} of attack traffic was absorbed at the edge. You served ${pct(rate)} of real customers during the attack.`,
        ...ev.debrief,
      ],
      tone: rate >= 0.95 ? 'success' : 'warning',
      codexIds: ev.codexIds,
    });
  } else if (ev.kind === 'region-outage') {
    const rate = st && st.demand > 0 ? st.served / st.demand : 1;
    pushNotice(s, {
      title: `${REGION_NAMES[ev.region]} has recovered`,
      body: [`During the Region outage you served ${pct(rate)} of requests.`, ...ev.debrief],
      tone: rate >= 0.9 ? 'success' : 'warning',
      codexIds: ev.codexIds,
    });
  } else if (ev.kind === 'spot-reclaim' && s.nodes.some((n) => n.kind === 'asg' && n.config.spot)) {
    const rate = st && st.demand > 0 ? st.served / st.demand : 1;
    pushNotice(s, {
      title: 'Spot capacity is back',
      body: [`While Spot capacity was reclaimed you served ${pct(rate)} of requests.`, ...ev.debrief],
      tone: rate >= 0.97 ? 'success' : 'warning',
      codexIds: ['spot'],
    });
  } else if (ev.kind === 'traffic-spike' && ev.debrief) {
    const rate = st && st.demand > 0 ? st.served / st.demand : 1;
    pushNotice(s, {
      title: 'Traffic is back to normal',
      body: [`During the rush you served ${pct(rate)} of requests.`, ...ev.debrief],
      tone: rate >= 0.95 ? 'success' : 'warning',
      codexIds: ev.codexIds,
    });
  }
}

function processEvents(s: SimState, ch: ChapterDef) {
  for (const e of [...s.effects]) {
    if (e.until <= s.hour) {
      s.effects = s.effects.filter((x) => x !== e);
      endEffect(s, ch, e.eventId);
    }
  }
  for (const ev of ch.events) {
    if (ev.at === s.hour && !s.fired.includes(ev.id)) {
      s.fired.push(ev.id);
      fireEvent(s, ev);
    }
  }
  const due = s.scheduled.filter((x) => x.at <= s.hour);
  s.scheduled = s.scheduled.filter((x) => x.at > s.hour);
  for (const item of due) {
    if (item.eventId.startsWith('complaint:')) {
      pushNotice(s, {
        title: 'Customers are complaining on social media',
        body: [
          `Posts say your site has been broken or slow for about ${COMPLAINT_DELAY_HOURS} hours, and you’re only hearing about it now.`,
          'With CloudWatch alarms you’d have been paged the moment something went wrong.',
        ],
        tone: 'warning',
        codexIds: ['cloudwatch'],
      });
      continue;
    }
    const ev = ch.events.find((e) => e.id === item.eventId);
    if (ev) fireEvent(s, ev);
  }
}

// ── Scaling, costs, alarms ───────────────────────────────────────────────

function autoScale(s: SimState) {
  for (const n of s.nodes) {
    if (n.kind !== 'asg') continue;
    const min = n.config.minSize ?? 1;
    const max = Math.max(min, n.config.maxSize ?? min);
    const perInstance = SIZES[n.config.size ?? 'medium'].ec2Capacity;
    const load = s.last.nodes[n.id]?.load ?? 0;
    const desired = Math.ceil(load / (perInstance * BALANCE.asgTargetUtilization));
    n.instances = Math.min(max, Math.max(min, desired));
  }
}

function hourlyCosts(s: SimState, ch: ChapterDef, flow: FlowResult): number {
  let total = 0;
  const charge = (item: string, amount: number) => {
    addBill(s, item, amount);
    total += amount;
  };
  for (const n of s.nodes) {
    const m = flow.nodes[n.id];
    if (n.kind === 'onprem' && n.readyAt !== undefined && s.hour < n.readyAt) continue;
    const label = n.kind === 'asg' ? 'EC2 (Auto Scaling)' : n.kind === 'onprem' ? 'Data center power & rack' : CATALOG[n.kind].name;
    charge(label, m?.costPerHour ?? nodeHourlyCost(n));
  }
  if (ch.freeTier) {
    const credit = (key: string, hours: number, price: number) => {
      const used = s.freeTierHours[key] ?? 0;
      const free = Math.min(hours, Math.max(0, BALANCE.freeTierHoursPerMonth - used));
      s.freeTierHours[key] = used + free;
      if (free > 0) charge('Free Tier credit', -free * price);
    };
    const smallEc2 = s.nodes.reduce((sum, n) => {
      if (n.config.size !== 'small') return sum;
      if (n.kind === 'ec2') return sum + 1;
      if (n.kind === 'asg') return sum + (n.instances ?? 1);
      return sum;
    }, 0);
    credit('ec2-small', smallEc2, SIZES.small.ec2Price);
    const smallRds = s.nodes.filter((n) => n.kind === 'rds' && n.config.size === 'small' && !n.config.multiAz).length;
    credit('rds-small', smallRds, SIZES.small.rdsPrice);
  }
  const perHour = 3600;
  const originGb = (flow.originMb * perHour) / 1024;
  charge('Data transfer out (internet)', originGb * BALANCE.originTransferPerGb);
  let edgeGb = (flow.edgeMb * perHour) / 1024;
  if (ch.freeTier) {
    const free = Math.min(edgeGb, Math.max(0, BALANCE.edgeFreeGbPerMonth - s.freeTierEdgeGb));
    s.freeTierEdgeGb += free;
    edgeGb -= free;
  }
  charge('CloudFront data transfer', edgeGb * BALANCE.edgeTransferPerGb);
  charge('CloudFront requests', ((flow.cloudfrontRequests * perHour) / 1000) * BALANCE.cloudfrontPerThousand);
  charge('S3 requests', ((flow.s3Gets * perHour) / 1000) * BALANCE.s3PerThousandGets);

  // Commitments: you pay them every hour whether or not you use the capacity.
  const a = s.account;
  const nodeCost = (kinds: ServiceKind[]) =>
    s.nodes.filter((n) => kinds.includes(n.kind)).reduce((sum, n) => sum + (flow.nodes[n.id]?.costPerHour ?? nodeHourlyCost(n)), 0);
  if (a.savingsPlan > 0) {
    charge('Savings Plan commitment', a.savingsPlan);
    charge('Savings Plan coverage', -Math.min(nodeCost(['ec2', 'asg', 'lambda']), a.savingsPlan * COMMIT_COVERAGE.savingsPlan));
  }
  if (a.reservedDb > 0) {
    charge('Reserved DB commitment', a.reservedDb);
    charge('Reserved DB coverage', -Math.min(nodeCost(['rds']), a.reservedDb * COMMIT_COVERAGE.reservedDb));
  }
  const monthly = (item: string, perMonth: number) => perMonth > 0 && charge(item, perMonth / HOURS_PER_MONTH);
  monthly(`Support plan (${SUPPORT_PLANS[a.support].label})`, SUPPORT_PLANS[a.support].monthly);
  monthly('Shield Advanced', a.shieldAdvanced ? ACCOUNT_PRICES.shieldAdvanced : 0);
  monthly('Secrets Manager', a.secretsManager ? ACCOUNT_PRICES.secretsManager : 0);
  monthly('CloudTrail', a.cloudtrail ? ACCOUNT_PRICES.cloudtrail : 0);
  monthly('AWS Config', a.config ? ACCOUNT_PRICES.config : 0);
  monthly('GuardDuty', a.guardduty ? ACCOUNT_PRICES.guardduty : 0);
  monthly('Security Hub', a.securityHub ? ACCOUNT_PRICES.securityHub : 0);
  monthly('Inspector', a.inspector ? ACCOUNT_PRICES.inspector : 0);
  monthly('Macie', a.macie ? ACCOUNT_PRICES.macie : 0);
  monthly('Detective', a.detective ? ACCOUNT_PRICES.detective : 0);
  monthly('AWS Backup', a.backup ? ACCOUNT_PRICES.backup : 0);
  return total;
}

function checkBudget(s: SimState) {
  const a = s.account;
  if (a.budget === null || a.budgetAlerted || s.hour < 24) return;
  const spent = Object.values(s.bill).reduce((sum, v) => sum + v, 0) - (s.bill['Hardware purchases (CapEx)'] ?? 0);
  const forecast = (spent / (s.hour + 1)) * HOURS_PER_MONTH;
  if (forecast <= a.budget) return;
  a.budgetAlerted = true;
  pushNotice(s, {
    title: 'AWS Budgets alert',
    body: [
      `At this rate, this month’s AWS bill will be about $${Math.round(forecast).toLocaleString()}, over your $${a.budget.toLocaleString()} budget.`,
      'Open the Bill tab to see what’s driving the cost.',
    ],
    tone: 'warning',
    codexIds: ['budgets'],
  });
}

/** Every public entry point (CloudFront, load balancers, API Gateway) serves HTTPS. */
export function allHttps(s: SimState): boolean {
  const entries = s.nodes.filter((n) => n.kind === 'cloudfront' || n.kind === 'elb' || n.kind === 'apigw');
  return entries.length > 0 && entries.every((n) => n.config.https);
}

function raiseAlarms(s: SimState, flow: FlowResult, availability: number) {
  if (!hasKind(s, 'cloudwatch')) return;
  s.stats.alarmHours += 1;
  const fire = (key: string, text: string, tone: 'warning' | 'danger') => {
    const lastAt = s.alarmFiredAt[key];
    if (lastAt !== undefined && s.hour - lastAt < ALARM_COOLDOWN_HOURS) return;
    s.alarmFiredAt[key] = s.hour;
    s.alerts.push({ hour: s.hour, text, tone });
  };
  for (const n of s.nodes) {
    const m = flow.nodes[n.id];
    if (!m || n.kind === 'users') continue;
    const name = CATALOG[n.kind].name;
    if (m.down) fire(`${n.id}:down`, `ALARM ${name}: ${m.downReason}`, 'danger');
    else if (m.capacity > 0 && m.load > m.capacity) fire(`${n.id}:overload`, `ALARM ${name} over capacity: dropping requests`, 'warning');
  }
  if (availability < 0.95) fire('availability', `ALARM Only ${Math.round(availability * 100)}% of requests succeeded this hour`, 'danger');
}

function trackIncident(s: SimState, availability: number) {
  if (!s.boss.enabled) return;
  if (availability >= BOSS.failingAvailability) {
    if (s.boss.badHours >= BOSS.hoursBeforeStrike) {
      s.alerts.push({ hour: s.hour, text: 'The site has recovered.', tone: 'info' });
    }
    s.boss.badHours = 0;
    return;
  }
  s.boss.badHours += 1;
  const pct = Math.round(availability * 100);
  if (s.boss.badHours === 1) {
    s.alerts.push({
      hour: s.hour,
      text: `Only ${pct}% of requests are succeeding! Fix it within ${BOSS.hoursBeforeStrike} hours or ${BOSS.name} will notice.`,
      tone: 'danger',
    });
  }
  const over = s.boss.badHours - BOSS.hoursBeforeStrike;
  if (over >= 0 && over % BOSS.repeatEvery === 0) {
    addStrike(
      s,
      over === 0
        ? `${BOSS.name}: “The store has been failing for ${BOSS.hoursBeforeStrike} hours straight. Customers are emailing me. That’s a strike.”`
        : `${BOSS.name}: “We’ve been broken for ${s.boss.badHours} hours now. Another strike.”`,
    );
  }
}

// ── Tick ──────────────────────────────────────────────────────────────────

/** Advances the simulation one hour. Mutates `s`. Does nothing while a notice is waiting or the chapter is over. */
export function step(s: SimState, ch: ChapterDef) {
  if (s.finished || s.notices.length) return;

  if (s.hour > 0 && s.hour % HOURS_PER_MONTH === 0) s.boss.strikes = 0;
  processEvents(s, ch);
  autoScale(s);

  const demand = computeDemand(s, ch);
  const flow = simulateFlow(s, demand);
  const wanted = demand.static + demand.dynamic;
  const served = flow.servedStatic + flow.servedDynamic;
  const availability = wanted > 0 ? Math.min(1, served / wanted) : 1;
  const latencyMs = served > 0 ? flow.latencyWeighted / served : 0;
  const lScore = latencyScore(latencyMs, ch.latencyTargetMs);

  // Browsers warn "Not secure" at checkout without HTTPS, and most shoppers leave.
  const checkoutTrust = ch.requireHttps && !allHttps(s) ? 0.6 : 1;
  const revenue =
    (flow.servedStatic * ch.revenue.static + flow.servedDynamic * ch.revenue.dynamic * checkoutTrust) * 3600 * (0.5 + 0.5 * lScore) * s.revenueBoost;
  const cost = hourlyCosts(s, ch, flow);
  s.cash += revenue - cost;
  for (const [id, backlog] of Object.entries(flow.backlogs)) {
    const n = s.nodes.find((x) => x.id === id);
    if (n) n.backlog = backlog;
  }
  checkBudget(s);

  const quality = availability * lScore * 100;
  s.satisfaction += (quality - s.satisfaction) * (quality < s.satisfaction ? 0.12 : 0.05);

  const st = s.stats;
  st.demand += wanted * 3600;
  st.served += served * 3600;
  st.latencyWeighted += flow.latencyWeighted * 3600;
  st.edgeServed += flow.edgeServed * 3600;
  st.euDynamic += flow.euDynamic * 3600;
  st.euOutside += flow.euOutside * 3600;
  st.queueDropped += flow.queueDropped * 3600;
  st.revenue += revenue;
  st.cost += cost;
  for (const n of s.nodes) {
    const m = flow.nodes[n.id];
    if (!m || !isComputeKind(n.kind) || m.down) continue;
    st.computeLoad += Math.min(m.load, m.capacity);
    st.computeCapacity += m.capacity;
  }
  if (activeOutage(s)) {
    st.outageDemand += wanted;
    st.outageServed += served;
  }
  for (const e of s.effects) {
    const es = (s.eventStats[e.eventId] ??= { demand: 0, served: 0, junk: 0, junkAtEdge: 0 });
    es.demand += wanted;
    es.served += served;
    es.junk += demand.junk;
    es.junkAtEdge += flow.junkAtEdge;
  }

  raiseAlarms(s, flow, availability);

  s.last = { demand, served, latencyMs, revenue, cost, nodes: flow.nodes, edges: flow.edges, edgeMix: flow.edgeMix };
  s.history.push({ hour: s.hour, demand: wanted, served, latencyMs, revenue, cost });
  trackIncident(s, availability);

  s.hour += 1;
  if (s.finished) return;
  if (s.cash < 0) {
    s.finished = true;
    s.failed = 'You ran out of money.';
  } else if (s.hour >= ch.lengthHours) {
    s.finished = true;
  }
}

// ── Player actions ────────────────────────────────────────────────────────

/** Returns an error message, or null on success. */
export function addNode(s: SimState, ch: ChapterDef, kind: ServiceKind, position: { x: number; y: number }): string | null {
  const def = CATALOG[kind];
  if (!ch.available.includes(kind)) return `${def.name} isn’t available in this chapter.`;
  if (def.maxCount && s.nodes.filter((n) => n.kind === kind).length >= def.maxCount) {
    return `You can only have ${def.maxCount} ${def.name}.`;
  }
  if (def.upfrontCost) {
    if (s.cash < def.upfrontCost) return `You need $${def.upfrontCost.toLocaleString()} to buy this.`;
    s.cash -= def.upfrontCost;
    s.stats.capex += def.upfrontCost;
    addBill(s, 'Hardware purchases (CapEx)', def.upfrontCost);
  }
  const node: SimNode = { id: `n${s.nextId++}`, kind, config: { ...def.defaultConfig }, position };
  if (def.deliveryHours) node.readyAt = s.hour + def.deliveryHours;
  if (kind === 'asg') node.instances = node.config.minSize;
  s.nodes.push(node);
  unlockCodex(s, def.codexId ? [def.codexId] : []);
  return null;
}

export function removeNode(s: SimState, id: string) {
  const node = s.nodes.find((n) => n.id === id);
  if (!node || node.kind === 'users') return;
  const upfront = CATALOG[node.kind].upfrontCost;
  if (upfront) {
    const resale = Math.round(upfront * ONPREM_RESALE);
    s.cash += resale;
    s.alerts.push({ hour: s.hour, text: `Sold used hardware for $${resale.toLocaleString()} (paid $${upfront.toLocaleString()})`, tone: 'info' });
  }
  s.nodes = s.nodes.filter((n) => n.id !== id);
  s.edges = s.edges.filter((e) => e.source !== id && e.target !== id);
}

export function connect(s: SimState, source: string, target: string): string | null {
  const a = s.nodes.find((n) => n.id === source);
  const b = s.nodes.find((n) => n.id === target);
  if (!a || !b) return 'Unknown node.';
  if (!canConnect(a.kind, b.kind)) {
    return `${CATALOG[a.kind].name} can’t send traffic to ${CATALOG[b.kind].name}.`;
  }
  if (s.edges.some((e) => e.source === source && e.target === target)) return null;
  s.edges.push({ id: `e${s.nextId++}`, source, target });
  return null;
}

export function removeEdge(s: SimState, id: string) {
  s.edges = s.edges.filter((e) => e.id !== id);
}

export function updateConfig(s: SimState, id: string, patch: Partial<NodeConfig>) {
  const node = s.nodes.find((n) => n.id === id);
  if (!node) return;
  node.config = { ...node.config, ...patch };
  if (node.kind === 'asg') {
    const min = node.config.minSize ?? 1;
    const max = Math.max(min, node.config.maxSize ?? min);
    node.config.maxSize = max;
    node.instances = Math.min(max, Math.max(min, node.instances ?? min));
  }
  if (patch.multiAz) unlockCodex(s, ['high-availability']);
  if (patch.sshOpen === false) unlockCodex(s, ['security-groups']);
}

export function moveNode(s: SimState, id: string, position: { x: number; y: number }) {
  const node = s.nodes.find((n) => n.id === id);
  if (node) node.position = position;
}

export function enableRootMfa(s: SimState) {
  s.flags.rootMfa = true;
  unlockCodex(s, ['mfa', 'root-user']);
}

export function dismissNotice(s: SimState) {
  const notice = s.notices[0];
  if (!notice || notice.choice) return;
  s.notices.shift();
}

export function resolveChoice(s: SimState, ch: ChapterDef, optionIndex: number) {
  const notice = s.notices[0];
  if (!notice?.choice) return;
  const ev = ch.events.find((e) => e.id === notice.choice!.eventId);
  s.notices.shift();
  if (!ev || ev.kind !== 'choice') return;
  const option = ev.options[optionIndex];
  s.stats.choicesTotal += 1;
  if (option.correct) s.stats.choicesCorrect += 1;
  else if (ev.onWrong) s.scheduled.push({ at: s.hour + ev.onWrong.delay, eventId: ev.onWrong.eventId });
  const e = option.effect;
  const extra: string[] = [];
  if (e?.revenueBoost && e.revenueBoost > 1) extra.push(`📈 Revenue +${Math.round((e.revenueBoost - 1) * 100)}% for the rest of the mission.`);
  if (e?.cash) extra.push(e.cash > 0 ? `💰 +$${e.cash.toLocaleString()}` : `💸 That cost $${(-e.cash).toLocaleString()}.`);
  applyOutcome(s, {
    title: option.correct ? 'Good call' : 'Not quite',
    body: [...option.outcome, ...extra],
    tone: option.correct ? 'success' : 'warning',
    codexIds: ev.codexIds,
    cash: e?.cash,
    revenueBoost: e?.revenueBoost,
    strike: e?.strike,
  });
}

/** Changes account settings. Commitments (Savings Plans, reservations) can't be reduced once bought. */
export function setAccount(s: SimState, patch: Partial<Account>): string | null {
  if (patch.savingsPlan !== undefined && patch.savingsPlan < s.account.savingsPlan) return 'A Savings Plan is a 1- or 3-year commitment. You can add to it, but not cancel it.';
  if (patch.reservedDb !== undefined && patch.reservedDb < s.account.reservedDb) return 'Reserved capacity is a 1- or 3-year commitment. You can’t give it back.';
  if (patch.scp && !(patch.organizations ?? s.account.organizations)) return 'Service control policies need AWS Organizations first.';
  if (patch.budget !== undefined) s.account.budgetAlerted = false;
  Object.assign(s.account, patch);
  if (patch.organizations === false) s.account.scp = false;
  return null;
}

export function updateStaff(s: SimState, id: string, patch: Partial<StaffMember>) {
  const person = s.account.staff.find((p) => p.id === id);
  if (person) Object.assign(person, patch);
}

export function removeStaff(s: SimState, id: string) {
  s.account.staff = s.account.staff.filter((p) => p.id !== id);
}

/** Kinds CloudFormation copies when deploying the stack to another Region. */
const STACK_KINDS: ServiceKind[] = ['elb', 'asg', 'ec2', 'rds', 'elasticache', 'apigw', 'lambda', 'dynamodb', 'sqs'];

/** Infrastructure as code: deploy a copy of the us-east-1 stack to another Region in one step. */
export function deployStack(s: SimState, region: Region): string | null {
  if (s.nodes.some((n) => STACK_KINDS.includes(n.kind) && regionOf(n) === region)) return `You already have a stack in ${REGION_NAMES[region]}.`;
  const originals = s.nodes.filter((n) => STACK_KINDS.includes(n.kind) && regionOf(n) === 'us');
  if (!originals.length) return 'There’s nothing in us-east-1 to copy yet.';
  const offset = region === 'eu' ? 300 : 600;
  const ids = new Map<string, string>();
  for (const n of originals) {
    const copy: SimNode = { ...structuredClone(n), id: `n${s.nextId++}`, config: { ...n.config, region }, position: { x: n.position.x, y: n.position.y + offset } };
    delete copy.backlog;
    delete copy.compromisedUntil;
    ids.set(n.id, copy.id);
    s.nodes.push(copy);
  }
  for (const e of [...s.edges]) {
    const src = ids.get(e.source);
    const dst = ids.get(e.target);
    if (src && dst) s.edges.push({ id: `e${s.nextId++}`, source: src, target: dst });
    else if (!src && dst) s.edges.push({ id: `e${s.nextId++}`, source: e.source, target: dst });
  }
  unlockCodex(s, ['cloudformation', 'automation-economics']);
  return null;
}

/** Records the practice exam result and closes it. */
export function recordExam(s: SimState, correct: number, total: number) {
  if (!s.notices[0]?.exam) return;
  s.notices.shift();
  s.examScore = total > 0 ? correct / total : 0;
  s.stats.questionsCorrect += correct;
  s.stats.questionsTotal += total;
}

/** Records a board-question answer. The caller shows the explanation. */
export function answerQuestion(s: SimState, correct: boolean, reward: number, codexIds: string[]) {
  const notice = s.notices[0];
  if (!notice?.questionId) return;
  s.notices.shift();
  s.stats.questionsTotal += 1;
  if (correct) {
    s.stats.questionsCorrect += 1;
    s.cash += reward;
    s.alerts.push({ hour: s.hour, text: `The board is impressed: +$${reward.toLocaleString()} investment`, tone: 'info' });
  }
  unlockCodex(s, codexIds);
}

/** Runs the chapter to the end, resolving every prompt with `decide`. For tests and balancing. */
export function runToEnd(
  s: SimState,
  ch: ChapterDef,
  decide: (s: SimState) => void = (st) => {
    const n = st.notices[0];
    if (n.choice) resolveChoice(st, ch, 0);
    else if (n.questionId) answerQuestion(st, false, 0, []);
    else dismissNotice(st);
  },
  maxHours = 10_000,
) {
  for (let i = 0; i < maxHours && !s.finished; i++) {
    while (s.notices.length) decide(s);
    step(s, ch);
  }
  while (s.notices.length) decide(s);
}
