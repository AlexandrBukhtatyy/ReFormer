/**
 * Действия над открытым документом: адрес поверхности и типизация её цели.
 *
 * ## Это тот же `MenuPoint`, только другая поверхность
 *
 * Ряд кнопок справа в строке вкладок — не отдельный механизм, а корень меню
 * ({@link EDITOR_TITLE_MENU}), у которого нет места в шапке. Плагин вносит туда такой же
 * вклад, как в «Файл» или в контекстное меню дерева, и действие остаётся командой —
 * доступной из палитры, с клавиши и ассистенту. Разница ровно в двух вещах: у пункта
 * может быть значок (иначе кнопке нечего показать) и цель — активный документ.
 *
 * ## Почему цель, а не `WhenContext`
 *
 * В контексте применимости есть `activeEditorId`, и предикат «эта кнопка для markdown»
 * можно было бы написать по нему. Но кнопке нужен и АДРЕС документа — чтобы передать его
 * команде аргументом, — а адрес в контексте непрозрачен и не несёт ни имени, ни медиатипа.
 * Цель приносит ссылку целиком, поэтому вклад решает по тому же, по чему решал бы редактор.
 *
 * @module host/ui/editor-menu
 */

import type { ResourceId, ResourceRef } from '@/shell/platform/primitives/resource';
import type { WhenContext } from '@/shell/platform/primitives/when-context';
import type { ContextMenuId, MenuTarget } from './menu';

/** Адрес ряда действий над активным документом. */
export const EDITOR_TITLE_MENU: ContextMenuId = 'editor/title';

/** Документ, к которому относятся кнопки ряда. */
export interface EditorMenuTarget {
  /** Адрес активного документа. */
  readonly documentId: ResourceId;
  /** Ссылка на ресурс: по ней вклад решает, его ли это документ. */
  readonly ref: ResourceRef;
  /** Идентификатор редактора, который сейчас рисует документ; `null` — ещё не выбран. */
  readonly editorId: string | null;
}

/**
 * Сужает непрозрачную цель до цели ряда действий; `null` — кнопку рисуют не там.
 *
 * Проверка структурная, а не `instanceof`: цель проходит через модель меню как `unknown`,
 * и вклад обязан уметь получить `null`, если его пункт по ошибке внесли в чужое меню.
 */
export function asEditorTarget(target: MenuTarget): EditorMenuTarget | null {
  if (typeof target !== 'object' || target === null) return null;
  const candidate = target as Partial<EditorMenuTarget>;
  if (typeof candidate.documentId !== 'string') return null;
  if (typeof candidate.ref !== 'object' || candidate.ref === null) return null;
  return candidate as EditorMenuTarget;
}

/** Предикат видимости кнопки по открытому документу. */
export function whenEditor(
  predicate: (target: EditorMenuTarget, ctx: WhenContext) => boolean
): (ctx: WhenContext, target: MenuTarget) => boolean {
  return (ctx, target) => {
    const editor = asEditorTarget(target);
    // Нет цели — нет и кнопки: пункт писался про открытый документ, а его спросили в другом
    // месте, где документа нет вовсе.
    return editor !== null && predicate(editor, ctx);
  };
}

/** Аргументы команды по открытому документу; для чужой цели их нет вовсе. */
export function argsOfEditor<T>(
  compute: (target: EditorMenuTarget) => T
): (target: MenuTarget) => T | undefined {
  return (target) => {
    const editor = asEditorTarget(target);
    return editor === null ? undefined : compute(editor);
  };
}
