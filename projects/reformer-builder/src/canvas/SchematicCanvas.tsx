/**
 * Схематичный canvas (L2-wireframe, спека §8/§9): рекурсивно рисует дерево через `childSlots`,
 * с нативным HTML5 drag-and-drop. Источники — палитра (новый узел) и узлы canvas (перемещение).
 * Зоны: before/after (сосед) и into (в контейнер) с индикаторами. Клик выделяет узел.
 *
 * @module reformer-builder/canvas/SchematicCanvas
 */

import { createContext, useContext, useState, type DragEvent } from 'react';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { canAcceptChildren, childSlots, kindOf, pathEquals, type JsonPath } from '../model';
import { editorActions } from '../store';
import { clearDrag, getDrag, setDrag } from '../dnd/drag-state';
import { performDrop, type DropZone } from '../dnd/resolve-drop';
import { cn } from '../lib/cn';
import { nodeLabel, nodeTypeBadge } from './node-display';

interface DropTarget {
  path: JsonPath;
  zone: DropZone;
}
const DndCtx = createContext<{
  drop: DropTarget | null;
  setDrop: (d: DropTarget | null) => void;
  schema: JsonFormSchema;
}>({ drop: null, setDrop: () => {}, schema: { root: { component: '$html(div)' } } });

/** Зона по позиции курсора: контейнер — before/into/after (28/44/28%), лист — before/after (50/50). */
function computeZone(e: DragEvent, node: JsonNode): DropZone {
  const r = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - r.top;
  if (canAcceptChildren(node)) {
    if (y < r.height * 0.28) return 'before';
    if (y > r.height * 0.72) return 'after';
    return 'into';
  }
  return y < r.height / 2 ? 'before' : 'after';
}

function commitDrop(schema: JsonFormSchema, path: JsonPath, zone: DropZone): void {
  const payload = getDrag();
  clearDrag();
  if (!payload) return;
  const res = performDrop(schema, path, zone, payload);
  if (res) editorActions.commit(res);
}

function NodeView({
  node,
  path,
  selectionPath,
}: {
  node: JsonNode;
  path: JsonPath;
  selectionPath: JsonPath | null;
}) {
  const { drop, setDrop, schema } = useContext(DndCtx);
  const isRoot = path.length === 1 && path[0] === 'root';
  const selected = selectionPath != null && pathEquals(path, selectionPath);
  const slots = childSlots(node, path);
  const isLeaf = kindOf(node) === 'field';

  const here = drop && pathEquals(drop.path, path) ? drop.zone : null;

  return (
    <div className="relative">
      {here === 'before' && (
        <div className="pointer-events-none absolute -top-1 right-0 left-0 z-10 h-0.5 rounded bg-primary" />
      )}
      <div
        draggable={!isRoot}
        onClick={(e) => {
          e.stopPropagation();
          editorActions.select(path);
        }}
        onDragStart={(e) => {
          e.stopPropagation();
          setDrag({ kind: 'move', path });
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => setDrop(null)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDrop({ path, zone: computeZone(e, node) });
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const zone = computeZone(e, node);
          setDrop(null);
          commitDrop(schema, path, zone);
        }}
        className={cn(
          'rounded-lg border border-dashed p-2.5 transition-colors',
          isRoot ? 'cursor-default' : 'cursor-grab',
          selected
            ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
            : 'border-border hover:border-muted-foreground/40',
          here === 'into' && 'border-primary bg-primary/5 ring-2 ring-primary/40'
        )}
      >
        <div className="flex items-center gap-2">
          {!isRoot && <span className="text-muted-foreground/50 select-none text-xs">⋮⋮</span>}
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{nodeLabel(node)}</span>
          <span className="flex-none rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[9.5px] font-semibold text-muted-foreground">
            {nodeTypeBadge(node)}
          </span>
        </div>
        {!isLeaf &&
          slots.map((slot) => (
            <div key={slot.kind} className="mt-2 flex flex-col gap-2 border-l border-dashed border-border/60 pl-3">
              {slot.nodes.length === 0 && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDrop({ path, zone: 'into' });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDrop(null);
                    commitDrop(schema, path, 'into');
                  }}
                  className={cn(
                    'rounded-md border border-dashed px-2 py-1.5 text-[11px]',
                    here === 'into'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border/60 text-muted-foreground'
                  )}
                >
                  перетащите компонент сюда
                </div>
              )}
              {slot.nodes.map((child, i) => (
                <NodeView
                  key={i}
                  node={child}
                  path={slot.single ? slot.path : [...slot.path, i]}
                  selectionPath={selectionPath}
                />
              ))}
            </div>
          ))}
      </div>
      {here === 'after' && (
        <div className="pointer-events-none absolute right-0 -bottom-1 left-0 z-10 h-0.5 rounded bg-primary" />
      )}
    </div>
  );
}

export function SchematicCanvas({
  schema,
  selectionPath,
}: {
  schema: JsonFormSchema;
  selectionPath: JsonPath | null;
}) {
  const [drop, setDrop] = useState<DropTarget | null>(null);
  return (
    <DndCtx.Provider value={{ drop, setDrop, schema }}>
      <NodeView node={schema.root} path={['root']} selectionPath={selectionPath} />
    </DndCtx.Provider>
  );
}
