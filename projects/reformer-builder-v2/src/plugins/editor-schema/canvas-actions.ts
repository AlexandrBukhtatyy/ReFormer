/**
 * Как показан документ схемы: дерево, схема или исходник — тремя кнопками в полосе вкладок.
 *
 * ## Почему это уехало из канваса
 *
 * Раньше вид конструктора переключала своя панель инструментов над деревом, и панель
 * существовала ровно ради неё: структурные действия ушли под клавиши, а две кнопки отнимали
 * у схемы полосу высоты на каждой вкладке. Рядом, в полосе вкладок, уже стоял переключатель
 * «конструктор / исходник» — то есть место, где отвечают на вопрос «чем показан этот
 * документ», — и вид конструктора отвечает на тот же вопрос уровнем ниже. Два переключателя
 * вида в двух местах экрана были расхождением, а не разделением обязанностей.
 *
 * ## Одно измерение из трёх положений, а не два измерения
 *
 * Вид конструктора (дерево / схема / форма) и режим документа (конструктор / исходник) — разные
 * состояния и хранятся раздельно ({@link './canvas-prefs'} и {@link './view-mode'}): первое
 * общее для всех вкладок, второе своё у каждой. Но СПРАШИВАЮТ про них одно и то же — «как
 * мне сейчас смотреть на этот файл», — и человеку это один переключатель. Поэтому кнопки
 * стоят одним набором, видны сразу все, и нажатая ровно одна.
 *
 * Положений четыре, но два из них условны: исходник существует, только если композиция дала
 * редактор кода, а живая форма — только если дала поверхность превью. Отсутствующее положение
 * не гаснет, а не рисуется вовсе: серая кнопка без объяснения хуже её отсутствия.
 *
 * Отсюда же виды конструктора умеют возвращать из исходника: человек нажимает их, чтобы
 * оказаться в этом виде, а не чтобы «задать предпочтение на будущее». Кнопка, которая
 * запомнила бы вид, не показав его, обещала бы не то.
 *
 * ## Все три видны всегда, а не «половина пары»
 *
 * Тумблер из пары взаимоисключающих пунктов (как у markdown) отвечает на вопрос «куда
 * перейти» и потому показывает только противоположное положение. Здесь вопрос другой —
 * «где я нахожусь», и его задают, глядя на полосу: три положения на виду отвечают на него
 * без нажатия, а исчезающая кнопка заставляла бы вспоминать состав переключателя.
 *
 * @module plugins/editor-schema/canvas-actions
 */

import { createElement, type ReactElement } from 'react';
import { Braces, LayoutPanelTop, List, SquareMousePointer } from 'lucide-react';
import {
  argsOfEditor,
  EDITOR_TITLE_MENU,
  whenEditor,
  type CommandContribution,
  type Disposable,
  type MenuContribution,
  type ResourceId,
} from '@/sdk';
import type { CanvasPrefs, CanvasView } from './canvas-prefs';
import { documentIdOf } from './view-actions';
import type { SchemaViewStore } from './view-mode';

/** Показать конструктор деревом. */
export const SHOW_TREE_COMMAND_ID = 'schema.canvas.showTree';
/** Показать конструктор схемой. */
export const SHOW_SCHEMATIC_COMMAND_ID = 'schema.canvas.showSchematic';
/** Показать конструктор живой формой. */
export const SHOW_LIVE_COMMAND_ID = 'schema.canvas.showLive';
/** Показать исходный JSON. */
export const SHOW_CODE_COMMAND_ID = 'schema.canvas.showCode';

/** Значки положений. Обёртки ради размера: контракт объявляет значок компонентом без пропсов. */
const TreeIcon = (): ReactElement => createElement(List, { className: 'size-4' });
const SchematicIcon = (): ReactElement => createElement(LayoutPanelTop, { className: 'size-4' });
// Не `MonitorPlay`: им помечена панель превью, и один значок в двух местах означал бы,
// что это одно и то же — а это вид конструктора, а не панель.
const LiveIcon = (): ReactElement => createElement(SquareMousePointer, { className: 'size-4' });
const CodeIcon = (): ReactElement => createElement(Braces, { className: 'size-4' });

export interface CanvasActionDeps {
  /** Предпочтения канваса: дерево или схема. */
  readonly prefs: CanvasPrefs;
  /**
   * Режимы документов: конструктор или исходник. `null` — режимов нет вовсе (тест, встраивание),
   * и тогда переключатель работает двумя положениями, а третьего не существует.
   */
  readonly views: SchemaViewStore | null;
  /**
   * Схема ли документ. Спрашивается у СЕАНСОВ, поэтому годится только там, где сеанс
   * заведомо есть, — у команд, которые зовут из палитры по активной вкладке.
   */
  readonly isSchema: (id: ResourceId) => boolean;
  /**
   * Идентификатор редактора схемы — по нему кнопки узнают свою вкладку.
   *
   * Не через {@link CanvasActionDeps.isSchema}, и это не мелочь: сеанс заводит ЭФФЕКТ тела
   * редактора, то есть уже после того, как полоса вкладок отрисована, а перерисовать её
   * после этого нечем — сигналы вклада привязаны к предпочтениям и режимам, а не к составу
   * сеансов. Именно поэтому на только что открытом файле кнопок не было до переключения
   * вкладок. Редактор же известен синхронно: его выбирает оболочка ещё до отрисовки ряда
   * и приносит в цели.
   */
  readonly editorId: string;
  /** Есть ли чем показать исходник. Без редактора кода этого положения нет. */
  readonly hasTextEditor: () => boolean;
  /**
   * Есть ли чем нарисовать живую форму.
   *
   * Спрашивается на каждую отрисовку, а не запоминается: поверхности вносятся вкладами, и
   * плагин превью можно выключить, пока вкладка открыта.
   */
  readonly hasLive: () => boolean;
  /** Активный документ — для команд, которые зовут из палитры, без цели щелчка. */
  readonly activeDocument: () => ResourceId | null;
}

/** Положение переключателя: два вида конструктора и исходник. */
type ViewMode = CanvasView | 'code';

/**
 * Есть ли это положение вообще.
 *
 * Два из четырёх условны, и оба спрашиваются одинаково — иначе правило «когда рисовать кнопку»
 * и правило «когда команда доступна» разошлись бы, а расходятся они молча: кнопка есть,
 * нажатие не делает ничего.
 */
function available(deps: CanvasActionDeps, mode: ViewMode): boolean {
  if (mode === 'code') return deps.hasTextEditor();
  if (mode === 'live') return deps.hasLive();
  return true;
}

/** Схема ли это и та ли вкладка. `null` означает «спросили не про документ». */
function onSchema(deps: CanvasActionDeps, id: ResourceId | null): id is ResourceId {
  return id !== null && deps.isSchema(id);
}

/** В каком положении переключатель для этого документа. */
function modeOf(deps: CanvasActionDeps, id: ResourceId): ViewMode {
  if ((deps.views?.get(id) ?? 'design') === 'code') return 'code';
  return deps.prefs.view();
}

/**
 * Перевести документ в положение; `null` — цели нет, и делать нечего.
 *
 * Дерево и схема ВОЗВРАЩАЮТ из исходника — иначе нажатие на видимую кнопку меняло бы только
 * невидимое предпочтение, то есть выглядело бы как отказ.
 */
function applyMode(deps: CanvasActionDeps, id: ResourceId | null, mode: ViewMode): boolean {
  if (id === null) return false;
  if (mode === 'code') {
    if (!deps.hasTextEditor()) return false;
    deps.views?.set(id, 'code');
    return true;
  }
  // Отказ, а не молчаливый переход в дерево: человек просил форму, и подмена вида была бы
  // ответом на другой вопрос.
  if (mode === 'live' && !deps.hasLive()) return false;
  deps.views?.set(id, 'design');
  deps.prefs.setView(mode);
  return true;
}

/**
 * Команды переключателя — по одной на положение.
 *
 * Три команды, а не одна с аргументом: в палитре «Показать деревом», «Показать схемой»
 * и «Показать исходник» — это три разных ответа на «покажи иначе», а «задать вид»
 * с параметром не называется ни одним из них. Тот же довод, что у команд перемещения
 * ({@link './commands'}).
 *
 * Идемпотентность намеренная: команда положения, в котором уже находишься, доступна и
 * ничего не меняет — как и кнопка, по которой нажали второй раз. Гасить её значило бы
 * отвечать «нельзя» на просьбу оставить как есть.
 */
export function canvasViewCommands(deps: CanvasActionDeps): readonly CommandContribution[] {
  /**
   * Документ, к которому относится вызов.
   *
   * Названный аргументом — берётся как есть: его дала кнопка, уже отобранная по редактору
   * цели. Активная же вкладка — догадка, и её приходится проверять: команду зовут и из
   * палитры, где активным мог оказаться чужой документ.
   */
  const target = (args: unknown): ResourceId | null => {
    const named = documentIdOf(args);
    if (named !== null) return named;
    const active = deps.activeDocument();
    return onSchema(deps, active) ? active : null;
  };

  const command = (id: string, titleKey: string, mode: ViewMode): CommandContribution => ({
    id,
    titleKey,
    enabled: () => onSchema(deps, deps.activeDocument()) && available(deps, mode),
    run: (args) => applyMode(deps, target(args), mode),
  });

  return [
    command(SHOW_TREE_COMMAND_ID, 'command.canvas.tree', 'tree'),
    command(SHOW_SCHEMATIC_COMMAND_ID, 'command.canvas.schematic', 'schematic'),
    command(SHOW_LIVE_COMMAND_ID, 'command.canvas.live', 'live'),
    command(SHOW_CODE_COMMAND_ID, 'command.showCode', 'code'),
  ];
}

/**
 * Кнопки переключателя в полосе вкладок.
 *
 * Сигнал перерисовки идёт от ОБОИХ хранилищ: нажатое положение складывается из вида
 * конструктора и режима документа. Подписка на одно из них оставила бы кнопку в положении,
 * в котором её отрисовали, — тот самый дефект, ради которого `onDidChange` и появился.
 */
export function canvasViewMenuItems(
  deps: CanvasActionDeps
): readonly { readonly id: string; readonly value: MenuContribution }[] {
  const { prefs, views } = deps;

  const onSchemaTab = whenEditor((target) => target.editorId === deps.editorId);
  const args = argsOfEditor((target) => ({ documentId: target.documentId }));

  const signal = (cb: () => void): Disposable => {
    const subscriptions = [prefs.subscribe(cb), views?.subscribe(cb)];
    return {
      dispose: () => {
        for (const subscription of subscriptions) subscription?.dispose();
      },
    };
  };

  /** Общее у трёх положений: место, порядок, цель и сигнал. */
  const position = (
    command: string,
    mode: ViewMode,
    titleKey: string,
    icon: () => ReactElement,
    order: number
  ) => ({
    kind: 'item' as const,
    menu: EDITOR_TITLE_MENU,
    command,
    // Своя группа: переключатель стоит одним набором, а не вперемешку с тем, что вносят
    // другие плагины.
    group: '1_view',
    order,
    titleKey,
    icon,
    when: (ctx: Parameters<typeof onSchemaTab>[0], target: Parameters<typeof onSchemaTab>[1]) =>
      onSchemaTab(ctx, target) && available(deps, mode),
    // Нажата ровно одна кнопка из трёх, и это то, ради чего они видны все: полоса отвечает
    // «где я», а не «куда можно».
    toggled: (_ctx: unknown, target: unknown) => {
      const id = (target as { documentId?: unknown } | null)?.documentId;
      return typeof id === 'string' && modeOf(deps, id) === mode;
    },
    argsOf: args,
    onDidChange: signal,
  });

  return [
    {
      id: 'schema.title.canvasTree',
      value: position(SHOW_TREE_COMMAND_ID, 'tree', 'action.view.tree', TreeIcon, 0),
    },
    {
      id: 'schema.title.canvasSchematic',
      value: position(
        SHOW_SCHEMATIC_COMMAND_ID,
        'schematic',
        'action.view.schematic',
        SchematicIcon,
        10
      ),
    },
    {
      id: 'schema.title.canvasLive',
      value: position(SHOW_LIVE_COMMAND_ID, 'live', 'action.view.live', LiveIcon, 15),
    },
    {
      id: 'schema.title.showCode',
      value: position(SHOW_CODE_COMMAND_ID, 'code', 'action.view.code', CodeIcon, 20),
    },
  ];
}
