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
 * системы». Сюда они не переезжают: и запрет живого рендера, и причина «почему не нашлось» —
 * ДАННЫЕ КИТА (`KitDescriptor.previewPolicy` / `unresolvedReason`), собранные из его каталога.
 * Модуль остался чистой логикой, а знание о конкретном ките — у кита.
 *
 * ## Порядок проверок значим
 *
 * 1. **Жёсткий запрет** — ДО резолва: оверлей нельзя рисовать вживую, даже если он есть
 *    в namespace. Radix-корень без триггера рисует невидимый узел, и подписанный стаб честнее
 *    пустоты. Часть compound'а наследует запрет корня — `DialogTitle` без своего `Dialog`
 *    рисуется в пустоту ровно так же.
 * 2. **Резолв** в namespace → живой компонент.
 * 3. **Не нашлось** → стаб с причиной кита, иначе с общей. Эта ветка — растяжка против дрейфа:
 *    новое каталожное имя без резолва и без объявленной причины видно сразу.
 *
 * @module plugins/preview/runtime/policy
 */

import type { CatalogEntry } from '@/lib/catalog/types';
import { exportNameFor } from '@/lib/kits/descriptor';
import type { KitDescriptor, KitNamespace } from '@/lib/kits/types';

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
 * Попадает ли запись каталога в реестр `$component`.
 *
 * Синтетика `$html(...)` и `FormArray` (роль `array`) рендерятся НАТИВНО, минуя реестр, —
 * их регистрация ничего бы не дала. Правило одно на реестр и на список известных имён:
 * две копии разошлись бы, и превью стало бы ругаться на компонент, который само же рисует.
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

/** Причина по умолчанию, когда кит своей не объявил. */
export function unresolvedReason(entry: CatalogEntry, descriptor: KitDescriptor): string {
  return (
    descriptor.unresolvedReason.get(entry.name) ??
    (entry.compoundParent === undefined
      ? undefined
      : descriptor.unresolvedReason.get(entry.compoundParent)) ??
    `не резолвится в ${descriptor.package}`
  );
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
