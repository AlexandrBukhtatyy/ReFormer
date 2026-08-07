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
import { ArrowDown, ArrowRight, GripVertical } from 'lucide-react';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import {
  childSlots,
  flipDirection,
  getAt,
  isDivContainer,
  kindOf,
  orientationOf,
  parentNodePath,
  pathEquals,
  type JsonPath,
  type Orientation,
} from '../model';
import { editorActions, useUi } from '../store';
import { setDrag } from '../dnd/drag-state';
import { commitDrop } from '../dnd/commit-drop';
import { computeZone, PERP_ZONES, zoneEdge, type ZoneEdge } from '../dnd/compute-zone';
import type { DropZone } from '../dnd/resolve-drop';
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
  hideDivWrappers: boolean;
  selectionPaths: JsonPath[];
}>({
  drop: null,
  setDrop: () => {},
  schema: { root: { component: '$html(div)' } },
  hideDivWrappers: false,
  selectionPaths: [],
});

/** Зона по позиции курсора события (геометрия — общая {@link computeZone}). */
function zoneAt(
  e: DragEvent,
  node: JsonNode,
  parentOrientation: Orientation,
  allowPerp: boolean
): DropZone {
  const rect = e.currentTarget.getBoundingClientRect();
  return computeZone({ x: e.clientX, y: e.clientY }, rect, node, parentOrientation, allowPerp);
}

/** Класс линии-индикатора у нужного края (край — из общей {@link zoneEdge}). */
const EDGE_CLASS: Record<Exclude<ZoneEdge, null>, string> = {
  top: '-top-1 right-0 left-0 h-0.5',
  bottom: 'right-0 -bottom-1 left-0 h-0.5',
  left: 'top-0 bottom-0 -left-1 w-0.5',
  right: 'top-0 bottom-0 -right-1 w-0.5',
};

function edgeLineClass(zone: DropZone, horizontalParent: boolean): string | null {
  const edge = zoneEdge(zone, horizontalParent);
  return edge ? EDGE_CLASS[edge] : null;
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

function NodeView({
  node,
  path,
  selectionPath,
}: {
  node: JsonNode;
  path: JsonPath;
  selectionPath: JsonPath | null;
}) {
  const { drop, setDrop, schema, hideDivWrappers, selectionPaths } = useContext(DndCtx);
  const isRoot = path.length === 1 && path[0] === 'root';
  const isActive = selectionPath != null && pathEquals(path, selectionPath);
  const selected = isActive || selectionPaths.some((p) => pathEquals(p, path));
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

  // Настройка «скрывать div-контейнеры»: рисуем детей div напрямую с его раскладкой, без бокса/шапки.
  if (hideDivWrappers && !isRoot && isDivContainer(node)) {
    const kids = slots.find((s) => s.kind === 'children');
    if (!kids) return null;
    return (
      <div
        className={cn(
          'flex gap-2',
          selfHorizontal ? 'flex-row items-start' : 'flex-col',
          parentOrientation === 'horizontal' && 'min-w-0 flex-1'
        )}
      >
        {kids.entries.map((entry) => (
          <NodeView
            key={entry.index}
            node={entry.node}
            path={[...kids.path, entry.index]}
            selectionPath={selectionPath}
          />
        ))}
      </div>
    );
  }

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
            'pointer-events-none absolute z-20 flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-px text-[9px] font-semibold whitespace-nowrap text-primary-foreground shadow-sm',
            chipPosClass(here)
          )}
        >
          {here === 'stack-before' || here === 'stack-after' ? (
            <>
              <ArrowDown className="size-2.5" />
              столбец
            </>
          ) : (
            <>
              <ArrowRight className="size-2.5" />
              ряд
            </>
          )}
        </div>
      )}
      <div
        draggable={!isRoot}
        onClick={(e) => {
          e.stopPropagation();
          if (e.shiftKey) editorActions.extendSelectionTo(path);
          else if (e.metaKey || e.ctrlKey) editorActions.toggleSelectionAt(path);
          else editorActions.select(path);
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
          setDrop({ path, zone: zoneAt(e, node, parentOrientation, allowPerp) });
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const zone = zoneAt(e, node, parentOrientation, allowPerp);
          setDrop(null);
          commitDrop(schema, path, zone);
        }}
        className={cn(
          'rounded-lg border border-dashed p-2.5 transition-colors',
          isRoot ? 'cursor-default' : 'cursor-grab',
          selected
            ? isActive
              ? 'border-primary bg-primary/5 ring-2 ring-primary/40'
              : 'border-primary bg-primary/5 ring-2 ring-primary/15'
            : 'border-border hover:border-muted-foreground/40',
          (here === 'into' || isPerp) && 'border-primary bg-primary/5 ring-2 ring-primary/40'
        )}
      >
        <div className="flex items-center gap-2">
          {!isRoot && <GripVertical className="h-3.5 w-3.5 select-none text-muted-foreground/50" />}
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
            {nodeLabel(node)}
          </span>
          {isDivContainer(node) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                editorActions.apply((s) => flipDirection(s, path));
              }}
              title={`Направление: ${selfHorizontal ? 'ряд' : 'столбец'} (клик — перевернуть)`}
              className="flex-none rounded border border-border p-0.5 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {selfHorizontal ? (
                <ArrowRight className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )}
            </button>
          )}
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
              {slot.entries.length === 0 && (
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
              {slot.entries.map((entry) => (
                <NodeView
                  key={entry.index}
                  node={entry.node}
                  path={slot.single ? slot.path : [...slot.path, entry.index]}
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
  selectionPaths = [],
}: {
  schema: JsonFormSchema;
  selectionPath: JsonPath | null;
  selectionPaths?: JsonPath[];
}) {
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const hideDivWrappers = useUi().hideDivWrappers;
  return (
    <DndCtx.Provider value={{ drop, setDrop, schema, hideDivWrappers, selectionPaths }}>
      <NodeView node={schema.root} path={['root']} selectionPath={selectionPath} />
    </DndCtx.Provider>
  );
}
