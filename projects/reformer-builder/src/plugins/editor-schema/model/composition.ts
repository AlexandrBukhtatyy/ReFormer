/**
 * Схема визарда из нескольких файлов — способность `composition` провайдера модели схемы.
 *
 * Корень держит в `componentProps.steps` ссылки `{ "$ref": "./steps/<шаг>/form.schema.json" }`,
 * шаги лежат в своих файлах. Оболочка читает файлы и ведёт документ, а что считать частью и куда
 * положить узел, отвечает здесь стек (`joinFormSchema` / `splitFormSchema`). Раскладка — карта
 * `$nodeId` шага → его файл: по ней переименованный шаг остаётся в своей папке, а новый шаг
 * разбитой формы сразу получает свой файл.
 *
 * @module plugins/editor-schema/model/composition
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  joinFormSchema,
  splitFormSchema,
  stepRefsOf,
  type NodeIdFactory,
  type StepOrigins,
} from '@reformer/builder-stack-reformer/form-model';
import type { DocumentComposition } from '@reformer/builder-plugin-api';

/** Отступ печати файла шага — тот же, что у корня. */
const INDENT = 2;

function printPart(part: unknown): string {
  return `${JSON.stringify(part, null, INDENT)}\n`;
}

function originsOf(layout: unknown): StepOrigins {
  return layout instanceof Map ? (layout as StepOrigins) : new Map();
}

/** Сборка и разбиение схемы формы по файлам шагов. */
export function formSchemaComposition(newId?: NodeIdFactory): DocumentComposition<JsonFormSchema> {
  return {
    references: (root) => stepRefsOf(root),

    compose(root, parts) {
      const parsed = new Map<string, unknown>();
      for (const [spec, text] of parts) {
        try {
          parsed.set(spec, JSON.parse(text) as unknown);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`файл шага «${spec}» не разбирается: ${reason}`);
        }
      }
      const { schema, origins } = joinFormSchema(root, parsed, newId);
      return { model: schema, layout: origins };
    },

    decompose(model, layout, restructure) {
      // «Собрать в один файл» — раскладка без частей; «разбить» — все шаги первого визарда.
      const origins = restructure === 'join' ? new Map() : originsOf(layout);
      const split = splitFormSchema(model, origins, { all: restructure === 'split' });
      const parts = new Map<string, string>();
      for (const [ref, part] of split.parts) parts.set(ref, printPart(part));
      return { root: split.skeleton, parts, layout: split.origins };
    },
  };
}
