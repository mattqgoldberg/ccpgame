import { useReactFlow } from '@xyflow/react';
import { servicesIn } from '../content/tutorial';
import { useFeatures, useGame, useTut } from '../game/store';
import { CATALOG } from '../sim/catalog';
import type { ServiceKind } from '../sim/types';
import { DRAG_TYPE } from './Canvas';

export function Palette() {
  const sim = useGame((s) => s.sim)!;
  const addService = useGame((s) => s.addService);
  const kinds = servicesIn(useFeatures());
  const { screenToFlowPosition } = useReactFlow();

  const addAtCenter = (kind: ServiceKind) => {
    const canvas = document.querySelector('.canvas')?.getBoundingClientRect();
    const jitter = (sim.nextId % 5) * 24;
    const pos = canvas
      ? screenToFlowPosition({ x: canvas.left + canvas.width / 2 - 90 + jitter, y: canvas.top + canvas.height / 3 - 30 + jitter })
      : { x: 300, y: 200 };
    addService(kind, pos);
  };

  return (
    <aside className="palette">
      <h3>{kinds.every((k) => k === 'onprem') ? 'Supplier' : 'AWS services'}</h3>
      {kinds.map((kind) => <PaletteItem key={kind} kind={kind} onAdd={() => addAtCenter(kind)} />)}
      <p className="hint">Click a service (or drag it) to add it to the map.</p>
    </aside>
  );
}

function PaletteItem({ kind, onAdd }: { kind: ServiceKind; onAdd: () => void }) {
  const sim = useGame((s) => s.sim)!;
  const tut = useTut(`palette-${kind}`);
  const def = CATALOG[kind];
  const count = sim.nodes.filter((n) => n.kind === kind).length;
  const atMax = def.maxCount !== undefined && count >= def.maxCount;
  const tooPricey = def.upfrontCost !== undefined && sim.cash < def.upfrontCost;
  return (
    <button
      className={`palette-item cat-${def.category}${tut}`}
      data-tut={`palette-${kind}`}
      disabled={atMax || tooPricey}
      draggable={!atMax && !tooPricey}
      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, kind)}
      onClick={onAdd}
      title={atMax ? `You can only have ${def.maxCount}` : tooPricey ? 'Not enough cash' : 'Click or drag onto the map'}
    >
      <span className="svc-badge">{def.short}</span>
      <span className="palette-text">
        <span className="palette-name">{def.name}</span>
        <span className="palette-price">{def.pricingHint}</span>
      </span>
    </button>
  );
}
