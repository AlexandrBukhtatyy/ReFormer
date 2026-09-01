/**
 * Условие применимости как ДАННЫЕ: разбор, вычисление, специфичность.
 *
 * ## Зачем понадобилось, если есть `enabled(ctx)`
 *
 * Предикат отвечает на вопрос «доступна ли команда сейчас» и больше ни на какой. Всё
 * остальное, что нужно клавиатуре, требует условие ПРОЧИТАТЬ, а функцию прочитать нельзя:
 *
 * - **сравнить два условия** — без этого нельзя решить, чья клавиша выигрывает, и `delete`
 *   в проекте сегодня разводится порядком регистрации плагинов, который по контракту
 *   ничего не значит (см. `plugin/registry.test.ts`);
 * - **доказать, что два условия не пересекаются** — без этого всякая пара на одной клавише
 *   выглядит конфликтом, даже «в дереве» против «на канвасе»;
 * - **записать в файл** — манифест плагина и раскладка пользователя это текст;
 * - **показать человеку** — в таблице клавиш условие обязано быть видно, иначе строка
 *   «Delete — удалить» повторяется дважды и объяснить разницу нечем.
 *
 * Поэтому условие становится строкой с грамматикой, а `enabled` остаётся — они отвечают
 * на разные вопросы. Водораздел проведён в шапке `./command`: `when` — про состояние
 * платформы (где фокус, что открыто), `enabled` — про приватное состояние владельца
 * (есть ли что отменять). Второе данными быть не может и переводу не подлежит.
 *
 * ## Чего в грамматике нет
 *
 * Арифметики, вызовов, присваивания. Ограничение не про аскетизм: специфичность считается
 * обходом дерева, и как только в условии появится вычисление, она перестанет быть
 * определимой — а вместе с ней и правило «кто выигрывает».
 *
 * ## Отношение к платформе и DOM
 *
 * Никакого. Модуль лежит в `primitives` рядом с `normalizeKeybinding` и по той же причине:
 * его зовут двое — реестр команд (проверка на регистрации) и диспетчер клавиш (вычисление
 * на нажатии), а `primitives` не имеет права импортировать `ui`.
 *
 * @module host/primitives/when-expr
 */

/** Значение в правой части сравнения. Только литерал — см. {@link parseWhen}. */
export type WhenLiteral = string | number | boolean | null;

/**
 * Узел разобранного условия.
 *
 * `negated` полем, а не обёрткой `not`, у сравнений — несущее решение: `a != b` и `!(a == b)`
 * обязаны давать ОДНУ структуру. Разойдись они, два одинаковых по смыслу правила получили бы
 * разную специфичность, по-разному участвовали бы в разрешении конфликта и выглядели бы
 * разными в редакторе клавиш — при том, что человек написал одно и то же.
 */
export type WhenNode =
  | { readonly kind: 'true' }
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'not'; readonly operand: WhenNode }
  | { readonly kind: 'and'; readonly operands: readonly WhenNode[] }
  | { readonly kind: 'or'; readonly operands: readonly WhenNode[] }
  | {
      readonly kind: 'eq';
      readonly key: string;
      readonly value: WhenLiteral;
      readonly negated: boolean;
    }
  | {
      readonly kind: 'match';
      readonly key: string;
      readonly pattern: string;
      readonly flags: string;
      readonly negated: boolean;
    }
  | {
      readonly kind: 'in';
      readonly key: string;
      readonly collection: string;
      readonly negated: boolean;
    };

/** Разобранное условие вместе со всем, что выводится из него один раз. */
export interface WhenExpr {
  /** Как написано человеком. Показывается в редакторе клавиш и в диагностике. */
  readonly source: string;
  readonly ast: WhenNode;
  /**
   * Ключи, которые условие ЧИТАЕТ, отсортированные и без повторов. Включает правую часть
   * `in`: по этому набору подписываются на изменения контекста и по нему же считается
   * диагностика «условие ссылается на ключ, которого никто не объявил».
   */
  readonly keys: readonly string[];
  /** Насколько узко условие называет место. Считается при разборе — см. {@link whenSpecificity}. */
  readonly specificity: number;
}

/**
 * Отказ разбора. Не `CommandError` намеренно: тот живёт в `./command`, который импортирует
 * этот модуль, и обратная ссылка замкнула бы цикл. Реестр команд ловит эту ошибку и
 * заворачивает в свой `CommandError('invalid-when')` — там, где у отказа появляется
 * идентификатор команды.
 */
export class WhenSyntaxError extends Error {
  /** Смещение в исходной строке — редактор подсветит место, а не всю строку. */
  readonly at: number;
  readonly source: string;

  constructor(message: string, source: string, at: number) {
    super(`условие «${source}» разобрать нельзя: ${message}`);
    this.name = 'WhenSyntaxError';
    this.source = source;
    this.at = at;
  }
}

export interface WhenParseError {
  readonly message: string;
  readonly at: number;
  readonly source: string;
}

export type WhenParseResult =
  | { readonly ok: true; readonly expr: WhenExpr }
  | { readonly ok: false; readonly error: WhenParseError };

// ── Лексер ──────────────────────────────────────────────────────────────────────

type TokenKind = 'word' | 'number' | 'string' | 'regex' | 'op' | 'end';

interface Token {
  readonly kind: TokenKind;
  /** Для `word`/`op` — текст как есть; для `string` и `regex` — уже без ограничителей. */
  readonly text: string;
  readonly at: number;
  /** Только у `regex`: флаги, снятые с хвоста шаблона. */
  readonly flags?: string;
}

/**
 * Слово: ключ (`focus`, `schemaEditor.nodeSelected`) либо литерал без кавычек (`form.schema`).
 * Различает их не лексер, а парсер — по позиции: слева от оператора это ключ, справа литерал.
 */
const WORD_START = /[A-Za-z_]/;
const WORD_BODY = /[A-Za-z0-9_.-]/;

const OPERATORS = ['&&', '||', '==', '!=', '=~', '!', '(', ')'] as const;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const at = i;
      i += 1;
      let value = '';
      while (i < source.length && source[i] !== ch) {
        // Экранирование одного уровня: кавычка внутри кавычек и сам обратный слэш.
        if (source[i] === '\\' && i + 1 < source.length) {
          value += source[i + 1];
          i += 2;
          continue;
        }
        value += source[i];
        i += 1;
      }
      if (i >= source.length) throw new WhenSyntaxError('строка не закрыта', source, at);
      i += 1;
      tokens.push({ kind: 'string', text: value, at });
      continue;
    }

    // Косая черта начинает шаблон и ничего другого: деления в грамматике нет, поэтому
    // разбирать её по месту, а не по контексту, однозначно. Читается здесь, а не в парсере,
    // потому что содержимое шаблона общим правилам лексера не подчиняется вовсе.
    if (ch === '/') {
      const at = i;
      i += 1;
      let pattern = '';
      while (i < source.length && source[i] !== '/') {
        if (source[i] === '\\' && i + 1 < source.length) {
          pattern += source.slice(i, i + 2);
          i += 2;
          continue;
        }
        pattern += source[i];
        i += 1;
      }
      if (i >= source.length) throw new WhenSyntaxError('шаблон не закрыт', source, at);
      i += 1;
      let flags = '';
      while (i < source.length && /[a-z]/.test(source[i])) {
        flags += source[i];
        i += 1;
      }
      try {
        new RegExp(pattern, flags);
      } catch {
        throw new WhenSyntaxError(`шаблон «${pattern}» не разбирается`, source, at);
      }
      tokens.push({ kind: 'regex', text: pattern, at, flags });
      continue;
    }

    const operator = OPERATORS.find((op) => source.startsWith(op, i));
    if (operator !== undefined) {
      tokens.push({ kind: 'op', text: operator, at: i });
      i += operator.length;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(source[i + 1] ?? ''))) {
      const at = i;
      if (ch === '-') i += 1;
      while (i < source.length && /[0-9.]/.test(source[i])) i += 1;
      tokens.push({ kind: 'number', text: source.slice(at, i), at });
      continue;
    }

    if (WORD_START.test(ch)) {
      const at = i;
      while (i < source.length && WORD_BODY.test(source[i])) i += 1;
      tokens.push({ kind: 'word', text: source.slice(at, i), at });
      continue;
    }

    throw new WhenSyntaxError(`непонятный символ «${ch}»`, source, i);
  }

  tokens.push({ kind: 'end', text: '', at: source.length });
  return tokens;
}

// ── Сборка узлов с нормализацией ────────────────────────────────────────────────

const TRUE_NODE: WhenNode = Object.freeze({ kind: 'true' as const });

/**
 * Отрицание с нормализацией. Три случая сводятся к одной форме, и каждый — ради того, чтобы
 * одинаковые по смыслу условия имели одинаковую структуру:
 *
 * - `!(a == b)` даёт то же, что `a != b`, иначе прямая и обёрнутая записи разошлись бы;
 * - двойное отрицание снимается, иначе оно накапливало бы обёртки;
 * - остальное — честная обёртка `not`.
 */
function negate(node: WhenNode): WhenNode {
  if (node.kind === 'eq' || node.kind === 'match' || node.kind === 'in') {
    return { ...node, negated: !node.negated };
  }
  if (node.kind === 'not') return node.operand;
  return { kind: 'not', operand: node };
}

/**
 * Конъюнкция и дизъюнкция плоские: `a && b && c` — один узел с тремя операндами, а не
 * вложенная пара. Вложенность дала бы ту же сумму специфичности, но разную структуру у
 * `(a && b) && c` и `a && (b && c)`, то есть снова два представления одного смысла.
 */
function group(kind: 'and' | 'or', operands: readonly WhenNode[]): WhenNode {
  const flat: WhenNode[] = [];
  for (const operand of operands) {
    if (operand.kind === kind) flat.push(...operand.operands);
    else flat.push(operand);
  }
  return flat.length === 1 ? flat[0] : { kind, operands: flat };
}

// ── Разбор ──────────────────────────────────────────────────────────────────────

const KEYWORD_LITERALS: Readonly<Record<string, WhenLiteral>> = {
  true: true,
  false: false,
  null: null,
};

class Parser {
  private index = 0;
  // Поля объявлены явно, а не параметрами конструктора: сборка идёт с `erasableSyntaxOnly`,
  // и сокращённая запись потребовала бы генерации кода там, где типы обязаны просто стираться.
  private readonly tokens: readonly Token[];
  private readonly source: string;

  constructor(tokens: readonly Token[], source: string) {
    this.tokens = tokens;
    this.source = source;
  }

  parse(): WhenNode {
    const node = this.parseOr();
    const rest = this.peek();
    if (rest.kind !== 'end') {
      throw new WhenSyntaxError(`лишнее после условия: «${rest.text}»`, this.source, rest.at);
    }
    return node;
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private take(): Token {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  private eatOperator(text: string): boolean {
    const token = this.peek();
    if (token.kind === 'op' && token.text === text) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private eatWord(text: string): boolean {
    const token = this.peek();
    if (token.kind === 'word' && token.text === text) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private parseOr(): WhenNode {
    const operands = [this.parseAnd()];
    while (this.eatOperator('||')) operands.push(this.parseAnd());
    return group('or', operands);
  }

  private parseAnd(): WhenNode {
    const operands = [this.parseUnary()];
    while (this.eatOperator('&&')) operands.push(this.parseUnary());
    return group('and', operands);
  }

  /**
   * `!` связывает только primary: `!a == b` разбирается как «отрицание a, сравнённое с b»,
   * а не как отрицание всего сравнения. Место спорное, и решается оно так же, как в VS Code,
   * — ради переносимости привычки: человек, писавший условия там, не должен переучиваться.
   */
  private parseUnary(): WhenNode {
    if (this.eatOperator('!')) return negate(this.parseUnary());
    return this.parsePrimary();
  }

  private parsePrimary(): WhenNode {
    if (this.eatOperator('(')) {
      const inner = this.parseOr();
      if (!this.eatOperator(')')) {
        throw new WhenSyntaxError('не закрыта скобка', this.source, this.peek().at);
      }
      return inner;
    }

    const token = this.take();
    if (token.kind !== 'word') {
      throw new WhenSyntaxError(
        token.kind === 'end' ? 'условие обрывается' : `здесь ожидался ключ, а не «${token.text}»`,
        this.source,
        token.at
      );
    }

    // `true` и `false` в позиции ключа — значения, а не имена ключей. Различие несущее для
    // специфичности: ключ с именем `true` весил бы единицу, и приписка «или всегда» перестала
    // бы обнулять условие — то есть перестала бы работать защита из `whenSpecificity`.
    if (this.isValuePosition(token.text)) {
      return token.text === 'true' ? TRUE_NODE : negate(TRUE_NODE);
    }
    return this.parseComparison(token.text);
  }

  /** Слово-значение, за которым НЕ идёт оператор сравнения: `true`, `false`. */
  private isValuePosition(text: string): boolean {
    if (text !== 'true' && text !== 'false') return false;
    const next = this.peek();
    return !(
      next.kind === 'op' &&
      (next.text === '==' || next.text === '!=' || next.text === '=~')
    );
  }

  private parseComparison(key: string): WhenNode {
    if (this.eatOperator('==')) {
      return { kind: 'eq', key, value: this.parseLiteral(), negated: false };
    }
    if (this.eatOperator('!=')) {
      return { kind: 'eq', key, value: this.parseLiteral(), negated: true };
    }
    if (this.eatOperator('=~')) return this.parseMatch(key);

    if (this.eatWord('in')) return { kind: 'in', key, collection: this.parseKey(), negated: false };
    // «not in» — два слова, как в VS Code. Отдельным оператором `not` не является: иначе
    // ключ с именем, начинающимся на `not`, перестал бы разбираться.
    if (this.peek().text === 'not' && this.tokens[this.index + 1]?.text === 'in') {
      this.index += 2;
      return { kind: 'in', key, collection: this.parseKey(), negated: true };
    }

    return { kind: 'key', key };
  }

  private parseKey(): string {
    const token = this.take();
    if (token.kind !== 'word') {
      throw new WhenSyntaxError(
        `справа от «in» ожидался ключ, а не «${token.text}»`,
        this.source,
        token.at
      );
    }
    return token.text;
  }

  /**
   * Правая часть сравнения — ВСЕГДА литерал, и голое слово там является строкой.
   *
   * Довод не про удобство записи. Читайся голое слово ключом, самая частая запись проекта —
   * `activeResourceKind == form.schema` — молча сравнивала бы два `undefined` и была бы
   * истинной ВСЕГДА. Промах выглядел бы как «клавиша работает везде», а это худший вид
   * отказа: он не падает, не пишет в консоль и обнаруживается только чужой жалобой.
   */
  private parseLiteral(): WhenLiteral {
    const token = this.take();
    if (token.kind === 'string') return token.text;
    if (token.kind === 'number') return Number(token.text);
    if (token.kind === 'word') {
      const keyword = KEYWORD_LITERALS[token.text];
      return keyword === undefined ? token.text : keyword;
    }
    throw new WhenSyntaxError(
      `справа от сравнения ожидалось значение, а не «${token.text}»`,
      this.source,
      token.at
    );
  }

  private parseMatch(key: string): WhenNode {
    const token = this.take();
    if (token.kind !== 'regex') {
      throw new WhenSyntaxError(
        'справа от «=~» ожидается шаблон в косых чертах',
        this.source,
        token.at
      );
    }
    return { kind: 'match', key, pattern: token.text, flags: token.flags ?? '', negated: false };
  }
}

// ── Специфичность ───────────────────────────────────────────────────────────────

/**
 * Вес ключа — «насколько узко названо место», а не важность.
 *
 * `scope` называет ОКНО, и клавиша окна обязана бить глобальную, потому что именно так это
 * видит рука: пока открыт диалог, его клавиши принадлежат ему. `focus` называет зону,
 * `activeEditorId` и `activeResourceKind` — что открыто, остальное — режим или состояние
 * плагина.
 */
const KEY_WEIGHTS: Readonly<Record<string, number>> = {
  scope: 4,
  scopes: 4,
  focus: 3,
  activeEditorId: 2,
  activeResourceKind: 2,
};

function weightOf(key: string): number {
  return KEY_WEIGHTS[key] ?? 1;
}

/**
 * Насколько узко условие называет место. Больше — уже, значит выигрывает при равном слое.
 *
 * Правила и их обоснование:
 *
 * - **дизъюнкция берёт МИНИМУМ ветвей.** Условие, истинное в объединении состояний,
 *   ограничивает ровно настолько, насколько его слабейшая ветвь. Возьми мы максимум —
 *   условие с приставкой «или всегда» встало бы ВЫШЕ исходного, совпадая при этом со строго
 *   большим числом состояний, и приписка стала бы способом перебить кого угодно. Правило,
 *   срабатывающее чаще, не имеет права выигрывать у срабатывающего реже.
 * - **конъюнкция — сумма:** каждый конъюнкт сужает.
 * - **отрицание — тождество:** отрицание ограничивает дополнением, то есть той же силы.
 *   Обнули мы его — «работает, когда ничего не выделено» стало бы безусловным.
 * - **сравнение дороже проверки на истинность на единицу:** сравнение выбирает одно значение
 *   из открытого множества, а голый ключ делит мир пополам.
 */
export function whenSpecificity(ast: WhenNode): number {
  switch (ast.kind) {
    case 'true':
      return 0;
    case 'key':
      return weightOf(ast.key);
    case 'eq':
    case 'match':
      return weightOf(ast.key) + 1;
    case 'in':
      return weightOf(ast.collection) + 1;
    case 'not':
      return whenSpecificity(ast.operand);
    case 'and':
      return ast.operands.reduce((sum, operand) => sum + whenSpecificity(operand), 0);
    case 'or':
      return Math.min(...ast.operands.map((operand) => whenSpecificity(operand)));
  }
}

/** Все читаемые ключи, отсортированные и без повторов. */
export function whenKeys(ast: WhenNode): readonly string[] {
  const found = new Set<string>();
  const walk = (node: WhenNode): void => {
    switch (node.kind) {
      case 'true':
        return;
      case 'key':
      case 'eq':
      case 'match':
        found.add(node.key);
        return;
      case 'in':
        found.add(node.key);
        found.add(node.collection);
        return;
      case 'not':
        walk(node.operand);
        return;
      case 'and':
      case 'or':
        for (const operand of node.operands) walk(operand);
    }
  };
  walk(ast);
  return [...found].sort();
}

// ── Вычисление ──────────────────────────────────────────────────────────────────

/**
 * Скомпилированные шаблоны. Кэш модульный, а не поле узла: AST обязан оставаться данными —
 * сравнимыми, сериализуемыми и безопасными для структурного сравнения в тестах.
 */
const REGEX_CACHE = new Map<string, RegExp>();

function regexOf(pattern: string, flags: string): RegExp {
  const cacheKey = `${flags} ${pattern}`;
  let compiled = REGEX_CACHE.get(cacheKey);
  if (compiled === undefined) {
    compiled = new RegExp(pattern, flags);
    REGEX_CACHE.set(cacheKey, compiled);
  }
  return compiled;
}

/**
 * Истинность голого ключа. Тот же набор пустых значений, что у VS Code: `undefined` (ключа
 * нет), `null` (`activeEditorId` без вкладок), ложь, пустая строка, ноль.
 */
function truthy(value: unknown): boolean {
  return value !== undefined && value !== null && value !== false && value !== '' && value !== 0;
}

/**
 * Равенство. Строгое, с одной поблажкой: если типы разошлись и одна сторона — строка,
 * сравниваются строковые представления. Поблажка нужна значениям, пришедшим из файла
 * (раскладка пользователя, манифест), где число записано текстом.
 */
function equals(value: unknown, literal: WhenLiteral): boolean {
  if (value === literal) return true;
  if (typeof literal === 'string' && (typeof value === 'number' || typeof value === 'boolean')) {
    return String(value) === literal;
  }
  return false;
}

function includes(collection: unknown, value: unknown): boolean {
  if (Array.isArray(collection)) return collection.includes(value);
  if (typeof collection === 'object' && collection !== null) {
    return Object.prototype.hasOwnProperty.call(collection, String(value));
  }
  return false;
}

/**
 * Вычисляет условие по читателю ключей.
 *
 * Читатель, а не снимок `WhenContext`: областей и ключей плагинов в контексте из пяти полей
 * нет, и тип с пятью полями заставил бы их туда положить — то есть расширять контракт на
 * каждый ключ, который завёл чужой плагин.
 *
 * **Неизвестный ключ — ложь, а не отказ.** Условие вправе ссылаться на ключ выключенного
 * плагина: это нормальное состояние приложения, а не поломка. Правило при этом просто
 * перестаёт совпадать, и клавиша достаётся следующему кандидату.
 */
export function evaluateWhen(expr: WhenExpr, read: (key: string) => unknown): boolean {
  const evaluate = (node: WhenNode): boolean => {
    switch (node.kind) {
      case 'true':
        return true;
      case 'key':
        return truthy(read(node.key));
      case 'not':
        return !evaluate(node.operand);
      case 'and':
        return node.operands.every(evaluate);
      case 'or':
        return node.operands.some(evaluate);
      case 'eq':
        return equals(read(node.key), node.value) !== node.negated;
      case 'match': {
        const value = read(node.key);
        const matched =
          value === undefined || value === null
            ? false
            : regexOf(node.pattern, node.flags).test(String(value));
        return matched !== node.negated;
      }
      case 'in':
        return includes(read(node.collection), read(node.key)) !== node.negated;
    }
  };
  return evaluate(expr.ast);
}

// ── Вход ────────────────────────────────────────────────────────────────────────

function build(source: string, ast: WhenNode): WhenExpr {
  return Object.freeze({
    source,
    ast,
    keys: whenKeys(ast),
    specificity: whenSpecificity(ast),
  });
}

/** Условие «всегда». Пустая строка и отсутствие условия дают именно его. */
export const WHEN_TRUE: WhenExpr = build('', TRUE_NODE);

/**
 * Разбирает условие, бросая {@link WhenSyntaxError}. Для кода: объявление команды проверяется
 * НА РЕГИСТРАЦИИ — по тому же доводу, что и сочетание клавиш (см. `./command`), — иначе
 * опечатка живёт до того дня, когда кто-то попробует нажать клавишу.
 */
export function compileWhen(source: string): WhenExpr {
  const trimmed = source.trim();
  if (trimmed === '') return WHEN_TRUE;
  return build(trimmed, new Parser(tokenize(trimmed), trimmed).parse());
}

/**
 * Разбирает условие, НЕ бросая. Для всего, что человек правит руками: манифест плагина,
 * раскладка пользователя. Испорченная запись в файле — обычное состояние, а не авария,
 * и ронять на ней загрузку нельзя.
 */
export function parseWhen(source: string): WhenParseResult {
  try {
    return { ok: true, expr: compileWhen(source) };
  } catch (error) {
    if (error instanceof WhenSyntaxError) {
      return { ok: false, error: { message: error.message, at: error.at, source } };
    }
    throw error;
  }
}

/**
 * Собирает позитивные сравнения верхнего уровня конъюнкции. Всё остальное — дизъюнкции,
 * отрицания, голые ключи — пропускается: из них непересекаемость не следует.
 */
function positiveEqualities(ast: WhenNode): ReadonlyMap<string, WhenLiteral> {
  const found = new Map<string, WhenLiteral>();
  const collect = (node: WhenNode): void => {
    if (node.kind === 'eq' && !node.negated) found.set(node.key, node.value);
    else if (node.kind === 'and') for (const operand of node.operands) collect(operand);
  };
  collect(ast);
  return found;
}

/**
 * Доказуемо ли, что два условия НЕ МОГУТ быть истинны одновременно.
 *
 * Осознанно неполна и доказывает ровно один случай: сравнение ОДНОГО ключа с РАЗНЫМИ
 * литералами (фокус в дереве против фокуса на канвасе). Всё остальное считается
 * пересекающимся.
 *
 * Полная проверка непересекаемости для произвольной булевой формулы над открытым множеством
 * значений в общем виде неразрешима, а приближать её эвристиками здесь нельзя: цена ошибки
 * несимметрична. Не доказали непересекаемость там, где она есть, — человек увидит лишнее
 * предупреждение в редакторе клавиш. «Доказали» там, где её нет, — конфликт молча пропущен,
 * и одна из двух клавиш не работает без единого следа.
 *
 * Ровно этот один случай закрывает то, ради чего функция и заводится: пара `delete` в дереве
 * против `delete` на канвасе.
 */
export function provablyDisjoint(a: WhenExpr, b: WhenExpr): boolean {
  const left = positiveEqualities(a.ast);
  if (left.size === 0) return false;
  const right = positiveEqualities(b.ast);

  for (const [key, value] of left) {
    if (!right.has(key)) continue;
    if (!equals(right.get(key), value)) return true;
  }
  return false;
}
