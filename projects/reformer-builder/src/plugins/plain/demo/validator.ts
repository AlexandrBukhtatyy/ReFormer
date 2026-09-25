/**
 * Валидатор демо-стека: находки `checkPlainForm` — в общий свод диагностик.
 *
 * Коды несут владельца (`reformer.plain:duplicate-name`): тексты лежат в словаре ЭТОГО плагина,
 * а не оболочки, — оболочка ошибок стека не знает. Цель находки — диапазон имени поля в тексте:
 * у формата нет идентификаторов узлов, и подчеркнуть можно только то место, где имя написано.
 *
 * @module plugins/plain/demo/validator
 */

import { checkPlainForm, isPlainForm } from '@reformer/builder-stack-plain';
import {
  pluginDiagnosticCode,
  type Diagnostic,
  type DocumentRef,
  type TextRange,
  type ValidatorContribution,
} from '@reformer/builder-plugin-api';
import { PLAIN_PLUGIN_ID, PLAIN_PROVIDER_ID, PLAIN_VALIDATOR_ID } from './contract';

/**
 * Где в тексте написано имя каждого поля — по порядку появления ключа `"name"`.
 *
 * Ключ `name` в формате встречается только у полей, поэтому i-е вхождение и есть i-е поле.
 * Диапазон — значение вместе с кавычками: пустое имя тоже должно быть видно.
 */
export function nameRanges(text: string): readonly TextRange[] {
  const ranges: TextRange[] = [];
  const pattern = /"name"\s*:\s*("(?:[^"\\]|\\.)*")/g;
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    const value = match[1]!;
    const start = match.index + match[0].length - value.length;
    ranges.push({ start, end: start + value.length });
  }
  return ranges;
}

export function createPlainValidator(): ValidatorContribution {
  return {
    id: PLAIN_VALIDATOR_ID,
    applies: (doc: DocumentRef) => doc.providerId === PLAIN_PROVIDER_ID,
    validate(ctx): readonly Diagnostic[] {
      const model = ctx.model();
      // Модели нет — буфер не разбирается; об этом уже сказал разбор, повторять незачем.
      if (!isPlainForm(model)) return [];
      const ranges = nameRanges(ctx.text());
      return checkPlainForm(model).map((problem) => {
        const range = ranges[problem.index];
        return {
          source: PLAIN_VALIDATOR_ID,
          severity: problem.code === 'no-options' ? 'warning' : 'error',
          code: pluginDiagnosticCode(PLAIN_PLUGIN_ID, problem.code),
          params: problem.params,
          target: range === undefined ? { kind: 'resource' } : { kind: 'range', range },
        };
      });
    },
  };
}
