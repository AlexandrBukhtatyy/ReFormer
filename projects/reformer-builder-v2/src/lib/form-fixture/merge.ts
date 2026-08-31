/**
 * Слияние слоёв данных: что в итоге увидит форма.
 *
 * ## Порядок старшинства
 *
 * ```text
 * synthMock(schema)  <  model.ts  <  fixture  <  введённое человеком
 * ```
 *
 * Синтез — база: он покрывает КАЖДЫЙ путь схемы, и без него поле, забытое во всех остальных
 * слоях, осталось бы без начального значения, то есть и без сигнала (см. `lib/form-mock`).
 *
 * Фикстура старше `model.ts`, и это единственное неочевидное место. Довод: `model.ts` описывает,
 * с чем форма открывается в приложении, а фикстура — то, с чем её сейчас ПРОВЕРЯЮТ. Будь она
 * младше, проверка «как выглядит форма с пустой моделью» стала бы невыразимой: `model.ts` всегда
 * перебивал бы. Обратный порядок ничего бы не дал взамен — человек и так может не заводить
 * фикстуру вовсе.
 *
 * Введённое человеком старше всего и приезжает не сюда, а отдельным шагом (`runtime/carry`):
 * оно переносится только туда, где новая форма оставила для него место.
 *
 * @module reformer-builder/lib/form-fixture/merge
 */

import type { FormMock } from '../form-mock';
import type { FixtureModel, FormFixture } from './types';

/** Значения формы. Приходят из схемы, и сузить их нечем. */
type Shape = Record<string, unknown>;

function isPlainObject(value: unknown): value is Shape {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Слияние вглубь: значения `patch` перекрывают `base`, объекты сливаются рекурсивно.
 *
 * Массивы НЕ сливаются поэлементно, а заменяются целиком: список из трёх опций, перекрытый
 * списком из одной, обязан стать списком из одной — поэлементное слияние дало бы три,
 * из которых две от прежнего слоя.
 */
export function deepMerge(base: Shape, patch: Shape): Shape {
  const out: Shape = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const previous = out[key];
    out[key] = isPlainObject(previous) && isPlainObject(value) ? deepMerge(previous, value) : value;
  }
  return out;
}

/** Что получилось из трёх слоёв данных. Форма совпадает с {@link FormMock} — она и есть результат. */
export type MergedData = FormMock;

/**
 * Складывает синтез, `model.ts` и фикстуру в то, чем будет заполнена форма.
 *
 * @param synthesized база из схемы ({@link FormMock} от `synthMock`)
 * @param declared начальные значения из `model.ts`; `undefined` — сайдкара нет или он не собрался
 * @param fixture авторская фикстура; `null` — её не заводили
 */
export function mergeFormData(
  synthesized: FormMock,
  declared: FixtureModel | undefined,
  fixture: FormFixture | null
): MergedData {
  let model: Shape = synthesized.model;
  if (declared !== undefined) model = deepMerge(model, declared);
  if (fixture?.model !== undefined) model = deepMerge(model, fixture.model);

  // Источники данных не сливаются вглубь: значение `$dataSource` — это целиком список опций,
  // скаляр или функция, и «частично перекрыть» его нечем.
  const dataSources: Record<string, unknown> = { ...synthesized.dataSources };
  if (fixture?.dataSources !== undefined) Object.assign(dataSources, fixture.dataSources);

  return { model, dataSources };
}
