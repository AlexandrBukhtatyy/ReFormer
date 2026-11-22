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
 * - каталог и порядок палитры — служба китов (`KitsCapability` SDK) и ReFormer-проекция её
 *   сырого каталога (`projectCatalog`): записи палитры с узлами по умолчанию и синтетикой билдера;
 * - перевод кодов находок и заголовков исправлений — словарь оболочки (`HostMessagesCapability`).
 *
 * Службы спрашиваются на КАЖДЫЙ вызов: кит переключают, проект закрывают, а порт живёт с плагином.
 *
 * @module plugins/reformer/editor/host-from-context
 */

import {
  DocumentModelsCapability,
  DocumentsServiceToken,
  HostMessagesCapability,
  KitsCapability,
  useTranslate,
  type Disposable,
  type DocumentsService,
  type HostMessagesService,
  type ModuleGeneratorService,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { projectCatalog, type CatalogEntry } from '../../core/catalog';
import { SCHEMA_MODEL_PROVIDER_ID } from './contract';
import type { SchemaEditorHost, SchemaModelHandle, SchemaRulesPort, Translate } from './host';
import type { RulesCache } from '../../core/codegen/rules-cache';
import { RULE_TARGET_IDS, rulesStackInput } from '../../core/codegen/rules-code';

const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);
const NOOP: Disposable = Object.freeze({ dispose: () => {} });

/** Словаря оболочки нет — показывают сам ключ: читаемо для разработчика, и ничего не падает. */
const NO_MESSAGES: HostMessagesService = Object.freeze({
  locale: '',
  t: (key: string) => key,
  diagnosticMessage: (code: string) => code,
  onDidChangeLocale: () => NOOP,
});

export function schemaHostFromContext(
  ctx: Pick<PluginContext, 'services' | 'i18n'>
): SchemaEditorHost {
  const kits = () => ctx.services.get(KitsCapability);
  const messages = () => ctx.services.get(HostMessagesCapability);

  // Именованные функции: правила хуков опознают хук по имени объявления.
  function useSchemaTranslate(): Translate {
    return useTranslate(ctx.i18n);
  }

  // Коды находок переводит словарь ВЛАДЕЛЬЦА кода, а не этого плагина: одна ошибка обязана
  // звучать одинаково на узле канваса, в подчёркивании редактора кода и в панели проблем.
  // Чей словарь и какая приставка — знает служба; плагин передаёт голый код.
  function useDiagnosticMessage(): Translate {
    const source = messages() ?? NO_MESSAGES;
    // Подписка на смену локали: значение нужно не переводу, а перерисовке.
    useTranslate(source);
    return (code, params) => source.diagnosticMessage(code, params);
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

    isDocumentOpen: (id: ResourceId) =>
      (ctx.services.get(DocumentsServiceToken)?.documentOf(id) ?? null) !== null,

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
    catalog: () => {
      const service = kits();
      return service === undefined ? NO_CATALOG : projectCatalog(service.catalogJson()).entries;
    },

    // Порядок разделов палитры объявляет сам кит (`palette.order` его дескриптора): «Формы,
    // потом Раскладка» — утверждение дизайн-системы о себе.
    categoryOrder: () => kits()?.descriptor().palette.order,

    onCatalogChange: (cb: () => void): Disposable => kits()?.onDidChange(cb) ?? NOOP,
  };
}

/**
 * Порт правил формы над кодом её модуля (`core/codegen/rules-code`).
 *
 * Чтение — из кэша (порт синхронный: им отвечает применимость быстрого исправления). Запись —
 * генерацией кода (`ModuleGeneratorCapability`): только файлы правил, с правилами вместо
 * прочитанных из кода. Своего принтера правил у редактора нет намеренно — второй разошёлся бы с
 * генерацией. Пометки нет: снятие правила заказал человек. Новые правила кэш прочтёт сам, по
 * событию рабочей области.
 *
 * @param generator - Спрашивается на каждую запись: плагин генерации выключаем на ходу.
 */
export function schemaRulesPort(
  cache: RulesCache,
  documents: Pick<DocumentsService, 'documentOf'>,
  generator: () => ModuleGeneratorService | undefined
): SchemaRulesPort {
  const pathOf = (id: ResourceId): string | null => documents.documentOf(id)?.ref.path ?? null;
  return {
    get(id) {
      const path = pathOf(id);
      return path === null ? null : (cache.get(id, path) ?? null);
    },
    set(id, rules) {
      const service = generator();
      if (service === undefined || pathOf(id) === null) return false;
      void service
        .generate(id, { stackInput: rulesStackInput(rules), only: RULE_TARGET_IDS })
        .then((report) => {
          if (!report.ok) {
            console.error('[schema-editor] правила не записаны', report.message);
            return;
          }
          // Правленный руками файл правил генерация не перепечатывает — правило в нём осталось.
          const kept = report.skipped.filter((file) => file.reason === 'edited');
          if (kept.length > 0) {
            console.warn(
              '[schema-editor] файлы правил правлены руками и не перепечатаны:',
              kept.map((file) => file.path).join(', ')
            );
          }
        });
      return true;
    },
  };
}
