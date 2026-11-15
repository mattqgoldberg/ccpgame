import { useState } from 'react';
import { CODEX_TEXT } from '../content/codex';
import { COVERAGE } from '../content/coverage';
import { domainOfTask } from '../content/exam';
import { useGame, type SidebarTab } from '../game/store';
import { advisorChecks } from '../sim/advisor';
import { CATALOG, SIZES } from '../sim/catalog';
import { azName } from '../sim/engine';
import { evaluateObjective } from '../sim/report';
import type { InstanceSize, SimNode } from '../sim/types';
import { clock, compact, money, pct } from './format';
import { TrafficChart } from './TrafficChart';

const TABS: { id: SidebarTab; label: string }[] = [
  { id: 'goals', label: 'Goals' },
  { id: 'inspect', label: 'Inspect' },
  { id: 'bill', label: 'Bill' },
  { id: 'advisor', label: 'Advisor' },
  { id: 'codex', label: 'Codex' },
];

export function Sidebar() {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const sim = useGame((s) => s.sim)!;
  const chapter = useGame((s) => s.chapter)!;
  const advisorIssues = advisorChecks(sim, chapter).filter((c) => c.status === 'error').length;

  return (
    <aside className="sidebar">
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'advisor' && advisorIssues > 0 && <span className="badge">{advisorIssues}</span>}
          </button>
        ))}
      </nav>
      <div className="tab-body">
        {tab === 'goals' && <GoalsPanel />}
        {tab === 'inspect' && <InspectPanel />}
        {tab === 'bill' && <BillPanel />}
        {tab === 'advisor' && <AdvisorPanel />}
        {tab === 'codex' && <CodexPanel />}
      </div>
    </aside>
  );
}

function GoalsPanel() {
  const sim = useGame((s) => s.sim)!;
  const chapter = useGame((s) => s.chapter)!;
  return (
    <>
      <h4>Objectives</h4>
      <ul className="objectives">
        {chapter.objectives.map((o) => {
          const r = evaluateObjective(sim, o);
          return (
            <li key={o.label} className={r.met ? 'met' : ''}>
              <span>{r.met ? '✓' : '○'}</span> {o.label} <span className="muted">({r.value})</span>
            </li>
          );
        })}
      </ul>
      <h4>Requests per second</h4>
      <TrafficChart samples={sim.history.slice(-72)} />
      <h4>Tips</h4>
      <ul className="tips">
        {chapter.tips.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <h4>Alerts</h4>
      {sim.alerts.length === 0 ? (
        <p className="muted small">{chapter.available.includes('cloudwatch') ? 'Add CloudWatch Alarms to get alerts here.' : 'Nothing yet.'}</p>
      ) : (
        <ul className="alerts">
          {sim.alerts.slice(-8).reverse().map((a, i) => (
            <li key={i} className={`tone-${a.tone}`}>
              <span className="muted">{clock(a.hour)}</span> {a.text}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange, danger }: { label: string; checked: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <label className={`toggle ${danger && checked ? 'danger' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" value={value} min={min} max={max} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))} />
    </label>
  );
}

const SIZE_OPTIONS = (Object.keys(SIZES) as InstanceSize[]).map((s) => ({ value: s, label: SIZES[s].label }));
const AZ_OPTIONS = [{ value: 'a' as const, label: azName('a') }, { value: 'b' as const, label: azName('b') }];

function NodeConfigFields({ node }: { node: SimNode }) {
  const configure = useGame((s) => s.configure);
  const c = node.config;
  const set = (patch: Partial<SimNode['config']>) => configure(node.id, patch);
  const sized = node.kind === 'ec2' || node.kind === 'asg' || node.kind === 'rds';
  const zoned = ['ec2', 'asg', 'rds', 'elasticache', 'lightsail'].includes(node.kind);
  const multi = ['asg', 'rds', 'elasticache'].includes(node.kind);
  const server = node.kind === 'ec2' || node.kind === 'asg';
  return (
    <div className="config">
      {sized && (
        <Select
          label={node.kind === 'rds' ? 'Instance class' : 'Instance type'}
          value={c.size ?? 'medium'}
          options={SIZE_OPTIONS.map((o) => ({
            ...o,
            label: `${o.label} · $${(node.kind === 'rds' ? SIZES[o.value].rdsPrice : SIZES[o.value].ec2Price).toFixed(3)}/h`,
          }))}
          onChange={(size) => set({ size })}
        />
      )}
      {multi && (
        <Toggle
          label={node.kind === 'asg' ? 'Spread across multiple AZs' : 'Multi-AZ (standby in another AZ, 2× cost)'}
          checked={!!c.multiAz}
          onChange={(multiAz) => set({ multiAz })}
        />
      )}
      {zoned && !c.multiAz && <Select label="Availability Zone" value={c.az ?? 'a'} options={AZ_OPTIONS} onChange={(az) => set({ az })} />}
      {node.kind === 'asg' && (
        <div className="row">
          <NumberField label="Min" value={c.minSize ?? 1} min={1} max={20} onChange={(minSize) => set({ minSize })} />
          <NumberField label="Max" value={c.maxSize ?? 4} min={1} max={20} onChange={(maxSize) => set({ maxSize })} />
        </div>
      )}
      {server && (
        <Toggle danger label="Security group: allow SSH (port 22) from 0.0.0.0/0" checked={!!c.sshOpen} onChange={(sshOpen) => set({ sshOpen })} />
      )}
    </div>
  );
}

function InspectPanel() {
  const sim = useGame((s) => s.sim)!;
  const selectedId = useGame((s) => s.selectedId);
  const removeNode = useGame((s) => s.removeNode);
  const node = sim.nodes.find((n) => n.id === selectedId);
  if (!node) return <p className="muted">Select a service on the canvas to configure it.</p>;
  const def = CATALOG[node.kind];
  const m = sim.last.nodes[node.id];
  const text = def.codexId ? CODEX_TEXT[def.codexId] : undefined;

  return (
    <>
      <div className="inspect-head">
        <span className={`svc-badge cat-${def.category}`}>{def.short}</span>
        <h4>{def.name}</h4>
      </div>
      {text && <p className="small">{text}</p>}
      {node.kind === 'onprem' && <p className="small">A physical server you own. You paid upfront, and you’re responsible for its power, cooling, repairs, and physical security.</p>}
      {node.kind === 'users' && <p className="small">Your customers around the world. Connect them to the front door of your site.</p>}
      <NodeConfigFields node={node} />
      {m && (
        <dl className="metrics">
          {m.capacity > 0 && (
            <>
              <dt>Load</dt>
              <dd>{compact(m.load)} / {compact(m.capacity)} per s ({pct(m.utilization, 0)})</dd>
            </>
          )}
          <dt>Handled</dt>
          <dd>{compact(m.throughput)} req/s</dd>
          <dt>Cost</dt>
          <dd>{money(m.costPerHour)}/h · {money(m.costPerHour * 720)}/mo</dd>
          {m.down && (<><dt>Status</dt><dd className="tone-danger">{m.downReason}</dd></>)}
          {m.warning && (<><dt>Problem</dt><dd className="tone-warning">{m.warning}</dd></>)}
        </dl>
      )}
      <p className="muted small">{def.pricingHint}</p>
      {node.kind !== 'users' && (
        <button className="danger-btn" onClick={() => removeNode(node.id)}>
          {node.kind === 'onprem' ? 'Sell hardware (30% back)' : 'Delete'}
        </button>
      )}
    </>
  );
}

function BillPanel() {
  const sim = useGame((s) => s.sim)!;
  const chapter = useGame((s) => s.chapter)!;
  const lines = Object.entries(sim.bill).filter(([, v]) => Math.abs(v) >= 0.005).sort((a, b) => b[1] - a[1]);
  const total = lines.reduce((s, [, v]) => s + v, 0);
  return (
    <>
      <h4>Bill so far this month</h4>
      <table className="bill">
        <tbody>
          {lines.map(([k, v]) => (
            <tr key={k} className={v < 0 ? 'credit' : ''}>
              <td>{k}</td>
              <td>{money(v)}</td>
            </tr>
          ))}
          {lines.length === 0 && <tr><td className="muted">Nothing yet.</td><td /></tr>}
        </tbody>
        <tfoot>
          <tr><td>Total spend</td><td>{money(total)}</td></tr>
          <tr><td>Revenue</td><td className="tone-good">{money(sim.stats.revenue)}</td></tr>
          <tr><td>Profit</td><td>{money(sim.stats.revenue - total)}</td></tr>
        </tfoot>
      </table>
      {chapter.freeTier && (
        <p className="small muted">
          Free Tier used: EC2 {Math.round(sim.freeTierHours['ec2-small'] ?? 0)}/750 h · RDS {Math.round(sim.freeTierHours['rds-small'] ?? 0)}/750 h · CloudFront {Math.round(sim.freeTierEdgeGb)}/1,000 GB
        </p>
      )}
      <p className="small muted">Pay-as-you-go: you’re billed for what runs each hour. Data sent out to the internet is charged per GB; data coming in is free.</p>
    </>
  );
}

function AdvisorPanel() {
  const sim = useGame((s) => s.sim)!;
  const chapter = useGame((s) => s.chapter)!;
  const enableRootMfa = useGame((s) => s.enableRootMfa);
  const checks = advisorChecks(sim, chapter);
  if (!checks.length) return <p className="muted">You don’t have an AWS account yet.</p>;
  const icon = { ok: '✅', warning: '⚠️', error: '🛑', locked: '🔒' };
  return (
    <>
      <h4>Trusted Advisor</h4>
      <p className="small muted">Basic Support plan: core security checks only.</p>
      <ul className="checks">
        {checks.map((c) => (
          <li key={c.id} className={`check-${c.status}`}>
            <div>
              {icon[c.status]} <strong>{c.title}</strong> <span className="muted small">{c.category}</span>
            </div>
            <div className="small">{c.detail}</div>
            {c.action === 'enable-mfa' && <button onClick={enableRootMfa}>Enable MFA on root user</button>}
          </li>
        ))}
      </ul>
    </>
  );
}

function CodexPanel() {
  const codex = useGame((s) => s.progress.codex);
  const [open, setOpen] = useState<string | null>(null);
  const entries = COVERAGE.filter((e) => codex.includes(e.id)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <h4>Codex</h4>
      <p className="small muted">{entries.length} of {COVERAGE.length} exam topics discovered</p>
      <ul className="codex">
        {entries.map((e) => (
          <li key={e.id}>
            <button className="codex-title" onClick={() => setOpen(open === e.id ? null : e.id)}>
              {e.name}
            </button>
            {open === e.id && (
              <div className="codex-body">
                <p className="small">{CODEX_TEXT[e.id] ?? e.hook}</p>
                <div className="small muted">On the exam, look for:</div>
                <div className="chips">{e.triggers.map((t) => <span key={t} className="chip">{t}</span>)}</div>
                <div className="small muted">Domain {domainOfTask(e.task).number}: {domainOfTask(e.task).name} · Task {e.task}</div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
