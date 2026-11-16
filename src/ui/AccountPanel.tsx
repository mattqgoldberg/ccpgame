import { useState, type ReactNode } from 'react';
import type { AccountKey } from '../content/tutorial';
import { useFeatures, useGame, useTut } from '../game/store';
import { ACCOUNT_PRICES, COMMIT_COVERAGE, REGION_NAMES, SUPPORT_PLANS, nodeHourlyCost } from '../sim/catalog';
import { regionOf } from '../sim/engine';
import type { Account, Region, SupportPlan } from '../sim/types';
import { money } from './format';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="acct-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

type ToggleKey = { [K in AccountKey]: Account[K] extends boolean ? K : never }[AccountKey];

interface ToggleSpec {
  key: ToggleKey;
  label: string;
  desc: string;
  monthly?: number;
}

const SECURITY: ToggleSpec[] = [
  { key: 'secretsManager', label: 'Secrets Manager', desc: 'Store and rotate database passwords and API keys.', monthly: ACCOUNT_PRICES.secretsManager },
  { key: 'shieldAdvanced', label: 'Shield Advanced', desc: 'DDoS response team 24/7, advanced protection, cost protection.', monthly: ACCOUNT_PRICES.shieldAdvanced },
  { key: 'cloudtrail', label: 'CloudTrail', desc: 'Log every API call: who did what, and when.', monthly: ACCOUNT_PRICES.cloudtrail },
  { key: 'config', label: 'AWS Config', desc: 'Record resource configurations and flag rule violations.', monthly: ACCOUNT_PRICES.config },
  { key: 'guardduty', label: 'GuardDuty', desc: 'Threat detection from logs: stolen keys, crypto-mining, odd behavior.', monthly: ACCOUNT_PRICES.guardduty },
  { key: 'macie', label: 'Macie', desc: 'Find sensitive data (personal, health) in S3.', monthly: ACCOUNT_PRICES.macie },
  { key: 'inspector', label: 'Inspector', desc: 'Scan servers and containers for known vulnerabilities.', monthly: ACCOUNT_PRICES.inspector },
  { key: 'securityHub', label: 'Security Hub', desc: 'One dashboard for all security findings.', monthly: ACCOUNT_PRICES.securityHub },
  { key: 'detective', label: 'Detective', desc: 'Investigate findings back to the root cause.', monthly: ACCOUNT_PRICES.detective },
  { key: 'backup', label: 'AWS Backup', desc: 'Scheduled, versioned backups across services.', monthly: ACCOUNT_PRICES.backup },
];

const GOVERNANCE: ToggleSpec[] = [
  { key: 'ec2Roles', label: 'IAM roles for EC2', desc: 'Servers get temporary credentials instead of stored access keys.' },
  { key: 'organizations', label: 'AWS Organizations', desc: 'Separate accounts (prod, dev) with one consolidated bill.' },
  { key: 'scp', label: 'Service control policy', desc: 'Guardrail: the dev account can’t use expensive instances or other Regions.' },
  { key: 'identityCenter', label: 'IAM Identity Center', desc: 'One sign-in for every person across all accounts.' },
  { key: 'costTags', label: 'Cost allocation tags', desc: 'Split the bill by team and feature.' },
];

function AcctToggle({ spec }: { spec: ToggleSpec }) {
  const value = useGame((s) => s.sim!.account[spec.key]);
  const setAccount = useGame((s) => s.setAccount);
  const tut = useTut(`acct-${spec.key}`);
  return (
    <label className={`acct-row${tut}`} data-tut={`acct-${spec.key}`}>
      <input type="checkbox" checked={value} onChange={(e) => setAccount({ [spec.key]: e.target.checked })} />
      <span>
        <strong>{spec.label}</strong>
        {spec.monthly ? <span className="muted"> · {money(spec.monthly)}/mo</span> : null}
        <span className="acct-desc">{spec.desc}</span>
      </span>
    </label>
  );
}

function DeployButtons() {
  const sim = useGame((s) => s.sim!);
  const deployStack = useGame((s) => s.deployStack);
  const tutEu = useTut('deploy-eu');
  const tutAp = useTut('deploy-ap');
  const deployed = (r: Region) => sim.nodes.some((n) => n.kind === 'elb' && regionOf(n) === r);
  const button = (r: Region, tut: string) => (
    <button key={r} className={`deploy-btn${tut}`} data-tut={`deploy-${r}`} disabled={deployed(r)} onClick={() => deployStack(r)}>
      {deployed(r) ? '✓ ' : 'Deploy to '}
      {REGION_NAMES[r]}
    </button>
  );
  return (
    <Section title="Infrastructure as code (CloudFormation)">
      <p className="small muted">Copy every regional service in us-east-1 (load balancers, servers, databases, queues) to another Region from a template.</p>
      <div className="deploy-row">{button('eu', tutEu)}{button('ap', tutAp)}</div>
    </Section>
  );
}

function SupportPicker() {
  const support = useGame((s) => s.sim!.account.support);
  const setAccount = useGame((s) => s.setAccount);
  const tut = useTut('acct-support');
  return (
    <Section title="Support plan">
      <div className={`support-list${tut}`} data-tut="acct-support">
        {(Object.keys(SUPPORT_PLANS) as SupportPlan[]).map((p) => (
          <label key={p} className={`support-row ${support === p ? 'on' : ''}`}>
            <input type="radio" name="support" checked={support === p} onChange={() => setAccount({ support: p })} />
            <span>
              <strong>{SUPPORT_PLANS[p].label}</strong> <span className="muted">{SUPPORT_PLANS[p].monthly ? `from ${money(SUPPORT_PLANS[p].monthly)}/mo` : 'free'}</span>
              <span className="acct-desc">{SUPPORT_PLANS[p].response}</span>
            </span>
          </label>
        ))}
      </div>
    </Section>
  );
}

function Team() {
  const staff = useGame((s) => s.sim!.account.staff);
  const { updateStaff, removeStaff } = useGame.getState();
  const tut = useTut('acct-staff');
  return (
    <Section title="Team (IAM users)">
      <div className={`team${tut}`} data-tut="acct-staff">
        {staff.length === 0 && <p className="small muted">No staff yet.</p>}
        {staff.map((p) => (
          <div key={p.id} className="person">
            <div className="person-head">
              <strong>{p.name}</strong> <span className="muted small">{p.role}</span>
              <button className="ghost small-btn" onClick={() => removeStaff(p.id)} title="Remove this person’s access">Remove</button>
            </div>
            <div className="person-controls">
              <select value={p.access} onChange={(e) => updateStaff(p.id, { access: e.target.value as 'admin' | 'least' })}>
                <option value="admin">Administrator</option>
                <option value="least">Least privilege</option>
              </select>
              <label><input type="checkbox" checked={p.mfa} onChange={(e) => updateStaff(p.id, { mfa: e.target.checked })} /> MFA</label>
              <label><input type="checkbox" checked={p.keys} onChange={(e) => updateStaff(p.id, { keys: e.target.checked })} /> Access keys</label>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Costs({ show }: { show: (k: AccountKey) => boolean }) {
  const sim = useGame((s) => s.sim!);
  const setAccount = useGame((s) => s.setAccount);
  const a = sim.account;
  const [budget, setBudget] = useState(a.budget ?? 2500);
  const [plan, setPlan] = useState(Math.max(a.savingsPlan, 0.3));
  const tut = { budget: useTut('acct-budget'), plan: useTut('acct-savingsPlan'), db: useTut('acct-reservedDb') };
  const dbHourly = sim.nodes.filter((n) => n.kind === 'rds').reduce((sum, n) => sum + nodeHourlyCost(n), 0);
  if (!show('budget') && !show('savingsPlan') && !show('reservedDb')) return null;
  return (
    <Section title="Cost management">
      {show('budget') && (
        <div className={`acct-row col${tut.budget}`} data-tut="acct-budget">
          <strong>AWS Budgets</strong>
          <span className="acct-desc">Alert me if this month’s forecast goes over:</span>
          <div className="inline">
            $<input type="number" value={budget} min={100} step={100} onChange={(e) => setBudget(Number(e.target.value))} />
            <button onClick={() => setAccount({ budget })}>{a.budget === null ? 'Set budget' : 'Update'}</button>
          </div>
          {a.budget !== null && <span className="small muted">Current budget: {money(a.budget)}/month</span>}
        </div>
      )}
      {show('savingsPlan') && (
        <div className={`acct-row col${tut.plan}`} data-tut="acct-savingsPlan">
          <strong>Compute Savings Plan</strong>
          <span className="acct-desc">Commit to $/hour of compute for a year. Covers up to {money(plan * COMMIT_COVERAGE.savingsPlan)}/h of On-Demand usage. You pay it even if you use less.</span>
          <div className="inline">
            $<input type="number" value={plan} min={a.savingsPlan} step={0.05} onChange={(e) => setPlan(Number(e.target.value))} />/h
            <button onClick={() => setAccount({ savingsPlan: plan })}>Commit</button>
          </div>
          {a.savingsPlan > 0 && <span className="small muted">Committed: {money(a.savingsPlan)}/h</span>}
        </div>
      )}
      {show('reservedDb') && (
        <div className={`acct-row col${tut.db}`} data-tut="acct-reservedDb">
          <strong>Reserved database capacity</strong>
          <span className="acct-desc">A 1-year reservation for the database’s current size: about 40% off, paid whether or not it runs.</span>
          {a.reservedDb > 0 ? (
            <span className="small muted">Reserved: {money(a.reservedDb)}/h</span>
          ) : (
            <button disabled={dbHourly === 0} onClick={() => setAccount({ reservedDb: Math.round(dbHourly * 0.6 * 1000) / 1000 })}>
              Reserve for {money(dbHourly * 0.6)}/h (instead of {money(dbHourly)}/h)
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

export function AccountPanel() {
  const f = useFeatures();
  const show = (k: AccountKey) => f.has(`acct:${k}`);
  const security = SECURITY.filter((t) => show(t.key));
  const governance = GOVERNANCE.filter((t) => show(t.key));
  return (
    <>
      {f.has('cloudformation') && <DeployButtons />}
      {show('support') && <SupportPicker />}
      {show('staff') && <Team />}
      {governance.length > 0 && (
        <Section title="Access and governance">
          {governance.map((t) => <AcctToggle key={t.key} spec={t} />)}
        </Section>
      )}
      {security.length > 0 && (
        <Section title="Security and protection services">
          {security.map((t) => <AcctToggle key={t.key} spec={t} />)}
        </Section>
      )}
      <Costs show={show} />
    </>
  );
}
