/**
 * Правила экрана «Горячие клавиши»: строки, запись нажатия, переназначение.
 *
 * Здесь нет React — по той же причине, что у отбора палитры и сборки меню: окружение тестов
 * `node`, и правило «запись игнорирует нажатие одного модификатора» полезно уметь спросить,
 * не рисуя интерфейс.
 *
 * ## Строка есть у каждой команды, даже без сочетания
 *
 * Иначе назначить клавишу тому, у чего её пока нет, было бы негде — а это ровно половина
 * смысла экрана. Поэтому список строится из ДВУХ источников: действующих правил (у них есть
 * сочетание) и команд без правил (у них его нет).
 *
 * ## Запись — не «поле ввода с текстом сочетания»
 *
 * Человек не пишет `mod+alt+d` руками, он нажимает клавиши. Разбор нажатия идёт той же
 * `eventToKeybinding`, что и в диспетчере: разъедься они, записанное сочетание не совпало бы
 * с тем, что человек потом нажмёт, — и промах выглядел бы как «клавиша не работает».
 *
 * @module host/ui/keybinding-editor
 */

import type { CommandContribution } from '../primitives/command';
import { MAX_CHORD_STEPS } from '../primitives/command';
import type { WhenExpr } from '../primitives/when-expr';
import type { KeybindingIndex, KeybindingLayer, KeybindingRule } from './keybinding-rules';
import type { UserKeybinding } from './keymap';

/** Строка таблицы редактора. */
export interface EditorRow {
  /** Адрес правила либо `command:<id>` у команды без сочетания. */
  readonly id: string;
  readonly commandId: string;
  readonly title: string;
  /** Ступени в каноническом написании. Пусто — сочетания нет. */
  readonly chord: readonly string[];
  readonly when: string;
  /** `null` у строки без сочетания: слоя у несуществующего правила не бывает. */
  readonly layer: KeybindingLayer | null;
  readonly conflicting: boolean;
}

export interface EditorRowsOptions {
  readonly translate: (key: string, owner?: CommandContribution) => string;
  /** Все команды: из них берутся заголовки и строки для тех, у кого сочетания нет. */
  readonly commands: readonly CommandContribution[];
  readonly conflicting?: ReadonlySet<string>;
  /** Строка поиска. Пусто — показать всё. */
  readonly query?: string;
}

/** Совпадает ли строка с запросом: по заголовку, идентификатору и подписи сочетания. */
function matches(row: EditorRow, query: string): boolean {
  if (query === '') return true;
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return (
    row.title.toLowerCase().includes(needle) ||
    row.commandId.toLowerCase().includes(needle) ||
    row.chord.join(' ').toLowerCase().includes(needle)
  );
}

/**
 * Строки редактора: сначала команды с сочетаниями, затем без — и всё это по заголовку.
 *
 * Порядок по заголовку, а не по наличию сочетания: человек ищет действие по названию,
 * и разделение на две группы заставило бы его смотреть в двух местах.
 */
export function editorRows(
  index: KeybindingIndex,
  options: EditorRowsOptions
): readonly EditorRow[] {
  const byId = new Map(options.commands.map((command) => [command.id, command]));
  const bound = new Set<string>();
  const rows: EditorRow[] = [];

  for (const rule of index.all()) {
    const command = byId.get(rule.commandId);
    // Правило на команду, которой сейчас нет: показывается, но без заголовка его не отличить
    // от соседа, поэтому вместо заголовка встаёт идентификатор.
    rows.push({
      id: rule.id,
      commandId: rule.commandId,
      title: command === undefined ? rule.commandId : options.translate(command.titleKey, command),
      chord: rule.chord,
      when: rule.when.source,
      layer: rule.layer,
      conflicting: options.conflicting?.has(rule.id) === true,
    });
    bound.add(rule.commandId);
  }

  for (const command of options.commands) {
    if (bound.has(command.id)) continue;
    rows.push({
      id: `command:${command.id}`,
      commandId: command.id,
      title: options.translate(command.titleKey, command),
      chord: [],
      when: '',
      layer: null,
      conflicting: false,
    });
  }

  return rows
    .filter((row) => matches(row, options.query ?? ''))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Состояние записи нажатия. */
export interface RecordingState {
  /** Записанные ступени в каноническом написании. */
  readonly steps: readonly string[];
  /** Достигнут ли предел ступеней — дальше запись не принимает. */
  readonly full: boolean;
}

export function beginRecording(): RecordingState {
  return { steps: [], full: false };
}

/**
 * Добавляет нажатие к записи.
 *
 * `null` — нажатие сочетанием не является (голый модификатор, набор через IME): такое
 * событие просто пропускается. Иначе «Shift сам по себе» записывался бы как сочетание,
 * которое потом не совпадёт ни с чем.
 */
export function pushKey(state: RecordingState, binding: string | null): RecordingState {
  if (binding === null || state.full) return state;
  const steps = [...state.steps, binding];
  return { steps, full: steps.length >= MAX_CHORD_STEPS };
}

/**
 * Правила, которые уже заняли это сочетание при таком условии.
 *
 * Спрашивается ДО записи: показать конфликт заранее дешевле, чем дать человеку назначить
 * клавишу и молча проиграть чужому правилу.
 */
export function conflictsOf(
  index: KeybindingIndex,
  steps: readonly string[],
  when: WhenExpr
): readonly KeybindingRule[] {
  const first = steps[0];
  if (first === undefined) return [];
  const candidates =
    steps.length === 1
      ? index.rulesFor(first)
      : index.rulesAfter(steps.slice(0, -1), steps[steps.length - 1]);
  // Совпадением считается пересечение условий: правило с другим `when` живёт в другом месте
  // и клавишу не отнимает. Проверка та же, что у поиска конфликтов, только с одной стороны
  // стоит ещё не записанное правило.
  return candidates.filter(
    (rule) => rule.when.source === when.source || when.source === '' || rule.when.source === ''
  );
}

/**
 * Раскладка человека после переназначения команды.
 *
 * Возвращает НОВЫЙ список: записи неизменяемы, а редактор пишет раскладку целиком
 * (см. `KeymapService.setUserRules`).
 *
 * Прошлые записи этой же команды убираются: две записи одной команды на разные клавиши —
 * это не «две клавиши», а неоднозначность, которую человек не заказывал. Кому нужны две,
 * тот добавит вторую отдельно.
 */
export function withRebinding(
  rules: readonly UserKeybinding[],
  commandId: string,
  steps: readonly string[],
  when?: string
): readonly UserKeybinding[] {
  const kept = rules.filter(
    (rule) => rule.command !== commandId && rule.command !== `-${commandId}`
  );
  if (steps.length === 0) return kept;
  return [
    ...kept,
    {
      key: steps.join(' '),
      command: commandId,
      ...(when === undefined || when === '' ? {} : { when }),
    },
  ];
}

/**
 * Раскладка человека после снятия сочетания у команды.
 *
 * Снятие записывается явной строкой с ведущим минусом, а не удалением: убрать можно только
 * СВОЮ запись, а сочетание, объявленное командой или плагином, живёт в коде — и перекрыть
 * его нечем, кроме снятия.
 */
export function withUnbinding(
  rules: readonly UserKeybinding[],
  commandId: string,
  steps: readonly string[]
): readonly UserKeybinding[] {
  const kept = rules.filter((rule) => rule.command !== commandId);
  if (steps.length === 0) return kept;
  return [...kept, { key: steps.join(' '), command: `-${commandId}` }];
}

/**
 * Раскладка человека после возврата команды к исходному сочетанию.
 *
 * Возврат — это отсутствие записей о команде, а не запись «как было»: исходное сочетание
 * живёт у команды, и дублировать его в настройках значило бы заморозить то значение,
 * которое было на момент нажатия кнопки.
 */
export function withReset(
  rules: readonly UserKeybinding[],
  commandId: string
): readonly UserKeybinding[] {
  return rules.filter((rule) => rule.command !== commandId && rule.command !== `-${commandId}`);
}
