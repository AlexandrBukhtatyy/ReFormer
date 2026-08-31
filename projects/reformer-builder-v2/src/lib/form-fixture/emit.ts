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
 * @module reformer-builder/lib/form-fixture/emit
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { classifyDataSources, mockOptions, synthMock } from '../form-mock';

/** Литерал JSON с отступом в два пробела, сдвинутый на нужный уровень. */
function literal(value: unknown, indent: number): string {
  const text = JSON.stringify(value, null, 2) ?? 'undefined';
  const pad = ' '.repeat(indent);
  return text
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${pad}${line}`))
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
 */
export function emitFixture(schema: JsonFormSchema, seed: FixtureSeed = {}): string {
  const synthesized = synthMock(schema);
  const mock = {
    model: { ...synthesized.model, ...seed.model },
    dataSources: { ...synthesized.dataSources, ...seed.dataSources },
  };
  const classes = classifyDataSources(schema);

  const optionLines = [...classes.optionLike].sort().map((name) => {
    const value = mock.dataSources[name] ?? mockOptions(name);
    return `    ${name}: ${literal(value, 4)},`;
  });
  const scalarLines = [...classes.scalarLike]
    .sort()
    .map((name) => `    ${name}: ${JSON.stringify(mock.dataSources[name] ?? '')},`);
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
 *   model        начальные значения (СТАРШЕ model.ts: фикстура пишется ради проверки)
 *   dataSources  значения $dataSource
 *   modules      подстановка импортов формы (./api, @/shared/...) — форма не пойдёт в сеть
 *   http         перехват запросов, если форма всё же зовёт fetch
 *   clock        фиксированные Date.now() и Math.random()
 */

export const fixture = {
  model: ${literal(mock.model, 2)},

${dataSources}

  // modules: {
  //   './api': { submitForm: async () => ({ success: true, data: { id: 'X1' } }) },
  // },

  // http: [{ method: 'GET', url: /\\/api\\//, respond: { json: [] } }],

  // clock: { now: '2026-01-01T00:00:00Z', random: 0.42 },
};
`;
}
