import { BALANCE, CATALOG, RANK, SIZES, canConnect, isComputeKind, nodeCapacity, nodeHourlyCost } from './catalog';
import type { ChapterDef, GameEvent } from './chapter';
import { nextRandom } from './rng';
import type { ChapterStats, NodeConfig, NodeMetrics, Notice, ServiceKind, SimNode, SimState, Traffic } from './types';

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
}

function emptyStats(): ChapterStats {
  return {
    demand: 0, served: 0, latencyWeighted: 0, revenue: 0, cost: 0, capex: 0,
    computeLoad: 0, computeCapacity: 0, outageDemand: 0, outageServed: 0, outageOccurred: false,
    compromises: 0, choicesCorrect: 0, choicesTotal: 0, alarmHours: 0, edgeServed: 0,
    questionsCorrect: 0, questionsTotal: 0,
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

function activeOutage(s: SimState) {
  return s.effects.find((e) => e.kind === 'az-outage');
}

export function downReason(s: SimState, node: SimNode): string | undefined {
  if (node.readyAt !== undefined && s.hour < node.readyAt) {
    return `Shipping: arrives in ${node.readyAt - s.hour}h`;
  }
  if (node.compromisedUntil !== undefined && s.hour < node.compromisedUntil) {
    return 'Compromised: being rebuilt';
  }
  const outage = activeOutage(s);
  if (outage?.az && !CATALOG[node.kind].regional && node.config.az === outage.az) {
    if (node.config.multiAz) return undefined;
    return `${azName(outage.az)} outage`;
  }
  return undefined;
}

function effectiveCapacity(s: SimState, node: SimNode): number {
  const outage = activeOutage(s);
  const cap = nodeCapacity(node);
  // A Multi-AZ group loses the instances in the failed AZ until it relaunches them elsewhere.
  if (node.kind === 'asg' && node.config.multiAz && outage && outage.since === s.hour) return cap / 2;
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
  const users = s.nodes.find((n) => n.kind === 'users');
  const hasDns = users && s.edges.some((e) => e.source === users.id && s.nodes.find((n) => n.id === e.target)?.kind === 'route53');
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
  nodes: Record<string, NodeMetrics>;
  edges: Record<string, number>;
  edgeMix: Record<string, Traffic>;
}

export function simulateFlow(s: SimState, demand: Traffic): FlowResult {
  const r: FlowResult = {
    servedStatic: 0, servedDynamic: 0, latencyWeighted: 0, edgeServed: 0, junkAtEdge: 0,
    originMb: 0, edgeMb: 0, s3Gets: 0, cloudfrontRequests: 0, nodes: {}, edges: {}, edgeMix: {},
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

  const serve = (node: SimNode, f: Flow, rps: number) => {
    const mb = f.type === 'dynamic' ? BALANCE.bytesDynamicMb : BALANCE.bytesStaticMb;
    if (f.viaEdge) r.edgeMb += rps * mb;
    else if (node.kind !== 'onprem' && node.kind !== 'lightsail') r.originMb += rps * mb;
    if (f.type === 'junk') return;
    if (f.type === 'static') r.servedStatic += rps;
    else r.servedDynamic += rps;
    r.latencyWeighted += rps * (f.latency + (f.viaEdge ? BALANCE.edgeRttMs : BALANCE.originRttMs));
    if (f.viaEdge) r.edgeServed += rps;
  };

  for (const node of order) {
    const def = CATALOG[node.kind];
    if (def.behavior === 'monitor') continue;
    const flows: Flow[] =
      def.behavior === 'source'
        ? (['static', 'dynamic', 'junk'] as const).map((type) => ({ type, rps: demand[type], latency: 0, viaEdge: false }))
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
    const forward = (f: Flow, rps: number, latency: number, viaEdge: boolean, eligible: (n: SimNode) => boolean, missing: string) => {
      const targets = children.filter((c) => eligible(c.node));
      if (targets.length === 0) {
        if (rps > 0.01) warning = missing;
        dropped += rps;
        return;
      }
      const share = rps / targets.length;
      for (const t of targets) {
        r.edges[t.edgeId] = (r.edges[t.edgeId] ?? 0) + share;
        const mix = (r.edgeMix[t.edgeId] ??= { static: 0, dynamic: 0, junk: 0 });
        mix[f.type] += share;
        if (!incoming.has(t.node.id)) incoming.set(t.node.id, []);
        incoming.get(t.node.id)!.push({ type: f.type, rps: share, latency, viaEdge });
      }
    };
    // Hardware that hasn't arrived isn't plugged in yet, so nothing routes to it.
    const installed = (n: SimNode) => n.readyAt === undefined || s.hour >= n.readyAt;
    const canTake = (type: FlowType) => (n: SimNode) => installed(n) && (CATALOG[n.kind].behavior !== 'storage' || type !== 'dynamic');
    const healthy = (type: FlowType) => (n: SimNode) => canTake(type)(n) && !down.get(n.id);
    const isData = (n: SimNode) => ['db', 'cache'].includes(CATALOG[n.kind].behavior);
    const noRoute = 'Not connected to anything that can handle this traffic';

    for (const f of flows) {
      const rps = f.rps * kept;
      if (rps <= 0) continue;
      throughput += rps;
      const latency = f.latency + hopLatency;
      switch (def.behavior) {
        case 'source':
        case 'dns':
          forward(f, rps, latency, f.viaEdge, canTake(f.type), noRoute);
          break;
        case 'lb':
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
          forward(f, rps - hits, latency + BALANCE.backboneMs, true, canTake(f.type), 'No origin configured');
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
      costPerHour: nodeHourlyCost(node, load),
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
  return total;
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

  const revenue = (flow.servedStatic * ch.revenue.static + flow.servedDynamic * ch.revenue.dynamic) * 3600 * (0.5 + 0.5 * lScore);
  const cost = hourlyCosts(s, ch, flow);
  s.cash += revenue - cost;

  const quality = availability * lScore * 100;
  s.satisfaction += (quality - s.satisfaction) * (quality < s.satisfaction ? 0.12 : 0.05);

  const st = s.stats;
  st.demand += wanted * 3600;
  st.served += served * 3600;
  st.latencyWeighted += flow.latencyWeighted * 3600;
  st.edgeServed += flow.edgeServed * 3600;
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
  pushNotice(s, {
    title: option.correct ? 'Good call' : 'Not quite',
    body: option.outcome,
    tone: option.correct ? 'success' : 'warning',
    codexIds: ev.codexIds,
  });
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
