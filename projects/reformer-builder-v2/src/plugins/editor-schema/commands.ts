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
 * @module plugins/editor-schema/commands
 */

import type { CommandContribution, ResourceId } from '@/sdk';
import { isDivContainer } from '@/lib/form-model/node-kind';
import { indexNodes } from './node-index';
import {
  duplicateOp,
  flipOp,
  groupOp,
  removeOp,
  renamePropOp,
  setComponentOp,
  ungroupOp,
} from './ops';
import type { EditOp, NodeId, SchemaEditorHost } from './host';
import type { SchemaSession, SessionRegistry } from './sessions';

export const DELETE_COMMAND_ID = 'editor-schema.delete';
export const DUPLICATE_COMMAND_ID = 'editor-schema.duplicate';
export const GROUP_COMMAND_ID = 'editor-schema.group';
export const UNGROUP_COMMAND_ID = 'editor-schema.ungroup';
export const FLIP_COMMAND_ID = 'editor-schema.flip';
export const UNDO_COMMAND_ID = 'editor-schema.undo';
export const REDO_COMMAND_ID = 'editor-schema.redo';

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
  host: SchemaEditorHost
): readonly CommandContribution[] {
  return [
    {
      id: DELETE_COMMAND_ID,
      titleKey: 'command.delete',
      keybinding: 'delete',
      enabled: () => removableSelection(registry).length > 0,
      run: () => {
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
      },
    },
    {
      id: DUPLICATE_COMMAND_ID,
      titleKey: 'command.duplicate',
      keybinding: 'mod+d',
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
      // Без сочетания клавиш: переворот всегда виден кнопкой на самой коробке, а свободные
      // сочетания дешевле оставить тем действиям, у которых своей кнопки нет.
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
      enabled: () => registry.active()?.get().canUndo === true,
      run: () => registry.active()?.undo() ?? false,
    },
    {
      id: REDO_COMMAND_ID,
      titleKey: 'command.redo',
      keybinding: 'mod+shift+z',
      enabled: () => registry.active()?.get().canRedo === true,
      run: () => registry.active()?.redo() ?? false,
    },
    ...schemaFixCommands(host),
  ];
}
