/**
 * Печать скелета фикстуры: схема → готовый к правке TypeScript.
 *
 * Скелет — не «пример в комментарии», а рабочий файл: форма с ним собирается сразу, а человек
 * правит значения там, где они его не устраивают. Отсюда состав — ровно то, что синтезируется
 * из схемы (`lib/form-mock`), плюс закомментированные заготовки трёх остальных слоёв: показать,
 * ЧТО тут можно написать, дешевле любой документации, а исполняться оно не будет.
 *
 * Печатает только текст. Маркер происхождения, запись и форматирование — забота того, кто
 * доставляет файл (`lib/codegen/marker` и порт кодогена): здесь нет ни файловой системы,
 * ни знания о том, регенерация это или первое создание.
 *
 * @module plugins/reformer/core/form-fixture/emit
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { printLiteral } from '../codegen/print/js';
import { classifyDataSources, mockOptions, synthMock, type ValueTypeOf } from '../form-mock';

/**
 * Свойство объекта со значением-литералом JS — строкой файла с отступом `indent`, так, как её
 * оставит форматтер репозитория: ключи без кавычек, одинарные кавычки, запятые в конце. JSON
 * (`JSON.stringify`) давал фикстуру, которую `prettier --check` отвергал.
 */
function property(name: string, value: unknown, indent: number): string {
  const pad = ' '.repeat(indent);
  return printLiteral(value, { indent, prefix: `${name}: `, suffix: ',' })
    .split('\n')
    .map((line) => (line === '' ? line : `${pad}${line}`))
    .join('\n');
}

/**
 * Готовые значения поверх синтеза.
 *
 * Нужны шаблонам: синтез честно печатает `option1/2/3`, и по такому списку видно, что механизм
 * работает, но не видно, как выглядит форма. Шаблон знает свои данные и подставляет их —
 * а автор формы, создающий фикстуру командой, по-прежнему получает синтез.
 */
export interface FixtureSeed {
  readonly model?: Record<string, unknown>;
  readonly dataSources?: Readonly<Record<string, unknown>>;
}

/**
 * Скелет фикстуры для схемы.
 *
 * Функции печатаются кодом, а не данными: `itemLabel` массива обязан быть функцией, и заготовка,
 * которую нельзя вызвать, была бы хуже её отсутствия.
 *
 * @param valueTypeOf - Тип значения контрола из каталога активного кита (`valueTypesOf` из
 *   `core/codegen`) — та же таблица, по которой кодоген печатает начальные значения и тип формы.
 *   Без неё вид значения решают наборы имён и пропсы узла, и поле чужого кита (`CheckboxGroup`
 *   со `string[] | null`) получило бы в фикстуре `''` — значение, которого контрол не принимает.
 */
export function emitFixture(
  schema: JsonFormSchema,
  seed: FixtureSeed = {},
  valueTypeOf?: ValueTypeOf
): string {
  const synthesized = synthMock(schema, valueTypeOf);
  const mock = {
    model: { ...synthesized.model, ...seed.model },
    dataSources: { ...synthesized.dataSources, ...seed.dataSources },
  };
  const classes = classifyDataSources(schema);

  const optionLines = [...classes.optionLike]
    .sort()
    .map((name) => property(name, mock.dataSources[name] ?? mockOptions(name), 4));
  const scalarLines = [...classes.scalarLike]
    .sort()
    .map((name) => property(name, mock.dataSources[name] ?? '', 4));
  const functionLines = [...classes.functionLike]
    .sort()
    .map((name) => `    ${name}: (_item: unknown, index = 0) => \`#\${index + 1}\`,`);

  const dataSourceBody = [...optionLines, ...scalarLines, ...functionLines].join('\n');
  const dataSources =
    dataSourceBody === ''
      ? '  // dataSources: в схеме нет ни одного $dataSource.'
      : `  dataSources: {\n${dataSourceBody}\n  },`;

  return `/**
 * Фикстура формы: чем наполнить её в предпросмотре.
 *
 * Слои независимы — заполняйте только нужные:
 *   model        начальные значения (СТАРШЕ model/initial-value.ts: фикстура пишется ради проверки)
 *   dataSources  значения $dataSource
 *   modules      подстановка импортов формы (../api, @/shared/...) — форма не пойдёт в сеть
 *   http         перехват запросов, если форма всё же зовёт fetch
 *   clock        фиксированные Date.now() и Math.random()
 */

export const fixture = {
${property('model', mock.model, 2)}

${dataSources}

  // modules: {
  //   '../api': { submitForm: async () => ({ success: true, data: { id: 'X1' } }) },
  // },

  // http: [{ method: 'GET', url: /\\/api\\//, respond: { json: [] } }],

  // clock: { now: '2026-01-01T00:00:00Z', random: 0.42 },
};
`;
}
