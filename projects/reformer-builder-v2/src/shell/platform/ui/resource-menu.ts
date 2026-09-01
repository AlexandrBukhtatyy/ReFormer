/**
 * Контекстное меню дерева ресурсов: цель щелчка и её типизация для вкладов.
 *
 * ## Здесь нет второй модели меню, и это главное
 *
 * Меню одно на приложение (`./menu`): пункт — ссылка на команду, группы дают разделители,
 * подменю адресуется путём. Контекстное меню дерева — просто ДРУГОЙ КОРЕНЬ этой модели
 * ({@link RESOURCE_CONTEXT_MENU}), а не отдельный механизм. Плагин, добавляющий пункт
 * в меню дерева, пишет ровно такой же вклад, как для «Файла», и его действие остаётся той же
 * командой — доступной из палитры, с клавиши и ассистенту.
 *
 * Единственное, чего в шапке нет и что обязано быть здесь, — ЦЕЛЬ: по чему щёлкнули.
 * Модель меню держит её непрозрачной (`MenuTarget = unknown`), потому что завтра контекстное
 * меню откроют над узлом схемы, а не над файлом. Этот модуль сужает `unknown` до формы,
 * которую понимает дерево, и даёт вкладам два помощника, чтобы им не приходилось приводить
 * типы руками.
 *
 * ## Каталог «внутрь которого» считается ОДИН раз
 *
 * Правило «каталог — сам он, файл — его родитель, пустое место — корень» живёт здесь
 * ({@link resourceMenuTarget}), а не у каждого вклада. Иначе «Новый файл…» от одного плагина
 * создавал бы файл рядом с выбранным, а от другого — внутрь него, и оба были бы уверены,
 * что поступают правильно.
 *
 * @module host/ui/resource-menu
 */

import { dirname, makeResourceId, type ResourceId, type ResourceRef } from '../primitives/resource';
import type { WhenContext } from '../primitives/when-context';
import type { ContextMenuId, MenuTarget } from './menu';

/** Адрес контекстного меню дерева: в него вносят пункты те, кому есть что предложить. */
export const RESOURCE_CONTEXT_MENU: ContextMenuId = 'resource/context';

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
 * Родитель ресурса как адрес.
 *
 * У ресурса верхнего уровня родитель — КОРЕНЬ источника (`fs:`), а не `null`: он существует
 * и в него можно создавать. `null` остаётся только у самого корня, у которого родителя нет
 * ни в каком смысле.
 */
export function parentIdOf(ref: ResourceRef): ResourceId | null {
  const parent = dirname(ref.path);
  if (parent === ref.path) return null;
  return makeResourceId(ref.sourceId, parent);
}

/**
 * Собирает цель щелчка, вычисляя каталог по единому правилу.
 *
 * `selection` передаётся готовым: «что выделено» — состояние дерева, и пересчитывать его
 * здесь значило бы иметь два ответа на один вопрос.
 */
export function resourceMenuTarget(
  ref: ResourceRef | null,
  selection: readonly ResourceRef[],
  rootId: ResourceId
): ResourceMenuTarget {
  const dir =
    ref === null ? rootId : ref.kind === 'directory' ? ref.id : (parentIdOf(ref) ?? rootId);
  return { ref, dir, selection, rootId };
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
