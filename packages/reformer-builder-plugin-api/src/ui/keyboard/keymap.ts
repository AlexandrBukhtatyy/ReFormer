/**
 * Раскладка клавиш: действующее сочетание команды и пользовательские переназначения.
 *
 * Здесь ОБЪЯВЛЕНИЕ службы. Сама служба, её хранение в настройках и сборка из слоёв живут
 * в оболочке билдера.
 *
 * @module @reformer/builder-plugin-api/ui/keyboard/keymap
 */

import type { Disposable } from '../../primitives/disposable';
import { defineService } from '../../primitives/service';
import type {
  KeybindingIndex,
  KeybindingLayer,
  KeybindingRule,
  KeybindingConflict,
} from './keybinding-rules';

/**
 * Запись раскладки, как её пишет человек.
 *
 * Строками, а не разобранными структурами: это содержимое файла настроек, и до разбора
 * у него нет ничего, кроме текста.
 */
export interface UserKeybinding {
  /** Сочетание как написал человек; нормализуется при сборке. */
  readonly key: string;
  /**
   * Идентификатор команды. Ведущий минус означает СНЯТИЕ: `-files.delete` убирает привязку
   * этой команды к этой клавише, одинокий `-` освобождает клавишу целиком.
   *
   * Форма взята у VS Code, и она правильная: снятие адресуется парой «клавиша + команда»,
   * потому что снятие по одной клавише убило бы и те привязки, которых человек не видел.
   */
  readonly command: string;
  readonly when?: string;
  readonly args?: unknown;
  readonly allowInEditable?: boolean;
}

/** Почему запись раскладки не применилась. */
export type KeymapIssueKind = 'invalid-key' | 'invalid-when' | 'not-an-object';

export interface KeymapIssue {
  readonly kind: KeymapIssueKind;
  /** Номер записи в списке — по нему человек находит строку в своём файле. */
  readonly at: number;
  readonly message: string;
}

export interface KeymapService {
  /** Действующий указатель. Пересобирается лениво — см. шапку модуля. */
  index(): KeybindingIndex;
  /** Записи раскладки человека — как они лежат в настройках. */
  userRules(): readonly UserKeybinding[];
  /**
   * Записывает раскладку человека целиком.
   *
   * Целиком, а не по одной записи: редактор клавиш правит список, и частичная запись
   * потребовала бы от него знать, какая строка какой записи соответствует, — то есть
   * держать вторую модель того же списка.
   */
  setUserRules(rules: readonly UserKeybinding[]): Promise<void>;
  /** Записи, которые не применились. Считается вместе с указателем. */
  issues(): readonly KeymapIssue[];
  /** Уведомление о смене раскладки: подписаны меню, справка и редактор клавиш. */
  onDidChange(cb: () => void): Disposable;
  /**
   * Правила внешнего источника. Замещает набор ЭТОГО источника целиком.
   *
   * Форма и довод те же, что у публикации диагностик: источник приносит «всё, что у меня
   * есть сейчас», и его прошлое исчезает без отдельного вызова. Иначе снятие пришлось бы
   * делать вторым вызовом, и первый же забытый оставил бы клавишу от плагина, которого нет.
   */
  registerRules(
    source: string,
    layer: KeybindingLayer,
    rules: readonly ExternalKeybinding[]
  ): Disposable;
  /** Неразрешимые пары. Считается лениво, вместе с указателем. */
  conflicts(): readonly KeybindingConflict[];
}

/**
 * Правило от внешнего источника — манифеста плагина или раскладки человека.
 *
 * Сочетание и условие здесь СТРОКАМИ: источник — это файл, и до разбора у него нет ничего,
 * кроме текста. Разбор делает служба, а испорченную запись отбрасывает поштучно.
 */
export interface ExternalKeybinding {
  readonly chord: readonly string[];
  readonly commandId: string;
  readonly when: KeybindingRule['when'];
  readonly args?: unknown;
  readonly allowInEditable?: boolean;
  readonly pluginId?: string;
}

export const KeymapServiceToken = defineService<KeymapService>('reformer.keymap');

/**
 * Каким сочетанием вызывается команда сейчас. `undefined` — ни одним.
 *
 * Берётся ПЕРВОЕ правило по порядку указателя, то есть то же, которое выиграет у диспетчера.
 * Иначе подсказка называла бы одно сочетание, а срабатывало бы другое.
 */
export function chordOfCommand(
  index: KeybindingIndex,
  commandId: string
): readonly string[] | undefined {
  return index.all().find((rule) => rule.commandId === commandId)?.chord;
}
