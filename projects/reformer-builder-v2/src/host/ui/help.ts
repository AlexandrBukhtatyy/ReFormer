/**
 * Справка о сочетаниях — правило, а не отрисовка.
 *
 * Список сочетаний не пишется руками и не хранится отдельно: он ЕСТЬ реестр команд, взятый
 * под другим углом. Это единственный способ, которым справка остаётся правдой — таблица,
 * которую ведут вручную, расходится с приложением на первой же новой команде, и расходится
 * молча.
 *
 * Отсюда же следует, чего в справке нет: ввода, принадлежащего редактору (стрелки на канвасе,
 * аккорды, Escape с тремя смыслами). Он не является командами — см. шапку
 * `primitives/command`, — и показать его здесь можно было бы только вторым, ручным списком,
 * то есть тем самым, от которого модуль и уходит.
 *
 * @module host/ui/help
 */

import type { CommandContribution } from '../primitives/command';
import type { TranslateKey } from './palette';

/** Строка таблицы сочетаний: что делает и чем вызывается. */
export interface ShortcutRow {
  readonly id: string;
  readonly title: string;
  /** Уже отформатированное сочетание: `Ctrl+Shift+P`. */
  readonly shortcut: string;
}

export interface ShortcutRowsOptions {
  readonly translate: TranslateKey;
  /** Подпись сочетания. Отдельным входом: платформу знает вызывающий, а не это правило. */
  readonly format: (keybinding: string) => string;
}

/**
 * Команды с сочетаниями, упорядоченные по заголовку.
 *
 * По заголовку, а не по идентификатору: справку читают глазами, и `ai.stop` рядом с
 * `ai.reset` группирует по владельцу, тогда как человек ищет по названию действия.
 * Сортировка — `localeCompare`, потому что заголовки переведены.
 *
 * Применимость (`enabled`) здесь не проверяется намеренно: справка отвечает на вопрос
 * «какие сочетания есть», а не «что доступно прямо сейчас». Прячь она недоступное — список
 * менялся бы от того, какая вкладка открыта, и запомнить его было бы нельзя.
 */
export function shortcutRows(
  commands: readonly CommandContribution[],
  options: ShortcutRowsOptions
): readonly ShortcutRow[] {
  return commands
    .filter((command) => command.keybinding !== undefined)
    .map((command) => ({
      id: command.id,
      title: options.translate(command.titleKey, command),
      shortcut: options.format(command.keybinding as string),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
