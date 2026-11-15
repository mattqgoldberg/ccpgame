import { describe, expect, it } from 'vitest';
import { getMission } from '../content/missions';
import { BOSS, addNode, connect, createSim, fireEvent, simulateFlow, step, updateConfig } from './engine';
import type { SimState } from './types';

const ch3 = getMission('3-1')!;
const viral = getMission('3-2')!;
const ch0 = getMission('0-2')!;

function lastNode(s: SimState) {
  return s.nodes[s.nodes.length - 1];
}

describe('engine', () => {
  it('rejects connections that make no sense', () => {
    const s = createSim(ch3);
    expect(connect(s, 'blog', 'web')).toMatch(/can’t send traffic/);
    expect(connect(s, 'web', 'db')).toBeNull();
  });

  it('does not route traffic to hardware that has not arrived', () => {
    const s = createSim(ch0);
    expect(addNode(s, ch0, 'onprem', { x: 0, y: 0 })).toBeNull();
    const server2 = lastNode(s);
    connect(s, 'users', server2.id);
    const flow = simulateFlow(s, { static: 0, dynamic: 10, junk: 0 });
    expect(flow.servedDynamic).toBeCloseTo(10);
    expect(flow.nodes[server2.id].down).toBe(true);
  });

  it('charges hardware upfront as CapEx', () => {
    const s = createSim(ch0);
    addNode(s, ch0, 'onprem', { x: 0, y: 0 });
    expect(s.cash).toBe(ch0.startingCash - 2500);
    expect(s.bill['Hardware purchases (CapEx)']).toBe(2500);
  });

  it('takes single-AZ resources down in an AZ outage but fails Multi-AZ RDS over', () => {
    const s = createSim(ch3);
    fireEvent(s, { id: 'x', kind: 'az-outage', az: 'a', duration: 4, debrief: [] });
    let flow = simulateFlow(s, { static: 0, dynamic: 10, junk: 0 });
    expect(flow.nodes.web.down).toBe(true);
    expect(flow.nodes.db.down).toBe(true);
    updateConfig(s, 'db', { multiAz: true });
    flow = simulateFlow(s, { static: 0, dynamic: 10, junk: 0 });
    expect(flow.nodes.db.down).toBe(false);
  });

  it('load balancers skip unhealthy targets', () => {
    const s = createSim(ch3);
    addNode(s, ch3, 'elb', { x: 0, y: 0 });
    const lb = lastNode(s);
    addNode(s, ch3, 'ec2', { x: 0, y: 0 });
    const webB = lastNode(s);
    updateConfig(s, webB.id, { az: 'b' });
    connect(s, 'cdn', lb.id);
    connect(s, lb.id, 'web');
    connect(s, lb.id, webB.id);
    connect(s, webB.id, 'db');
    s.edges = s.edges.filter((e) => e.id !== 'e-cdn-web');
    updateConfig(s, 'db', { multiAz: true });
    fireEvent(s, { id: 'x', kind: 'az-outage', az: 'a', duration: 4, debrief: [] });
    const flow = simulateFlow(s, { static: 0, dynamic: 20, junk: 0 });
    expect(flow.servedDynamic).toBeCloseTo(20);
  });

  it('only compromises servers with SSH open to the internet', () => {
    const s = createSim(ch3);
    fireEvent(s, { id: 'x', kind: 'ssh-bruteforce', duration: 12 });
    expect(s.stats.compromises).toBe(0);
    updateConfig(s, 'web', { sshOpen: true });
    fireEvent(s, { id: 'y', kind: 'ssh-bruteforce', duration: 12 });
    expect(s.stats.compromises).toBe(1);
    expect(s.nodes.find((n) => n.id === 'web')!.compromisedUntil).toBe(12);
  });

  it('reports how much traffic fails at each node, and the mix on each connection', () => {
    const s = createSim(ch3);
    updateConfig(s, 'web', { size: 'small' });
    const flow = simulateFlow(s, { static: 0, dynamic: 120, junk: 0 });
    expect(flow.nodes.web.failRate).toBeGreaterThan(0.5);
    expect(flow.nodes.db.failRate).toBe(0);
    expect(flow.edgeMix['e-cdn-web'].dynamic).toBeCloseTo(120);
    s.edges = s.edges.filter((e) => e.id !== 'e-web-db');
    expect(simulateFlow(s, { static: 0, dynamic: 10, junk: 0 }).nodes.web.failRate).toBeCloseTo(1);
  });

  it('absorbs an HTTP flood at the edge when CloudFront is in front', () => {
    const s = createSim(ch3);
    const flow = simulateFlow(s, { static: 0, dynamic: 0, junk: 1000 });
    expect(flow.junkAtEdge).toBeGreaterThan(950);
  });

  it('pages you immediately with CloudWatch, late without it', () => {
    const without = createSim(ch3);
    fireEvent(without, { id: 'x', kind: 'az-outage', az: 'a', duration: 4, debrief: [] });
    expect(without.notices).toHaveLength(0);
    expect(without.scheduled[0].eventId).toBe('complaint:x');

    const withCw = createSim(ch3);
    addNode(withCw, ch3, 'cloudwatch', { x: 0, y: 0 });
    fireEvent(withCw, { id: 'x', kind: 'az-outage', az: 'a', duration: 4, debrief: [] });
    expect(withCw.notices[0].title).toMatch(/ALARM/);
  });

  it('pauses while a notice is waiting', () => {
    const s = createSim(ch3);
    s.notices.push({ id: 'n', title: 't', body: [], tone: 'info' });
    step(s, ch3);
    expect(s.hour).toBe(0);
  });

  it('auto scaling grows with load', () => {
    const s = createSim(viral);
    addNode(s, viral, 'asg', { x: 0, y: 0 });
    const asg = lastNode(s);
    updateConfig(s, asg.id, { minSize: 1, maxSize: 8, size: 'medium' });
    s.last.nodes[asg.id] = { load: 400, capacity: 80, utilization: 1, down: false, throughput: 80, costPerHour: 0 };
    step(s, viral);
    expect(asg.instances).toBe(8);
  });
});

describe('boss strikes', () => {
  /** Breaks the site: no route from customers to anything. */
  function broken() {
    const s = createSim(ch3);
    s.edges = [];
    return s;
  }
  const runUntilNotice = (s: SimState, mission = ch3) => {
    for (let i = 0; i < 100 && !s.notices.length && !s.finished; i++) step(s, mission);
  };

  it(`warns immediately, then strikes after ${BOSS.hoursBeforeStrike} failing hours`, () => {
    const s = broken();
    step(s, ch3);
    expect(s.alerts.at(-1)?.text).toMatch(/Fix it within 3 hours/);
    expect(s.boss.strikes).toBe(0);
    runUntilNotice(s);
    expect(s.hour).toBe(BOSS.hoursBeforeStrike);
    expect(s.boss.strikes).toBe(1);
    expect(s.notices[0].strike).toEqual({ count: 1, max: 3 });
  });

  it('explains what is broken in the strike notice', () => {
    const s = createSim(ch3);
    updateConfig(s, 'web', { size: 'small' });
    s.edges = s.edges.filter((e) => e.id !== 'e-web-db');
    runUntilNotice(s);
    expect(s.notices[0].body.join(' ')).toMatch(/No database connected/);
  });

  it('fires you on the third strike', () => {
    const s = broken();
    for (let i = 0; i < 200 && !s.finished; i++) {
      s.notices = [];
      step(s, ch3);
    }
    expect(s.boss.strikes).toBe(3);
    expect(s.failed).toMatch(/let you go/);
  });

  it('gives a strike for a breach', () => {
    const s = createSim(ch3);
    updateConfig(s, 'web', { sshOpen: true });
    fireEvent(s, { id: 'x', kind: 'ssh-bruteforce', duration: 12 });
    expect(s.boss.strikes).toBe(1);
  });

  it('has no strikes before the boss introduces them', () => {
    const s = createSim(getMission('0-1')!);
    s.edges = [];
    for (let i = 0; i < 24; i++) step(s, getMission('0-1')!);
    expect(s.boss.strikes).toBe(0);
  });
});
