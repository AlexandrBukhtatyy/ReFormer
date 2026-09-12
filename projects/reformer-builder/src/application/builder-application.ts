/**
 * Приложение «ReFormer Builder» как СОСТАВ: из каких встроенных плагинов оно собрано.
 *
 * Оболочка знает форму композиции (`shell/boot/composition`), но не её содержимое, — поэтому
 * значение собирается здесь и приходит в `boot` параметром из `main.tsx`. Отсюда свойство, ради
 * которого слой и заведён: другое приложение на той же оболочке — это другое значение в этом
 * каталоге, а не правка `boot`.
 *
 * ОДИН объект, а не две функции по отдельному полю `BootOptions`: фазы обязаны приходить ПАРОЙ.
 * Разъехавшись, они дали бы приложение, у которого статический набор от одного состава, а ленивый
 * от другого, — и заметить это можно было бы только по пропавшей панели.
 *
 * Сами функции не переписаны в методы: `composer/builtin-plugins` объявляет их ровно той формы,
 * которую просит оболочка, и совпадение проверяется компиляцией этих двух строк. Обёртка вида
 * `eager: (o) => createEagerBuiltinPlugins(o)` спрятала бы расхождение сигнатур за стрелкой.
 *
 * @module application/builder-application
 */

import type { ApplicationComposition } from '@/shell/boot/composition';
import { createEagerBuiltinPlugins, loadLazyBuiltinPlugins } from './composer/builtin-plugins';

export const builderApplication: ApplicationComposition = Object.freeze({
  eager: createEagerBuiltinPlugins,
  lazy: loadLazyBuiltinPlugins,
});
