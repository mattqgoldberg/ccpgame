import { useCallback, useState } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { summarizeByDomain } from './content/coverageSummary';

// Placeholder architecture for the Chapter 1 static site, until the simulation engine exists.
const initialNodes: Node[] = [
  { id: 'users', position: { x: 0, y: 120 }, data: { label: '🌍 Customers' }, type: 'input' },
  { id: 'route53', position: { x: 220, y: 40 }, data: { label: 'Route 53' } },
  { id: 'cloudfront', position: { x: 220, y: 200 }, data: { label: 'CloudFront' } },
  { id: 's3', position: { x: 460, y: 200 }, data: { label: 'S3 bucket' }, type: 'output' },
];
const initialEdges: Edge[] = [
  { id: 'users-route53', source: 'users', target: 'route53', animated: true },
  { id: 'users-cloudfront', source: 'users', target: 'cloudfront', animated: true },
];

export function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  const onNodesChange = useCallback((c: NodeChange[]) => setNodes((n) => applyNodeChanges(c, n)), []);
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges((e) => applyEdgeChanges(c, e)), []);
  const onConnect = useCallback((c: Connection) => setEdges((e) => addEdge({ ...c, animated: true }, e)), []);

  return (
    <div className="layout">
      <header className="topbar">
        <strong>Cloud Tycoon</strong>
        <span className="muted">prototype: drag nodes, connect CloudFront → S3</span>
      </header>
      <main className="canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </main>
      <aside className="sidebar">
        <h3>Exam coverage</h3>
        {summarizeByDomain().map((d) => (
          <div key={d.id} className="domain">
            <div>{d.name}</div>
            <div className="muted">
              {d.weight}% of exam · {d.total} topics
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}
