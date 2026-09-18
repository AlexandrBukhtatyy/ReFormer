/**
 * Порт визуального редактора схемы, собранный из платформы.
 *
 * Отличие от портов файлов и Monaco одно.
 *
 * Сюда приходит **каталог активного кита**. Редактор без него работает, но бесполезен —
 * палитре нечего предлагать, а инспектору нечего показывать в свойствах. Каталог берётся
 * из сервиса китов ЛЕНИВО, на каждый вызов: кит переключают, и захваченный в замыкание список
 * означал бы палитру от предыдущего кита.
 *
 * Живого рендера формы здесь больше нет: его отдаёт плагин превью возможностью
 * `reformer.preview.live` из `@reformer/builder-plugin-api`, и редактор схемы спрашивает её сам.
 *
 * @module shell/boot/ports/schema
 */

import type { Disposable } from '@reformer/builder-plugin-api/internal';
import type { ResourceId } from '@reformer/builder-plugin-api/internal';
import type { ServiceRegistry } from '@reformer/builder-plugin-api/internal';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { useLocale } from '@reformer/builder-plugin-api/internal';
import type { CatalogEntry } from '@reformer/builder-stack-reformer/catalog';
import { KitsServiceToken } from '@/plugins/kits';
import {
  SCHEMA_EDITOR_PLUGIN_ID,
  SCHEMA_MODEL_PROVIDER_ID,
} from '@/plugins/editor-schema/contract';
import type { SchemaEditorHost, SchemaModelHandle, Translate } from '@/plugins/editor-schema';
import { makeUseDiagnosticMessage, makeUseHostMessage } from './monaco';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface SchemaHostDeps {
  readonly project: ProjectHost;
  readonly i18n: RootI18nService;
  readonly services: ServiceRegistry;
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
