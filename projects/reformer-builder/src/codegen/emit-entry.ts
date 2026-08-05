/**
 * Эмиттер `entry.ts` — запись реестра форм (`@reformer/form-registry`).
 *
 * Закрывает исходную дыру билдера: связка «id формы → модуль» была ручной. Билдер печатал
 * сниппет из трёх шагов («вставьте импорт, пункт списка и маршрут»), человек копировал его в
 * `App.tsx`, и с этого момента ничто не гарантировало, что копия соответствует сгенерированному
 * коду. `entry.ts` описывает форму данными — регистрация становится одной строкой, а всё
 * остальное берётся из самой записи.
 *
 * Файл относится к классу `derived`: им владеет машина, при регенерации он перезаписывается.
 * Граница «машина владеет / человек владеет» здесь та же, что и у остальных эмиттеров.
 *
 * Раскладка по источникам повторяет границу «данные / код»:
 * - схема сериализуема, поэтому объявлена `DataSource` и позже может стать `kind: 'http'`
 *   без единой правки в коде потребителя;
 * - реестр, поведение, фабрика модели и render-behavior — код, только из бандла (`CodeSource`).
 *
 * @module reformer-builder/codegen/emit-entry
 */

import type { Names } from './naming';

export function emitEntry(n: Names): string {
  return `// entry.ts — запись реестра форм. Регенерируется билдером; правки будут перезаписаны.

import type { FormEntry } from '@reformer/form-registry';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { schema } from './schema';
import { createRegistry } from './registry';
import { ${n.modelFactory} } from './model';
import { formBehavior } from './form.behavior';
import { createJsonRenderBehavior } from './renderer.behavior';
import type { ${n.TypeName} } from './types';

// ./schema типизирована как loose JsonFormSchema (машинно-сгенерирована); сужаем к модели формы.
const typedSchema = schema as unknown as JsonFormSchema<${n.TypeName}>;

/**
 * Запись формы «${n.title}».
 *
 * Регистрация в приложении — одна строка:
 * \`\`\`ts
 * import { getFormRegistry } from '@reformer/form-registry';
 * import { ${n.entryConst} } from './pages/examples/${n.dir}/entry';
 *
 * getFormRegistry().register(${n.entryConst});
 * \`\`\`
 *
 * После этого форма монтируется где угодно: \`<FormOutlet id="${n.exampleId}" />\`, либо через
 * слот/маршрут, если заполнить \`placement\`.
 */
export const ${n.entryConst}: FormEntry<${n.TypeName}> = {
  id: '${n.exampleId}',
  version: '1.0.0',
  // Кто зарегистрировал: по этому полю различаются одинаковые id из разных микрофронтов.
  owner: 'react-playground',

  // Данные — единственная часть, которую можно доставить по сети.
  schema: { kind: 'inline', value: typedSchema },

  // Код — только из бандла.
  registry: { kind: 'inline', value: createRegistry() },
  model: { kind: 'inline', value: ${n.modelFactory} },
  behavior: { kind: 'inline', value: formBehavior },
  // Адаптер, а не прямая ссылка: у \`createJsonRenderBehavior\` третий параметр — настройки места
  // (\`{ onResult }\`), а реестр третьим отдаёт правила валидации и только четвёртым — настройки
  // хоста. Без переходника это не компилируется, а \`onResult\` не доезжает никогда.
  // Настройки задаются на месте монтирования: <FormOutlet renderBehaviorOptions={{ onResult }} />.
  renderBehavior: {
    kind: 'inline',
    value: (form, model, _validation, options) =>
      createJsonRenderBehavior(form, model, options as { onResult?: (m: string, ok: boolean) => void }),
  },

  // Где показывать. Пусто — форма доступна только по id; заполните, чтобы показывать её
  // в слоте хоста или на маршруте.
  placement: { slots: [], routes: ['${n.routePath}'] },

  meta: {
    name: '${n.title}',
    tags: ['renderer-json', 'form-registry'],
  },
};
`;
}
