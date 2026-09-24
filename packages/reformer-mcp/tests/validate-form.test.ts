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

  /**
   * Замер (см. `.tmp/verdicts/b3-validate-bundle-false-positives.md`) показал две беды сразу:
   * проверка C1 ругалась на корректные относительные пути внутри `item.$template` и при этом
   * пропускала реальные промахи, потому что смягчение шло суффиксным сравнением. Оба агента
   * в итоге перестали смотреть на ответы этой проверки — худший исход для валидатора.
   */
  const arrayIntent = {
    formName: 'Loan',
    fields: [
      { name: 'coBorrowers', type: 'array' as const, component: 'FormArray' },
      { name: 'coBorrowers.personalData.lastName', type: 'string' as const, component: 'Input' },
    ],
  };

  const arraySchema = (templateBinding: string) => ({
    root: {
      component: '$component(Box)',
      children: [
        {
          array: '$model(coBorrowers)',
          component: '$component(FormArray)',
          item: {
            $template: {
              component: '$component(Box)',
              children: [{ value: templateBinding, component: '$component(Input)' }],
            },
          },
        },
      ],
    },
  });

  it('путь внутри item.$template резолвится относительно элемента, а не корня', async () => {
    const { content } = await validateFormTool(
      { kind: 'bundle', intent: arrayIntent, schema: arraySchema('$model(personalData.lastName)') },
      k
    );
    expect(codes(content[0].text), 'корректная привязка не должна давать C1/RF001').not.toContain(
      'RF001'
    );
  });

  it('несуществующий путь в шаблоне элемента ловится, а не прячется суффиксным совпадением', async () => {
    const { content } = await validateFormTool(
      { kind: 'bundle', intent: arrayIntent, schema: arraySchema('$model(personalData.ghost)') },
      k
    );
    expect(codes(content[0].text)).toContain('RF001');
  });

  it('корневая привязка не «находится» внутри элемента массива', async () => {
    // monthlyIncome есть только как поле элемента; на корне его нет — C1 обязана ругнуться.
    const intent = {
      formName: 'Loan',
      fields: [
        { name: 'coBorrowers', type: 'array' as const, component: 'FormArray' },
        { name: 'coBorrowers.monthlyIncome', type: 'number' as const, component: 'Input' },
      ],
    };
    const { content } = await validateFormTool(
      {
        kind: 'bundle',
        intent,
        schema: {
          root: {
            component: '$component(Box)',
            children: [{ value: '$model(monthlyIncome)', component: '$component(Input)' }],
          },
        },
      },
      k
    );
    expect(codes(content[0].text)).toContain('RF001');
  });

  it('контейнерный шим Wizard не объявляется неизвестным компонентом', async () => {
    const { content } = await validateFormTool(
      {
        kind: 'bundle',
        intent: { formName: 'X', fields: [{ name: 'a', type: 'string', component: 'Input' }] },
        schema: {
          root: {
            component: '$component(Wizard)',
            children: [{ value: '$model(a)', component: '$component(Input)' }],
          },
        },
      },
      k
    );
    // Wizard — прикладной шим: библиотека его не экспортирует, полем intent он быть не может.
    expect(content[0].text).not.toMatch(/\$component\(Wizard\).*не объявлен/);
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
      'form.validation.ts',
      'data-sources.ts',
      'api.ts',
    ],
    'renderer-react': [
      'index.tsx',
      'types.ts',
      'model.ts',
      'form.schema.ts',
      'form.behavior.ts',
      'form.render.ts',
      'form.validation.ts',
      'data-sources.ts',
      'api.ts',
    ],
    'renderer-json': [
      'index.tsx',
      'types.ts',
      'model.ts',
      'form.schema.ts',
      'form.behavior.ts',
      'form.render.ts',
      'form.validation.ts',
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
    expect(text).toContain('wizard.tsx');
    expect(text, 'раскладка шагов доезжает вместе с каноном').toContain('steps/<slug>/');
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
    expect(errors).toMatch(/`json-schema\.ts`[\s\S]*?`form\.schema\.ts`/);
    expect(errors).toMatch(/`render-behavior\.ts`[\s\S]*?`form\.render\.ts`/);
    expect(errors, 'имя названо — про «нет файла» второй раз не сообщаем').not.toMatch(/RF012/);

    const warnings = section(text, 'Warnings');
    // `wizard.tsx` — теперь каноническое имя шима, претензии к нему нет.
    expect(warnings).not.toMatch(/`wizard\.tsx`/);
    expect(warnings).toMatch(/README\.md/);
  });

  it('замер run B (renderer-react, `.tsx`) по новому канону проходит', async () => {
    const text = await layout(
      [
        'api.ts',
        'data-sources.ts',
        'form.behavior.ts',
        'index.tsx',
        'model.ts',
        'form.render.ts',
        'form.schema.tsx',
        'types.ts',
        'form.validation.ts',
      ],
      'renderer-react'
    );
    // `.tsx` у схемы — обоснованное отличие расширения (в схеме бывает JSX), а не нарушение.
    expect(text).toMatch(/✅ ошибок нет/);
    expect(text).not.toMatch(/предупреждений \d/);
  });

  it('прежние имена `renderer.*` — только предупреждения «переименуйте», без ошибок', async () => {
    // Ровно тот набор, что замер run B написал по прежнему канону: форма рабочая, ломать её
    // ради имени незачем, но новое имя обязано прозвучать.
    const react = await layout(
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
    expect(react).toMatch(/✅ ошибок нет, предупреждений 3/);
    const warnings = section(react, 'Warnings');
    expect(warnings).toMatch(/RF011/);
    expect(warnings).toMatch(/устаревшее имя/);
    expect(warnings).toMatch(/`renderer\.behavior\.ts` → `form\.render\.ts`/);
    expect(warnings).toMatch(/`validation\.ts` → `form\.validation\.ts`/);
    expect(react, 'прежнее имя покрывает роль валидации — «нет файла» не сообщаем').not.toMatch(
      /RF012/
    );
    // Расширение сохраняется: `.tsx` переименовывается в `.tsx`, а не в дефолтный `.ts`.
    expect(warnings).toMatch(/`renderer\.schema\.tsx` → `form\.schema\.tsx`/);

    const json = await layout(
      CANON['renderer-json']
        .map((f) =>
          f === 'form.schema.ts'
            ? 'renderer.schema.json'
            : f === 'form.render.ts'
              ? 'renderer.behavior.ts'
              : f
        )
        .concat('renderer.wizard.tsx'),
      'renderer-json'
    );
    expect(errorCount(json)).toBe(0);
    const jsonWarnings = section(json, 'Warnings');
    expect(jsonWarnings).toMatch(/`renderer\.schema\.json` → `form\.schema\.json`/);
    expect(jsonWarnings).toMatch(/`renderer\.wizard\.tsx` → `wizard\.tsx`/);
    expect(json, 'прежнее имя покрывает роль — «нет файла» не сообщаем').not.toMatch(/RF012/);
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
    expect(errors).toMatch(/`schema\.ts`[\s\S]*?`form\.schema\.ts`/);
    expect(errors).toMatch(/`render\.behavior\.ts`[\s\S]*?`form\.render\.ts`/);
    // Шим опционален — имя вне канона у него предупреждение, а не ошибка.
    expect(section(text, 'Warnings')).toMatch(/`json-wizard\.tsx`[\s\S]*?`wizard\.tsx`/);
  });

  it('`form.schema.json` допустим, но предупреждает о потере типизации', async () => {
    const files = CANON['renderer-json'].map((f) =>
      f === 'form.schema.ts' ? 'form.schema.json' : f
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
    const text = await layout(
      [...CANON['core'], 'form.render.ts', 'renderer.behavior.ts', 'registry.ts'],
      'core'
    );
    expect(text).toMatch(/✅ ошибок нет/);
    const warnings = section(text, 'Warnings');
    expect(warnings).toMatch(/form\.render\.ts[\s\S]*?`form\.behavior\.ts`/);
    expect(warnings).toMatch(/renderer\.behavior\.ts[\s\S]*?`form\.behavior\.ts`/);
    expect(warnings).toMatch(/registry\.ts[\s\S]*?renderer-json/);
  });

  it('вложенные каталоги вне `steps/` — ошибка: раскладка плоская', async () => {
    const text = await layout(
      [
        'index.tsx',
        'types.ts',
        'schema/model.ts',
        'form.schema.ts',
        'form.behavior.ts',
        'form.validation.ts',
        'data-sources.ts',
        'api.ts',
        'components/steps/Step1.tsx',
        'lib/x.ts',
      ],
      'core'
    );
    expect(errorCount(text)).toBe(3);
    const errors = section(text, 'Errors');
    expect(errors).toMatch(/schema\/model\.ts/);
    expect(errors).toMatch(/корне модуля/);
    expect(errors).toMatch(/lib\/x\.ts/);
    // Шаги не запрещены — запрещено их место: подсказка ведёт в `steps/<slug>/`.
    expect(errors).toMatch(/components\/steps\/Step1\.tsx[\s\S]*?`steps\/<slug>\/`/);
    expect(errors, 'модель названа — «нет model.ts» не сообщаем').not.toMatch(/RF012/);
  });

  it('`lib/x.ts` — ошибка вложенности', async () => {
    const text = await layout([...CANON['renderer-json'], 'lib/x.ts'], 'renderer-json');
    expect(errorCount(text)).toBe(1);
    expect(section(text, 'Errors')).toMatch(/lib\/x\.ts[\s\S]*?вложенный каталог вне канона/);
  });

  describe('визард по шагам — `steps/<slug>/`', () => {
    const STEPS = [
      'steps/index.ts',
      'steps/kontakty/form.validation.ts',
      'steps/kontakty/form.render.ts',
      'steps/kontakty/form.schema.json',
      'steps/dannye-zayomshchika/form.validation.ts',
      'steps/dannye-zayomshchika/form.render.ts',
    ];

    it('канон + папки шагов проходят без единой претензии', async () => {
      const text = await layout(
        [...CANON['renderer-json'], 'wizard.tsx', ...STEPS],
        'renderer-json'
      );
      expect(text).toMatch(/✅ ошибок нет/);
      expect(text).not.toMatch(/предупреждений \d/);
    });

    it('`steps/<slug>/form.validation.ts` принят и в core', async () => {
      const text = await layout(
        [...CANON['core'], 'steps/index.ts', 'steps/kontakty/form.validation.ts'],
        'core'
      );
      expect(text).toMatch(/✅ ошибок нет/);
      expect(text).not.toMatch(/предупреждений \d/);
    });

    it('общий каталог модуля снимается и у набора с шагами', async () => {
      const text = await layout(
        [...CANON['renderer-react'], 'steps/index.ts', 'steps/kontakty/form.validation.ts'].map(
          (f) => `src/forms/credit/${f}`
        ),
        'renderer-react'
      );
      expect(text).toMatch(/✅ ошибок нет/);
    });

    it('файл вне канона папки шага — ошибка с подсказкой', async () => {
      const text = await layout(
        [
          ...CANON['renderer-react'],
          'steps/index.ts',
          'steps/kontakty/utils.ts',
          'steps/kontakty/rules.ts',
          'steps/kontakty/model.ts',
        ],
        'renderer-react'
      );
      expect(errorCount(text)).toBe(3);
      const errors = section(text, 'Errors');
      expect(errors).toMatch(/steps\/kontakty\/rules\.ts[\s\S]*?`form\.validation\.ts`/);
      expect(errors).toMatch(/steps\/kontakty\/model\.ts[\s\S]*?корневой `model\.ts`/);
    });

    it('более глубокая вложенность в `steps/` — ошибка', async () => {
      const text = await layout(
        [...CANON['core'], 'steps/index.ts', 'steps/kontakty/parts/a.ts', 'steps/misc.ts'],
        'core'
      );
      expect(errorCount(text)).toBe(2);
    });

    it('прежнее имя в папке шага — предупреждение, номер в имени папки — предупреждение', async () => {
      const text = await layout(
        [...CANON['renderer-react'], 'steps/index.ts', 'steps/01-kontakty/renderer.behavior.ts'],
        'renderer-react'
      );
      expect(text).toMatch(/✅ ошибок нет/);
      const warnings = section(text, 'Warnings');
      expect(warnings).toMatch(/`renderer\.behavior\.ts` → `form\.render\.ts`/);
      expect(warnings).toMatch(/01-kontakty[\s\S]*?без номера/);
    });

    it('прежний `validation.ts` в папке шага и в корне — только предупреждения', async () => {
      const text = await layout(
        [
          ...CANON['core'].map((f) => (f === 'form.validation.ts' ? 'validation.ts' : f)),
          'steps/index.ts',
          'steps/kontakty/validation.ts',
        ],
        'core'
      );
      expect(text).toMatch(/✅ ошибок нет, предупреждений 2/);
      const warnings = section(text, 'Warnings');
      expect(warnings).toMatch(
        /at validation\.ts[\s\S]*?`validation\.ts` → `form\.validation\.ts`/
      );
      expect(warnings).toMatch(
        /steps\/kontakty\/validation\.ts[\s\S]*?`validation\.ts` → `form\.validation\.ts`/
      );
    });

    it('папки шагов без `steps/index.ts` — предупреждение про агрегатор', async () => {
      const text = await layout([...CANON['core'], 'steps/kontakty/form.validation.ts'], 'core');
      expect(text).toMatch(/✅ ошибок нет/);
      expect(section(text, 'Warnings')).toMatch(/RF012[\s\S]*?`steps\/index\.ts`/);
    });
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
    const json = await layout(CANON['renderer-json']);
    expect(json).toMatch(
      /`target` не передан — принят `renderer-json` по составу файлов \(есть `registry\.ts`\)/
    );
    expect(json).toMatch(/✅ ошибок нет/);

    const react = await layout(CANON['renderer-react']);
    expect(react).toMatch(/принят `renderer-react`[\s\S]*?`form\.render\.ts`/);
    expect(react).toMatch(/✅ ошибок нет/);
  });

  it('набор без различающих файлов — догадка «наугад» и совет передать target', async () => {
    // После выравнивания имён `form.schema.ts` есть у всех таргетов: по нему одному таргет
    // не определяется, и отчёт обязан это сказать, а не выдать догадку за вывод.
    const text = await layout(CANON['core']);
    expect(text).toMatch(/принят `core` НАУГАД/);
    expect(text).toMatch(/явным\s+`target`/);
  });

  it('неопознаваемый набор без target — отказ с перечнем значений', async () => {
    const text = await layout(['index.tsx', 'types.ts']);
    expect(text).toMatch(/core.*renderer-react.*renderer-json/s);
  });
});
