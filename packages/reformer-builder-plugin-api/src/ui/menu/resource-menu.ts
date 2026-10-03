/**
 * Контекстное меню ресурса: цель, условие, аргументы и выделение.
 *
 * Чистые функции: вторая их реализация в плагине разошлась бы с платформенной.
 *
 * @module @reformer/builder-plugin-api/ui/menu/resource-menu
 */

import type { ResourceId, ResourceRef } from '../../primitives/resource.js';
import type { WhenContext } from '../../primitives/when-context.js';
import type { ContextMenuId, MenuPath, MenuTarget } from './menu.js';

/** Адрес контекстного меню дерева: в него вносят пункты те, кому есть что предложить. */
export const RESOURCE_CONTEXT_MENU: ContextMenuId = 'resource/context';

/**
 * Адрес подменю «Сгенерировать» в контекстном меню дерева — общий для всех стеков.
 *
 * Заголовок вносит плагин файлов: дерево его, и он есть в любом составе. Наполняют подменю
 * домены — каждый стек заводит под этим адресом свой подраздел (`…/generate/<домен>`) и кладёт
 * пункты в него. Адрес объявлен здесь, а не у одного из стеков: иначе подменю принадлежало бы
 * ему, и в составе без него второму стеку было бы некуда вносить.
 *
 * Пока подразделов нет, подменю пустое и не рисуется — состав без генерации его не видит.
 */
export const RESOURCE_GENERATE_MENU: MenuPath = 'resource/context/generate';

/** По чему щёлкнули в дереве. */
export interface ResourceMenuTarget {
  /**
   * Строка, по которой щёлкнули. `null` — щелчок по пустому месту панели, и это законный
   * случай: «Новый файл…» там осмысленен, «Переименовать» — нет.
   */
  readonly ref: ResourceRef | null;
  /** Каталог, ВНУТРЬ которого действуют пункты создания. Считается по правилу модуля. */
  readonly dir: ResourceId;
  /**
   * К чему пункт применится: набор, если щёлкнули по его строке, иначе одна строка.
   * Считает дерево (`actionTargets` в `./resource-tree`) — это его состояние, а не меню.
   */
  readonly selection: readonly ResourceRef[];
  /** Корень показа: им вклад отличает «щёлкнули по проекту» от «щёлкнули по файлу». */
  readonly rootId: ResourceId;
}

/**
 * Сужает непрозрачную цель модели меню до цели дерева; `null` — меню открыли не над деревом.
 *
 * Проверка структурная, а не `instanceof`: цель проходит через модель меню как `unknown`,
 * и вклад плагина обязан уметь получить `null`, если его пункт по ошибке внесли в чужое меню.
 */
export function asResourceTarget(target: MenuTarget): ResourceMenuTarget | null {
  if (typeof target !== 'object' || target === null) return null;
  const candidate = target as Partial<ResourceMenuTarget>;
  if (typeof candidate.dir !== 'string' || !Array.isArray(candidate.selection)) return null;
  if (candidate.ref !== null && typeof candidate.ref !== 'object') return null;
  return candidate as ResourceMenuTarget;
}

/**
 * Предикат видимости пункта по цели щелчка.
 *
 * Обёртка ради одного: без неё каждый вклад начинался бы с приведения `unknown` и проверки
 * на `null`, то есть с трёх строк, которые все напишут по-разному.
 */
export function whenResource(
  predicate: (target: ResourceMenuTarget, ctx: WhenContext) => boolean
): (ctx: WhenContext, target: MenuTarget) => boolean {
  return (ctx, target) => {
    const resource = asResourceTarget(target);
    // Нет цели — нет и пункта: он писался про строку дерева, а его открыли не над ней.
    return resource !== null && predicate(resource, ctx);
  };
}

/**
 * Аргументы команды по цели щелчка.
 *
 * `undefined` для чужой цели — команда получит его вместо адресов и откажется сама, что
 * честнее выдуманного аргумента.
 */
export function argsOfResource<T>(
  compute: (target: ResourceMenuTarget) => T
): (target: MenuTarget) => T | undefined {
  return (target) => {
    const resource = asResourceTarget(target);
    return resource === null ? undefined : compute(resource);
  };
}

/** Адреса выделенных ресурсов — самая частая форма аргументов команд дерева. */
export function selectedIds(target: ResourceMenuTarget): readonly ResourceId[] {
  return target.selection.map((ref) => ref.id);
}
