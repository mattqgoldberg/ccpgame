import type { Traffic } from '../sim/types';

export type DotKind = 'dynamic' | 'static' | 'junk' | 'failed';

const TRAVEL_SECONDS = 2;
const MAX_DOTS = 8;

/** Splits `n` dots between request types: failures first, then the traffic mix. */
export function dotKinds(flow: number, mix: Traffic | undefined, failRate: number): DotKind[] {
  const n = Math.min(MAX_DOTS, Math.round(Math.log2(1 + flow)));
  if (n === 0) return [];
  const failed = Math.min(n, Math.round(n * failRate));
  const rest = n - failed;
  const total = mix ? mix.static + mix.dynamic + mix.junk : 0;
  const junk = total ? Math.round((rest * mix!.junk) / total) : 0;
  const statics = total ? Math.round(((rest - junk) * mix!.static) / Math.max(1e-9, mix!.static + mix!.dynamic)) : 0;
  const kinds: DotKind[] = [
    ...Array<DotKind>(junk).fill('junk'),
    ...Array<DotKind>(statics).fill('static'),
    ...Array<DotKind>(Math.max(0, rest - junk - statics)).fill('dynamic'),
  ];
  // Scatter failures through the stream instead of bunching them together.
  for (let i = 0; i < failed; i++) kinds.splice(Math.round(((i + 0.5) * (kinds.length + 1)) / failed), 0, 'failed');
  return kinds.slice(0, n);
}

/** Dots that travel along a connection's path. Phase is tied to the clock, so dots don't jump when the count changes. */
export function RequestDots({ path, kinds }: { path: string; kinds: DotKind[] }) {
  const n = kinds.length;
  return (
    <g className="request-dots" pointerEvents="none">
      {kinds.map((kind, i) => {
        const begin = `${-((i * TRAVEL_SECONDS) / n)}s`;
        return (
          <circle key={`${i}-${kind}`} r={5} className={`dot dot-${kind}`}>
            <animateMotion dur={`${TRAVEL_SECONDS}s`} repeatCount="indefinite" begin={begin} path={path} />
            {kind === 'failed' && (
              <>
                <animate attributeName="r" values="5;5;11;0" keyTimes="0;0.82;0.92;1" dur={`${TRAVEL_SECONDS}s`} repeatCount="indefinite" begin={begin} />
                <animate attributeName="opacity" values="1;1;0.6;0" keyTimes="0;0.82;0.92;1" dur={`${TRAVEL_SECONDS}s`} repeatCount="indefinite" begin={begin} />
              </>
            )}
          </circle>
        );
      })}
    </g>
  );
}

export function DotLegend() {
  return (
    <div className="dot-legend">
      <span><i className="dot-swatch dot-dynamic" />page</span>
      <span><i className="dot-swatch dot-static" />file</span>
      <span><i className="dot-swatch dot-failed" />failing</span>
      <span><i className="dot-swatch dot-junk" />attack</span>
    </div>
  );
}
