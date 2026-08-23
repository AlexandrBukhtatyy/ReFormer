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
    expect(content[0].text).toMatch(/code.*json-schema.*behaviors.*bundle.*layout/s);
  });

  it('каждый kind требует своих аргументов и говорит каких', async () => {
    expect((await validateFormTool({ kind: 'code' }, k)).content[0].text).toMatch(/`code`/);
    expect((await validateFormTool({ kind: 'behaviors' }, k)).content[0].text).toMatch(
      /dependencies/
    );
    expect((await validateFormTool({ kind: 'json-schema' }, k)).content[0].text).toMatch(/schema/);
    expect((await validateFormTool({ kind: 'bundle' }, k)).content[0].text).toMatch(/intent/);
    expect((await validateFormTool({ kind: 'layout' }, k)).content[0].text).toMatch(/files/);
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

/**
 * `kind="layout"` — единственная проверка, которая ловит расхождение с каноном раскладки
 * постфактум. Наборы файлов здесь не выдуманы: это фактические раскладки из замера
 * (`docs/plans/mcp-layout-authority.md`), где два независимых MCP-only прогона дали 5/10 и 8/9
 * совпадений с каноном. Тест обязан ловить ровно те имена, которые они реально написали, —
 * иначе enforcement меряет не ту ошибку.
 */
describe('validate_form kind=layout', () => {
  const layout = async (files: string[], target?: string) =>
    (await validateFormTool({ kind: 'layout', files, target }, k)).content[0].text;

  /** Раздел отчёта — чтобы отличать ошибки от предупреждений, а не считать коды скопом. */
  const section = (text: string, name: string) => {
    const at = text.indexOf(`## ${name}`);
    if (at < 0) return '';
    const rest = text.slice(at + name.length + 3);
    const end = rest.indexOf('\n## ');
    return end < 0 ? rest : rest.slice(0, end);
  };
  const errorCount = (text: string) => Number(/❌ ошибок (\d+)/.exec(text)?.[1] ?? 0);

  const CANON: Record<string, string[]> = {
    core: [
      'index.tsx',
      'types.ts',
      'model.ts',
      'form.schema.ts',
      'form.behavior.ts',
      'validation.ts',
      'data-sources.ts',
      'api.ts',
    ],
    'renderer-react': [
      'index.tsx',
      'types.ts',
      'model.ts',
      'renderer.schema.ts',
      'form.behavior.ts',
      'renderer.behavior.ts',
      'validation.ts',
      'data-sources.ts',
      'api.ts',
    ],
    'renderer-json': [
      'index.tsx',
      'types.ts',
      'model.ts',
      'renderer.schema.ts',
      'form.behavior.ts',
      'renderer.behavior.ts',
      'validation.ts',
      'data-sources.ts',
      'api.ts',
      'registry.ts',
    ],
  };

  for (const [target, files] of Object.entries(CANON)) {
    it(`канон target=${target} проходит без единой претензии`, async () => {
      const text = await layout(files, target);
      expect(text).toMatch(/✅ ошибок нет/);
      expect(text, 'канон не должен давать предупреждений').not.toMatch(/предупреждений \d/);
    });
  }

  it('отчёт всегда печатает сам канон и границы проверки', async () => {
    const text = await layout(CANON['renderer-json'], 'renderer-json');
    expect(text).toMatch(/## Канон раскладки — target=`renderer-json`/);
    expect(text).toContain('renderer.wizard.tsx');
    expect(text).toMatch(/Что эта проверка НЕ видит/);
    expect(text, 'правило целиком — одним вызовом').toMatch(/find_recipe directory-layout/);
  });

  it('замер run A (renderer-json, 5/10) — ловит все пять имён', async () => {
    const text = await layout(
      [
        'api.ts',
        'behavior.ts',
        'dictionaries.ts',
        'index.tsx',
        'initial-values.ts',
        'json-schema.ts',
        'registry.ts',
        'render-behavior.ts',
        'types.ts',
        'validation.ts',
        'wizard.tsx',
        'README.md',
      ],
      'renderer-json'
    );
    const errors = section(text, 'Errors');
    expect(errorCount(text)).toBe(5);
    // Каждая претензия обязана называть ожидаемое имя: агент чинит переименованием.
    expect(errors).toMatch(/`behavior\.ts`[\s\S]*?`form\.behavior\.ts`/);
    expect(errors).toMatch(/`dictionaries\.ts`[\s\S]*?`data-sources\.ts`/);
    expect(errors).toMatch(/`initial-values\.ts`[\s\S]*?`model\.ts`/);
    expect(errors).toMatch(/`json-schema\.ts`[\s\S]*?`renderer\.schema\.ts`/);
    expect(errors).toMatch(/`render-behavior\.ts`[\s\S]*?`renderer\.behavior\.ts`/);
    expect(errors, 'имя названо — про «нет файла» второй раз не сообщаем').not.toMatch(/RF012/);

    const warnings = section(text, 'Warnings');
    expect(warnings).toMatch(/`wizard\.tsx`[\s\S]*?`renderer\.wizard\.tsx`/);
    expect(warnings).toMatch(/README\.md/);
  });

  it('замер run B (renderer-react, 8/9 + `.tsx`) проходит', async () => {
    const text = await layout(
      [
        'api.ts',
        'data-sources.ts',
        'form.behavior.ts',
        'index.tsx',
        'model.ts',
        'renderer.behavior.ts',
        'renderer.schema.tsx',
        'types.ts',
        'validation.ts',
      ],
      'renderer-react'
    );
    // `.tsx` у схемы — обоснованное отличие расширения (в схеме бывает JSX), а не нарушение.
    expect(text).toMatch(/✅ ошибок нет/);
    expect(text).not.toMatch(/предупреждений \d/);
  });

  it('форма new-mcp-test падает ровно на двух именах', async () => {
    const text = await layout(
      [
        'api.ts',
        'data-sources.ts',
        'form.behavior.ts',
        'index.tsx',
        'json-wizard.tsx',
        'model.ts',
        'registry.ts',
        'render.behavior.ts',
        'schema.ts',
        'types.ts',
        'validation.ts',
      ],
      'renderer-json'
    );
    expect(errorCount(text)).toBe(2);
    const errors = section(text, 'Errors');
    expect(errors).toMatch(/`schema\.ts`[\s\S]*?`renderer\.schema\.ts`/);
    expect(errors).toMatch(/`render\.behavior\.ts`[\s\S]*?`renderer\.behavior\.ts`/);
    // Шим опционален — имя вне канона у него предупреждение, а не ошибка.
    expect(section(text, 'Warnings')).toMatch(/`json-wizard\.tsx`[\s\S]*?`renderer\.wizard\.tsx`/);
  });

  it('`renderer.schema.json` допустим, но предупреждает о потере типизации', async () => {
    const files = CANON['renderer-json'].map((f) =>
      f === 'renderer.schema.ts' ? 'renderer.schema.json' : f
    );
    const text = await layout(files, 'renderer-json');
    expect(text).toMatch(/✅ ошибок нет/);
    expect(section(text, 'Warnings')).toMatch(/\$model/);
    expect(section(text, 'Warnings')).toMatch(/defineJsonSchema/);
  });

  it('нет обязательного файла — RF012 с именем и назначением', async () => {
    const text = await layout(
      CANON['core'].filter((f) => f !== 'data-sources.ts'),
      'core'
    );
    const errors = section(text, 'Errors');
    expect(errors).toMatch(/RF012/);
    expect(errors).toMatch(/`data-sources\.ts`/);
  });

  it('роль чужого таргета — предупреждение с указанием, куда свернуть', async () => {
    const text = await layout([...CANON['core'], 'renderer.behavior.ts', 'registry.ts'], 'core');
    expect(text).toMatch(/✅ ошибок нет/);
    const warnings = section(text, 'Warnings');
    expect(warnings).toMatch(/renderer\.behavior\.ts[\s\S]*?`form\.behavior\.ts`/);
    expect(warnings).toMatch(/registry\.ts[\s\S]*?renderer-json/);
  });

  it('вложенные каталоги — ошибка: раскладка плоская', async () => {
    const text = await layout(
      [
        'index.tsx',
        'types.ts',
        'schema/model.ts',
        'form.schema.ts',
        'form.behavior.ts',
        'validation.ts',
        'data-sources.ts',
        'api.ts',
        'components/steps/Step1.tsx',
      ],
      'core'
    );
    const errors = section(text, 'Errors');
    expect(errors).toMatch(/schema\/model\.ts/);
    expect(errors).toMatch(/корне модуля/);
    expect(section(text, 'Warnings')).toMatch(/инлайном в `index\.tsx`/);
  });

  it('общий каталог модуля снимается, а не считается вложенностью', async () => {
    const text = await layout(
      CANON['core'].map((f) => `src/pages/examples/my-form/${f}`),
      'core'
    );
    expect(text).toMatch(/✅ ошибок нет/);
  });

  it('тесты и стили лишними файлами не считаются', async () => {
    const text = await layout(
      [...CANON['core'], 'model.test.ts', 'index.stories.tsx', 'styles.module.css'],
      'core'
    );
    expect(text).toMatch(/✅ ошибок нет/);
    expect(text).not.toMatch(/предупреждений \d/);
  });

  it('target выводится по составу файлов и догадка проговаривается', async () => {
    const text = await layout(CANON['renderer-json']);
    expect(text).toMatch(/`target` не передан — принят `renderer-json`/);
    expect(text).toMatch(/✅ ошибок нет/);
  });

  it('неопознаваемый набор без target — отказ с перечнем значений', async () => {
    const text = await layout(['index.tsx', 'types.ts']);
    expect(text).toMatch(/core.*renderer-react.*renderer-json/s);
  });
});
