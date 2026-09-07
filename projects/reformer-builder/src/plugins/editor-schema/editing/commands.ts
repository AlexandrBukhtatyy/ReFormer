/**
 * Команды редактора схемы: удаление, дублирование, группировка, отмена и быстрые исправления.
 *
 * ## Быстрые исправления живут ЗДЕСЬ, а не у валидатора
 *
 * Находка называет команду строкой (`QuickFix.commandId`), а исполняет её тот, кто умеет
 * править документ. Валидатор править не умеет и не должен: в этом весь смысл пары
 * «код + команда» — человек чинит из панели проблем, ассистент вызывает ту же команду
 * тем же `execute`, и второго, только для машин написанного пути не заводится.
 *
 * Всё, что редактор делает по нажатию клавиши, проходит через реестр команд, а не через
 * обработчик на канвасе. Это то самое место, где v1 стал монолитом: там сочетания разбирал
 * один обработчик с охранными условиями внутри, и добавить клавишу означало править его.
 * Здесь условие живёт у команды (`enabled`), сочетание — рядом с ней, а канвас про клавиши
 * структурных операций не знает вовсе.
 *
 * Побочный выигрыш — общая дверь: то, что человек вызывает из палитры команд, ассистент
 * вызовет тем же `execute`, а не вторым, только для машин написанным путём.
 *
 * ## Применимость спрашивается у реестра сеансов, а не у контекста
 *
 * `WhenContext` отвечает про оболочку: куда направлен фокус, какая вкладка активна. Про то,
 * есть ли выделение НА КАНВАСЕ и разбирается ли документ, знает только сеанс. Поэтому
 * предикаты читают реестр, а из контекста берут ровно то, что он про них знает.
 *
 * @module plugins/editor-schema/editing/commands
 */

import type { CommandContribution, ResourceId } from '@/sdk';
import { isDivContainer } from '@/lib/form-model/node-kind';
import type { NavDir } from '@/lib/form-model/query';
import { planDuplicate } from './duplicate';
import { planMove } from './move';
import type { QuickAddStore } from '../session/quick-add-store';
import { indexNodes } from '../model/node-index';
import {
  duplicateOp,
  flipOp,
  groupOp,
  removeOp,
  renamePropOp,
  setComponentOp,
  ungroupOp,
} from '../model/ops';
import type { EditOp, NodeId, SchemaEditorHost } from '../host';
import type { SchemaSession, SessionRegistry } from '../session/sessions';

export const DELETE_COMMAND_ID = 'editor-schema.delete';
/**
 * Второе имя удаления — под Backspace.
 *
 * Отдельная команда, а не второе сочетание у первой: у команды по контракту РОВНО одно
 * сочетание ({@link CommandContribution.keybinding}), и это правильно — палитра команд
 * показывает одно, а не список. Две привычки («Delete» и «Backspace») пришли из первой
 * версии и обе живые, поэтому обе и остаются, но делают они одно и то же.
 */
export const DELETE_BACK_COMMAND_ID = 'editor-schema.delete.backspace';
export const DUPLICATE_COMMAND_ID = 'editor-schema.duplicate';
export const GROUP_COMMAND_ID = 'editor-schema.group';
export const UNGROUP_COMMAND_ID = 'editor-schema.ungroup';
export const FLIP_COMMAND_ID = 'editor-schema.flip';
export const UNDO_COMMAND_ID = 'editor-schema.undo';
export const REDO_COMMAND_ID = 'editor-schema.redo';

/**
 * Перемещение узла клавишами — по команде на направление.
 *
 * Четыре команды, а не одна с аргументом: сочетание у команды одно, и «переместить»
 * с параметром получило бы четыре разных сочетания на один идентификатор. Заодно каждая
 * видна в палитре под своим именем — а «переместить» без направления там бесполезна.
 */
export const MOVE_COMMAND_IDS: Readonly<Record<NavDir, string>> = {
  up: 'editor-schema.move-up',
  down: 'editor-schema.move-down',
  left: 'editor-schema.move-left',
  right: 'editor-schema.move-right',
};

/**
 * Дублирование в направлении — «Copy Line» первой версии, по команде на направление.
 *
 * Отдельно от {@link DUPLICATE_COMMAND_ID}, потому что это разные действия: то кладёт копию
 * сразу за оригиналом и направления не знает, это — ставит её с той стороны, куда показала
 * стрелка, и умеет копировать блок целиком.
 */
export const DUPLICATE_DIR_COMMAND_IDS: Readonly<Record<NavDir, string>> = {
  up: 'editor-schema.duplicate-up',
  down: 'editor-schema.duplicate-down',
  left: 'editor-schema.duplicate-left',
  right: 'editor-schema.duplicate-right',
};

/** Схлопнуть выделение: из блока — к одному узлу, из одного — к его родителю. */
export const COLLAPSE_SELECTION_COMMAND_ID = 'editor-schema.collapse-selection';

/** Открыть диалог быстрого добавления компонента. */
export const QUICK_ADD_COMMAND_ID = 'editor-schema.quick-add';

/**
 * Команды быстрых исправлений. Имена — часть контракта с валидатором
 * (`plugins/validator-schema/codes`.`COMMANDS`), поэтому пространства имён плагина у них нет:
 * исправление называет команду СТРОКОЙ, и строка обязана совпасть с точностью до буквы.
 * Владеет ими редактор схемы, потому что чинить — значит править документ, а править
 * документ умеет он.
 */
export const SET_COMPONENT_COMMAND_ID = 'schema.set-component';
export const RENAME_PROP_COMMAND_ID = 'schema.rename-prop';
export const REMOVE_RULE_COMMAND_ID = 'rules.remove';

/**
 * Реестр команд в объёме, нужном тому, кто ПОКАЗЫВАЕТ исправления.
 *
 * Не порт композиции: реестр приходит плагину в `activate` (`ctx.commands`), а не от
 * приложения. Тип живёт здесь, рядом с командами, потому что и канвас, и панель проблем
 * спрашивают у него одно и то же — «есть ли такая команда» и «запусти её с аргументами».
 */
export interface CommandAccess {
  /**
   * Есть ли сейчас такая команда.
   *
   * Тот же вопрос, на который отвечает `usableFixes` при публикации находки, и задаётся он
   * ВТОРОЙ раз намеренно: между публикацией диагностики и нажатием кнопки плагин, владеющий
   * командой, могли выключить, и кнопка обязана исчезнуть, а не отказать при нажатии.
   */
  has(commandId: string): boolean;
  /** Запустить с аргументами исправления. Отказ реестра уходит в консоль, а не наверх. */
  run(commandId: string, args?: unknown): void;
}

/** Сеанс, готовый принять структурную правку: он есть, и текст разбирается. */
function editable(registry: SessionRegistry): SchemaSession | null {
  const session = registry.active();
  if (session === null) return null;
  return session.get().syncState === 'synced' ? session : null;
}

/** Выделение активного сеанса. Пустой список означает «команде не к чему применяться». */
function selectionOf(registry: SessionRegistry): readonly string[] {
  return editable(registry)?.get().selection ?? [];
}

/**
 * Корень удалять нечем и незачем: он не лежит в массив-слоте, а схема без корня — не схема.
 * Проверка здесь, а не в операции: операция ответит отказом, но команда обязана быть
 * недоступной ЗАРАНЕЕ, иначе пункт палитры обещает то, чего не сделает.
 */
function removableSelection(registry: SessionRegistry): readonly string[] {
  const session = editable(registry);
  if (session === null) return [];
  const { model, selection } = session.get();
  const rootId = (model.root as { $nodeId?: string }).$nodeId;
  return selection.filter((id) => id !== rootId);
}

/**
 * Узел, которому есть что переворачивать, — или `null`.
 *
 * Отвечает и на вопрос доступности команды, и на вопрос «над кем работать», поэтому одна
 * функция, а не предикат плюс поиск: разойдясь, они дали бы доступную команду, которой не
 * над кем исполниться.
 *
 * Аргумент важнее выделения: кнопку переворота нажимают ПРЯМО НА КОРОБКЕ, и выделение при
 * этом не двигается — иначе щелчок по стрелке уводил бы курсор с узла, над которым работают.
 */
function flippableNode(registry: SessionRegistry, nodeId?: string): NodeId | null {
  const session = editable(registry);
  if (session === null) return null;
  const { model, selection } = session.get();
  const target = nodeId ?? (selection.length === 1 ? selection[0] : undefined);
  if (target === undefined) return null;
  const found = indexNodes(model).find(target);
  return found !== undefined && isDivContainer(found.node) ? target : null;
}

/**
 * Сочетание для перемещения в этом направлении.
 *
 * `mod+стрелка`, как в первой версии: стрелка без модификатора двигает КУРСОР по дереву,
 * а с модификатором — сам узел. Пара «навигация / перемещение» тем и запоминается, что
 * отличается одной клавишей.
 */
/**
 * Условие клавиш канваса, записанное данными.
 *
 * Заведено по найденному дефекту, а не «для порядка»: у `delete`, `backspace`, `mod+d`,
 * `mod+g` и стрелок предикат смотрел только на выделение и НЕ смотрел на фокус. Значит
 * `Delete` в дереве файлов удалял узел схемы, если в схеме что-то оставалось выделенным, —
 * и то же сочетание было объявлено плагином файлов. Разводил их порядок регистрации, который
 * по контракту рантайма плагинов ничего не значит.
 *
 * Пара `focus == canvas` против `focus == tree` делает эти клавиши ДОКАЗУЕМО
 * непересекающимися — см. `provablyDisjoint` в `host/primitives/when-expr`.
 */
const ON_CANVAS = 'focus == canvas';

/**
 * Условие клавиш, применимых ко всей вкладке схемы, а не к канвасу.
 *
 * Отмена и повтор принадлежат ДОКУМЕНТУ: их жмут и из панели свойств, и с канваса, поэтому
 * сужать их до фокуса на канвасе нельзя. Зато сужение до вида ресурса обязательно — иначе
 * `mod+z` на вкладке markdown перебирает историю схемы, открытой в соседней вкладке.
 */
const IN_SCHEMA = 'activeResourceKind == form.schema';

const MOVE_KEYBINDINGS: Readonly<Record<NavDir, string>> = {
  up: 'mod+arrowup',
  down: 'mod+arrowdown',
  left: 'mod+arrowleft',
  right: 'mod+arrowright',
};

/** Сочетание для дублирования в этом направлении — то же, что в первой версии. */
const DUPLICATE_KEYBINDINGS: Readonly<Record<NavDir, string>> = {
  up: 'alt+shift+arrowup',
  down: 'alt+shift+arrowdown',
  left: 'alt+shift+arrowleft',
  right: 'alt+shift+arrowright',
};

const DIRECTIONS: readonly NavDir[] = ['up', 'down', 'left', 'right'];

/** Команды дублирования в направлении: копия встаёт с той стороны, куда показала стрелка. */
function duplicateCommands(registry: SessionRegistry): readonly CommandContribution[] {
  return DIRECTIONS.map((dir) => ({
    id: DUPLICATE_DIR_COMMAND_IDS[dir],
    titleKey: `command.duplicate.${dir}`,
    keybinding: DUPLICATE_KEYBINDINGS[dir],
    when: ON_CANVAS,
    enabled: () => removableSelection(registry).length > 0,
    run: () => {
      const session = editable(registry);
      if (session === null) return false;
      const { model, selection } = session.get();
      const op = planDuplicate(model, selection, dir);
      if (op === null) return false;
      // Выделение остаётся на оригинале: копия — новый узел, и уводить на неё курсор
      // значило бы, что следующая правка человека уйдёт не в то место, где он работал.
      const outcome = session.apply(op);
      if (outcome.status !== 'applied') return false;
      session.setSelection(selection);
      return true;
    },
  }));
}

/**
 * Команда быстрого добавления — только когда есть чем открыть диалог.
 *
 * Без стора её нет вовсе, а не «есть, но ничего не делает»: команда, не делающая ничего,
 * висит в палитре и обещает то, чего не будет.
 */
function quickAddCommands(
  registry: SessionRegistry,
  quickAdd: QuickAddStore | null
): readonly CommandContribution[] {
  if (quickAdd === null) return [];
  return [
    {
      id: QUICK_ADD_COMMAND_ID,
      titleKey: 'command.quick-add',
      keybinding: 'enter',
      when: ON_CANVAS,
      // Только на канвасе: Enter в поле ввода принадлежит полю, а на кнопке — кнопке
      // (это отдельно стережёт диспетчер оболочки).
      enabled: (ctx) => ctx.focus === 'canvas' && editable(registry) !== null,
      run: () => {
        if (editable(registry) === null) return false;
        quickAdd.open();
        return true;
      },
    },
  ];
}

/** Команды перемещения: одна на направление, все поверх одного планировщика. */
function moveCommands(registry: SessionRegistry): readonly CommandContribution[] {
  const directions: readonly NavDir[] = DIRECTIONS;
  return directions.map((dir) => ({
    id: MOVE_COMMAND_IDS[dir],
    titleKey: `command.move.${dir}`,
    keybinding: MOVE_KEYBINDINGS[dir],
    when: ON_CANVAS,
    // Условие широкое — «есть что двигать»: точный ответ даёт планировщик по модели,
    // а повторять его правила в предикате значило бы завести им второе место жизни.
    enabled: () => selectionOf(registry).length > 0,
    run: () => {
      const session = editable(registry);
      if (session === null) return false;
      const { model, selection } = session.get();
      const op = planMove(model, selection, dir);
      if (op === null) return false;
      const outcome = session.apply(op);
      if (outcome.status !== 'applied') return false;
      // Курсор остаётся на том, что двигали: реордер выражен переносом СОСЕДА через блок
      // (см. `./move`), и `focus` операции назвал бы именно его — то есть выделение
      // перепрыгнуло бы на узел, которого человек не трогал.
      session.setSelection(selection);
      return true;
    },
  }));
}

// ── быстрые исправления ─────────────────────────────────────────────────────────
//
// Их применимость целиком в АРГУМЕНТАХ: какой документ, какой узел, какое правило.
// `enabled(ctx)` аргументов не видит, поэтому предикат отвечает на самый широкий верный
// вопрос — «есть ли вообще открытый документ». Сузить его до «активна схема формы» нельзя:
// исправление вызывают и из панели проблем, где находка принадлежит НЕ активной вкладке,
// и такой предикат запретил бы законный вызов. Всё остальное проверяет `run`, отвечая
// отказом, — как и команда сохранения, которая перепроверяет вкладку перед записью.

/** Аргументы узлового исправления: адрес документа и адрес узла в нём. */
interface NodeFixArgs {
  readonly resource: ResourceId;
  readonly nodeId: NodeId;
}

/** Непустая строка по ключу или `undefined`. Аргументы приходят от чужого кода — от валидатора. */
function stringAt(args: unknown, key: string): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function readNodeFix(args: unknown): NodeFixArgs | null {
  const resource = stringAt(args, 'resource');
  const nodeId = stringAt(args, 'nodeId');
  return resource === undefined || nodeId === undefined ? null : { resource, nodeId };
}

/**
 * Применяет операцию к документу ПО АДРЕСУ, а не к активному сеансу.
 *
 * Сеанс — это вид редактора, и он рождается, только когда тело редактора смонтировали.
 * Находку же чинят и из панели проблем, где файл может быть открыт текстовым редактором
 * или лежать в неактивной вкладке. Ручка документа существует в обоих случаях, и она же
 * держит историю — значит, отменяется такое исправление тем же Ctrl+Z, что и правка руками.
 *
 * `false` означает три состояния сразу, и все три законны: документа нет в работе,
 * текст в расхождении, операция не применилась (узел исчез между показом и нажатием).
 */
function applyToDocument(host: SchemaEditorHost, resource: ResourceId, op: EditOp): boolean {
  const handle = host.modelOf(resource);
  if (handle === null) return false;
  return handle.apply(op).status === 'applied';
}

/** Какой список правил названо чистить. Чужая строка — отказ, а не удаление наугад. */
function readRuleList(args: unknown): 'validation' | 'behavior' | 'render' | null {
  const list = stringAt(args, 'list');
  return list === 'validation' || list === 'behavior' || list === 'render' ? list : null;
}

/** Целое неотрицательное по ключу. Дробное и отрицательное — не индекс списка. */
function indexAt(args: unknown, key: string): number | null {
  if (typeof args !== 'object' || args === null) return null;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Команды быстрых исправлений.
 *
 * `rules.remove` вносится ТОЛЬКО когда композиция дала сайдкар правил ({@link
 * SchemaEditorHost.rules}), и это не осторожность, а тот же довод, ради которого исправления
 * стали отбираться по реестру: команда, которой нечем работать, — это кнопка, обещающая то,
 * чего не сделает. Пока сайдкара нет, `usableFixes` уберёт исправление у находки, а валидатор
 * назовёт причину в консоли — то есть дефект останется видимым, а не превратится в тишину.
 */
export function schemaFixCommands(host: SchemaEditorHost): readonly CommandContribution[] {
  const commands: CommandContribution[] = [
    {
      id: SET_COMPONENT_COMMAND_ID,
      titleKey: 'command.set-component',
      enabled: (ctx) => ctx.activeEditorId !== null,
      run: (args) => {
        const target = readNodeFix(args);
        const name = stringAt(args, 'name');
        if (target === null || name === undefined) return false;
        return applyToDocument(host, target.resource, setComponentOp(target.nodeId, name));
      },
    },
    {
      id: RENAME_PROP_COMMAND_ID,
      titleKey: 'command.rename-prop',
      enabled: (ctx) => ctx.activeEditorId !== null,
      run: (args) => {
        const target = readNodeFix(args);
        const from = stringAt(args, 'from');
        const to = stringAt(args, 'to');
        if (target === null || from === undefined || to === undefined) return false;
        return applyToDocument(host, target.resource, renamePropOp(target.nodeId, from, to));
      },
    },
  ];

  const rules = host.rules;
  if (rules !== undefined) {
    commands.push({
      id: REMOVE_RULE_COMMAND_ID,
      titleKey: 'command.remove-rule',
      enabled: (ctx) => ctx.activeEditorId !== null,
      run: (args) => {
        const resource = stringAt(args, 'resource');
        const list = readRuleList(args);
        const index = indexAt(args, 'index');
        if (resource === undefined || list === null || index === null) return false;
        const current = rules.get(resource);
        // Индекс за пределами списка — не «удалить последнее», а промах: правило могли
        // убрать между показом находки и нажатием, и молча стереть соседнее было бы худшим
        // из возможных ответов.
        if (current === null || index >= current[list].length) return false;
        rules.set(resource, {
          ...current,
          [list]: current[list].filter((_, at) => at !== index),
        });
        return true;
      },
    });
  }

  return commands;
}

/** Команды плагина. Отдельно от `activate`, чтобы тест звал их без реестров. */
export function schemaEditorCommands(
  registry: SessionRegistry,
  host: SchemaEditorHost,
  quickAdd: QuickAddStore | null = null
): readonly CommandContribution[] {
  const removeSelection = (): boolean => {
    const session = editable(registry);
    if (session === null) return false;
    // С конца: удаление соседа сдвигает индексы, но не адреса — а адреса здесь и нужны.
    // Порядок всё равно значим для выделения: после серии удалений оно уедет на родителя
    // последнего удалённого, и это ближе к месту, где человек только что работал.
    let applied = false;
    for (const id of removableSelection(registry)) {
      if (session.apply(removeOp(id)).status === 'applied') applied = true;
    }
    return applied;
  };

  return [
    {
      id: DELETE_COMMAND_ID,
      titleKey: 'command.delete',
      keybinding: 'delete',
      when: ON_CANVAS,
      enabled: () => removableSelection(registry).length > 0,
      run: removeSelection,
    },
    {
      id: DELETE_BACK_COMMAND_ID,
      titleKey: 'command.delete',
      keybinding: 'backspace',
      when: ON_CANVAS,
      enabled: () => removableSelection(registry).length > 0,
      run: removeSelection,
    },
    {
      id: DUPLICATE_COMMAND_ID,
      titleKey: 'command.duplicate',
      keybinding: 'mod+d',
      when: ON_CANVAS,
      enabled: () => removableSelection(registry).length > 0,
      run: () => {
        const session = editable(registry);
        const target = removableSelection(registry)[0];
        if (session === null || target === undefined) return false;
        return session.apply(duplicateOp(target)).status === 'applied';
      },
    },
    {
      id: GROUP_COMMAND_ID,
      titleKey: 'command.group',
      keybinding: 'mod+g',
      when: ON_CANVAS,
      enabled: () => removableSelection(registry).length > 0,
      run: () => {
        const session = editable(registry);
        const nodes = removableSelection(registry);
        if (session === null || nodes.length === 0) return false;
        return session.apply(groupOp(nodes)).status === 'applied';
      },
    },
    {
      id: UNGROUP_COMMAND_ID,
      titleKey: 'command.ungroup',
      keybinding: 'mod+shift+g',
      when: ON_CANVAS,
      enabled: () => selectionOf(registry).length === 1,
      run: () => {
        const session = editable(registry);
        const target = selectionOf(registry)[0];
        if (session === null || target === undefined) return false;
        return session.apply(ungroupOp(target)).status === 'applied';
      },
    },
    {
      id: FLIP_COMMAND_ID,
      titleKey: 'command.flip',
      // То же сочетание, что в первой версии: там оно означало «сменить раскладку выделенного
      // div», и здесь означает ровно это же.
      keybinding: 'mod+shift+l',
      when: ON_CANVAS,
      enabled: () => flippableNode(registry) !== null,
      run: (args) => {
        const session = editable(registry);
        const target = flippableNode(registry, stringAt(args, 'nodeId'));
        if (session === null || target === null) return false;
        return session.apply(flipOp(target)).status === 'applied';
      },
    },
    {
      id: UNDO_COMMAND_ID,
      titleKey: 'command.undo',
      keybinding: 'mod+z',
      when: IN_SCHEMA,
      enabled: () => registry.active()?.get().canUndo === true,
      run: () => registry.active()?.undo() ?? false,
    },
    {
      id: REDO_COMMAND_ID,
      titleKey: 'command.redo',
      keybinding: 'mod+shift+z',
      when: IN_SCHEMA,
      enabled: () => registry.active()?.get().canRedo === true,
      run: () => registry.active()?.redo() ?? false,
    },
    {
      id: COLLAPSE_SELECTION_COMMAND_ID,
      titleKey: 'command.collapse-selection',
      keybinding: 'escape',
      when: ON_CANVAS,
      // Только на канвасе: Escape в остальном интерфейсе принадлежит тому, что открыто
      // поверх — окну, палитре, подсказке. Отбирать его у них ради выделения нельзя.
      enabled: (ctx) => ctx.focus === 'canvas' && selectionOf(registry).length > 0,
      run: () => {
        const session = registry.active();
        if (session === null) return false;
        const { model, selection } = session.get();
        // Блок схлопывается к одному узлу — тому, на котором курсор; одиночное выделение
        // поднимается к родителю. Так один и тот же Escape отвечает на оба «слишком много
        // выделено» и «хочу работать уровнем выше».
        if (selection.length > 1) {
          session.setSelection([selection[selection.length - 1]]);
          return true;
        }
        const current = selection[0];
        if (current === undefined) return false;
        const index = indexNodes(model);
        const entry = index.find(current);
        if (entry === undefined) return false;
        const parentPath = entry.path.slice(0, -1);
        // Путь родителя — это ещё и путь слота: у `children` и `steps` над узлом лежит
        // массив, а над ним уже сам родитель.
        const parent = index.idAt(parentPath) ?? index.idAt(parentPath.slice(0, -1));
        if (parent === undefined || parent === current) return false;
        session.setSelection([parent]);
        return true;
      },
    },
    ...quickAddCommands(registry, quickAdd),
    ...moveCommands(registry),
    ...duplicateCommands(registry),
    ...schemaFixCommands(host),
  ];
}
