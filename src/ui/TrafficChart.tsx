import { useState } from 'react';
import type { HourSample } from '../sim/types';
import { compact, clock } from './format';

const W = 228;
const H = 84;
const PAD = { top: 6, right: 4, bottom: 14, left: 4 };

/** Demand (context, dashed gray) vs requests served (blue). The gap between them is dropped traffic. */
export function TrafficChart({ samples }: { samples: HourSample[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (samples.length < 2) return <div className="chart-empty">Traffic history appears after a few hours.</div>;

  const max = Math.max(1, ...samples.map((s) => s.demand));
  const x = (i: number) => PAD.left + (i / (samples.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const path = (key: 'demand' | 'served') => samples.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join('');
  const h = hover !== null ? samples[hover] : null;

  return (
    <div className="chart">
      <div className="chart-legend">
        <span><i className="swatch demand" />Demand</span>
        <span><i className="swatch served" />Served</span>
      </div>
      <svg
        width={W}
        height={H}
        role="img"
        aria-label="Requests per second: demand versus served, last 72 hours"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - box.left - PAD.left) / (W - PAD.left - PAD.right)) * (samples.length - 1));
          setHover(Math.max(0, Math.min(samples.length - 1, i)));
        }}
      >
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="chart-axis" />
        <path d={path('demand')} className="line-demand" />
        <path d={path('served')} className="line-served" />
        {h && hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} className="chart-crosshair" />
            <circle cx={x(hover)} cy={y(h.served)} r={4} className="dot-served" />
          </>
        )}
        <text x={PAD.left} y={H - 2} className="chart-tick">−72h</text>
        <text x={W - PAD.right} y={H - 2} className="chart-tick" textAnchor="end">now</text>
      </svg>
      <div className="chart-readout">
        {h ? (
          <>
            {clock(h.hour)}: {compact(h.served)}/s served of {compact(h.demand)}/s
          </>
        ) : (
          'Hover to inspect an hour'
        )}
      </div>
    </div>
  );
}
