/**
 * Опции встроенного набора для проверок состава — один стенд на всех, кто их проверяет.
 *
 * Проверок состава три, и все они спрашивают у композиции одно и то же: КТО собрался и что
 * он внёс. Поведение портов их не интересует вовсе — оно проверено у каждого плагина своими
 * тестами. Поэтому порты здесь пустышки, а стенд общий: три копии шестидесяти методов
 * расходились бы по одной на каждое изменение любого порта.
 *
 * Не `*.test.ts` намеренно: файл импортируют тесты из ДРУГИХ каталогов
 * (`shell/boot/integration`), а тест — не модуль, на который ссылаются. Цена в том, что файл
 * попадает под храповик «стартовый граф не импортирует барель ленивого плагина значением»
 * наравне с рабочим кодом; здесь это ровно то, что нужно.
 *
 * @module application/composer/testing
 */

import type { BuiltinPluginsOptions } from '@/shell/boot/composition';
import type { ServiceRegistry } from '@/shell/platform/primitives/service';
import {
  createEditorViewStates,
  EditorViewStatesToken,
} from '@/shell/platform/workspace/model/editor-view-states';
import {
  createTextEditorFocusRegistry,
  TextEditorFocusToken,
} from '@/shell/platform/workspace/model/text-editor-focus';

/**
 * Возможности оболочки, без которых встроенные плагины не поднимаются, — как в `boot`.
 *
 * Не пустышки: реестр фокуса и хранилище снимков вида настоящие, потому что подделывать
 * в них нечего — это карта и множество. Службы документов здесь НЕТ намеренно: она требует
 * рабочей области, а плагины, которым её не хватает, обязаны деградировать (`get`, не
 * `require`) — и стенд это проверяет самим своим существованием.
 *
 * Вызывается стендом, который плагины АКТИВИРУЕТ. Тому, кто их только создаёт, не нужно:
 * службы спрашиваются в `activate`.
 */
export function stubHostCapabilities(services: ServiceRegistry): void {
  services.register(TextEditorFocusToken, createTextEditorFocusRegistry());
  services.register(EditorViewStatesToken, createEditorViewStates());
}

/**
 * Порт-пустышка.
 *
 * Прокси, а не литерал с методами: у семи портов вместе больше шестидесяти методов, и держать
 * их список здесь значило бы переписывать этот файл на каждое изменение любого порта — то есть
 * получить вторую копию контрактов вдобавок к тем, что уже есть.
 */
export function stubHost(): never {
  return new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'then') return undefined;
        // Хуки обязаны быть функциями с именем на `use`: правила хуков смотрят на имя.
        return typeof prop === 'string' && prop.startsWith('use')
          ? function useStub(): unknown {
              return () => '';
            }
          : () => null;
      },
    }
  ) as never;
}

/**
 * Опции, на которых собирается любой профиль.
 *
 * Разделяемых состояний здесь больше нет ни одного: фокус, снимки вида и состояния превью
 * стали возможностями и живут в реестре служб, а не в опциях. Словари не проверяются —
 * перевод возвращает ключ; полнота словарей живёт в `shell/boot/integration/i18n-completeness`.
 */
export function stubBuiltinOptions(): BuiltinPluginsOptions {
  return {
    files: stubHost(),
    monaco: stubHost(),
    markdown: stubHost(),
    schema: stubHost(),
    ai: stubHost(),
    preview: stubHost(),
    codegen: stubHost(),
    templates: stubHost(),
    printTemplate: () => Promise.resolve([]),
    kits: {},
    pluginManager: { host: stubHost() },
  };
}
