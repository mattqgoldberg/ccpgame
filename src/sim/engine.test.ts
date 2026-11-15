import { describe, expect, it } from 'vitest';
import { getChapter } from '../content/campaign';
import { addNode, connect, createSim, fireEvent, simulateFlow, step, updateConfig } from './engine';
import type { SimState } from './types';

const ch3 = getChapter(3)!;
const ch0 = getChapter(0)!;

function lastNode(s: SimState) {
  return s.nodes[s.nodes.length - 1];
}

describe('engine', () => {
  it('rejects connections that make no sense', () => {
    const s = createSim(ch3);
    expect(connect(s, 'bucket', 'web')).toMatch(/can’t send traffic/);
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
    const s = createSim(ch3);
    addNode(s, ch3, 'asg', { x: 0, y: 0 });
    const asg = lastNode(s);
    updateConfig(s, asg.id, { minSize: 1, maxSize: 8, size: 'medium' });
    s.last.nodes[asg.id] = { load: 400, capacity: 80, utilization: 1, down: false, throughput: 80, costPerHour: 0 };
    step(s, ch3);
    expect(asg.instances).toBe(8);
  });
});
