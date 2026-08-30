/**
 * Схематичный вид: коробки в той раскладке, в какой встанет форма.
 *
 * Второй вид одного редактора, а не второй редактор: сеанс, выделение, история и команды
 * у него общие с деревом строк ({@link './Canvas'}) — меняется только то, как показана
 * модель и что можно показать мышью.
 *
 * ## Зачем он, если дерево уже есть
 *
 * Дерево отвечает на вопрос «что вложено во что», схема — на вопрос «как это встанет».
 * Второй вопрос дороже проверять в превью: там правка требует возврата к дереву, а здесь
 * колонку двигают там же, где её видят. Отсюда и главная возможность вида: у коробки есть
 * левый и правый край, поэтому перетаскиванием выражается «поставить рядом» — то, чего
 * в списке строк выразить нечем ({@link './../schematic-zone'}).
 *
 * ## Ближайшая коробка выигрывает
 *
 * Коробки вложены, и событие мыши всплывает от самой глубокой. Каждый обработчик гасит
 * всплытие, поэтому решение принимает коробка ПОД курсором, а не её предки. Без этого
 * бросок в поле внутри ряда внутри шага считался бы броском в шаг.
 *
 * ## Зона решается до отпускания кнопки
 *
 * Куда встанет груз, считает {@link zoneAt} по геометрии, а допустим ли такой бросок —
 * {@link planSchematicDrop}. Отказ означает отсутствие подсветки: запрет виден заранее,
 * а не в виде «ничего не произошло» после броска.
 *
 * @module plugins/editor-schema/ui/SchematicView
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { ArrowDown, ArrowRight, GripVertical, Wrench } from 'lucide-react';
import { Badge } from '@reformer/ui-kit/badge';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import type { CommandLookup, Diagnostic, QuickFix } from '@/sdk';
import { type NavDir } from '@/lib/form-model/query';
import type { Orientation } from '@/lib/form-model/node-kind';
import { FLIP_COMMAND_ID, type CommandAccess } from '../commands';
import { carriesSchemaNode, DRAG_MIME, type DragSession } from '../drag-session';
import {
  indexNodeDiagnostics,
  nodeFixes,
  nodeProblemTitle,
  type NodeDiagnostics,
} from '../node-diagnostics';
import { indexNodes } from '../node-index';
import { visibleTarget } from '../schematic-nav';
import { planSchematicDrop, type SchematicSpot } from '../schematic-drop';
import { zoneAt, zoneEdge, PERP_ZONES, type SchematicZone } from '../schematic-zone';
import {
  buildSchematic,
  schematicOrder,
  type SchematicBox,
  type SchematicItem,
} from '../schematic-tree';
import { selectModeOf, selectNode, type SelectMode } from '../selection';
import type { NodeId, Translate } from '../host';
import type { SchemaEditorState, SchemaSession } from '../sessions';

export interface SchematicViewProps {
  readonly session: SchemaSession;
  readonly state: SchemaEditorState;
  readonly t: Translate;
  readonly commands: CommandAccess;
  readonly problems?: readonly Diagnostic[];
  /** Перевод кода находки словарём Host — тот же, что у дерева строк. */
  readonly message?: Translate;
  /** Подпись быстрого исправления словарём Host, полным ключом. */
  readonly fixTitle?: Translate;
  readonly drag?: DragSession | null;
  /** Скрывать `$html(div)`-обёртки: от них остаётся раскладка, но не рамка. */
  readonly hideWrappers?: boolean;
}

const NO_PROBLEMS: readonly Diagnostic[] = Object.freeze([]);
const NO_FIXES: readonly QuickFix[] = Object.freeze([]);
const rawCode: Translate = (code) => code;

/** Стрелка → направление навигации домена. Та же таблица, что у дерева строк. */
const ARROW_DIRECTIONS: Readonly<Record<string, NavDir>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Классы линии-указателя у каждого края. Величины динамические, токеном невыразимы. */
const EDGE_CLASS: Readonly<Record<'top' | 'bottom' | 'left' | 'right', string>> = {
  top: '-top-1 right-0 left-0 h-0.5',
  bottom: 'right-0 -bottom-1 left-0 h-0.5',
  left: 'top-0 bottom-0 -left-1 w-0.5',
  right: 'top-0 bottom-0 -right-1 w-0.5',
};

/** Где висит подсказка «ряд»/«столбец» — у того края, к которому метится обёртка. */
const CHIP_CLASS: Readonly<Record<string, string>> = {
  'beside-before': 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2',
  'beside-after': 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2',
  'stack-before': 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
  'stack-after': 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2',
};

function classes(...parts: readonly (string | false | null | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part !== '').join(' ');
}

/**
 * Общее знание всех коробок вида.
 *
 * Контекст, а не пропсы: коробки вложены на произвольную глубину, и протаскивать через
 * каждую дюжину обработчиков значило бы переписывать промежуточные компоненты всякий раз,
 * когда у листа появляется новая возможность.
 */
interface SchematicShared {
  readonly t: Translate;
  readonly selection: readonly NodeId[];
  readonly spot: SchematicSpot | null;
  readonly draggable: boolean;
  readonly problems: ReadonlyMap<NodeId, NodeDiagnostics>;
  readonly message: Translate;
  readonly fixTitle: Translate;
  readonly hasCommand: CommandLookup;
  onSelect(id: NodeId, mode: SelectMode): void;
  onFlip(id: NodeId): void;
  onFix(fix: QuickFix): void;
  onDragStart(event: DragEvent<HTMLElement>, id: NodeId): void;
  onDragEnd(): void;
  onBoxDragOver(event: DragEvent<HTMLElement>, box: SchematicBox): void;
  onBoxDrop(event: DragEvent<HTMLElement>, box: SchematicBox): void;
  onSlotDragOver(event: DragEvent<HTMLElement>, box: SchematicBox): void;
  onSlotDrop(event: DragEvent<HTMLElement>, box: SchematicBox): void;
}

const SchematicContext = createContext<SchematicShared | null>(null);

function useShared(): SchematicShared {
  const shared = useContext(SchematicContext);
  if (shared === null) throw new Error('коробка отрисована вне схематичного вида');
  return shared;
}

export function SchematicView({
  session,
  state,
  t,
  commands,
  problems = NO_PROBLEMS,
  message = rawCode,
  fixTitle = rawCode,
  drag = null,
  hideWrappers = false,
}: SchematicViewProps): ReactElement {
  const [spot, setSpot] = useState<SchematicSpot | null>(null);
  const { model, selection } = state;

  const tree = useMemo(() => buildSchematic(model, { hideWrappers }), [model, hideWrappers]);
  const order = useMemo(() => schematicOrder(tree), [tree]);
  // Множество видимых адресов: по нему навигация пропускает скрытые обёртки, которых
  // на экране нет. Считается из того же порядка — второго ответа на вопрос «что видно» быть
  // не должно.
  const visible = useMemo(() => new Set(order), [order]);
  const byNode = useMemo(() => indexNodeDiagnostics(problems), [problems]);

  const editable = state.syncState === 'synced';
  // Груз читается синхронно в обработчиках, поэтому свежая ссылка нужна без перерисовки.
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const onSelect = useCallback(
    (id: NodeId, mode: SelectMode) => {
      session.setSelection(selectNode(selection, id, mode, order));
    },
    [session, selection, order]
  );

  const onFlip = useCallback(
    (id: NodeId) => {
      // Через команду, а не прямой правкой сеанса: то же действие вызывается из палитры
      // команд и ассистентом, и второй путь к нему разошёлся бы с первым на охранном условии.
      commands.run(FLIP_COMMAND_ID, { nodeId: id });
    },
    [commands]
  );

  const hasCommand = useCallback((commandId: string) => commands.has(commandId), [commands]);

  const onFix = useCallback(
    (fix: QuickFix) => {
      if (!commands.has(fix.commandId)) return;
      commands.run(fix.commandId, fix.args);
    },
    [commands]
  );

  const onDragStart = useCallback(
    (event: DragEvent<HTMLElement>, id: NodeId) => {
      const dragging = dragRef.current;
      if (dragging === null || !editable) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      dragging.begin({ kind: 'node', id });
      event.dataTransfer.setData(DRAG_MIME, id);
      event.dataTransfer.effectAllowed = 'move';
    },
    [editable]
  );

  const onDragEnd = useCallback(() => {
    dragRef.current?.end();
    setSpot(null);
  }, []);

  /** Место броска под курсором — или `null`, если сюда нельзя. */
  const spotUnder = useCallback(
    (event: DragEvent<HTMLElement>, box: SchematicBox, zone?: SchematicZone) => {
      const payload = dragRef.current?.payload() ?? null;
      if (payload === null || !editable) return null;
      const rect = event.currentTarget.getBoundingClientRect();
      const chosen =
        zone ??
        zoneAt({ x: event.clientX, y: event.clientY }, rect, {
          acceptsInside: box.acceptsInside,
          parentOrientation: box.parentOrientation,
          allowPerp: box.canWrap,
        });
      const candidate: SchematicSpot = { target: box.id, zone: chosen };
      return planSchematicDrop(model, payload, candidate) === null ? null : candidate;
    },
    [editable, model]
  );

  const showSpot = useCallback(
    (event: DragEvent<HTMLElement>, box: SchematicBox, zone?: SchematicZone) => {
      if (!carriesSchemaNode(event.dataTransfer.types)) return;
      event.stopPropagation();
      const next = spotUnder(event, box, zone);
      if (next === null) {
        event.dataTransfer.dropEffect = 'none';
        setSpot((current) => (current === null ? current : null));
        return;
      }
      // Без этого браузер бросок не разрешит вовсе — и `drop` не позовётся.
      event.preventDefault();
      event.dataTransfer.dropEffect = dragRef.current?.payload()?.kind === 'new' ? 'copy' : 'move';
      setSpot((current) => (sameSpot(current, next) ? current : next));
    },
    [spotUnder]
  );

  const commitDrop = useCallback(
    (event: DragEvent<HTMLElement>, box: SchematicBox, zone?: SchematicZone) => {
      if (!carriesSchemaNode(event.dataTransfer.types)) return;
      event.preventDefault();
      event.stopPropagation();
      const payload = dragRef.current?.payload() ?? null;
      const target = spotUnder(event, box, zone);
      onDragEnd();
      if (payload === null || target === null) return;
      const op = planSchematicDrop(model, payload, target);
      // Выделение переедет на брошенный узел само: его называет `focus` операции.
      if (op !== null) session.apply(op);
    },
    [model, onDragEnd, session, spotUnder]
  );

  const onBoxDragOver = useCallback(
    (event: DragEvent<HTMLElement>, box: SchematicBox) => {
      showSpot(event, box);
    },
    [showSpot]
  );

  const onBoxDrop = useCallback(
    (event: DragEvent<HTMLElement>, box: SchematicBox) => {
      commitDrop(event, box);
    },
    [commitDrop]
  );

  const onSlotDragOver = useCallback(
    (event: DragEvent<HTMLElement>, box: SchematicBox) => {
      showSpot(event, box, 'into');
    },
    [showSpot]
  );

  const onSlotDrop = useCallback(
    (event: DragEvent<HTMLElement>, box: SchematicBox) => {
      commitDrop(event, box, 'into');
    },
    [commitDrop]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const dir = ARROW_DIRECTIONS[event.key];
      if (dir === undefined) return;
      // Стрелка с Ctrl/Cmd или Alt принадлежит КОМАНДЕ — перемещению и дублированию.
      // То же правило, что у дерева строк: одно нажатие делает одно дело.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const current = selection[selection.length - 1];
      if (current === undefined) return;
      const from = indexNodes(model).find(current);
      if (!from) return;
      // Навигация домена уже axis-aware: в ряду «влево» означает соседа, а не выход наверх.
      // А вот СКРЫТЫЕ обёртки домен не пропускает — он про отрисовку не знает, поэтому шаг
      // повторяется до видимого узла (см. `./../schematic-nav`).
      const id = visibleTarget(model, from.path, dir, visible);
      if (id === null) return;
      event.preventDefault();
      session.setSelection(selectNode(selection, id, event.shiftKey ? 'range' : 'replace', order));
    },
    [model, order, selection, session, visible]
  );

  const shared = useMemo<SchematicShared>(
    () => ({
      t,
      selection,
      spot,
      draggable: drag !== null && editable,
      problems: byNode,
      message,
      fixTitle,
      hasCommand,
      onSelect,
      onFlip,
      onFix,
      onDragStart,
      onDragEnd,
      onBoxDragOver,
      onBoxDrop,
      onSlotDragOver,
      onSlotDrop,
    }),
    [
      t,
      selection,
      spot,
      drag,
      editable,
      byNode,
      message,
      fixTitle,
      hasCommand,
      onSelect,
      onFlip,
      onFix,
      onDragStart,
      onDragEnd,
      onBoxDragOver,
      onBoxDrop,
      onSlotDragOver,
      onSlotDrop,
    ]
  );

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div
        role="tree"
        aria-label={t('schematic.label')}
        data-focus-zone="canvas"
        data-view="schematic"
        tabIndex={0}
        onKeyDown={onKeyDown}
        // Уход курсора за пределы вида гасит подсветку. Проверка «ушёл ли наружу» нужна
        // потому, что `dragleave` прилетает и при переходе между вложенными коробками.
        onDragLeave={(event) => {
          const to = event.relatedTarget;
          if (to instanceof Node && event.currentTarget.contains(to)) return;
          setSpot(null);
        }}
        onDrop={onDragEnd}
        className="min-w-0 p-3 outline-none"
      >
        {tree === null ? null : (
          <SchematicContext.Provider value={shared}>
            <ItemView item={tree} parentOrientation="vertical" />
          </SchematicContext.Provider>
        )}
      </div>
    </ScrollArea>
  );
}

/** Коробка или прозрачная группа — развилка одна, и она здесь. */
function ItemView({
  item,
  parentOrientation,
}: {
  item: SchematicItem;
  parentOrientation: Orientation;
}): ReactElement {
  if (item.shape === 'group') {
    return (
      <div
        className={classes(
          'flex gap-2',
          item.orientation === 'horizontal' ? 'flex-row items-start' : 'flex-col',
          parentOrientation === 'horizontal' && 'min-w-0 flex-1'
        )}
      >
        {item.items.map((child, at) => (
          <ItemView key={keyOf(child, at)} item={child} parentOrientation={item.orientation} />
        ))}
      </div>
    );
  }
  return <BoxView box={item} />;
}

/** Ключ списка: адрес коробки, а у прозрачной группы — её место среди соседей. */
function keyOf(item: SchematicItem, at: number): string {
  return item.shape === 'box' ? item.id : `group:${String(at)}`;
}

function BoxView({ box }: { box: SchematicBox }): ReactElement {
  const shared = useShared();
  const zone = shared.spot?.target === box.id ? shared.spot.zone : null;
  const selected = shared.selection.includes(box.id);
  const active = shared.selection[shared.selection.length - 1] === box.id;
  const perp = zone !== null && PERP_ZONES.has(zone);
  const edge = zone === null ? null : zoneEdge(zone, box.parentOrientation === 'horizontal');
  const problems = shared.problems.get(box.id);
  const fixes = problems === undefined ? NO_FIXES : nodeFixes(problems, shared.hasCommand);
  const horizontal = box.orientation === 'horizontal';

  return (
    <div
      className={classes('relative', box.parentOrientation === 'horizontal' && 'min-w-0 flex-1')}
    >
      {/* Указатели не перехватывают события: иначе `dragover` над линией считался бы уходом
          с коробки, и подсветка мигала бы у самой границы. */}
      {edge !== null && (
        <div
          className={classes(
            'bg-primary pointer-events-none absolute z-10 rounded',
            EDGE_CLASS[edge]
          )}
        />
      )}
      {perp && zone !== null && (
        <div
          className={classes(
            'bg-primary text-primary-foreground pointer-events-none absolute z-20 flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-semibold whitespace-nowrap shadow-sm',
            CHIP_CLASS[zone]
          )}
        >
          {zone === 'stack-before' || zone === 'stack-after' ? (
            <>
              <ArrowDown className="size-2.5" />
              {shared.t('schematic.column')}
            </>
          ) : (
            <>
              <ArrowRight className="size-2.5" />
              {shared.t('schematic.row')}
            </>
          )}
        </div>
      )}
      <div
        role="treeitem"
        aria-selected={selected}
        aria-label={box.title}
        data-node-id={box.id}
        data-drop={zone ?? undefined}
        data-selected={selected || undefined}
        draggable={(shared.draggable && !box.isRoot) || undefined}
        onClick={(event) => {
          // Останов всплытия: щелчок по вложенной коробке выбирает ЕЁ, а не всех предков.
          event.stopPropagation();
          shared.onSelect(box.id, selectModeOf(event));
        }}
        onDragStart={(event) => {
          shared.onDragStart(event, box.id);
        }}
        onDragEnd={shared.onDragEnd}
        onDragOver={(event) => {
          shared.onBoxDragOver(event, box);
        }}
        onDrop={(event) => {
          shared.onBoxDrop(event, box);
        }}
        className={classes(
          'rounded-lg border border-dashed p-2.5 transition-colors',
          box.isRoot ? 'cursor-default' : 'cursor-grab',
          selected
            ? active
              ? 'border-primary bg-primary/5 ring-primary/40 ring-2'
              : 'border-primary bg-primary/5 ring-primary/15 ring-2'
            : 'border-border hover:border-muted-foreground/40',
          (zone === 'into' || perp) && 'border-primary bg-primary/5 ring-primary/40 ring-2'
        )}
      >
        <div className="flex items-center gap-2">
          {!box.isRoot && (
            <GripVertical className="text-muted-foreground/50 size-3.5 select-none" />
          )}
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{box.title}</span>
          {fixes.map((fix) => (
            <button
              key={`${fix.commandId}:${fix.titleKey}`}
              type="button"
              aria-label={shared.fixTitle(fix.titleKey)}
              title={shared.fixTitle(fix.titleKey)}
              data-fix={fix.commandId}
              onClick={(event) => {
                // Щелчок по кнопке чинит находку и НЕ трогает выделение: иначе починка
                // соседа уводила бы курсор с узла, над которым работают.
                event.stopPropagation();
                shared.onFix(fix);
              }}
              className="border-border text-muted-foreground hover:border-primary hover:text-primary flex-none rounded border p-0.5 transition-colors"
            >
              <Wrench className="size-3" />
            </button>
          ))}
          {problems !== undefined && (
            // Подпись родным `title`, а не всплывающим виджетом: подсказка нужна на каждой
            // из десятков коробок, а виджет кита — это подписка и портал на каждую.
            <Badge
              variant={problems.worst === 'error' ? 'destructive' : 'outline'}
              className="flex-none text-[10px]"
              title={nodeProblemTitle(problems, shared.message)}
            >
              {problems.total}
            </Badge>
          )}
          {box.flippable && (
            <button
              type="button"
              aria-label={shared.t('action.flip', {
                axis: shared.t(horizontal ? 'schematic.row' : 'schematic.column'),
              })}
              title={shared.t('action.flip', {
                axis: shared.t(horizontal ? 'schematic.row' : 'schematic.column'),
              })}
              data-flip={box.id}
              onClick={(event) => {
                event.stopPropagation();
                shared.onFlip(box.id);
              }}
              className="border-border text-muted-foreground hover:border-primary hover:text-primary flex-none rounded border p-0.5 transition-colors"
            >
              {horizontal ? <ArrowRight className="size-3" /> : <ArrowDown className="size-3" />}
            </button>
          )}
          {box.binding !== null && (
            <Badge variant="secondary" className="flex-none font-mono text-[10px]">
              {box.binding}
            </Badge>
          )}
          {box.component !== null && (
            <Badge variant="outline" className="flex-none text-[10px]">
              {box.component}
            </Badge>
          )}
        </div>
        {box.slots.map((slot) => (
          <div
            key={slot.kind}
            role="group"
            className={classes(
              'border-border/60 mt-2 flex gap-2 border-dashed',
              slot.orientation === 'horizontal'
                ? 'flex-row items-start border-t pt-3'
                : 'flex-col border-l pl-3'
            )}
          >
            {slot.empty && (
              <div
                onDragOver={(event) => {
                  shared.onSlotDragOver(event, box);
                }}
                onDrop={(event) => {
                  shared.onSlotDrop(event, box);
                }}
                data-empty-slot={slot.kind}
                className={classes(
                  'rounded-md border border-dashed px-2 py-1.5 text-[11px]',
                  zone === 'into'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border/60 text-muted-foreground'
                )}
              >
                {shared.t('schematic.drop-here')}
              </div>
            )}
            {slot.items.map((item, at) => (
              <ItemView key={keyOf(item, at)} item={item} parentOrientation={slot.orientation} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * То же ли это место броска.
 *
 * Нужно затем, чтобы `dragover` — событие, которое браузер шлёт непрерывно, — не перерисовывал
 * весь вид на каждое дрожание мыши.
 */
function sameSpot(a: SchematicSpot | null, b: SchematicSpot | null): boolean {
  if (a === null || b === null) return a === b;
  return a.target === b.target && a.zone === b.zone;
}
