/**
 * Перевод «узел → диапазон» — разбором текста с позициями.
 *
 * Так требует контракт диагностики (`docs/editors-and-preview.md`): у записи ровно одна цель,
 * структурная ошибка адресуется **идентификатором узла**, а перевод в диапазон делает тот,
 * кто РИСУЕТ, по тексту, который сейчас в редакторе. В v1 диапазон для узла вычисляется
 * симуляцией печати, и поэтому подчёркивание уезжает на иначе отформатированном JSON;
 * здесь позиция берётся из самого текста и уехать не может.
 *
 * ## Почему свой проход, а не `JSON.parse`
 *
 * `JSON.parse` позиций не отдаёт вовсе — ни узлам, ни ключам. Полноценный разбор с позициями
 * (`jsonc-parser`) — это зависимость и дерево на каждый показ диагностик; здесь нужно ровно
 * одно отношение «идентификатор → место», и один проход по строке даёт его за O(n) без
 * промежуточного дерева.
 *
 * ## Ограничение, которое надо знать
 *
 * Идентификаторы **выдаются при разборе, а записываются при первом сохранении** — нетронутый
 * файл не получает шумного diff. Значит в тексте только что открытого файла `$nodeId` может
 * не быть ни одного, и тогда перевести узел в диапазон нечем. Это не поломка: диагностика,
 * которую некуда положить, остаётся в списке нерешённых (см. `markers.ts`) и показывается
 * панелью проблем, а не подчёркиванием.
 *
 * Экранирование внутри строк не разворачивается: сравнение идёт по сырому содержимому,
 * а служебный ключ и восемь символов base36 экранирования не содержат. Закрывающую кавычку
 * при этом проход ищет честно — `"a\"b"` заканчивается там, где надо.
 *
 * @module plugins/editor-monaco/diagnostics/node-ranges
 */

import type { TextRange } from '@/sdk';

/**
 * Имя поля идентификатора. Форма — `^[0-9a-z]{8}$`, но проверять её здесь незачем:
 * искать надо то, что записал провайдер модели, а не то, что мы считаем правильным.
 */
export const NODE_ID_KEY = '$nodeId';

/** Где узел лежит в тексте. */
export interface NodeLocation {
  /**
   * Сам идентификатор вместе с кавычками — короткий якорь для подчёркивания.
   *
   * Подчёркивать узел целиком нельзя: контейнер занимает сотни строк, и маркер на всём
   * поддереве не показывает, где ошибка, — он закрашивает половину файла.
   */
  readonly anchor: TextRange;
  /** Объект узла целиком, от `{` до `}`. Нужен выделению и переходу к узлу, не маркеру. */
  readonly node: TextRange;
}

interface Frame {
  readonly start: number;
  readonly object: boolean;
  nodeId: string | null;
  anchor: TextRange | null;
}

interface StringToken {
  readonly value: string;
  /** Индекс сразу за закрывающей кавычкой. */
  readonly end: number;
}

/** Читает строковый литерал, начинающийся кавычкой в позиции `at`. `null` — литерал не закрыт. */
function readString(text: string, at: number): StringToken | null {
  let i = at + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '"') return { value: text.slice(at + 1, i), end: i + 1 };
    i += 1;
  }
  return null;
}

function skipWhitespace(text: string, at: number): number {
  let i = at;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  return i;
}

/**
 * Строит указатель «идентификатор узла → место в тексте».
 *
 * Повторный идентификатор — ошибка схемы, и находит её валидатор; здесь выигрывает первое
 * вхождение. Выбор произвольный, но детерминированный: диагностика обязана указывать
 * на одно и то же место при каждом показе одного и того же текста.
 *
 * Незакрытая строка, лишняя скобка, оборванный файл — не повод отказываться от уже
 * найденного: набранный наполовину JSON это НОРМАЛЬНОЕ состояние буфера, и половина
 * указателя лучше, чем ничего.
 */
export function indexNodeRanges(text: string): ReadonlyMap<string, NodeLocation> {
  const found = new Map<string, NodeLocation>();
  const stack: Frame[] = [];
  /** Ключ, чьё значение читается сейчас. */
  let key: string | null = null;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '"') {
      const token = readString(text, i);
      if (token === null) break;
      const after = skipWhitespace(text, token.end);
      if (text[after] === ':') {
        key = token.value;
        i = after + 1;
        continue;
      }
      const frame = stack[stack.length - 1];
      if (key === NODE_ID_KEY && frame !== undefined && frame.object) {
        frame.nodeId = token.value;
        frame.anchor = { start: i, end: token.end };
      }
      key = null;
      i = token.end;
      continue;
    }

    if (ch === '{' || ch === '[') {
      stack.push({ start: i, object: ch === '{', nodeId: null, anchor: null });
      key = null;
      i += 1;
      continue;
    }

    if (ch === '}' || ch === ']') {
      const frame = stack.pop();
      if (frame?.nodeId != null && frame.anchor !== null && !found.has(frame.nodeId)) {
        found.set(frame.nodeId, { anchor: frame.anchor, node: { start: frame.start, end: i + 1 } });
      }
      key = null;
      i += 1;
      continue;
    }

    if (ch === ',') key = null;
    i += 1;
  }

  return found;
}
