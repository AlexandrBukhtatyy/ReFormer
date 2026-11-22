/**
 * Раскладка текста под ширину строки: документ из групп и возможных переносов и его печать.
 *
 * ## Зачем кодогену свой раскладчик
 *
 * Напечатанный модуль обязан проходить `prettier --check` как есть: иначе папку формы после
 * генерации приходится форматировать отдельным шагом и перевыставлять маркеры происхождения, а
 * билдер показывает человеку не тот текст, что окажется в репозитории. Тащить prettier в рантайм
 * плагина нельзя (мегабайты ради десятка конструкций), а «перенести, если длиннее ста» по месту
 * не работает: переносится ли вызов, зависит от того, поместился ли его ПОСЛЕДНИЙ аргумент, а
 * тот — от своих вложенных.
 *
 * Поэтому здесь тот же алгоритм, которым раскладывает сам prettier (Wadler: группа печатается в
 * строку, если помещается, иначе рвётся по своим переносам), — в объёме, нужном кодогену. Формы
 * документов для конструкций JS строит `./js`; совпадение с prettier закреплено тестом, который
 * сверяет вывод с настоящим форматтером.
 *
 * ## Что поддержано
 *
 * Строка, последовательность, отступ, группа (в том числе с несколькими состояниями — «условная
 * группа»), перенос (мягкий, обычный, жёсткий), ветвление по состоянию группы, заполнение строки
 * (`fill`) и принудительный разрыв родителя. Этого хватает на импорты, литералы, вызовы и
 * объявления; выравнивания, суффиксов строк и курсора здесь нет.
 *
 * @module plugins/reformer/core/codegen/print/doc
 */

/** Ширина строки по конфигу репозитория (`printWidth`). */
export const PRINT_WIDTH = 100;

/** Шаг отступа (`tabWidth`). */
export const TAB_WIDTH = 2;

export interface IndentDoc {
  readonly type: 'indent';
  readonly contents: Doc;
}

export interface GroupDoc {
  readonly type: 'group';
  readonly contents: Doc;
  /** Группа обязана порваться. Выставляется явно либо распространением жёсткого переноса. */
  break: boolean;
  /** Состояния условной группы — от самого сжатого к самому развёрнутому. */
  readonly expandedStates?: readonly Doc[];
  readonly id?: symbol;
}

export interface LineDoc {
  readonly type: 'line';
  /** В строку — ничего (иначе пробел). */
  readonly soft?: boolean;
  /** Перенос безусловный. */
  readonly hard?: boolean;
}

export interface IfBreakDoc {
  readonly type: 'if-break';
  readonly breakContents: Doc;
  readonly flatContents: Doc;
  /** Группа, по состоянию которой выбирается ветка; без неё — по объемлющей. */
  readonly groupId?: symbol;
}

export interface FillDoc {
  readonly type: 'fill';
  /** Чередование «содержимое, разделитель, содержимое…». */
  readonly parts: readonly Doc[];
  /** Сколько частей уже напечатано — служебное поле печати. */
  readonly offset?: number;
}

export interface BreakParentDoc {
  readonly type: 'break-parent';
}

export type Doc =
  | string
  | readonly Doc[]
  | IndentDoc
  | GroupDoc
  | LineDoc
  | IfBreakDoc
  | FillDoc
  | BreakParentDoc;

export const breakParent: BreakParentDoc = { type: 'break-parent' };

/** Пробел в строку, перенос при разрыве. */
export const line: LineDoc = { type: 'line' };

/** Ничего в строку, перенос при разрыве. */
export const softline: LineDoc = { type: 'line', soft: true };

/** Перенос всегда; рвёт все объемлющие группы. */
export const hardline: Doc = [{ type: 'line', hard: true }, breakParent];

export function indent(contents: Doc): IndentDoc {
  return { type: 'indent', contents };
}

export function group(
  contents: Doc,
  options: { shouldBreak?: boolean; id?: symbol } = {}
): GroupDoc {
  return {
    type: 'group',
    contents,
    break: options.shouldBreak === true,
    ...(options.id === undefined ? {} : { id: options.id }),
  };
}

/** Группа с несколькими состояниями: берётся первое, которое помещается, иначе последнее. */
export function conditionalGroup(states: readonly Doc[]): GroupDoc {
  return { type: 'group', contents: states[0] ?? '', break: false, expandedStates: states };
}

export function ifBreak(breakContents: Doc, flatContents: Doc = '', groupId?: symbol): IfBreakDoc {
  return {
    type: 'if-break',
    breakContents,
    flatContents,
    ...(groupId === undefined ? {} : { groupId }),
  };
}

/** Отступ содержимого, если названная группа порвалась. */
export function indentIfBreak(contents: Doc, groupId: symbol): IfBreakDoc {
  return ifBreak(indent(contents), contents, groupId);
}

export function fill(parts: readonly Doc[]): FillDoc {
  return { type: 'fill', parts };
}

/** Склеить документы разделителем. */
export function join(separator: Doc, docs: readonly Doc[]): Doc {
  const out: Doc[] = [];
  docs.forEach((doc, index) => {
    if (index > 0) out.push(separator);
    out.push(doc);
  });
  return out;
}

function isArray(doc: Doc): doc is readonly Doc[] {
  return Array.isArray(doc);
}

/**
 * Ширина строки в колонках.
 *
 * Кириллица — по колонке на знак; широкие знаки (иероглифы, полноширинные формы, эмодзи) — по
 * две, управляющие и комбинируемые — ноль. Так же считает prettier, и расхождение здесь дало бы
 * перенос на знак раньше или позже него.
 */
export function widthOf(text: string): number {
  if (/^[\x20-\x7e]*$/.test(text)) return text.length;
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) continue;
    if (code >= 0x300 && code <= 0x36f) continue;
    width += isWide(code) ? 2 : 1;
  }
  return width;
}

function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1faff) ||
    (code >= 0x20000 && code <= 0x3fffd)
  );
}

/** Есть ли в документе принудительный разрыв: жёсткий перенос либо группа, обязанная порваться. */
export function willBreak(doc: Doc): boolean {
  if (typeof doc === 'string') return false;
  if (isArray(doc)) return doc.some(willBreak);
  switch (doc.type) {
    case 'break-parent':
      return true;
    case 'line':
      return doc.hard === true;
    case 'group':
      return doc.break || willBreak(doc.contents);
    case 'indent':
      return willBreak(doc.contents);
    case 'fill':
      return doc.parts.some(willBreak);
    case 'if-break':
      return willBreak(doc.breakContents) || willBreak(doc.flatContents);
  }
}

/**
 * Распространить принудительные разрывы вверх по группам.
 *
 * Условная группа разрыв от детей не принимает: какое из её состояний печатать, решает она сама.
 * Поэтому рядом с условной группой, чьё содержимое рвётся, строитель ставит `breakParent` явно.
 */
function propagateBreaks(doc: Doc): void {
  const stack: GroupDoc[] = [];
  const seen = new Set<GroupDoc>();
  const breakParentGroup = (): void => {
    const parent = stack[stack.length - 1];
    if (parent !== undefined && parent.expandedStates === undefined) parent.break = true;
  };
  const visit = (node: Doc): void => {
    if (typeof node === 'string') return;
    if (isArray(node)) {
      node.forEach(visit);
      return;
    }
    switch (node.type) {
      case 'break-parent':
        breakParentGroup();
        return;
      case 'line':
        return;
      case 'indent':
        visit(node.contents);
        return;
      case 'fill':
        node.parts.forEach(visit);
        return;
      case 'if-break':
        visit(node.breakContents);
        visit(node.flatContents);
        return;
      case 'group': {
        stack.push(node);
        if (!seen.has(node)) {
          seen.add(node);
          if (node.expandedStates !== undefined) node.expandedStates.forEach(visit);
          else visit(node.contents);
        }
        stack.pop();
        if (node.break) breakParentGroup();
      }
    }
  };
  visit(doc);
}

type Mode = 'flat' | 'break';

interface Command {
  readonly indent: number;
  readonly mode: Mode;
  readonly doc: Doc;
}

/**
 * Помещается ли команда в остаток строки.
 *
 * Меряется до ПЕРВОГО возможного переноса: всё, что стоит после команды до конца строки
 * (`rest`), тоже занимает место — закрывающая скобка, запятая, точка с запятой.
 *
 * @param mustBeFlat - Группа, обязанная порваться, считается непомещающейся (так меряет `fill`).
 */
function fits(
  next: Command,
  rest: readonly Command[],
  remaining: number,
  groupModes: Map<symbol, Mode>,
  mustBeFlat = false
): boolean {
  let restIndex = rest.length;
  let pendingSpace = false;
  let width = remaining;
  const commands: { mode: Mode; doc: Doc }[] = [{ mode: next.mode, doc: next.doc }];
  while (width >= 0) {
    const command = commands.pop();
    if (command === undefined) {
      if (restIndex === 0) return true;
      restIndex -= 1;
      const pending = rest[restIndex] as Command;
      commands.push({ mode: pending.mode, doc: pending.doc });
      continue;
    }
    const { mode, doc } = command;
    if (typeof doc === 'string') {
      if (doc !== '') {
        if (pendingSpace) {
          width -= 1;
          pendingSpace = false;
        }
        width -= widthOf(doc);
      }
      continue;
    }
    if (isArray(doc)) {
      for (let i = doc.length - 1; i >= 0; i -= 1) commands.push({ mode, doc: doc[i] as Doc });
      continue;
    }
    switch (doc.type) {
      case 'fill': {
        for (let i = doc.parts.length - 1; i >= (doc.offset ?? 0); i -= 1) {
          commands.push({ mode, doc: doc.parts[i] as Doc });
        }
        break;
      }
      case 'indent':
        commands.push({ mode, doc: doc.contents });
        break;
      case 'group': {
        if (mustBeFlat && doc.break) return false;
        const groupMode: Mode = doc.break ? 'break' : mode;
        const contents =
          doc.expandedStates !== undefined && groupMode === 'break'
            ? (doc.expandedStates[doc.expandedStates.length - 1] as Doc)
            : doc.contents;
        commands.push({ mode: groupMode, doc: contents });
        break;
      }
      case 'if-break': {
        const groupMode: Mode =
          doc.groupId === undefined ? mode : (groupModes.get(doc.groupId) ?? 'flat');
        const contents = groupMode === 'break' ? doc.breakContents : doc.flatContents;
        if (contents !== '') commands.push({ mode, doc: contents });
        break;
      }
      case 'line':
        if (mode === 'break' || doc.hard === true) return true;
        if (doc.soft !== true) pendingSpace = true;
        break;
      case 'break-parent':
        break;
    }
  }
  return false;
}

export interface PrintOptions {
  /** Ширина строки; по умолчанию {@link PRINT_WIDTH}. */
  readonly width?: number;
  /**
   * Отступ, с которым текст ляжет в файл. В вывод он НЕ попадает (его ставит место вставки) — он
   * только сужает строку, под которую идёт раскладка.
   */
  readonly indent?: number;
}

/** Напечатать документ. Строки вывода — без внешнего отступа. */
export function printDoc(doc: Doc, options: PrintOptions = {}): string {
  const width = (options.width ?? PRINT_WIDTH) - (options.indent ?? 0);
  const groupModes = new Map<symbol, Mode>();
  const commands: Command[] = [{ indent: 0, mode: 'break', doc }];
  let output = '';
  let position = 0;
  let shouldRemeasure = false;

  propagateBreaks(doc);

  for (;;) {
    const command = commands.pop();
    if (command === undefined) break;
    const { indent: ind, mode, doc: current } = command;

    if (typeof current === 'string') {
      output += current;
      position += widthOf(current);
      continue;
    }
    if (isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        commands.push({ indent: ind, mode, doc: current[i] as Doc });
      }
      continue;
    }

    switch (current.type) {
      case 'indent':
        commands.push({ indent: ind + TAB_WIDTH, mode, doc: current.contents });
        break;

      case 'group': {
        if (mode === 'flat' && !shouldRemeasure) {
          commands.push({
            indent: ind,
            mode: current.break ? 'break' : 'flat',
            doc: current.contents,
          });
        } else {
          shouldRemeasure = false;
          const next: Command = { indent: ind, mode: 'flat', doc: current.contents };
          const remaining = width - position;
          if (!current.break && fits(next, commands, remaining, groupModes)) {
            commands.push(next);
          } else if (current.expandedStates !== undefined) {
            const states = current.expandedStates;
            const mostExpanded = states[states.length - 1] as Doc;
            if (current.break) {
              commands.push({ indent: ind, mode: 'break', doc: mostExpanded });
            } else {
              let chosen: Command = { indent: ind, mode: 'break', doc: mostExpanded };
              for (let i = 1; i < states.length; i += 1) {
                const candidate: Command = { indent: ind, mode: 'flat', doc: states[i] as Doc };
                if (fits(candidate, commands, remaining, groupModes)) {
                  chosen = candidate;
                  break;
                }
              }
              commands.push(chosen);
            }
          } else {
            commands.push({ indent: ind, mode: 'break', doc: current.contents });
          }
        }
        if (current.id !== undefined) {
          groupModes.set(current.id, (commands[commands.length - 1] as Command).mode);
        }
        break;
      }

      case 'fill': {
        const remaining = width - position;
        const offset = current.offset ?? 0;
        const { parts } = current;
        const length = parts.length - offset;
        if (length === 0) break;
        const content = parts[offset] as Doc;
        const whitespace = parts[offset + 1] as Doc;
        const contentFlat: Command = { indent: ind, mode: 'flat', doc: content };
        const contentBreak: Command = { indent: ind, mode: 'break', doc: content };
        const contentFits = fits(contentFlat, [], remaining, groupModes, true);
        if (length === 1) {
          commands.push(contentFits ? contentFlat : contentBreak);
          break;
        }
        const whitespaceFlat: Command = { indent: ind, mode: 'flat', doc: whitespace };
        const whitespaceBreak: Command = { indent: ind, mode: 'break', doc: whitespace };
        if (length === 2) {
          if (contentFits) commands.push(whitespaceFlat, contentFlat);
          else commands.push(whitespaceBreak, contentBreak);
          break;
        }
        const second = parts[offset + 2] as Doc;
        const twoFit = fits(
          { indent: ind, mode: 'flat', doc: [content, whitespace, second] },
          [],
          remaining,
          groupModes,
          true
        );
        commands.push({ indent: ind, mode, doc: { ...current, offset: offset + 2 } });
        if (twoFit) commands.push(whitespaceFlat, contentFlat);
        else if (contentFits) commands.push(whitespaceBreak, contentFlat);
        else commands.push(whitespaceBreak, contentBreak);
        break;
      }

      case 'if-break': {
        const groupMode =
          current.groupId === undefined ? mode : (groupModes.get(current.groupId) ?? 'flat');
        const contents = groupMode === 'break' ? current.breakContents : current.flatContents;
        if (contents !== '') commands.push({ indent: ind, mode, doc: contents });
        break;
      }

      case 'line':
        if (mode === 'flat' && current.hard !== true) {
          if (current.soft !== true) {
            output += ' ';
            position += 1;
          }
          break;
        }
        if (mode === 'flat') shouldRemeasure = true;
        // Хвостовые пробелы строки срезаются: пустая строка не несёт отступа.
        output = output.replace(/[ \t]+$/, '');
        output += `\n${' '.repeat(ind)}`;
        position = ind;
        break;

      case 'break-parent':
        break;
    }
  }
  return output.replace(/[ \t]+$/gm, '');
}
