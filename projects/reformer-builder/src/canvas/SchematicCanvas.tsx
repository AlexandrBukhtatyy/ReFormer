/**
 * Схематичный canvas (L2-wireframe, спека §8/§9): рекурсивно рисует дерево через `childSlots`,
 * с нативным HTML5 drag-and-drop. Источники — палитра (новый узел) и узлы canvas (перемещение).
 *
 * Зоны дропа axis-aware: главная ось = ось раскладки РОДИТЕЛЯ цели (`orientationOf`). Вдоль неё —
 * `before`/`into`/`after`; поперёк, у краёв — обёртка цели+брошенного в новый `$html(div)`:
 * в вертикальном родителе `beside-*` (горизонтальный ряд), в горизонтальном `stack-*` (вертикальный
 * столбец) — так строится grid-подобная вложенность. Клик выделяет узел, двойной — прыгает в raw-JSON.
 *
 * @module reformer-builder/canvas/SchematicCanvas
 */

import { createContext, useContext, useState, type DragEvent } from 'react';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import {
  canAcceptChildren,
  childSlots,
  getAt,
  kindOf,
  orientationOf,
  parentNodePath,
  pathEquals,
  type JsonPath,
  type Orientation,
} from '../model';
import { editorActions } from '../store';
import { clearDrag, getDrag, setDrag } from '../dnd/drag-state';
import { performDrop, type DropZone } from '../dnd/resolve-drop';
import { lineOfPath } from '../io/error-path';
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

const PERP_ZONES = new Set<DropZone>([
  'beside-before',
  'beside-after',
  'stack-before',
  'stack-after',
]);

/**
 * Зона по позиции курсора. `parentOrientation` задаёт главную ось (Y для вертикального родителя,
 * X для горизонтального): вдоль неё — before/into/after. `allowPerp` (узел в `children`) включает
 * поперечные края → перпендикулярную обёртку: в вертикальном родителе `beside-*` (создать ряд),
 * в горизонтальном `stack-*` (создать столбец).
 */
function computeZone(
  e: DragEvent,
  node: JsonNode,
  parentOrientation: Orientation,
  allowPerp: boolean
): DropZone {
  const r = e.currentTarget.getBoundingClientRect();
  const rx = (e.clientX - r.left) / r.width;
  const ry = (e.clientY - r.top) / r.height;
  const horizontalParent = parentOrientation === 'horizontal';
  const main = horizontalParent ? rx : ry;
  const cross = horizontalParent ? ry : rx;

  if (allowPerp) {
    if (cross < 0.25) return horizontalParent ? 'stack-before' : 'beside-before';
    if (cross > 0.75) return horizontalParent ? 'stack-after' : 'beside-after';
  }

  if (canAcceptChildren(node)) {
    if (main < 0.28) return 'before';
    if (main > 0.72) return 'after';
    return 'into';
  }
  return main < 0.5 ? 'before' : 'after';
}

/** Класс линии-индикатора у нужного края (edge зависит от зоны и оси родителя). */
function edgeLineClass(zone: DropZone, horizontalParent: boolean): string | null {
  const TOP = '-top-1 right-0 left-0 h-0.5';
  const BOTTOM = 'right-0 -bottom-1 left-0 h-0.5';
  const LEFT = 'top-0 bottom-0 -left-1 w-0.5';
  const RIGHT = 'top-0 bottom-0 -right-1 w-0.5';
  switch (zone) {
    case 'before':
      return horizontalParent ? LEFT : TOP;
    case 'after':
      return horizontalParent ? RIGHT : BOTTOM;
    case 'beside-before':
      return LEFT;
    case 'beside-after':
      return RIGHT;
    case 'stack-before':
      return TOP;
    case 'stack-after':
      return BOTTOM;
    default:
      return null; // into — подсветка бокса, не линия
  }
}

/** Позиция чипа-подсказки у края для перпендикулярных (обёрточных) зон. */
function chipPosClass(zone: DropZone): string {
  switch (zone) {
    case 'beside-before':
      return 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2';
    case 'beside-after':
      return 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2';
    case 'stack-before':
      return 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2';
    case 'stack-after':
      return 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2';
    default:
      return '';
  }
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

  // Ось раскладки родителя определяет геометрию зон; перпендикулярная обёртка («в ряд»/«в столбец»)
  // доступна для любого узла в `children` (в горизонтальном родителе → создаётся вложенный столбец).
  const parentPath = parentNodePath(path);
  const parentNode = parentPath ? (getAt(schema, parentPath) as JsonNode | undefined) : undefined;
  const parentOrientation: Orientation = parentNode ? orientationOf(parentNode) : 'vertical';
  const allowPerp = !isRoot && path[path.length - 2] === 'children';
  // Схематика отражает реальную раскладку: `children` горизонтального контейнера-ряда рисуются в ряд.
  const selfHorizontal = orientationOf(node) === 'horizontal';

  const here = drop && pathEquals(drop.path, path) ? drop.zone : null;
  const isPerp = here != null && PERP_ZONES.has(here);

  // В горизонтальном родителе колонки тянутся на всю ширину поровну (flex-1), а не сжимаются под контент.
  return (
    <div className={cn('relative', parentOrientation === 'horizontal' && 'min-w-0 flex-1')}>
      {here != null && here !== 'into' && (
        <div
          className={cn(
            'pointer-events-none absolute z-10 rounded bg-primary',
            edgeLineClass(here, parentOrientation === 'horizontal')
          )}
        />
      )}
      {isPerp && (
        <div
          className={cn(
            'pointer-events-none absolute z-20 rounded-full bg-primary px-1.5 py-px text-[9px] font-semibold whitespace-nowrap text-primary-foreground shadow-sm',
            chipPosClass(here)
          )}
        >
          {here === 'stack-before' || here === 'stack-after' ? '↕ столбец' : '↔ ряд'}
        </div>
      )}
      <div
        draggable={!isRoot}
        onClick={(e) => {
          e.stopPropagation();
          editorActions.select(path);
        }}
        onDoubleClick={(e) => {
          // Прыжок в raw-JSON на строку узла (панель откроется, если свёрнута).
          e.stopPropagation();
          editorActions.revealRawLine(lineOfPath(schema, [...path]) ?? 1);
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
          setDrop({ path, zone: computeZone(e, node, parentOrientation, allowPerp) });
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const zone = computeZone(e, node, parentOrientation, allowPerp);
          setDrop(null);
          commitDrop(schema, path, zone);
        }}
        className={cn(
          'rounded-lg border border-dashed p-2.5 transition-colors',
          isRoot ? 'cursor-default' : 'cursor-grab',
          selected
            ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
            : 'border-border hover:border-muted-foreground/40',
          (here === 'into' || isPerp) && 'border-primary bg-primary/5 ring-2 ring-primary/40'
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
            <div
              key={slot.kind}
              className={cn(
                'mt-2 flex gap-2 border-dashed border-border/60',
                slot.kind === 'children' && selfHorizontal
                  ? 'flex-row items-start border-t pt-3'
                  : 'flex-col border-l pl-3'
              )}
            >
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
