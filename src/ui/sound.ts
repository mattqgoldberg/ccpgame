import { useSyncExternalStore } from 'react';

/** Tiny synthesized sound effects (Web Audio API, no asset files). */

const MUTE_KEY = 'cloud-tycoon:muted';
let ctx: AudioContext | null = null;
let muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
const listeners = new Set<() => void>();

function audio(): AudioContext | null {
  if (muted || typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface Tone {
  freq: number;
  /** Seconds after now. */
  at?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Glide to this frequency over the tone. */
  to?: number;
}

function play(tones: Tone[]) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const t of tones) {
    const start = now + (t.at ?? 0);
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.dur);
    const peak = t.gain ?? 0.12;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.connect(amp).connect(ac.destination);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

export const sfx = {
  /** A service dropped onto the map. */
  place: () => play([{ freq: 520, dur: 0.08, type: 'triangle', gain: 0.1 }, { freq: 780, at: 0.05, dur: 0.1, type: 'triangle', gain: 0.08 }]),
  /** Two services wired together. */
  connect: () => play([{ freq: 440, to: 880, dur: 0.12, type: 'sine', gain: 0.1 }]),
  /** Something deleted. */
  remove: () => play([{ freq: 400, to: 180, dur: 0.14, type: 'triangle', gain: 0.09 }]),
  /** A tutorial task verified. */
  taskDone: () => play([523, 659, 784].map((freq, i) => ({ freq, at: i * 0.07, dur: 0.18, type: 'sine' as const, gain: 0.1 }))),
  /** A neutral message popped up. */
  notice: () => play([{ freq: 660, dur: 0.07, type: 'sine', gain: 0.08 }, { freq: 990, at: 0.06, dur: 0.1, type: 'sine', gain: 0.07 }]),
  /** Good news. */
  good: () => play([{ freq: 784, dur: 0.1, gain: 0.09 }, { freq: 1047, at: 0.08, dur: 0.18, gain: 0.09 }]),
  /** The site started failing, or an alarm went off. */
  alarm: () => play([0, 0.18, 0.36].map((at) => ({ freq: 880, to: 620, at, dur: 0.14, type: 'square' as const, gain: 0.05 }))),
  /** The boss handed out a strike. */
  strike: () => play([{ freq: 180, dur: 0.35, type: 'sawtooth', gain: 0.09 }, { freq: 120, at: 0.18, dur: 0.45, type: 'sawtooth', gain: 0.09 }]),
  /** Mission passed. */
  win: () => play([523, 659, 784, 1047].map((freq, i) => ({ freq, at: i * 0.11, dur: i === 3 ? 0.45 : 0.16, type: 'triangle' as const, gain: 0.1 }))),
  /** Mission failed or fired. */
  lose: () => play([392, 349, 311, 262].map((freq, i) => ({ freq, at: i * 0.18, dur: 0.3, type: 'triangle' as const, gain: 0.1 }))),
  /** Investor money or a correct answer. */
  coin: () => play([{ freq: 988, dur: 0.07, type: 'square', gain: 0.05 }, { freq: 1319, at: 0.07, dur: 0.22, type: 'square', gain: 0.05 }]),
};

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable; mute just won't persist.
  }
  listeners.forEach((l) => l());
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => muted,
  );
}
