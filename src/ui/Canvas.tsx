import { useCallback, useMemo, type DragEvent } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type IsValidConnection,
  type NodeChange,
} from '@xyflow/react';
import { useGame } from '../game/store';
import { canConnect } from '../sim/catalog';
import type { ServiceKind } from '../sim/types';
import { compact } from './format';
import { ServiceNode, type ServiceRFNode } from './ServiceNode';

const nodeTypes = { service: ServiceNode };
export const DRAG_TYPE = 'application/x-cloud-service';

export function Canvas() {
  const sim = useGame((s) => s.sim)!;
  const selectedId = useGame((s) => s.selectedId);
  const { moveNode, select, removeNode, removeEdge, connect, addService } = useGame.getState();
  const { screenToFlowPosition } = useReactFlow();

  const nodes = useMemo<ServiceRFNode[]>(
    () =>
      sim.nodes.map((n) => ({
        id: n.id,
        type: 'service',
        position: n.position,
        selected: n.id === selectedId,
        deletable: n.kind !== 'users',
        data: { node: n, metrics: sim.last.nodes[n.id], demand: n.kind === 'users' ? sim.last.demand : undefined },
      })),
    [sim, selectedId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      sim.edges.map((e) => {
        const flow = sim.last.edges[e.id] ?? 0;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          animated: flow > 0.05,
          label: flow > 0.05 ? `${compact(flow)}/s` : undefined,
          style: { strokeWidth: 1.5 + Math.min(4, Math.log10(1 + flow)) },
          markerEnd: { type: MarkerType.ArrowClosed },
        };
      }),
    [sim],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<ServiceRFNode>[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position) moveNode(c.id, c.position);
        else if (c.type === 'select' && c.selected) select(c.id);
        else if (c.type === 'remove') removeNode(c.id);
      }
    },
    [moveNode, select, removeNode],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const c of changes) if (c.type === 'remove') removeEdge(c.id);
    },
    [removeEdge],
  );

  const onConnect = useCallback((c: Connection) => connect(c.source, c.target), [connect]);

  const isValidConnection: IsValidConnection = useCallback(
    (c) => {
      const kinds = useGame.getState().sim!.nodes;
      const a = kinds.find((n) => n.id === c.source);
      const b = kinds.find((n) => n.id === c.target);
      return !!a && !!b && canConnect(a.kind, b.kind);
    },
    [],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(DRAG_TYPE) as ServiceKind;
      if (kind) addService(kind, screenToFlowPosition({ x: e.clientX - 90, y: e.clientY - 30 }));
    },
    [addService, screenToFlowPosition],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onPaneClick={() => select(null)}
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      deleteKeyCode={['Backspace', 'Delete']}
      colorMode="dark"
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
    >
      <Background gap={24} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
