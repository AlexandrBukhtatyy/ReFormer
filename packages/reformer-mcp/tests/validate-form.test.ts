/**
 * `validate_form` и коды RF0xx.
 *
 * Что здесь проверяется по существу: сервер ловит класс ошибок, который НЕ ловит `tsc`.
 * Компилятор не знает архитектуры библиотеки — он пропустит `validate(...)` вне
 * `defineValidationSchema` (правило не зарегистрируется, поле молча не валидируется) и импорт
 * символа из подпути, из которого он не экспортируется (соберётся в монорепо, упадёт у
 * потребителя). Именно на этом классе ошибок стоит `scripts/check-mcp-prompts.mjs`: снятый
 * `validateFormModel` компилировался, форма рисовалась и молча отправляла пустые поля.
 *
 * Второй инвариант — чистый отчёт НЕ должен читаться как «код верен»: проверка построчная,
 * без AST, и её ограничения печатаются всегда.
 */

import { describe, it, expect } from 'vitest';
import { validateFormTool } from '../src/core/tools/validate-form';
import { validateCode } from '../src/core/validate/code';
import { CODE_TITLES } from '../src/core/validate/codes.js';
import { getPublicSymbols } from '../src/platform/cli/symbols-parser';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

/** Знание процесса: тесты гоняются в Node, поэтому источники — те же, что у сервера. */
const k = cliKnowledge();

const hasSymbols = getPublicSymbols('@reformer/core').length > 0;
const codes = (text: string) => [...text.matchAll(/\*\*(RF\d{3})\*\*/g)].map((m) => m[1]);

describe('validate_form — диспетчер', () => {
  it('без kind объясняет варианты, а не падает', async () => {
    const { content } = await validateFormTool({}, k);
    expect(content[0].text).toMatch(/code.*json-schema.*behaviors.*bundle/s);
  });

  it('каждый kind требует своих аргументов и говорит каких', async () => {
    expect((await validateFormTool({ kind: 'code' }, k)).content[0].text).toMatch(/`code`/);
    expect((await validateFormTool({ kind: 'behaviors' }, k)).content[0].text).toMatch(
      /dependencies/
    );
    expect((await validateFormTool({ kind: 'json-schema' }, k)).content[0].text).toMatch(/schema/);
    expect((await validateFormTool({ kind: 'bundle' }, k)).content[0].text).toMatch(/intent/);
  });

  it('у каждого кода есть человекочитаемое имя', () => {
    for (const [code, title] of Object.entries(CODE_TITLES)) {
      expect(code).toMatch(/^RF\d{3}$/);
      expect(title).toMatch(/^[A-Z_]+$/);
    }
  });
});

describe('validate_form kind=code', () => {
  it.runIf(hasSymbols)('RF002 — несуществующий символ, с похожими именами', async () => {
    const { content } = await validateFormTool(
      {
        kind: 'code',
        code: "import { validateFormModel } from '@reformer/core/validation';",
      },
      k
    );
    const text = content[0].text;
    expect(codes(text)).toContain('RF002');
    // Подсказка обязана называть живую замену, иначе агент просто повторит ошибку.
    expect(text).toContain('validateModel');
    expect(text, 'диагностика должна вести к следующему вызову').toMatch(/search_docs/);
  });

  it.runIf(hasSymbols)('RF003 — символ не экспортируется из этого подпути', async () => {
    const { content } = await validateFormTool(
      {
        kind: 'code',
        code: "import { validate } from '@reformer/core';",
      },
      k
    );
    const text = content[0].text;
    expect(codes(text)).toContain('RF003');
    expect(text).toContain('@reformer/core/validation');
  });

  it.runIf(hasSymbols)('корректные импорты из подпутей не дают ложных срабатываний', async () => {
    // Первая версия сравнивала `/behaviors` со записанным в exports `./behaviors` и
    // объявляла ошибкой КАЖДЫЙ верный импорт из подпути.
    const { diagnostics } = await validateCode(
      k,
      [
        "import { computeFrom, copyFrom } from '@reformer/core/behaviors';",
        "import { defineValidationSchema, validate } from '@reformer/core/validation';",
        "import { required } from '@reformer/core/validators';",
        "import { createForm } from '@reformer/core';",
      ].join('\n')
    );
    expect(
      diagnostics.filter((d) => d.code === 'RF003'),
      'ложные RF003 на корректных импортах'
    ).toEqual([]);
  });

  it.runIf(hasSymbols)('RF004 — оператор валидации вне своей схемы', async () => {
    const code = [
      "import { validate, defineValidationSchema } from '@reformer/core/validation';",
      "import { required } from '@reformer/core/validators';",
      '',
      'validate(model.$.email, [required()]);',
      '',
      'export const s = defineValidationSchema(({ model }) => {',
      '  validate(model.$.name, [required()]);',
      '});',
    ].join('\n');
    const { diagnostics } = await validateCode(k, code);
    const rf004 = diagnostics.filter((d) => d.code === 'RF004');
    expect(rf004).toHaveLength(1);
    // Ловим именно вызов вне схемы (строка 4), а тот, что внутри, — не трогаем.
    expect(rf004[0].line).toBe(4);
    expect(rf004[0].message).toMatch(/молча не будет валидироваться/);
  });

  it.runIf(hasSymbols)('RF005 — оператор поведения вне своей схемы', async () => {
    const code = [
      "import { computeFrom, defineFormBehavior } from '@reformer/core/behaviors';",
      '',
      'computeFrom([a], b, () => 1);',
      '',
      'export const b = defineFormBehavior(({ model }) => {',
      '  computeFrom([model.$.x], model.$.y, (x) => x);',
      '});',
    ].join('\n');
    const rf005 = (await validateCode(k, code)).diagnostics.filter((d) => d.code === 'RF005');
    expect(rf005).toHaveLength(1);
    expect(rf005[0].line).toBe(3);
  });

  it.runIf(hasSymbols)('ограничения печатаются даже когда ошибок нет', async () => {
    // Чистый отчёт не должен читаться как «код верен»: проверка построчная и видит не всё.
    const { content } = await validateFormTool(
      {
        kind: 'code',
        code: "import { createForm } from '@reformer/core';",
      },
      k
    );
    expect(content[0].text).toMatch(/✅ ошибок нет/);
    expect(content[0].text).toMatch(/Что эта проверка НЕ видит/);
  });

  it('пустой код не считается ошибкой', async () => {
    expect((await validateCode(k, '')).diagnostics).toEqual([]);
  });
});

describe('validate_form kind=behaviors', () => {
  it('RF006 — цикл, с указанием пути', async () => {
    const { content } = await validateFormTool(
      {
        kind: 'behaviors',
        dependencies: [
          { target: 'a', reads: ['b'] },
          { target: 'b', reads: ['a'] },
        ],
      },
      k
    );
    const text = content[0].text;
    expect(codes(text)).toContain('RF006');
    expect(text).toMatch(/a → b → a/);
    expect(text).toMatch(/Cycle detected/);
  });

  it('RF006 warning — поле читает само себя', async () => {
    const { content } = await validateFormTool(
      {
        kind: 'behaviors',
        dependencies: [{ target: 'a', reads: ['a', 'b'] }],
      },
      k
    );
    expect(content[0].text).toMatch(/читает сам себя/);
  });

  it('ациклический граф проходит', async () => {
    const { content } = await validateFormTool(
      {
        kind: 'behaviors',
        dependencies: [{ target: 'total', reads: ['price', 'qty'] }],
      },
      k
    );
    expect(content[0].text).toMatch(/✅ ошибок нет/);
  });

  it('кривая форма зависимостей отвергается внятно', async () => {
    const { content } = await validateFormTool(
      {
        kind: 'behaviors',
        dependencies: [{ target: 1, reads: 'x' } as never],
      },
      k
    );
    expect(content[0].text).toMatch(/target.*reads/);
  });
});

describe('validate_form kind=bundle', () => {
  it('сводит коды кросс-проверки к RF0xx', async () => {
    const { content } = await validateFormTool(
      {
        kind: 'bundle',
        intent: {
          formName: 'X',
          fields: [{ name: 'a', type: 'string', component: 'Input' }],
          validation: [{ target: 'ghost', rules: ['required()'] }],
        },
        schema: { root: { component: '$component(Box)', children: [] } },
      },
      k
    );
    const text = content[0].text;
    expect(codes(text)).toContain('RF004');
    expect(text, 'граница проверки должна быть названа').toMatch(/сам TypeScript не проверяется/);
  });
});
