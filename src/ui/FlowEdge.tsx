import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';
import { useGame, useTut } from '../game/store';
import type { Traffic } from '../sim/types';
import { compact } from './format';
import { RequestDots, dotKinds } from './RequestDots';

export type FlowEdgeData = {
  /** Requests per second on this connection last hour. */
  flow: number;
  /** `edge-<from kind>-<to kind>`, for tutorial highlights. */
  tutKey: string;
  mix?: Traffic;
  /** Share of this traffic failing at the target. */
  failRate: number;
  /** Time is moving, so animate requests. */
  running: boolean;
};

export type FlowRFEdge = Edge<FlowEdgeData, 'flow'>;

export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, deletable, markerEnd, style }: EdgeProps<FlowRFEdge>) {
  const removeEdge = useGame((s) => s.removeEdge);
  const tut = useTut(data?.tutKey ?? '');
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const flow = data?.flow ?? 0;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={28}
        style={{ ...style, stroke: tut ? '#facc15' : selected ? '#818cf8' : undefined }}
        className={tut ? 'edge-tut' : undefined}
      />
      {data?.running && <RequestDots path={path} kinds={dotKinds(flow, data.mix, data.failRate)} />}

      <EdgeLabelRenderer>
        <div className="edge-label nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
          {flow > 0.05 && <span className="edge-flow">{compact(flow)}/s</span>}
          {selected && deletable && (
            <button className="edge-delete" title="Delete connection" onClick={() => removeEdge(id)}>
              ✕
            </button>
          )}
          {tut && !selected && <span className="edge-pointer">click this line</span>}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
