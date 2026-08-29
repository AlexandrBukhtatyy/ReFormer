/**
 * Порт визуального редактора схемы, собранный из платформы.
 *
 * Отличие от портов файлов и Monaco одно: сюда приходит **каталог активного кита**. Редактор
 * без него работает, но бесполезен — палитре нечего предлагать, а инспектору нечего показывать
 * в свойствах. Каталог берётся из сервиса китов ЛЕНИВО, на каждый вызов: кит переключают,
 * и захваченный в замыкание список означал бы палитру от предыдущего кита.
 *
 * @module app/schema-host
 */

import type { ComponentType } from 'react';
import type { Disposable } from '../host/primitives/disposable';
import type { ResourceId } from '../host/primitives/resource';
import type { ServiceRegistry } from '../host/primitives/service';
import type { RootI18nService } from '../host/services/i18n/i18n';
import { useLocale } from '../host/ui/usePanels';
import type { CatalogEntry } from '../lib/catalog/types';
import { KitsServiceToken } from '../plugins/kits/service';
import { SCHEMA_EDITOR_PLUGIN_ID, SCHEMA_MODEL_PROVIDER_ID } from '../plugins/editor-schema';
import type { SchemaEditorHost, SchemaModelHandle, Translate } from '../plugins/editor-schema';
import { makeUseDiagnosticMessage, makeUseHostMessage } from './monaco-host';
import type { ProjectHost } from './project';

export interface SchemaHostDeps {
  readonly project: ProjectHost;
  readonly i18n: RootI18nService;
  readonly services: ServiceRegistry;
  /**
   * Тело редактора кода для показа схемы исходником.
   *
   * Собирается композицией из вклада Monaco: плагины друг друга не импортируют, а «показать
   * текстом» обязано показывать ТОТ ЖЕ редактор, в котором файл правится, — иначе это была
   * бы его урезанная копия со своими сочетаниями клавиш и своей подсветкой.
   */
  readonly TextEditor?: ComponentType<{ documentId: ResourceId }>;
}

/** Пустой каталог: одна замороженная ссылка вместо нового массива на каждый вызов. */
const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/** Реактивный перевод в пространстве имён плагина (именованная функция — ради правил хуков). */
function makeUseTranslate(i18n: RootI18nService): () => Translate {
  const view = i18n.forPlugin(SCHEMA_EDITOR_PLUGIN_ID);
  function useTranslate(): Translate {
    useLocale(i18n);
    return (key, params) => view.t(key, params);
  }
  return useTranslate;
}

export function createSchemaHost(deps: SchemaHostDeps): SchemaEditorHost {
  const { project, i18n, services } = deps;

  return {
    useTranslate: makeUseTranslate(i18n),
    // Адрес активной вкладки: команде переключения вида он нужен, когда её зовут
    // из палитры, где аргументов нет вовсе.
    activeDocument: () => project.get()?.documents.get().activeId ?? null,

    // Приходит от композиции и уходит в редактор как есть: плагин не выбирает редактор
    // и не знает, чей он.
    TextEditor: deps.TextEditor,
    // Тот же словарь Host, что у Monaco: находка на узле канваса и подчёркивание в тексте —
    // это одна ошибка, показанная дважды, и звучать она обязана одинаково.
    useDiagnosticMessage: makeUseDiagnosticMessage(i18n),
    // Заголовок исправления — ГОТОВЫЙ ключ словаря Host, без приставки: приставка `errors.`
    // существует для кодов диагностик, а у исправления кода нет.
    useQuickFixTitle: makeUseHostMessage(i18n),

    modelOf: (id: ResourceId): SchemaModelHandle | null => {
      const handle = project.get()?.models.handleOf(id) ?? null;
      if (handle === null) return null;
      // Проверка, ради которой приведение ниже честное: ручка обещает `unknown` — ядро
      // держит провайдеров разом несколько и ни об одной модели ничего не знает, — а вот
      // документ, который разобрал ИМЕННО этот провайдер, держит `JsonFormSchema`, потому
      // что другого `parse` у него нет. Идентификатор провайдера и есть это утверждение,
      // проверенное в рантайме; без него редактор схемы получил бы чужую модель под своим
      // типом на первом же втором формате.
      if (handle.document.providerId !== SCHEMA_MODEL_PROVIDER_ID) return null;
      return handle as SchemaModelHandle;
    },

    // Пустой каталог тут — не «кита нет», а «плагин китов ещё не активировался». Разница
    // видна пользователю одинаково (палитра пуста), но чинится по-разному, поэтому молчаливого
    // умолчания достаточно: активация плагинов идёт до первого показа панели.
    catalog: () => services.get(KitsServiceToken)?.catalog() ?? NO_CATALOG,

    // Порядок разделов палитры объявляет сам кит (`palette.order` его дескриптора), а не билдер:
    // «Формы, потом Раскладка, потом Навигация» — утверждение дизайн-системы о себе.
    categoryOrder: () => services.get(KitsServiceToken)?.descriptor().palette.order,

    // Подписка на сервис, а не на его отсутствие: сервис китов появляется при активации
    // плагина, и подписаться можно только после. Если его ещё нет — молчим и отдаём пустую
    // отписку: панель, отрисованная до активации, всё равно пуста, а перерисовать её
    // придёт первое же изменение после подписки.
    onCatalogChange(cb: () => void): Disposable {
      const kits = services.get(KitsServiceToken);
      return kits?.onDidChange(cb) ?? { dispose: () => {} };
    },
  };
}
