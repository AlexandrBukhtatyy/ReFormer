/**
 * `$model(...)` читает путь, которого никто не объявил.
 *
 * Класс поломки — молчаливый no-op, худший в этом проекте. Модель формы строится из ОБЪЯВЛЕНИЙ
 * (`value` полей, `array` массивов); текстовая часть или проп с `$model(fulName)` в рантайме
 * даёт `No model signal` в консоли и пустоту на экране — ни ошибки, ни эффекта. Какие позиции
 * объявляют, а какие читают, — `form-model/model-scopes`; здесь только сверка и находка.
 *
 * ## Строгость — предупреждение, и это названная уступка
 *
 * Начальные значения могут прийти сайдкаром `model.ts`, который превью домешивает к модели, —
 * а соседнего ресурса валидатор сегодня не видит (то же ограничение `ValidateContext`, из-за
 * которого правила приходят параметром). Путь, объявленный только там, даст ложное срабатывание,
 * и ошибкой его помечать нельзя.
 *
 * ## Исправление — своей командой, не привязкой
 *
 * Находка всегда о позиции ЧТЕНИЯ, а `set-binding` правит позицию объявления. Поэтому чинит
 * `schema.set-model-read`: заменяет путь ровно в том месте (`within`), где он прочитан.
 * Предлагается, только когда есть ближайший объявленный путь — иначе подставить нечего.
 *
 * @module plugins/reformer/validator/checks/model-paths
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import {
  boundPathsIn,
  collectModelReads,
  collectModelScopes,
  isPathBound,
  type JsonPath,
} from '@reformer/builder-stack-reformer/form-model';
import { CODES, type DiagnosticCode } from '../codes';
import { nearestName } from '../nearest';

/** Находка до того, как стала диагностикой. */
export interface ModelPathFinding {
  readonly code: DiagnosticCode;
  readonly node: JsonNode;
  /** Место чтения внутри узла — подчёркивается значение. */
  readonly within: JsonPath;
  readonly params: Record<string, unknown>;
  /** Прочитанный путь — то, что исправление заменяет. */
  readonly path: string;
  /** Ближайший объявленный путь, если такой нашёлся. */
  readonly suggestion?: string;
}

export function unboundModelReads(schema: JsonFormSchema): ModelPathFinding[] {
  const scopes = collectModelScopes(schema);
  return collectModelReads(schema)
    .filter((read) => !isPathBound(read.path, boundPathsIn(scopes, read.scope)))
    .map((read) => {
      const suggestion = nearestName(boundPathsIn(scopes, read.scope), read.path);
      return {
        code: CODES.MODEL_PATH_UNBOUND,
        node: read.node,
        within: read.within,
        path: read.path,
        ...(suggestion === undefined ? {} : { suggestion }),
        // Ветка фразы выбирается ЯВНО: без подсказки фраза обязана быть другой, иначе на экране
        // появился бы маркер пропущенного аргумента, а не текст.
        params:
          suggestion === undefined
            ? { path: read.path, hint: 'no' }
            : { path: read.path, hint: 'yes', suggestion },
      };
    });
}
