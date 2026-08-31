/**
 * Регистрация значений `$dataSource/$fn/$locale` в реестре Runtime-preview. Источники разложены по
 * бакетам ({@link classifyDataSources}): `functionLike` (itemLabel массива) → функция; `optionLike`
 * (list-проп поля) → массив опций; `treeLike` (`nodes` дерева) → иерархия; `scalarLike` → скаляр.
 * Значения берутся из переданного `dataSources` (синтез ⊕ правки пользователя из панели мок-данных),
 * с fallback на синтез.
 *
 * @module reformer-builder/preview-runtime/mock-sources
 */

import { type JsonFormSchema, type RegistryBuilder } from '@reformer/renderer-json';
import { collectOperatorNames } from '../model';
import { classifyDataSources, mockOptions, mockTreeNodes } from './mock-synth';

/**
 * Зарегистрировать заглушки/значения всех `$dataSource/$fn/$locale` схемы.
 *
 * @param dataSources - эффективные значения option/scalar-источников (по имени). Пропуски —
 *   добираются синтез-дефолтом. functionLike всегда fn-заглушка (не сериализуется).
 */
export function registerMockSources(
  reg: RegistryBuilder,
  schema: JsonFormSchema,
  dataSources: Record<string, unknown> = {}
): void {
  const { functionLike, optionLike, treeLike, scalarLike } = classifyDataSources(schema);

  for (const name of functionLike) {
    reg.dataSource(name, (_: unknown, index = 0) => `#${index + 1}`);
  }
  for (const name of optionLike) {
    reg.dataSource(name, dataSources[name] ?? mockOptions(name));
  }
  // Дерево — отдельным дефолтом: плоские опции у `nodes` дали бы пустое дерево (в них нет `id`),
  // а строка-плейсхолдер уронила бы обход иерархии и вместе с ним всё превью.
  for (const name of treeLike) {
    reg.dataSource(name, dataSources[name] ?? mockTreeNodes(name));
  }
  for (const name of scalarLike) {
    reg.dataSource(name, dataSources[name] ?? 'значение');
  }

  const { fns, locales } = collectOperatorNames(schema);
  for (const name of fns) {
    reg.fn(name, () => '');
  }
  if (locales.length > 0) {
    // голый резолвер: ключ локализации → сам ключ (плейсхолдер)
    reg.locale((key: string) => key);
  }
}
