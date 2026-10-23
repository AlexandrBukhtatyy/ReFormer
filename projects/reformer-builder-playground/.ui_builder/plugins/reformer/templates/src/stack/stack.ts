/**
 * Стек ReFormer в шаблонах форм — ответы на вопросы хозяина шаблонов (`TemplateStack` SDK).
 *
 * Хозяин шаблонов (панель, хранилища проекта и браузера, снимок каталога, подстановка имени,
 * запись новой формы) общий для любого формата формы. Что из этого зависит от формата, он
 * спрашивает у стека:
 *
 * - **документ формы** среди файлов шаблона — схема ReFormer любого формата, документ модуля в
 *   `schema/` первым (`./document`); его хозяин открывает после создания формы;
 * - **перевод в формат 2** — схема и файлы шагов шаблона, снятого с формы прежнего формата;
 * - **вид формы** для шаблона на Eta (`it.form`) — полный вид генерации кодогена под активный кит;
 * - **токены имён модуля** — `__FormType__` и соседи (`./names`): так файлы шаблона ложатся в те же
 *   пути, в которые напечатает модуль генерация;
 * - **пустая форма** — один документ `schema/form.schema.json` с пустым корнем: так создаётся форма
 *   по описанию, без шаблона-образца;
 * - **место модуля и фикстуры** — раскладка кодогена (`modulePlacementOf`) и правило превью
 *   (`fixtureDirOf`): новую форму предлагают рядом с модулем открытого документа, а не внутри
 *   него, фикстура ложится в корень модуля.
 *
 * Встроенные шаблоны стек вносит отдельно — хранилищем (`./builtin`).
 *
 * @module plugins/reformer/templates/stack/stack
 */

import type { FormTemplate, TemplateStack } from '@reformer/builder-plugin-api';
import {
  buildView,
  modulePlacementOf,
  prepare,
  SCHEMA_DIR,
  SCHEMA_FILE,
  type KitView,
} from '../../../core/codegen';
import { printJson } from '../../../core/codegen/print/js';
import { fixtureDirOf } from '../../../core/form-fixture';
import { emptySchema } from '../../../core/form-model';
import { formDocumentOf, upgradeFormFiles } from './document';
import { moduleTokens } from './names';

/** Идентификатор стека — тот же, что у стека ReFormer в генерации кода. */
export const TEMPLATE_STACK_ID = 'reformer';

export interface TemplateStackOptions {
  /**
   * Активный кит — спрашивается на каждый вид: кит переключают. Без него вида формы нет —
   * импортировать компоненты неоткуда.
   */
  readonly kit: () => KitView | null;
}

/** Пустая форма — шаблон из одного документа. */
function emptyTemplate(): FormTemplate {
  return {
    id: 'empty',
    name: 'empty',
    source: 'builtin',
    files: [{ path: `${SCHEMA_DIR}/${SCHEMA_FILE}`, content: printJson(emptySchema()) }],
  };
}

/** Собирает стек ReFormer в шаблонах. */
export function createTemplateStack(options: TemplateStackOptions): TemplateStack {
  return {
    id: TEMPLATE_STACK_ID,
    owns: (files) => formDocumentOf(files) !== null,
    documentOf: (files) => formDocumentOf(files)?.file ?? null,
    upgrade: upgradeFormFiles,

    view(files, formName) {
      const kit = options.kit();
      if (kit === null) return null;
      const found = formDocumentOf(files);
      if (found === null) return null;
      return buildView(
        prepare({
          schema: found.schema,
          origins: found.origins,
          formName,
          kit,
          // Пути вида считаются от места документа В ШАБЛОНЕ: схема в `schema/` — папки ролей,
          // схема в корне — шаблон, снятый с формы прежней раскладки.
          schemaPath: modulePlacementOf(found.file.path).schemaPath,
        })
      );
    },

    tokens: moduleTokens,
    empty: emptyTemplate,

    // Свободно названный документ (`forms/credit.schema.json`) своего модуля не имеет: новая форма
    // встаёт рядом с ним. Документ модуля лежит в корне модуля (прежняя раскладка) либо в его
    // папке `schema/` — глубина и есть число сегментов его пути в модуле.
    moduleDepthOf(documentPath) {
      const placement = modulePlacementOf(documentPath);
      return placement.kind === 'detached' ? null : placement.schemaPath.split('/').length - 1;
    },

    fixtureDirOf,
  };
}
