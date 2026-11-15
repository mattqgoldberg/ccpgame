import { useEffect, useState } from 'react';
import { clockAllowed, useGame } from '../game/store';
import type { Mission } from '../content/tutorial';
import type { SimState } from '../sim/types';

type Tone = 'happy' | 'slow' | 'angry' | 'bot';
interface Bubble {
  id: number;
  text: string;
  tone: Tone;
  /** Horizontal jitter so bubbles don't stack exactly. */
  x: number;
}

const LINES: Record<Exclude<Tone, 'happy'>, string[]> & { store: string[]; blog: string[] } = {
  store: ['🛒 Bought a tent!', '🎒 Ordered a backpack', '🥾 New boots, yes!', '⛺ Checkout was quick', '🔦 Got a headlamp', '⭐ Love this store', '🧭 Gift for my dad!', '🧤 Gloves for winter'],
  blog: ['📖 Great hiking guide!', '🏔️ Bookmarked this trail', '📸 Gorgeous photos', '🗺️ Planning my trip now', '👍 Sharing with friends', '🥾 Adding this to my list'],
  slow: ['🐢 So slow…', '⌛ Still loading…', '😴 Spinning wheel again', '🐌 That took forever'],
  angry: ['😡 Page won’t load!', '💥 Error 503?!', '🙄 Checkout failed again', '😤 Is the site down?', '📵 Ordering somewhere else'],
  bot: ['🤖 GET / GET / GET /', '🤖 beep boop', '🤖 flood flood flood'],
};

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

/** What a random customer says right now, based on how the store is doing. */
export function reaction(sim: SimState, mission: Mission): { text: string; tone: Tone } | null {
  const wanted = sim.last.demand.static + sim.last.demand.dynamic;
  if (wanted <= 0) return null;
  // Quieter hours mean fewer comments.
  if (Math.random() > Math.min(1, 0.35 + wanted / 30)) return null;
  if (sim.last.demand.junk > 0 && Math.random() < 0.35) return { text: pick(LINES.bot), tone: 'bot' };
  const failing = 1 - Math.min(1, sim.last.served / wanted);
  const roll = Math.random();
  if (roll < failing * 1.3) return { text: pick(LINES.angry), tone: 'angry' };
  if (sim.last.latencyMs > mission.latencyTargetMs && roll < 0.65) return { text: pick(LINES.slow), tone: 'slow' };
  return { text: pick(mission.traffic.staticShare >= 1 ? LINES.blog : LINES.store), tone: 'happy' };
}

/** Speech bubbles floating up from the Customers node while time runs. */
export function CustomerChatter() {
  const running = useGame((s) => s.speed > 0 && clockAllowed(s) && !s.sim?.notices.length && !s.sim?.finished);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  useEffect(() => {
    if (!running) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const id = setInterval(() => {
      const { sim, mission } = useGame.getState();
      if (!sim || !mission) return;
      const r = reaction(sim, mission);
      if (!r) return;
      const bubble: Bubble = { id: Date.now() + Math.random(), ...r, x: Math.round((Math.random() - 0.5) * 60) };
      setBubbles((bs) => [...bs.slice(-3), bubble]);
      timers.push(setTimeout(() => setBubbles((bs) => bs.filter((b) => b.id !== bubble.id)), 2800));
    }, 1100);
    return () => {
      clearInterval(id);
      timers.forEach(clearTimeout);
    };
  }, [running]);

  return (
    <div className="chatter" aria-hidden>
      {bubbles.map((b) => (
        <div key={b.id} className={`bubble bubble-${b.tone}`} style={{ marginLeft: b.x }}>
          {b.text}
        </div>
      ))}
    </div>
  );
}
