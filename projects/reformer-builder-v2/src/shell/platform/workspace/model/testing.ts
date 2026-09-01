/**
 * Подставной провайдер модели — «модель это список строк», и никакой схемы формы.
 *
 * **Формат нарочно чужой.** Проверять машинерию документа схемой формы означало бы проверять
 * её единственным форматом, который у нас есть, и молча утащить в тест знание, которого
 * у Host нет. Если ядро где-то опирается на JSON, на узлы схемы или на порядок ключей —
 * оно обязано сломаться здесь.
 *
 * Формат текста: одна строка на узел, `<id> <текст>`. Ошибка разбора вводится тривиально
 * (строка без идентификатора), а печать детерминирована — иначе перерисовка буфера
 * проверялась бы сравнением с самой собой.
 *
 * Провайдер держит structural sharing честно: `apply` переиспользует объекты нетронутых
 * узлов, поэтому тест может утверждать про идентичность, а не только про равенство.
 *
 * @module host/workspace/model/testing
 */

import type { ResourceRef } from '@/shell/platform/primitives/resource';
import type { ApplyResult, DocumentModelProvider, EditOp, NodeId } from './provider';

/** Узел подставной модели. */
export interface LineNode {
  readonly id: NodeId;
  readonly text: string;
}

/** Подставная модель: список узлов. Неизменяемая — как и положено модели документа. */
export interface LinesModel {
  readonly lines: readonly LineNode[];
}

export interface LinesProviderOptions {
  readonly id?: string;
  /** По каким ресурсам провайдер берётся. По умолчанию — по расширению `.lines`. */
  readonly applies?: (ref: ResourceRef) => boolean;
}

/** Строка формата: идентификатор, пробел, остальное. */
const LINE_PATTERN = /^([0-9a-z]+) (.*)$/;

/** Собирает текст подставного формата из пар «идентификатор — текст». */
export function printLines(model: LinesModel): string {
  return model.lines.map((line) => `${line.id} ${line.text}`).join('\n');
}

/**
 * Провайдер подставного формата.
 *
 * Идентификаторы выдаёт он сам и по возрастающему счётчику: «провайдер модели владеет выдачей»,
 * а недетерминированный источник случайности сделал бы недетерминированными и тесты правок.
 */
export function createLinesProvider(
  options: LinesProviderOptions = {}
): DocumentModelProvider<LinesModel> {
  const id = options.id ?? 'test.lines';
  const applies = options.applies ?? ((ref: ResourceRef): boolean => ref.path.endsWith('.lines'));
  let seq = 0;

  const nextId = (): NodeId => {
    seq += 1;
    return `n${seq}`;
  };

  const indexOf = (model: LinesModel, target: NodeId | undefined): number => {
    const at = model.lines.findIndex((line) => line.id === target);
    if (at === -1) throw new Error(`нет узла ${String(target)}`);
    return at;
  };

  return {
    id,

    applies(ref) {
      return applies(ref);
    },

    parse(text) {
      if (text === '') return { lines: [] };
      const lines = text.split('\n').map((raw, index) => {
        const matched = LINE_PATTERN.exec(raw);
        if (matched === null) {
          throw new Error(`строка ${index + 1} не разбирается: «${raw}»`);
        }
        return { id: matched[1], text: matched[2] };
      });
      const ids = new Set(lines.map((line) => line.id));
      if (ids.size !== lines.length) throw new Error('идентификаторы узлов повторяются');
      // Счётчик догоняет то, что уже лежит в тексте: выдать существующий идентификатор
      // значило бы создать двойника, на которого сработают правила исходного узла.
      for (const line of lines) {
        const numbered = /^n(\d+)$/.exec(line.id);
        if (numbered !== null) seq = Math.max(seq, Number(numbered[1]));
      }
      return { lines };
    },

    print: printLines,

    apply(model, op): ApplyResult<LinesModel> {
      switch (op.type) {
        case 'insert': {
          const at = Math.min(Number(op.params?.index ?? model.lines.length), model.lines.length);
          const node: LineNode = { id: nextId(), text: String(op.params?.text ?? '') };
          // Нетронутые узлы переезжают ССЫЛКАМИ: на этом стоит и снимок отмены, и сравнение.
          const lines = [...model.lines.slice(0, at), node, ...model.lines.slice(at)];
          return {
            model: { lines },
            inverse: { type: 'remove', target: node.id },
            focus: node.id,
          };
        }

        case 'remove': {
          const at = indexOf(model, op.target);
          const removed = model.lines[at];
          const lines = [...model.lines.slice(0, at), ...model.lines.slice(at + 1)];
          return {
            model: { lines },
            inverse: {
              type: 'insert',
              params: { index: at, text: removed.text },
            },
            // Выделение переезжает на соседа: узла, на котором оно стояло, больше нет.
            focus: lines[Math.min(at, lines.length - 1)]?.id,
          };
        }

        case 'set-text': {
          const at = indexOf(model, op.target);
          const previous = model.lines[at];
          const lines = [...model.lines];
          lines[at] = { id: previous.id, text: String(op.params?.text ?? '') };
          return {
            model: { lines },
            inverse: { type: 'set-text', target: previous.id, params: { text: previous.text } },
            focus: previous.id,
          };
        }

        default:
          throw new Error(`неизвестная операция: ${op.type}`);
      }
    },
  };
}

/** Операция вставки строки — чтобы тесты не собирали литерал каждый раз. */
export function insertLine(index: number, text: string): EditOp {
  return { type: 'insert', params: { index, text } };
}

export function setLineText(target: NodeId, text: string): EditOp {
  return { type: 'set-text', target, params: { text } };
}

export function removeLine(target: NodeId): EditOp {
  return { type: 'remove', target };
}
