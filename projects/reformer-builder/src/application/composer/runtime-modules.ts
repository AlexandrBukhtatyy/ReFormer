/**
 * Модули, которые состав отдаёт исполняемому коду, — собранные ПО ПАПКАМ плагинов.
 *
 * Имён пакетов здесь нет ни одного, и это то же правило, что у карты плагинов
 * (`./builtin-plugins`): состав знает, КАК найти, а не ЧТО найдёт. Какие пакеты импортирует
 * код формы и как нарезан кит — знание плагина, и лежит оно у него: файлом `runtime-modules.ts`
 * рядом с манифестом. Новый стек приносит свои модули новой папкой, без правки этого файла
 * и без правки оболочки.
 *
 * ## Соглашение файла
 *
 * Два необязательных экспорта: `modules` — пары «спецификатор, объект экспортов», и
 * `lazyModules` — пары «спецификатор, загрузчик». Загрузчик — обычная функция с `import()`;
 * в обещание реестра (`lazyBuiltin`) её оборачивают здесь, потому что плагину `@/shell` не виден.
 *
 * ## Обход — НЕ отложенный, и стартовый граф от этого не растёт
 *
 * Реестр модулей создаётся ДО загрузки плагинов, а защищённый слот занимается только при
 * создании — поэтому списки нужны сразу. Файл со списком при этом не барель плагина: кода
 * плагина он не тянет, а статически импортирует лишь то, что и так лежит в стартовом графе
 * билдера. Всё тяжёлое в нём — `import()` и остаётся отдельным чанком.
 *
 * ## Один набор на все профили
 *
 * Модули берутся у ВСЕХ найденных плагинов, а не только у плагинов собранного профиля. Набор —
 * обещание сборщику внешнего плагина (`PLUGIN_RUNTIME_MODULES` пакета контракта): всё из него
 * плагин держит внешним, и профиль, отдавший меньше, уронил бы плагин, собранный «правильно».
 * Совпадение стережёт тест сборки (`shell/boot/integration/plugin-modules.test`).
 *
 * Один спецификатор у двух плагинов — отказ на старте: реестр не принимает слот дважды.
 *
 * @module application/composer/runtime-modules
 */

import type { ComposedModule } from '@/shell/boot/composition';
import { lazyBuiltin } from '@/shell/platform/modules/registry';

/** Что плагин может объявить в своём `runtime-modules.ts`. */
interface RuntimeModulesFile {
  readonly modules?: readonly (readonly [string, unknown])[];
  readonly lazyModules?: readonly (readonly [string, () => Promise<unknown>])[];
}

const FILES = import.meta.glob<RuntimeModulesFile>('../../plugins/*/*/runtime-modules.ts', {
  eager: true,
});

/** Модули всех плагинов. Порядок — по пути файла: детерминирован, но на поведение не влияет. */
export const RUNTIME_MODULES: readonly ComposedModule[] = Object.freeze(
  Object.keys(FILES)
    .sort()
    .flatMap((file): ComposedModule[] => {
      const declared = FILES[file];
      return [
        ...(declared?.modules ?? []),
        ...(declared?.lazyModules ?? []).map(
          ([specifier, load]): ComposedModule => [specifier, lazyBuiltin(load)]
        ),
      ];
    })
);
