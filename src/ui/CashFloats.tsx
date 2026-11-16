import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { money } from './format';

/** Little "+$12" pops from the cash counter as money comes in, so earnings feel tangible. */
export function CashFloats() {
  const hour = useGame((s) => s.sim?.hour ?? 0);
  const [floats, setFloats] = useState<{ id: number; text: string; good: boolean }[]>([]);
  const lastShown = useRef(0);

  useEffect(() => {
    const sim = useGame.getState().sim;
    if (!sim || hour === 0) return;
    const now = Date.now();
    if (now - lastShown.current < 700) return;
    lastShown.current = now;
    const net = sim.last.revenue - sim.last.cost;
    if (Math.abs(net) < 0.5) return;
    const id = now + Math.random();
    setFloats((f) => [...f.slice(-2), { id, text: `${net >= 0 ? '+' : ''}${money(net)}`, good: net >= 0 }]);
    const t = setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1400);
    return () => clearTimeout(t);
  }, [hour]);

  return (
    <div className="cash-floats" aria-hidden>
      {floats.map((f) => <span key={f.id} className={f.good ? 'good' : 'bad'}>{f.text}</span>)}
    </div>
  );
}
