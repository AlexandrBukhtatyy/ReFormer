/**
 * Правило сочетания и индекс правил — то, что читает раскладка.
 *
 * Здесь ОБЪЯВЛЕНИЯ. Сборка индекса из команд и поиск конфликтов живут в оболочке билдера.
 *
 * @module @reformer/builder-plugin-api/ui/keyboard/keybinding-rules
 */

import type { WhenExpr } from '../../primitives/when-expr';

/**
 * Откуда правило пришло. Порядок в {@link LAYER_RANK} и есть порядок старшинства.
 *
 * Плагин каталога стоит выше встроенного намеренно: встроенный набор — это то, что мы
 * решили за человека, а плагин, положенный в проект, — то, что он решил сам.
 */
export type KeybindingLayer = 'host' | 'builtin-plugin' | 'catalog-plugin' | 'user';

/** Привязка сочетания к команде. */
export interface KeybindingRule {
  /** Устойчивый адрес правила: его показывает редактор клавиш и называет диагностика. */
  readonly id: string;
  /**
   * Ступени аккорда в каноническом написании. Одна ступень — обычное сочетание.
   *
   * Массив, а не строка, с самого начала: аккорд появляется позже, но переписывать под него
   * указатель, редактор и диагностику дороже, чем сразу назвать вещь тем, что она есть.
   */
  readonly chord: readonly string[];
  readonly commandId: string;
  /** Аргументы вызова. Есть у правил из манифеста и раскладки, у команд их не бывает. */
  readonly args?: unknown;
  readonly when: WhenExpr;
  readonly layer: KeybindingLayer;
  /** Кто принёс правило: идентификатор плагина либо `undefined` у оболочки и человека. */
  readonly pluginId?: string;
  readonly allowInEditable: boolean;
  /** Порядковый номер появления. Последний критерий сортировки. */
  readonly seq: number;
}

/** Указатель по первой ступени сочетания. */
export interface KeybindingIndex {
  /** Правила, у которых первая ступень равна `binding`. Уже отсортированы. */
  rulesFor(binding: string): readonly KeybindingRule[];
  /** Является ли сочетание НАЧАЛОМ аккорда — признак входа в режим ожидания. */
  isChordPrefix(binding: string): boolean;
  /** Продолжения после уже нажатых ступеней. */
  rulesAfter(prefix: readonly string[], binding: string): readonly KeybindingRule[];
  /** Все действующие правила — редактору клавиш и справке. */
  all(): readonly KeybindingRule[];
}

/** Пара правил на одном сочетании, которую разрешить нечем. */
export interface KeybindingConflict {
  readonly chord: readonly string[];
  /** Не меньше двух, в порядке указателя: первый и есть победитель. */
  readonly rules: readonly KeybindingRule[];
  readonly winner: string;
}
