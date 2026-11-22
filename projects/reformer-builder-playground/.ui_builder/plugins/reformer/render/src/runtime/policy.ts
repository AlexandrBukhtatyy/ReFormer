/**
 * Политика рендера рантайм-поверхности: для каждой каталожной записи решаем — рисовать ЖИВОЙ
 * компонент активного кита или показать нейтральный стаб «предпросмотр ограничен».
 *
 * Модуль React-free (значения кита проходят насквозь как `unknown`), поэтому проверяется
 * в node-окружении: подставить namespace в тесте — это подставить объект с функциями,
 * а не поднять браузер.
 *
 * ## Почему решение выведено, а не перечислено
 *
 * В v1 здесь жили два захардкоженных списка под `@reformer/ui-kit` — «единственная ручная ручка
 * системы». Сюда они не переезжают: запрет живого рендера — ДАННЫЕ КИТА
 * (`KitDescriptor.previewPolicy`), а «нашёлся ли компонент» — ФАКТ: символ в пространстве имён
 * кита либо есть, либо нет. Модуль остался чистой логикой, а знание о конкретном ките — у кита.
 *
 * ## Подпуть заглушкой не делает
 *
 * Подпуть записи (`KitDescriptor.subpaths`) говорит только, откуда импортируется её символ.
 * Пространство имён кит собирает сам — из главного входа и любых подпутей, — поэтому компонент
 * за подпутём рисуется вживую, как только его символ в пространстве имён есть (так живут
 * комбобокс и выбор даты встроенного кита). Подпуть нужен здесь в одном месте: объяснить
 * человеку, ПОЧЕМУ символа не нашлось, — этот вход пакета в превью не загружен.
 *
 * ## Порядок проверок значим
 *
 * 1. **Жёсткий запрет** — ДО резолва: оверлей нельзя рисовать вживую, даже если он есть
 *    в namespace. Radix-корень без триггера рисует невидимый узел, и подписанный стаб честнее
 *    пустоты. Часть compound'а наследует запрет корня — `DialogTitle` без своего `Dialog`
 *    рисуется в пустоту ровно так же.
 * 2. **Резолв** в namespace → живой компонент, лежит он в главном входе или за подпутём.
 * 3. **Не нашлось** → стаб с причиной: незагруженный подпуть, иначе общая. Эта ветка — растяжка
 *    против дрейфа: новое каталожное имя без резолва видно сразу.
 *
 * @module plugins/reformer/render/runtime/policy
 */

import type { CatalogEntry } from '../../../core/catalog';
import { exportNameFor } from '@reformer/builder-plugin-api';
import type { KitDescriptor, KitNamespace } from '@reformer/builder-plugin-api';

/** Решение политики для одной записи каталога. */
export type EntryPolicy =
  | { readonly policy: 'live'; readonly component: unknown }
  | { readonly policy: 'limited'; readonly reason: string };

/**
 * Похоже ли значение на React-компонент.
 *
 * Функция ИЛИ объект с `$$typeof` (`forwardRef`, `memo`, ленивый). Проверка структурная
 * намеренно: импортировать React ради `isValidElementType` значило бы затащить его в модуль,
 * который специально сделан React-free.
 */
export function isComponentLike(value: unknown): boolean {
  if (typeof value === 'function') return true;
  return typeof value === 'object' && value !== null && '$$typeof' in value;
}

/**
 * Попадает ли запись каталога в реестр `$component` ПО ОБЩЕМУ ПРАВИЛУ.
 *
 * Синтетика `$html(...)` рендерится нативно, минуя реестр. Запись массива (роль `array`) под
 * общее правило тоже не идёт: под её именем кит символа не объявляет, а узел массива без
 * `component` рендерер рисует сам — строки по шаблону. Узел с ЯВНЫМ компонентом обслуживает
 * {@link resolveArrayHost}. Правило одно на реестр и на список известных имён: две копии
 * разошлись бы, и превью стало бы ругаться на компонент, который само же рисует.
 */
export function isRegistrable(entry: Pick<CatalogEntry, 'name' | 'role'>): boolean {
  return entry.role !== 'array' && !entry.name.startsWith('$html(');
}

/** Значение кита для записи каталога. Имя символа считает `exportNameFor` — угадывать нельзя. */
export function resolveKitExport(
  entry: Pick<CatalogEntry, 'name' | 'exportName'>,
  namespace: KitNamespace
): unknown {
  const exported = namespace[exportNameFor(entry)];
  return isComponentLike(exported) ? exported : undefined;
}

/**
 * Почему символа записи нет в пространстве имён кита — текст для заглушки.
 *
 * Запись за подпутём называет вход пакета, который превью не загрузило: так человек видит, что
 * компонент у кита есть и где он лежит, а не «не резолвится». Часть compound'а без своего подпутя
 * объясняется подпутём корня — лежат они вместе. Иначе причина общая, с именем пакета.
 */
export function unresolvedReason(entry: CatalogEntry, descriptor: KitDescriptor): string {
  const subpath =
    descriptor.subpaths.get(entry.name) ??
    (entry.compoundParent === undefined
      ? undefined
      : descriptor.subpaths.get(entry.compoundParent));
  if (subpath === undefined) return `не резолвится в ${descriptor.package}`;
  return `лежит в ${descriptor.codegen.importSpecifier}/${subpath} — этот подпуть в превью не загружен`;
}

/** Политика для записи каталога. Порядок проверок — в шапке модуля. */
export function classifyEntry(
  entry: CatalogEntry,
  namespace: KitNamespace,
  descriptor: KitDescriptor
): EntryPolicy {
  const limit =
    descriptor.previewPolicy.get(entry.name) ??
    (entry.compoundParent === undefined
      ? undefined
      : descriptor.previewPolicy.get(entry.compoundParent));
  // Явный `preview: { mode: 'live' }` у записи снимает запрет, в том числе унаследованный
  // от корня compound'а, — поэтому сравнение с `'limited'`, а не проверка на наличие.
  if (limit?.mode === 'limited') {
    return { policy: 'limited', reason: limit.reason ?? 'предпросмотр ограничен' };
  }

  const component = resolveKitExport(entry, namespace);
  if (component !== undefined) return { policy: 'live', component };

  return { policy: 'limited', reason: unresolvedReason(entry, descriptor) };
}

/** Имя, под которым в схеме стоит компонент массива (синтетическая запись каталога). */
export const ARRAY_HOST_NAME = 'FieldArray';

/**
 * Компонент кита для узла-массива с явным компонентом (`component: $component(FieldArray)`).
 *
 * Так массив записан во встроенных шаблонах и в эталонной форме: компонент кита рисует заголовок,
 * «добавить» и «удалить», а строки — по шаблону узла. Запись каталога под этим именем
 * синтетическая (её пропсы описывает домен, а не кит), поэтому символ ищется прямо в пространстве
 * имён кита. Кит без такого компонента отдаёт `undefined` — узел останется подписанной
 * заглушкой, как любое имя, которого реестр не знает.
 */
export function resolveArrayHost(namespace: KitNamespace): unknown {
  const exported = namespace[ARRAY_HOST_NAME];
  return isComponentLike(exported) ? exported : undefined;
}

/**
 * Визард кита — компонент, которым рисуются узлы-хозяева шагов (`Wizard`, `FormWizard`, …).
 *
 * Хозяева шагов — синтетика каталога: под этими именами кит ничего не экспортирует, а под каким
 * символом он поставляет визард, говорит `descriptor.adapters.wizard`. Кит без визарда (адаптер
 * `null` или не объявлен) отдаёт `undefined` — хозяин шагов остаётся подписанным стабом.
 */
export function resolveWizard(descriptor: KitDescriptor, namespace: KitNamespace): unknown {
  const adapter = descriptor.adapters.wizard;
  if (adapter === null || adapter === undefined) return undefined;
  const exported = namespace[adapter.symbol];
  return isComponentLike(exported) ? exported : undefined;
}

/**
 * Инфраструктурные имена реестра → значения кита.
 *
 * `FormField`/`AsyncBoundary`/`List` — это КЛЮЧИ РЕЕСТРА, которыми адресуют схемы, а не имена
 * экспортов: под какими символами кит их поставляет, знает `descriptor.infra`. Поэтому ключи
 * не меняются со сменой кита, а значения меняются.
 */
export function resolveInfra(
  descriptor: KitDescriptor,
  namespace: KitNamespace
): Readonly<Record<string, unknown>> {
  return {
    FormField: namespace[descriptor.infra.fieldWrapper],
    AsyncBoundary: namespace[descriptor.infra.asyncBoundary],
    List: namespace[descriptor.infra.list],
  };
}
