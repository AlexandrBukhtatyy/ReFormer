/**
 * Композиция двух пакетов правок в один — то, на чём стоит схлопывание.
 *
 * **Зачем это вообще нужно.** Пакеты нельзя просто склеить списком: контракт
 * {@link applyTextEdits} требует, чтобы ВСЕ смещения пакета отсчитывались от текста ДО пакета,
 * а второй пакет отсчитан от текста ПОСЛЕ первого. Склейка дала бы правдоподобный, но неверный
 * результат — ровно ту порчу, которую обнаруживают через день и не связывают с историей.
 *
 * **Почему это выполнимо без самого текста.** Потому что `removed` хранится. Каждый пакет
 * самодостаточен: он знает, какие символы убрал и какие поставил, — и этого хватает, чтобы
 * пересобрать композицию в координатах основания. Единственное, чего мы не знаем, — нетронутые
 * куски основания; они в композицию и не попадают. Это и есть та плата за `removed`, ради
 * которой он в формате.
 *
 * ```text
 *  основание   a b c d e f
 *  пакет 1                 вставил «X» после «c», убрал «d»
 *  промежуток  a b c X e f
 *  пакет 2                 убрал «X e», вставил «Y»
 *  итог        a b c Y f
 *  композиция  {offset: 3, removed: 'de', inserted: 'Y'}   ← в координатах ОСНОВАНИЯ
 * ```
 *
 * Промежуточный текст разбирается на токены: куски основания (`base`), вставленное первым
 * пакетом (`ins`) и удалённое им (`gap` — нулевой длины в промежутке, но занимающее место
 * в основании). Токены непрерывны в координатах основания, поэтому «грязный» участок всегда
 * складывается в одну правку, а чистый кусок основания эту правку закрывает.
 *
 * @module host/workspace/journal/compose
 */

import type { TextEdit } from '../model/history';

/**
 * Токен промежуточного текста.
 *
 * `length` — длина в ПРОМЕЖУТОЧНОМ тексте, `baseLength` — в основании. У `ins` вторая нулевая
 * (текста в основании нет), у `gap` нулевая первая (в промежутке его уже нет).
 */
interface Token {
  readonly kind: 'base' | 'ins' | 'gap';
  readonly length: number;
  readonly baseFrom: number;
  readonly baseLength: number;
  /** Для `ins` — вставленное первым пакетом, для `gap` — удалённое им. */
  readonly text: string;
}

/** Отсортированная копия: порядок пакета не гарантирован, а вся арифметика идёт по возрастанию. */
function sorted(edits: readonly TextEdit[]): TextEdit[] {
  return [...edits].sort((a, b) => a.offset - b.offset);
}

/**
 * Промежуточный текст как последовательность токенов.
 *
 * @param needed докуда второму пакету нужен хвост основания; ровно на столько он и тянется.
 *   Знать полную длину текста не требуется — за пределами `needed` композиции нечего решать.
 */
function tokenize(first: readonly TextEdit[], needed: number): Token[] {
  const tokens: Token[] = [];
  let base = 0;
  let inter = 0;

  for (const edit of sorted(first)) {
    if (edit.offset > base) {
      const length = edit.offset - base;
      tokens.push({ kind: 'base', length, baseFrom: base, baseLength: length, text: '' });
      base = edit.offset;
      inter += length;
    }
    if (edit.removed !== '') {
      tokens.push({
        kind: 'gap',
        length: 0,
        baseFrom: base,
        baseLength: edit.removed.length,
        text: edit.removed,
      });
      base += edit.removed.length;
    }
    if (edit.inserted !== '') {
      tokens.push({
        kind: 'ins',
        length: edit.inserted.length,
        baseFrom: base,
        baseLength: 0,
        text: edit.inserted,
      });
      inter += edit.inserted.length;
    }
  }

  const tail = Math.max(0, needed - inter);
  tokens.push({ kind: 'base', length: tail, baseFrom: base, baseLength: tail, text: '' });
  // Замыкающий пустой токен: правка второго пакета может стоять ровно в конце текста
  // (дописывание), и ей нужна позиция, на которую она сядет.
  tokens.push({ kind: 'base', length: 0, baseFrom: base + tail, baseLength: 0, text: '' });
  return tokens;
}

/** Токен, разрезанный по промежуточному смещению. */
function splitToken(token: Token, at: number): [Token, Token] {
  if (token.kind === 'ins') {
    return [
      {
        kind: 'ins',
        length: at,
        baseFrom: token.baseFrom,
        baseLength: 0,
        text: token.text.slice(0, at),
      },
      {
        kind: 'ins',
        length: token.length - at,
        baseFrom: token.baseFrom,
        baseLength: 0,
        text: token.text.slice(at),
      },
    ];
  }
  return [
    { kind: 'base', length: at, baseFrom: token.baseFrom, baseLength: at, text: '' },
    {
      kind: 'base',
      length: token.length - at,
      baseFrom: token.baseFrom + at,
      baseLength: token.length - at,
      text: '',
    },
  ];
}

/** Складываемая правка в координатах основания. */
interface Draft {
  readonly baseFrom: number;
  baseTo: number;
  removed: string;
  inserted: string;
}

/**
 * Один пакет, равносильный последовательному применению двух.
 *
 * Гарантия: `applyTextEdits(applyTextEdits(t, first), second)` равно
 * `applyTextEdits(t, composeTextEdits(first, second))` для любого `t`, к которому применимы оба.
 *
 * Смещения — в кодовых единицах UTF-16, как и везде в журнале. Функция единиц не толкует
 * и суррогатные пары не склеивает: если второй пакет разрезал пару, вставленную первым,
 * то это уже сделал редактор, и композиция обязана сохранить его правку как есть, а не
 * «чинить» текст задним числом.
 *
 * @throws если второй пакет не ложится на текст, полученный из первого (правки пересекаются
 *   или уходят за его пределы). Такой пакет и применить было бы нельзя, а молча вернуть
 *   из него правдоподобный мусор хуже, чем отказать.
 */
export function composeTextEdits(
  first: readonly TextEdit[],
  second: readonly TextEdit[]
): readonly TextEdit[] {
  if (second.length === 0) return sorted(first);
  // Первого пакета нет — промежуточный текст и есть основание, второй пакет уже в его координатах.
  if (first.length === 0) return sorted(second);

  const ops = sorted(second);
  let needed = 0;
  for (const op of ops) needed = Math.max(needed, op.offset + op.removed.length);

  const tokens = tokenize(first, needed);
  const drafts: Draft[] = [];
  let open: Draft | null = null;

  const openAt = (baseFrom: number): Draft => {
    if (open !== null) return open;
    const draft: Draft = { baseFrom, baseTo: baseFrom, removed: '', inserted: '' };
    drafts.push(draft);
    open = draft;
    return draft;
  };
  const touch = (token: Token): Draft => {
    const draft = openAt(token.baseFrom);
    draft.baseTo = Math.max(draft.baseTo, token.baseFrom + token.baseLength);
    return draft;
  };

  let index = 0;
  let inter = 0;
  let opIndex = 0;
  /** Вставка текущей правки уже выпущена, идёт её удаление. */
  let inOp = false;
  /** Сколько удаляемого текущей правкой осталось разобрать по токенам. */
  let left = '';

  while (index < tokens.length) {
    const token = tokens[index];
    const op = opIndex < ops.length ? ops[opIndex] : undefined;

    // Правка начинается внутри токена — режем токен по её границе.
    if (op !== undefined && !inOp && op.offset > inter && op.offset < inter + token.length) {
      tokens.splice(index, 1, ...splitToken(token, op.offset - inter));
      continue;
    }

    // Правка начинается здесь: вставка садится на позицию основания этого токена.
    if (op !== undefined && !inOp && op.offset <= inter) {
      if (op.inserted !== '') openAt(token.baseFrom).inserted += op.inserted;
      if (op.removed === '') {
        opIndex += 1;
        continue;
      }
      inOp = true;
      left = op.removed;
      continue;
    }

    if (inOp) {
      // Удалённое первым пакетом место в промежутке не занимает, но в основании занимает:
      // удаление, перешагнувшее через него, обязано забрать эти символы с собой — иначе
      // композиция вырезала бы из основания разрыв.
      if (token.kind === 'gap') {
        touch(token).removed += token.text;
        index += 1;
        continue;
      }
      if (token.length > left.length) {
        tokens.splice(index, 1, ...splitToken(token, left.length));
        continue;
      }
      const draft = touch(token);
      // Символы основания известны только из `removed` второго пакета — оттуда их и берём.
      if (token.kind === 'base') draft.removed += left.slice(0, token.length);
      left = left.slice(token.length);
      inter += token.length;
      index += 1;
      if (left === '') {
        inOp = false;
        opIndex += 1;
      }
      continue;
    }

    if (token.kind === 'gap') {
      touch(token).removed += token.text;
      index += 1;
      continue;
    }
    if (token.kind === 'ins') {
      touch(token).inserted += token.text;
      inter += token.length;
      index += 1;
      continue;
    }
    // Нетронутый кусок основания закрывает запись: за ним начнётся другая правка, а символы
    // между ними нам неизвестны — и в правку они попасть не должны.
    if (token.length > 0) open = null;
    inter += token.length;
    index += 1;
  }

  if (inOp || opIndex < ops.length) {
    throw new Error('второй пакет правок не ложится на текст, полученный из первого');
  }

  return drafts
    .filter((draft) => draft.removed !== '' || draft.inserted !== '')
    .map((draft) => ({
      offset: draft.baseFrom,
      removed: draft.removed,
      inserted: draft.inserted,
    }));
}
