import { useCallback, useMemo, type DragEvent } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type IsValidConnection,
  type NodeChange,
} from '@xyflow/react';
import { clockAllowed, useFeatures, useGame } from '../game/store';
import { canConnect } from '../sim/catalog';
import type { ServiceKind } from '../sim/types';
import { FlowEdge, type FlowRFEdge } from './FlowEdge';
import { ServiceNode, type ServiceRFNode } from './ServiceNode';

const nodeTypes = { service: ServiceNode };
const edgeTypes = { flow: FlowEdge };
export const DRAG_TYPE = 'application/x-cloud-service';

export function Canvas() {
  const sim = useGame((s) => s.sim)!;
  const selectedId = useGame((s) => s.selectedId);
  const selectedEdgeId = useGame((s) => s.selectedEdgeId);
  const running = useGame((s) => s.speed > 0 && clockAllowed(s) && !s.sim?.notices.length && !s.sim?.finished);
  const { moveNode, select, selectEdge, removeNode, removeEdge, connect, addService } = useGame.getState();
  const { screenToFlowPosition } = useReactFlow();
  const features = useFeatures();
  const canConnectNodes = features.has('connect');
  const canDelete = features.has('delete');
  const showSsh = features.has('config-ssh');

  const nodes = useMemo<ServiceRFNode[]>(
    () =>
      sim.nodes.map((n) => ({
        id: n.id,
        type: 'service',
        position: n.position,
        selected: n.id === selectedId,
        deletable: canDelete && n.kind !== 'users',
        data: {
          node: n,
          metrics: sim.last.nodes[n.id],
          demand: n.kind === 'users' ? sim.last.demand : undefined,
          connectable: canConnectNodes,
          showSsh,
        },
      })),
    [sim, selectedId, canDelete, canConnectNodes, showSsh],
  );

  const edges = useMemo<FlowRFEdge[]>(() => {
    const kind = (id: string) => sim.nodes.find((n) => n.id === id)?.kind;
    return sim.edges.map((e) => {
      const flow = sim.last.edges[e.id] ?? 0;
      return {
        id: e.id,
        type: 'flow',
        source: e.source,
        target: e.target,
        selected: e.id === selectedEdgeId,
        deletable: canDelete,
        data: {
          flow,
          tutKey: `edge-${kind(e.source)}-${kind(e.target)}`,
          mix: sim.last.edgeMix?.[e.id],
          failRate: sim.last.nodes[e.target]?.failRate ?? 0,
          running,
        },
        style: { strokeWidth: 2 + Math.min(4, Math.log10(1 + flow)) },
        markerEnd: { type: MarkerType.ArrowClosed },
      };
    });
  }, [sim, canDelete, selectedEdgeId, running]);

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
    (changes: EdgeChange<FlowRFEdge>[]) => {
      for (const c of changes) {
        if (c.type === 'remove') removeEdge(c.id);
        else if (c.type === 'select' && c.selected) selectEdge(c.id);
      }
    },
    [removeEdge, selectEdge],
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
      edgeTypes={edgeTypes}
      onEdgeClick={(_, e) => selectEdge(e.id)}
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
      deleteKeyCode={canDelete ? ['Backspace', 'Delete'] : null}
      elementsSelectable
      nodesConnectable={canConnectNodes}
      edgesFocusable={canDelete}
      colorMode="dark"
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
    >
      <Background gap={24} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
