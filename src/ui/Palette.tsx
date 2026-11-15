import { useReactFlow } from '@xyflow/react';
import { useGame } from '../game/store';
import { CATALOG } from '../sim/catalog';
import { DRAG_TYPE } from './Canvas';

export function Palette() {
  const chapter = useGame((s) => s.chapter)!;
  const sim = useGame((s) => s.sim)!;
  const addService = useGame((s) => s.addService);
  const { screenToFlowPosition } = useReactFlow();

  const addAtCenter = (kind: (typeof chapter.available)[number]) => {
    const canvas = document.querySelector('.canvas')?.getBoundingClientRect();
    const jitter = (sim.nextId % 5) * 24;
    const pos = canvas
      ? screenToFlowPosition({ x: canvas.left + canvas.width / 2 - 90 + jitter, y: canvas.top + canvas.height / 2 - 30 + jitter })
      : { x: 300, y: 200 };
    addService(kind, pos);
  };

  return (
    <aside className="palette">
      <h3>{chapter.id === 0 ? 'Supplier' : 'AWS services'}</h3>
      {chapter.available.map((kind) => {
        const def = CATALOG[kind];
        const count = sim.nodes.filter((n) => n.kind === kind).length;
        const atMax = def.maxCount !== undefined && count >= def.maxCount;
        const tooPricey = def.upfrontCost !== undefined && sim.cash < def.upfrontCost;
        return (
          <button
            key={kind}
            className={`palette-item cat-${def.category}`}
            disabled={atMax || tooPricey}
            draggable={!atMax && !tooPricey}
            onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, kind)}
            onClick={() => addAtCenter(kind)}
            title={atMax ? `Limit: ${def.maxCount}` : 'Click or drag onto the canvas'}
          >
            <span className="svc-badge">{def.short}</span>
            <span className="palette-text">
              <span className="palette-name">{def.name}</span>
              <span className="palette-price">{def.pricingHint}</span>
            </span>
          </button>
        );
      })}
      <p className="hint">Drag from a service’s right edge to another’s left edge to send traffic. Select + Backspace deletes.</p>
    </aside>
  );
}
