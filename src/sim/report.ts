import { isComputeKind } from './catalog';
import type { ChapterDef, Objective } from './chapter';
import type { SimState } from './types';

export interface ObjectiveResult {
  label: string;
  met: boolean;
  value: string;
}

export interface Criterion {
  label: string;
  score: number;
  detail: string;
}

export interface PillarResult {
  name: string;
  score: number;
  criteria: Criterion[];
}

export interface Report {
  objectives: ObjectiveResult[];
  passed: boolean;
  pillars: PillarResult[];
  overall: number;
  stars: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

export function availability(s: SimState): number {
  return s.stats.demand > 0 ? s.stats.served / s.stats.demand : 1;
}

export function averageLatency(s: SimState): number {
  return s.stats.served > 0 ? s.stats.latencyWeighted / s.stats.served : 0;
}

export function computeUtilization(s: SimState): number | null {
  return s.stats.computeCapacity > 0 ? s.stats.computeLoad / s.stats.computeCapacity : null;
}

export function evaluateObjective(s: SimState, o: Objective): ObjectiveResult {
  switch (o.kind) {
    case 'availability': {
      const v = availability(s);
      return { label: o.label, met: v >= o.target, value: pct(v) };
    }
    case 'latency': {
      const v = averageLatency(s);
      return { label: o.label, met: s.stats.served > 0 && v <= o.target, value: `${Math.round(v)} ms` };
    }
    case 'cash':
      return { label: o.label, met: s.cash >= o.target, value: `$${Math.round(s.cash).toLocaleString()}` };
    case 'served':
      return { label: o.label, met: s.stats.served >= o.target, value: Math.round(s.stats.served).toLocaleString() };
  }
}

function utilizationScore(u: number | null): number {
  if (u === null) return 100;
  return u >= 0.4 ? 100 : clamp((u / 0.4) * 100);
}

export function buildReport(s: SimState, ch: ChapterDef): Report {
  const objectives = ch.objectives.map((o) => evaluateObjective(s, o));
  const passed = !s.failed && objectives.every((o) => o.met);
  const st = s.stats;
  const hours = Math.max(1, s.hour);
  const has = (kind: string) => s.nodes.some((n) => n.kind === kind);
  const onprem = has('onprem');
  const util = computeUtilization(s);

  const opEx: Criterion[] = [
    onprem
      ? { label: 'Operational overhead', score: 30, detail: 'Physical servers have to be ordered, racked, repaired, and replaced by you.' }
      : { label: 'Operational overhead', score: 100, detail: 'No hardware to manage. AWS handles the data centers.' },
  ];
  if (ch.available.includes('cloudwatch')) {
    const share = st.alarmHours / hours;
    opEx.push({
      label: 'Monitoring and alarms',
      score: clamp(share * 100),
      detail: share > 0.5 ? 'CloudWatch alarms watched your system.' : 'You had no alarms for most of the month, so incidents went unnoticed.',
    });
  }
  if (st.choicesTotal > 0) {
    opEx.push({
      label: 'Incident decisions',
      score: clamp((st.choicesCorrect / st.choicesTotal) * 100),
      detail: `${st.choicesCorrect} of ${st.choicesTotal} calls were right.`,
    });
  }

  const security: Criterion[] = [];
  if (onprem) {
    security.push({ label: 'Physical security', score: 40, detail: 'Locks, cameras, and power for your server closet are all on you. In the cloud, that is AWS’s responsibility.' });
  }
  if (ch.id >= 1) {
    security.push({
      label: 'Root user protected with MFA',
      score: s.flags.rootMfa ? 100 : 0,
      detail: s.flags.rootMfa ? 'MFA is enabled on the root user.' : 'Root user had no MFA. Trusted Advisor flags this.',
    });
  }
  if (ch.available.includes('ec2') || ch.available.includes('asg')) {
    const open = s.nodes.some((n) => (n.kind === 'ec2' || n.kind === 'asg') && n.config.sshOpen);
    security.push({
      label: 'Least-privilege network access',
      score: open ? 0 : 100,
      detail: open ? 'A security group allows SSH from the entire internet.' : 'Security groups only allow the traffic you need.',
    });
  }
  security.push({
    label: 'No security incidents',
    score: clamp(100 - 50 * st.compromises),
    detail: st.compromises ? `${st.compromises} breach(es) this chapter.` : 'Nobody got in.',
  });

  const a = availability(s);
  const reliability: Criterion[] = [
    { label: 'Availability', score: clamp(((a - 0.9) / 0.099) * 100), detail: `${pct(a, 2)} of requests succeeded.` },
  ];
  if (st.outageOccurred) {
    const rate = st.outageDemand > 0 ? st.outageServed / st.outageDemand : 1;
    reliability.push({
      label: 'Survived the AZ outage',
      score: clamp(((rate - 0.5) / 0.45) * 100),
      detail: `Served ${pct(rate, 0)} of requests while an Availability Zone was down.`,
    });
  }
  const computeNodes = s.nodes.filter((n) => isComputeKind(n.kind));
  const azs = new Set(computeNodes.filter((n) => n.kind !== 'onprem').map((n) => n.config.az));
  const computeRedundant = computeNodes.some((n) => n.kind === 'asg' && n.config.multiAz) || azs.size >= 2 || (computeNodes.length === 0 && has('s3'));
  const dbs = s.nodes.filter((n) => n.kind === 'rds' || n.kind === 'elasticache');
  const dbRedundant = dbs.every((n) => n.config.multiAz);
  reliability.push({
    label: 'No single points of failure',
    score: clamp((computeRedundant ? 50 : 15) + (dbRedundant ? 50 : 15)),
    detail: [
      computeRedundant ? 'Web tier spans multiple AZs or is fully managed.' : 'Web tier lives in one place.',
      dbs.length ? (dbRedundant ? 'Data tier is Multi-AZ.' : 'Data tier has single-AZ components.') : '',
    ].join(' '),
  });

  const latency = averageLatency(s);
  const performance: Criterion[] = [
    {
      label: 'Latency',
      score: clamp(latency <= ch.latencyTargetMs ? 100 : 100 - ((latency - ch.latencyTargetMs) / ch.latencyTargetMs) * 100),
      detail: `Average ${Math.round(latency)} ms (target ${ch.latencyTargetMs} ms).`,
    },
  ];
  if (ch.available.includes('cloudfront')) {
    const edge = st.served > 0 ? st.edgeServed / st.served : 0;
    performance.push({
      label: 'Served from edge locations',
      score: clamp((edge / 0.6) * 100),
      detail: `${pct(edge, 0)} of requests were answered by CloudFront close to the customer.`,
    });
  }

  const margin = st.revenue > 0 ? (st.revenue - st.cost - st.capex) / st.revenue : -1;
  const cost: Criterion[] = [
    {
      label: 'Paying only for what you use',
      score: utilizationScore(util),
      detail: util === null ? 'No servers to leave idle.' : `Servers averaged ${pct(util, 0)} utilization. Idle capacity is wasted money.`,
    },
    { label: 'Profit margin', score: clamp((margin / 0.5) * 100), detail: `${pct(Math.max(margin, -1), 0)} margin after all costs.` },
  ];

  const selfManaged = s.nodes.reduce((sum, n) => sum + (n.kind === 'onprem' ? 3 : n.kind === 'ec2' || n.kind === 'asg' ? 1 : 0), 0);
  const managed = s.nodes.filter((n) => !['users', 'onprem', 'ec2', 'asg', 'cloudwatch'].includes(n.kind)).length;
  const sustainability: Criterion[] = [
    {
      label: 'Minimal idle capacity',
      score: utilizationScore(util),
      detail: 'Running servers that do nothing still burns energy.',
    },
    {
      label: 'Managed and shared infrastructure',
      score: clamp(selfManaged + managed === 0 ? 100 : (managed / (managed + selfManaged)) * 100),
      detail: onprem ? 'A small server closet is far less energy-efficient than an AWS data center.' : 'Managed services run on highly utilized, shared infrastructure.',
    },
  ];

  const pillars: PillarResult[] = [
    ['Operational Excellence', opEx],
    ['Security', security],
    ['Reliability', reliability],
    ['Performance Efficiency', performance],
    ['Cost Optimization', cost],
    ['Sustainability', sustainability],
  ].map(([name, criteria]) => {
    const list = criteria as Criterion[];
    return { name: name as string, criteria: list, score: clamp(list.reduce((sum, c) => sum + c.score, 0) / list.length) };
  });
  const overall = clamp(pillars.reduce((sum, p) => sum + p.score, 0) / pillars.length);
  const stars = passed ? 1 + (overall >= 60 ? 1 : 0) + (overall >= 80 ? 1 : 0) : 0;
  return { objectives, passed, pillars, overall, stars };
}
