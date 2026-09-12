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
import { createTextEditorFocusRegistry } from '@/shell/platform/workspace/model/text-editor-focus';

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
 * Новый объект на каждый вызов: реестр фокуса внутри — состояние, и два стенда, поделившие
 * его, проверяли бы друг друга. Словари не проверяются — перевод возвращает ключ; полнота
 * словарей живёт в `shell/boot/integration/i18n-completeness`.
 */
export function stubBuiltinOptions(): BuiltinPluginsOptions {
  return {
    i18n: { forPlugin: () => ({ t: (key: string) => key, contribute: () => {} }) },
    files: stubHost(),
    monaco: stubHost(),
    monacoFocus: createTextEditorFocusRegistry(),
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
