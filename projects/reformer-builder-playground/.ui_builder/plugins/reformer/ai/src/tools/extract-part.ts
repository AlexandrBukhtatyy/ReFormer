/**
 * `extract_part` — вынести блок в именованную часть документа и подключить её на его месте.
 *
 * Часть (`parts` + `$part(имя)`) — разметка, которую подключают к нескольким группам модели:
 * адрес регистрации и адрес проживания рисуются одной разметкой. Поля части пишут пути ОТ ГРУППЫ
 * (`city`, а не `registration.city`), поэтому вынос переписывает пути: всё, что лежит в блоке,
 * обязано лежать внутри группы `model`. Поле вне неё — отказ: в части ему было бы не к чему
 * привязаться. Шаблоны строк массивов внутри блока не трогаются — у строки своя область путей.
 *
 * Второе подключение той же части — `insert_node` с `{ part, model }`.
 *
 * @module plugins/reformer/ai/tools/extract-part
 */

import type { JsonNode } from '@reformer/renderer-json';
import { childSlots, documentParts, kindOf, PARTS_KEY, updateAt } from '../../../core/form-model';
import { commitBatch } from '../loop/gate';
import { isResolved, labelOf, modelOf, nodeRef, resolveRef } from '../model/node-ref';
import { fail, type AgentTool } from '../model/types';
import { REF_PROP } from './params';

interface Params {
  ref: string;
  /** Имя новой части. */
  name: string;
  /** Путь группы модели, к которой часть подключается на месте блока. */
  model: string;
}

/** Имя части — идентификатор: оно стоит в `$part(имя)` и ключом в `parts`. */
const PART_NAME = /^[A-Za-z][\w-]*$/;

export const extractPartTool: AgentTool<Params> = {
  name: 'extract_part',
  description:
    'Move a block into a named part mounted in its place for group model (inner paths become ' +
    'relative). Mount it again: insert_node { part, model }.',
  inputSchema: {
    type: 'object',
    properties: {
      ref: REF_PROP,
      name: { type: 'string' },
      model: { type: 'string', description: 'Group path the block fields live under' },
    },
    required: ['ref', 'name', 'model'],
    additionalProperties: false,
  },
  readOnly: false,
  run(params, ctx) {
    if (!PART_NAME.test(params.name)) {
      return fail('INVALID_PARAMS', `"${params.name}" is not a part name: use an identifier.`);
    }
    if (documentParts(ctx.draft).has(params.name)) {
      return fail('INVALID_PARAMS', `Part "${params.name}" already exists: pick another name.`);
    }
    const found = resolveRef(ctx.draft, params.ref);
    if (!isResolved(found)) return found;
    if (kindOf(found.node) !== 'container') {
      return fail(
        'INVALID_PARAMS',
        `${params.ref} is not a container: only a block becomes a part.`
      );
    }
    if (found.path[0] !== 'root') {
      return fail('INVALID_PARAMS', `${params.ref} is already inside a part.`);
    }

    const markup = structuredClone(found.node);
    const outside: string[] = [];
    relocate(markup, params.model, outside);
    if (outside.length > 0) {
      return fail(
        'INVALID_PARAMS',
        `Fields outside group "${params.model}" cannot move into the part: ${outside.join(', ')}.`
      );
    }

    const withPart = updateAt(ctx.draft, [PARTS_KEY], (parts) => ({
      ...((parts as Record<string, unknown> | undefined) ?? {}),
      [params.name]: markup,
    }));
    const mount = { model: `$model(${params.model})`, part: `$part(${params.name})` };
    const schema = updateAt(withPart, found.path, () => mount);
    const label = labelOf(found.node) ?? params.ref;
    return commitBatch(ctx, schema, [
      {
        ref: nodeRef(found.path),
        kind: 'update',
        summary: `${label} → часть «${params.name}» (${params.model})`,
        report: `${label} → part "${params.name}" bound to ${params.model}`,
      },
      {
        ref: nodeRef([PARTS_KEY, params.name]),
        kind: 'add',
        summary: `часть «${params.name}»`,
        report: `part "${params.name}"`,
      },
    ]);
  },
};

/**
 * Переписать пути модели узлов блока от группы — на месте, в копии. Поле вне группы (и сама
 * группа как поле) попадает в `outside`. В шаблон строки массива обход не заходит: там пути от
 * строки, и группа к ним отношения не имеет.
 */
function relocate(node: JsonNode, group: string, outside: string[]): void {
  const model = modelOf(node);
  if (model !== undefined) {
    if (model.startsWith(`${group}.`)) {
      (node as unknown as { model: string }).model = `$model(${model.slice(group.length + 1)})`;
    } else {
      outside.push(model);
    }
  }
  for (const slot of childSlots(node, [])) {
    if (slot.kind === 'template') continue;
    for (const entry of slot.entries) relocate(entry.node, group, outside);
  }
}
