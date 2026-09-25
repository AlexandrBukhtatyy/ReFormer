/**
 * Порт редактора схемы из возможностей оболочки — то, что раньше собирала композиция.
 *
 * Порт ({@link SchemaEditorHost}) остался: панели, канвас и команды пишутся против него, и тест
 * подставляет его целиком. Изменилось, КТО его собирает. Раньше — оболочка, и ради этого она
 * знала, что провайдер `form.schema` принадлежит этому плагину и что каталог палитры — это
 * служба китов, то есть знала стек ReFormer. Теперь плагин собирает порт сам:
 *
 * - ручка модели — `DocumentModelsCapability`, сужение по идентификатору СВОЕГО провайдера;
 * - активная вкладка — `DocumentsService`;
 * - каталог и порядок палитры — служба китов по структурной копии ({@link KitCatalogCapability});
 * - перевод кодов находок и заголовков исправлений — словарь оболочки (`HostMessagesCapability`).
 *
 * Службы спрашиваются на КАЖДЫЙ вызов: кит переключают, проект закрывают, а порт живёт с плагином.
 *
 * @module plugins/reformer/editor/host-from-context
 */

import {
  defineCapability,
  DocumentModelsCapability,
  DocumentsServiceToken,
  HostMessagesCapability,
  useTranslate,
  type Disposable,
  type HostMessagesService,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import type { CatalogEntry } from '@reformer/builder-stack-reformer/catalog';
import type { KitDescriptor } from '@reformer/builder-stack-reformer/kits';
import { SCHEMA_MODEL_PROVIDER_ID } from './contract';
import type { SchemaEditorHost, SchemaModelHandle, Translate } from './host';

/**
 * Служба китов в объёме палитры и инспектора — структурная копия `KitsService` плагина китов.
 * Копия, а не импорт: плагины друг друга не импортируют, а реестр служб ключуется строкой.
 */
export interface KitCatalogReader {
  catalog(): readonly CatalogEntry[];
  descriptor(): KitDescriptor;
  onDidChange(cb: () => void): Disposable;
}

export const KitCatalogCapability = defineCapability<KitCatalogReader>({
  id: 'reformer.kit.catalog',
  version: '1.0.0',
});

const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);
const NOOP: Disposable = Object.freeze({ dispose: () => {} });

/** Словаря оболочки нет — показывают сам ключ: читаемо для разработчика, и ничего не падает. */
const NO_MESSAGES: HostMessagesService = Object.freeze({
  locale: '',
  t: (key: string) => key,
  onDidChangeLocale: () => NOOP,
});

export function schemaHostFromContext(
  ctx: Pick<PluginContext, 'services' | 'i18n'>
): SchemaEditorHost {
  const kits = () => ctx.services.get(KitCatalogCapability);
  const messages = () => ctx.services.get(HostMessagesCapability);

  // Именованные функции: правила хуков опознают хук по имени объявления.
  function useSchemaTranslate(): Translate {
    return useTranslate(ctx.i18n);
  }

  // Коды находок переводит словарь ОБОЛОЧКИ, а не плагина: одна ошибка обязана звучать
  // одинаково на узле канваса, в подчёркивании редактора кода и в панели проблем. Приставку
  // `errors.` ставит порт — плагин передаёт голый код.
  function useDiagnosticMessage(): Translate {
    const source = messages();
    const t = useTranslate(source ?? NO_MESSAGES);
    return (code, params) => (source === undefined ? code : t(`errors.${code}`, params));
  }

  // Заголовок исправления — ГОТОВЫЙ ключ словаря оболочки, без приставки: у исправления нет кода.
  function useQuickFixTitle(): Translate {
    return useTranslate(messages() ?? NO_MESSAGES);
  }

  return {
    useTranslate: useSchemaTranslate,
    useDiagnosticMessage,
    useQuickFixTitle,

    // Адрес активной вкладки: команде переключения вида он нужен, когда её зовут из палитры.
    activeDocument: () => ctx.services.get(DocumentsServiceToken)?.activeResource() ?? null,

    modelOf(id: ResourceId): SchemaModelHandle | null {
      const handle = ctx.services.get(DocumentModelsCapability)?.handleOf(id) ?? null;
      if (handle === null) return null;
      // Проверка, ради которой приведение ниже честное: ручка обещает `unknown` — оболочка
      // держит провайдеров разом несколько и ни об одной модели ничего не знает, — а документ,
      // который разобрал ИМЕННО наш провайдер, держит `JsonFormSchema`: другого `parse` у него
      // нет. Без неё редактор получил бы модель другого стека под своим типом.
      if (handle.document.providerId !== SCHEMA_MODEL_PROVIDER_ID) return null;
      return handle as unknown as SchemaModelHandle;
    },

    // Пустой каталог — не «кита нет», а «плагин китов ещё не активировался» или выключен:
    // палитра пуста, и перерисовать её придёт первое же изменение после подписки.
    catalog: () => kits()?.catalog() ?? NO_CATALOG,

    // Порядок разделов палитры объявляет сам кит (`palette.order` его дескриптора): «Формы,
    // потом Раскладка» — утверждение дизайн-системы о себе.
    categoryOrder: () => kits()?.descriptor().palette.order,

    onCatalogChange: (cb: () => void): Disposable => kits()?.onDidChange(cb) ?? NOOP,
  };
}
