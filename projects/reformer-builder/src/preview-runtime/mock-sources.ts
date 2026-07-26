/**
 * Регистрация мок-заглушек для `$dataSource/$fn/$locale`, чтобы конвертер не падал на
 * app-specific источниках (спека §9: «`$dataSource/$fn/$locale` → мок-заглушки»).
 *
 * dataSource-имена, использованные как `itemLabel` массива, регистрируются ФУНКЦИЕЙ (иначе
 * компонент массива вызвал бы массив как функцию); остальные — пустым массивом (options).
 *
 * @module reformer-builder/preview-runtime/mock-sources
 */

import {
  isArrayNode,
  parseOperator,
  type JsonFormSchema,
  type RegistryBuilder,
} from '@reformer/renderer-json';
import { collectOperatorNames, walkNodes } from '../model';

/** dataSource-имена, использованные как `itemLabel` (нужны как функции, а не массивы). */
export function collectFunctionLikeDataSources(schema: JsonFormSchema): Set<string> {
  const names = new Set<string>();
  walkNodes(schema, (node) => {
    if (isArrayNode(node)) {
      const parsed = parseOperator(node.componentProps?.itemLabel);
      if (parsed?.op === 'dataSource') names.add(parsed.arg);
    }
  });
  return names;
}

/** Зарегистрировать заглушки всех `$dataSource/$fn/$locale`, встречающихся в схеме. */
export function registerMockSources(reg: RegistryBuilder, schema: JsonFormSchema): void {
  const { dataSources, fns, locales } = collectOperatorNames(schema);
  const functionLike = collectFunctionLikeDataSources(schema);

  for (const name of dataSources) {
    if (functionLike.has(name)) {
      reg.dataSource(name, (_: unknown, index = 0) => `#${index + 1}`);
    } else {
      reg.dataSource(name, [] as unknown[]);
    }
  }
  for (const name of fns) {
    reg.fn(name, () => '');
  }
  if (locales.length > 0) {
    // голый резолвер: ключ локализации → сам ключ (плейсхолдер)
    reg.locale((key: string) => key);
  }
}
