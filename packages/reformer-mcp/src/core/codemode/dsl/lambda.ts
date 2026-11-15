/**
 * Лямбда конструктора → выражение `form_edit`: `m => m.customerType === "company"` →
 * `model.customerType === "company"`.
 *
 * Выражение не правится по месту, а печатается заново из дерева TypeScript, только из разрешённых
 * узлов: параметр становится `model`, `values`, `value` или `item`, как бы модель его ни назвала, а
 * приведения типов (`as`, `!`) снимаются. Так уходит класс ошибок области: `values.x` в поведении
 * сервер раньше принимал, и сборка падала на «Cannot find name 'values'» (батч
 * 20261114T225122Z-f433). Всё, что сервер не сможет собрать, — отказ с подсказкой сразу, против
 * цепочки, а не ошибка типов в `form.behavior.ts`.
 *
 * Модуль TypeScript передаёт платформа: в пакете он необязателен.
 *
 * @module reformer-mcp/core/codemode/dsl/lambda
 */

import type * as Ts from 'typescript';

export type TypeScriptModule = typeof Ts;

/** Над чем лямбда: форма, значения формы в правиле между полями, одно значение, строка массива. */
export type LambdaScope = 'model' | 'values' | 'value' | 'item';

export type Lowered = { readonly expr: string } | { readonly error: string };

/** Глобальные имена, которые выражение может читать. */
const GLOBALS = new Set([
  'Math',
  'Array',
  'Object',
  'Number',
  'String',
  'Boolean',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'Date',
  'undefined',
  'NaN',
  'Infinity',
]);

/** Функции-глобали, которые можно вызвать. */
const CALLABLE = new Set([
  'Number',
  'String',
  'Boolean',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
]);

/** Методы значений: строк, чисел, массивов, дат. */
const METHODS = new Set([
  'trim',
  'toUpperCase',
  'toLowerCase',
  'includes',
  'startsWith',
  'endsWith',
  'indexOf',
  'slice',
  'replace',
  'split',
  'join',
  'test',
  'toFixed',
  'toString',
  'some',
  'every',
  'filter',
  'map',
  'reduce',
  'find',
  'findIndex',
  'getTime',
  'getFullYear',
  'getMonth',
  'getDate',
  'getDay',
  'charAt',
  'charCodeAt',
  'padStart',
  'padEnd',
  'repeat',
  'substring',
  'lastIndexOf',
  'trimStart',
  'trimEnd',
  'match',
  'at',
  'concat',
  'flat',
  'toPrecision',
  'localeCompare',
]);

/** Статические функции, кроме `Math.*`: `Array.from(m.items, r => …)`, `Number.isInteger(…)`. */
const STATICS: Readonly<Record<string, ReadonlySet<string>>> = {
  Array: new Set(['from', 'isArray']),
  Number: new Set(['isInteger', 'isFinite', 'isNaN', 'parseFloat', 'parseInt']),
  Object: new Set(['keys', 'values']),
};

const PARAM_HINT: Record<LambdaScope, string> = {
  model: 'm => m.<field>',
  values: 'v => v.<field>',
  value: 'v => … over the value v',
  item: 'r => r.<column>',
};

class LambdaError extends Error {}

/** Разобрать исходник лямбды и напечатать выражение над областью `scope`. */
export function lowerLambda(
  ts: TypeScriptModule | null,
  source: string,
  scope: LambdaScope
): Lowered {
  if (!ts) {
    return {
      error:
        "an arrow needs the server's TypeScript package — pass the expression as a string instead",
    };
  }
  try {
    return { expr: lower(ts, source, scope) };
  } catch (error) {
    if (error instanceof LambdaError) return { error: error.message };
    throw error;
  }
}

function lower(ts: TypeScriptModule, source: string, scope: LambdaScope): string {
  const file = ts.createSourceFile(
    'lambda.ts',
    `(${source})`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const parseErrors = (file as unknown as { parseDiagnostics?: readonly Ts.Diagnostic[] })
    .parseDiagnostics;
  if (parseErrors && parseErrors.length > 0) {
    throw new LambdaError(
      `not valid code: ${ts.flattenDiagnosticMessageText(parseErrors[0].messageText, ' ')}`
    );
  }
  const statement = file.statements[0];
  if (file.statements.length !== 1 || !statement || !ts.isExpressionStatement(statement)) {
    throw new LambdaError(`a function with one parameter: ${PARAM_HINT[scope]}`);
  }
  let fn: Ts.Expression = statement.expression;
  while (ts.isParenthesizedExpression(fn)) fn = fn.expression;
  if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) {
    throw new LambdaError(`a function with one parameter: ${PARAM_HINT[scope]}`);
  }
  if (fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
    throw new LambdaError(
      scope === 'value'
        ? 'no async: the condition only — the server waits the delay itself'
        : 'no async: one expression over the form'
    );
  }
  if (fn.parameters.length !== 1) {
    throw new LambdaError(
      `exactly one parameter (${PARAM_HINT[scope]}), not ${fn.parameters.length}`
    );
  }
  const [param] = fn.parameters;
  if (!ts.isIdentifier(param.name) || param.initializer || param.dotDotDotToken) {
    throw new LambdaError(`one plain parameter name: ${PARAM_HINT[scope]}`);
  }
  const body = bodyOf(ts, fn.body);
  const emitter = new Emitter(ts, scope);
  return emitter.emit(body, new Map([[param.name.text, scope]]));
}

/** Тело функции: выражение или блок из одного `return`. */
function bodyOf(ts: TypeScriptModule, body: Ts.ConciseBody): Ts.Expression {
  if (!ts.isBlock(body)) return body;
  const [only] = body.statements;
  if (body.statements.length !== 1 || !ts.isReturnStatement(only) || !only.expression) {
    throw new LambdaError('one expression — or a block with only `return …`');
  }
  return only.expression;
}

class Emitter {
  private counter = 0;

  constructor(
    private readonly ts: TypeScriptModule,
    private readonly scope: LambdaScope
  ) {}

  emit(node: Ts.Node, names: ReadonlyMap<string, string>): string {
    const ts = this.ts;
    const k = ts.SyntaxKind;
    const emit = (child: Ts.Node): string => this.emit(child, names);

    if (ts.isIdentifier(node)) return this.identifier(node.text, names);
    if (
      ts.isStringLiteral(node) ||
      ts.isNumericLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isBigIntLiteral(node) ||
      ts.isRegularExpressionLiteral(node)
    ) {
      return node.getText();
    }
    switch (node.kind) {
      case k.TrueKeyword:
        return 'true';
      case k.FalseKeyword:
        return 'false';
      case k.NullKeyword:
        return 'null';
      case k.ThisKeyword:
        throw new LambdaError(`no \`this\`: read the parameter (${PARAM_HINT[this.scope]})`);
    }
    if (ts.isTemplateExpression(node)) {
      return `${node.head.getText()}${node.templateSpans
        .map((span) => `${emit(span.expression)}${span.literal.getText()}`)
        .join('')}`;
    }
    if (ts.isParenthesizedExpression(node)) return `(${emit(node.expression)})`;
    if (
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node)
    ) {
      return emit(node.expression);
    }
    if (ts.isPropertyAccessExpression(node)) {
      return `${emit(node.expression)}${node.questionDotToken ? '?.' : '.'}${node.name.text}`;
    }
    if (ts.isElementAccessExpression(node)) {
      return `${emit(node.expression)}${node.questionDotToken ? '?.' : ''}[${emit(node.argumentExpression)}]`;
    }
    if (ts.isCallExpression(node)) return this.call(node, names);
    if (ts.isNewExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'Date') {
        return `new Date(${(node.arguments ?? []).map(emit).join(', ')})`;
      }
      throw new LambdaError('no `new` except `new Date(…)`: one expression over the form');
    }
    if (ts.isPrefixUnaryExpression(node)) {
      if (node.operator === k.PlusPlusToken || node.operator === k.MinusMinusToken) {
        throw new LambdaError('no ++ or --: the expression only reads the form');
      }
      return `${ts.tokenToString(node.operator)}${emit(node.operand)}`;
    }
    if (ts.isPostfixUnaryExpression(node)) {
      throw new LambdaError('no ++ or --: the expression only reads the form');
    }
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      if (operator >= k.FirstAssignment && operator <= k.LastAssignment) {
        throw new LambdaError('an assignment (=) — compare with ===');
      }
      if (operator === k.CommaToken) {
        throw new LambdaError('one expression, no commas between expressions');
      }
      return `${emit(node.left)} ${ts.tokenToString(operator)} ${emit(node.right)}`;
    }
    if (ts.isConditionalExpression(node)) {
      return `${emit(node.condition)} ? ${emit(node.whenTrue)} : ${emit(node.whenFalse)}`;
    }
    if (ts.isTypeOfExpression(node)) return `typeof ${emit(node.expression)}`;
    if (ts.isArrayLiteralExpression(node)) return `[${node.elements.map(emit).join(', ')}]`;
    if (ts.isAwaitExpression(node)) {
      throw new LambdaError(
        this.scope === 'value'
          ? 'no await: the condition only — the server waits the delay itself'
          : 'no await: one expression over the form'
      );
    }
    if (ts.isObjectLiteralExpression(node)) {
      throw new LambdaError('no object literals: one expression over the form');
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      throw new LambdaError(
        'a function inside only as the callback of some, every, filter, map, reduce, find'
      );
    }
    throw new LambdaError(
      `${ts.SyntaxKind[node.kind]} is not allowed: one expression over the form (${PARAM_HINT[this.scope]})`
    );
  }

  private identifier(name: string, names: ReadonlyMap<string, string>): string {
    const renamed = names.get(name);
    if (renamed !== undefined) return renamed;
    if (GLOBALS.has(name)) return name;
    throw new LambdaError(
      `\`${name}\` is not known inside the function: only its parameter (${PARAM_HINT[this.scope]}), literals, Math, Number, String — a variable of the script does not reach the server`
    );
  }

  private call(node: Ts.CallExpression, names: ReadonlyMap<string, string>): string {
    const ts = this.ts;
    const callee = node.expression;
    const optional = node.questionDotToken ? '?.' : '';
    if (ts.isIdentifier(callee)) {
      if (!CALLABLE.has(callee.text)) {
        throw new LambdaError(
          `\`${callee.text}()\` is not allowed: no calls but Math.*, Number, String, Boolean, parseInt, parseFloat and methods of values`
        );
      }
      return `${callee.text}${optional}(${node.arguments.map((arg) => this.emit(arg, names)).join(', ')})`;
    }
    if (!ts.isPropertyAccessExpression(callee)) {
      throw new LambdaError('call a method by its name: m.<field>.trim(), Math.round(…)');
    }
    const method = callee.name.text;
    const owner = ts.isIdentifier(callee.expression) ? callee.expression.text : '';
    const isStatic = owner === 'Math' || (STATICS[owner]?.has(method) ?? false);
    if (!isStatic && !METHODS.has(method)) {
      throw new LambdaError(
        `.${method}() is not allowed: methods of values only — ${[...METHODS].join(', ')}; and Math.*, Array.from, Number.isInteger`
      );
    }
    const args = node.arguments.map((arg) =>
      ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)
        ? this.callback(arg, names)
        : this.emit(arg, names)
    );
    return `${this.emit(callee, names)}${optional}(${args.join(', ')})`;
  }

  /** Колбэк метода массива: параметры — `_1`, `_2`…, чтобы сервер не принял их за поля формы. */
  private callback(
    fn: Ts.ArrowFunction | Ts.FunctionExpression,
    names: ReadonlyMap<string, string>
  ): string {
    const ts = this.ts;
    const inner = new Map(names);
    const params = fn.parameters.map((param) => {
      if (!ts.isIdentifier(param.name) || param.initializer || param.dotDotDotToken) {
        throw new LambdaError('a callback takes plain parameter names: (sum, row) => …');
      }
      const renamed = `_${++this.counter}`;
      inner.set(param.name.text, renamed);
      return renamed;
    });
    return `(${params.join(', ')}) => ${this.emit(bodyOf(ts, fn.body), inner)}`;
  }
}
