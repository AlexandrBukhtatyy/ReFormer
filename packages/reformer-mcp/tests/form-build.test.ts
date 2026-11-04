/**
 * `form_build` на настоящем диске и с настоящим компилятором: только так видно, что запись идёт «всё
 * или ничего», а проверка типов действительно ловит ошибки в `expr`. Проект лежит вне репозитория,
 * пакеты резолвятся через `REFORMER_TYPECHECK_ROOT`, как у стенда сценариев.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as prettier from 'prettier';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { GRAMMAR_EXAMPLE, intentGrammar } from '../src/core/generate/intent-grammar';
import { originOf, withMarker } from '../src/core/generate/generated-marker';
import type { Knowledge } from '../src/core/knowledge';
import { formBuildTool, INTENT_FILE } from '../src/core/tools/form-build';
import { createCliFormWorkspace, TYPECHECK_ROOT_ENV } from '../src/platform/cli/form-workspace';
import { cliKnowledge } from '../src/platform/cli/knowledge';

const repoRoot = resolve(__dirname, '../../..');
const SLOW = 120_000;

let project: string;
let knowledge: Knowledge;
const previousRoot = process.env[TYPECHECK_ROOT_ENV];

const formFile = (name: string) => join(project, 'form', name);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function writeIntent(intent: unknown): void {
  mkdirSync(join(project, 'form'), { recursive: true });
  writeFileSync(formFile(INTENT_FILE), JSON.stringify(intent));
}

async function build(dir?: string): Promise<{ text: string; isError: boolean }> {
  const result = await formBuildTool(dir === undefined ? {} : { dir }, knowledge);
  return { text: result.content[0].text, isError: result.isError === true };
}

/** Каталог формы содержит только исходник: отказ не оставил следов. */
function expectNothingWritten(): void {
  expect(readdirSync(join(project, 'form'))).toEqual([INTENT_FILE]);
}

beforeAll(() => {
  process.env[TYPECHECK_ROOT_ENV] = repoRoot;
});

afterAll(() => {
  if (previousRoot === undefined) delete process.env[TYPECHECK_ROOT_ENV];
  else process.env[TYPECHECK_ROOT_ENV] = previousRoot;
});

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'form-build-'));
  writeFileSync(
    join(project, 'package.json'),
    JSON.stringify({ name: 'consumer', dependencies: { '@reformer/core': '*' } })
  );
  knowledge = { ...cliKnowledge(), forms: createCliFormWorkspace(project) };
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('form_build: путь без ошибок', () => {
  it('без исходника отдаёт грамматику и ничего не создаёт', async () => {
    const { text, isError } = await build();
    expect(isError).toBe(false);
    expect(text).toBe(intentGrammar(CATALOGS));
    expect(existsSync(join(project, 'form'))).toBe(false);
  });

  it(
    'форма из грамматики собирается, и ответ не содержит файлов',
    async () => {
      writeIntent(GRAMMAR_EXAMPLE);
      const { text, isError } = await build();
      expect(text).toContain('✓ form_build');
      expect(isError).toBe(false);
      expect(text).toContain('Типы проверены');
      expect(text).not.toContain('import ');
      expect(text.length).toBeLessThan(1500);
      expect(readdirSync(join(project, 'form')).sort()).toEqual(
        [
          'api.ts',
          'data-sources.ts',
          'form.behavior.ts',
          'form.flow.ts',
          INTENT_FILE,
          'form.messages.ts',
          'form.schema.ts',
          'form.validation.ts',
          'index.tsx',
          'model.ts',
          'operators.ts',
          'types.ts',
        ].sort()
      );
      expect(originOf(readFileSync(formFile('model.ts'), 'utf-8'))).toBe('generated');
      expect(originOf(readFileSync(formFile('types.ts'), 'utf-8'))).toBe('handwritten');
      // Свои операторы: заготовка — файл сборки, пока её не правили, и ответ о ней напоминает.
      expect(originOf(readFileSync(formFile('operators.ts'), 'utf-8'))).toBe('generated');
      expect(readFileSync(formFile('api.ts'), 'utf-8')).toContain(
        'export function submitApplication'
      );
      expect(text).toContain('Свои операторы — ещё заготовки: operators.ts, api.ts');
    },
    SLOW
  );

  it(
    'та же форма собирается под renderer-json',
    async () => {
      writeIntent({ ...GRAMMAR_EXAMPLE, target: 'renderer-json' });
      const { text, isError } = await build();
      expect(text).toContain('✓ form_build');
      expect(isError).toBe(false);
      expect(existsSync(formFile('registry.ts'))).toBe(true);
    },
    SLOW
  );

  it(
    'незнакомое свойство компонента — предупреждение со свойствами, которые есть',
    async () => {
      const intent = clone(GRAMMAR_EXAMPLE);
      Object.assign(intent.fields[1].componentProps!, { minValue: 1 });
      for (const target of ['renderer-react', 'renderer-json']) {
        writeIntent({ ...intent, target });
        // Компилятор чужой ключ не ловит и на renderer-react: `componentProps` узла схемы не
        // сверяется с пропсами компонента, так что сказать о нём может только сборка.
        const { text, isError } = await build();
        expect(isError).toBe(false);
        expect(text).toContain('поле «price»: у InputNumber нет свойства «minValue»');
      }
    },
    SLOW
  );

  it(
    'форма кредита на 75 полей собирается',
    async () => {
      const credit = JSON.parse(
        readFileSync(resolve(__dirname, '../eval/calibration/cases/credit/intent.json'), 'utf-8')
      );
      writeIntent({ ...credit, target: 'renderer-react' });
      const { text, isError } = await build();
      expect(text).toContain('✓ form_build');
      expect(isError).toBe(false);
    },
    SLOW
  );

  it(
    'повторная сборка ничего не переписывает',
    async () => {
      writeIntent(GRAMMAR_EXAMPLE);
      await build();
      const { text } = await build();
      expect(text).toContain('записано 0');
    },
    SLOW
  );

  it(
    'каждый компонент кита компилируется на обоих таргетах',
    async () => {
      const names = Object.keys(CATALOGS.uiKit.fields);
      const fields = names.map((component, index) => ({
        name: `field${index}`,
        type: 'string',
        component,
        label: component,
      }));
      for (const target of ['renderer-react', 'renderer-json']) {
        writeIntent({
          formName: 'Все компоненты',
          interfaceName: 'AllComponents',
          target,
          fields,
          layoutRoot: {
            kind: 'container',
            component: 'Box',
            children: fields.map((field) => field.name),
          },
        });
        const { text } = await build();
        expect(text).not.toContain('has no exported member');
      }
    },
    SLOW
  );
});

describe('form_build: при ошибке диск не меняется', () => {
  it('нераспознаваемый JSON', async () => {
    mkdirSync(join(project, 'form'));
    writeFileSync(formFile(INTENT_FILE), '{ нет');
    const { text, isError } = await build();
    expect(isError).toBe(true);
    expect(text).toContain('не разбирается');
    expectNothingWritten();
  });

  it('ссылка раскладки в никуда', async () => {
    writeIntent({
      ...GRAMMAR_EXAMPLE,
      layoutRoot: { kind: 'container', component: 'Box', children: ['ghostField'] },
    });
    const { text, isError } = await build();
    expect(isError).toBe(true);
    expect(text).toContain('C11');
    expect(text).toContain('ghostField');
    expectNothingWritten();
  });

  it('поле не стоит в раскладке', async () => {
    const intent = clone(GRAMMAR_EXAMPLE);
    intent.fields.push({
      name: 'forgotten',
      type: 'string',
      component: 'Input',
      label: 'Забытое',
      initialValue: '',
    });
    writeIntent(intent);
    const { text, isError } = await build();
    expect(isError).toBe(true);
    expect(text).toContain('forgotten');
    expectNothingWritten();
  });

  it('потерянный текст ошибки: у проверок правила нет кода', async () => {
    const intent = clone(GRAMMAR_EXAMPLE);
    intent.validation[0].rules = ['required()', 'min(1)'];
    writeIntent(intent);
    const { text, isError } = await build();
    expect(isError).toBe(true);
    expect(text).toContain('тексты ошибок потеряны');
    expect(text).toContain("required({ code: 'price.required' })");
    expectNothingWritten();
  });

  it(
    'выдуманный метод массива в expr',
    async () => {
      const intent = clone(GRAMMAR_EXAMPLE);
      intent.behavior[5].expr = 'model.contacts.reduce((sum, row) => sum + (row.income || 0), 0)';
      writeIntent(intent);
      const { text, isError } = await build();
      expect(isError).toBe(true);
      expect(text).toContain("Property 'reduce' does not exist");
      expect(text).toContain('в строке:');
      expectNothingWritten();
    },
    SLOW
  );

  it(
    'неизвестный валидатор',
    async () => {
      const intent = clone(GRAMMAR_EXAMPLE);
      intent.validation[0].rules = ["notARealValidator({ code: 'price.required' })"];
      writeIntent(intent);
      const { text, isError } = await build();
      expect(isError).toBe(true);
      expect(text).toContain('notARealValidator');
      expect(text).toContain('объяви в operators');
      expectNothingWritten();
    },
    SLOW
  );

  it('вызов необъявленного оператора — отказ с подсказкой про operators', async () => {
    const intent = clone(GRAMMAR_EXAMPLE);
    const { roundTo: _undeclared, ...operators } = intent.operators;
    void _undeclared;
    writeIntent({ ...intent, operators });
    const { text, isError } = await build();
    expect(isError).toBe(true);
    expect(text).toContain('C12');
    expect(text).toContain('`roundTo` не объявлен в operators');
    expectNothingWritten();
  });

  it(
    'неразбираемый expr',
    async () => {
      const intent = clone(GRAMMAR_EXAMPLE);
      intent.behavior[0].expr = 'model.price + (';
      writeIntent(intent);
      const { isError } = await build();
      expect(isError).toBe(true);
      expectNothingWritten();
    },
    SLOW
  );
});

describe('form_build: границы каталога', () => {
  it('путь вне проекта и родитель проекта отклоняются', async () => {
    for (const dir of ['../outside', '..', resolve(project, '../outside')]) {
      const { isError, text } = await build(dir);
      expect(isError, dir).toBe(true);
      expect(text).toContain('внутри проекта');
    }
  });

  it('в node_modules и .git писать нельзя', async () => {
    for (const dir of ['node_modules/x', '.git/hooks']) {
      const { isError, text } = await build(dir);
      expect(isError, dir).toBe(true);
      expect(text).toContain('писать нельзя');
    }
  });

  it('символическая ссылка не выводит за границу проекта', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'form-build-outside-'));
    try {
      symlinkSync(outside, join(project, 'escape'), 'junction');
      const { isError, text } = await build('escape/form');
      expect(isError).toBe(true);
      expect(text).toContain('внутри проекта');
      expect(readdirSync(outside)).toEqual([]);
    } finally {
      rmSync(join(project, 'escape'), { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('без проекта отказывает, а не пишет наугад', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'form-build-bare-'));
    try {
      const noProject = createCliFormWorkspace(bare).open('form');
      // Выше временного каталога может лежать настоящий package.json: тогда отказа не будет.
      if (!noProject.ok) expect(noProject.reason).toContain('package.json');
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe('form_build: чей файл', () => {
  it(
    'правка руками отсоединяет файл, а удаление возвращает его под сборку',
    async () => {
      writeIntent(GRAMMAR_EXAMPLE);
      await build();
      const edited = `${readFileSync(formFile('form.behavior.ts'), 'utf-8')}\n// правка человека\n`;
      writeFileSync(formFile('form.behavior.ts'), edited);

      const rebuilt = await build();
      expect(rebuilt.text).toContain('Правлены вручную');
      expect(rebuilt.text).toContain('form.behavior.ts');
      expect(readFileSync(formFile('form.behavior.ts'), 'utf-8')).toBe(edited);

      rmSync(formFile('form.behavior.ts'));
      const returned = await build();
      expect(returned.text).not.toContain('Правлены вручную');
      expect(readFileSync(formFile('form.behavior.ts'), 'utf-8')).not.toContain('правка человека');
    },
    SLOW
  );

  it(
    'файл, написанный до сборки, не затирается',
    async () => {
      writeIntent(GRAMMAR_EXAMPLE);
      await build();
      const own = readFileSync(formFile('form.flow.ts'), 'utf-8').split('\n').slice(1).join('\n');
      writeFileSync(formFile('form.flow.ts'), own);
      const { text } = await build();
      expect(text).toContain('form.flow.ts');
      expect(readFileSync(formFile('form.flow.ts'), 'utf-8')).toBe(own);
    },
    SLOW
  );

  it(
    'свои types.ts и api.ts сборка не трогает',
    async () => {
      writeIntent(GRAMMAR_EXAMPLE);
      await build();
      writeFileSync(formFile('api.ts'), 'export const load = () => null;\n');
      await build();
      expect(readFileSync(formFile('api.ts'), 'utf-8')).toBe('export const load = () => null;\n');
    },
    SLOW
  );

  it(
    'форматирование prettier не отсоединяет файлы',
    async () => {
      writeIntent(GRAMMAR_EXAMPLE);
      await build();
      for (const name of readdirSync(join(project, 'form'))) {
        if (!/\.tsx?$/.test(name)) continue;
        const text = readFileSync(formFile(name), 'utf-8');
        const formatted = await prettier.format(text, {
          parser: 'typescript',
          singleQuote: false,
          trailingComma: 'all',
          printWidth: 60,
        });
        expect(originOf(formatted), name).toBe(originOf(text));
      }
    },
    SLOW
  );

  it('маркер отличает правку кода от правки оформления', () => {
    const file = withMarker("const name = 'a';\n");
    expect(originOf(file)).toBe('generated');
    expect(originOf(file.replace("'a'", '"a"'))).toBe('generated');
    expect(originOf(file.replace("'a'", "'b'"))).toBe('edited');
    expect(originOf("const name = 'a';\n")).toBe('handwritten');
  });

  it(
    'тела своих операторов переживают пересборку, а напоминание остаётся только о заготовках',
    async () => {
      writeIntent(GRAMMAR_EXAMPLE);
      await build();
      const own = [
        "import type { Rule } from '@reformer/core/validation';",
        '',
        'export const postalCodeRu =',
        '  (options: { code?: string } = {}): Rule<string | null> =>',
        '  (value) =>',
        "    !value || /^\\d{6}$/.test(value) ? null : { code: options.code ?? 'postalCode' };",
        'export function phoneOrEmail(..._args: unknown[]): void {}',
        'export function roundTo(..._args: unknown[]): void {}',
        'export function saveDraft(..._args: unknown[]): void {}',
        '',
      ].join('\n');
      writeFileSync(formFile('operators.ts'), own);

      const rebuilt = await build();
      expect(rebuilt.isError).toBe(false);
      expect(readFileSync(formFile('operators.ts'), 'utf-8')).toBe(own);
      expect(rebuilt.text).not.toContain('Правлены вручную');
      expect(rebuilt.text).toContain('Свои операторы — ещё заготовки: api.ts.');
    },
    SLOW
  );

  it(
    'заготовка следует за intent, пока её не правили: оператор становится правилом позже',
    async () => {
      writeIntent({ ...GRAMMAR_EXAMPLE, validation: [] });
      await build();
      expect(readFileSync(formFile('operators.ts'), 'utf-8')).toContain(
        'export function postalCodeRu(..._args: unknown[]): void'
      );
      writeIntent(GRAMMAR_EXAMPLE);
      const { text, isError } = await build();
      expect(isError, text).toBe(false);
      expect(readFileSync(formFile('operators.ts'), 'utf-8')).toContain(
        'export function postalCodeRu(..._args: unknown[]): Rule<string | null>'
      );
    },
    SLOW
  );

  it(
    'точка входа подхватывает тексты, появившиеся после первой сборки',
    async () => {
      writeIntent({ ...GRAMMAR_EXAMPLE, validation: [] });
      await build();
      expect(readFileSync(formFile('index.tsx'), 'utf-8')).not.toContain(
        'ValidationMessagesProvider'
      );
      expect(existsSync(formFile('form.messages.ts'))).toBe(false);

      writeIntent(GRAMMAR_EXAMPLE);
      await build();
      expect(readFileSync(formFile('index.tsx'), 'utf-8')).toContain('ValidationMessagesProvider');
      expect(existsSync(formFile('form.messages.ts'))).toBe(true);
    },
    SLOW
  );

  it(
    'необязательный файл исчезает вместе с причиной',
    async () => {
      writeIntent(GRAMMAR_EXAMPLE);
      await build();
      expect(existsSync(formFile('form.messages.ts'))).toBe(true);
      writeIntent({ ...GRAMMAR_EXAMPLE, validation: [] });
      await build();
      expect(existsSync(formFile('form.messages.ts'))).toBe(false);
    },
    SLOW
  );
});

describe('form_build: таргет core', () => {
  const coreIntent = { ...GRAMMAR_EXAMPLE, target: 'core', visibility: [] };

  it(
    'собирает всё, кроме разметки, и не тянет рендерер',
    async () => {
      writeIntent(coreIntent);
      const { text, isError } = await build();
      expect(text).toContain('✓ form_build');
      expect(isError).toBe(false);
      expect(text).toContain('Разметки ещё нет');
      // Правила узлов исполняет рендерер: на core их нет в поведении, и сборка об этом говорит.
      expect(text).toContain('Правил узлов схемы');
      expect(readFileSync(formFile('form.behavior.ts'), 'utf-8')).not.toContain('onMount');
      expect(originOf(readFileSync(formFile('index.tsx'), 'utf-8'))).toBe('handwritten');
      expect(existsSync(formFile('model.ts'))).toBe(true);
      for (const name of readdirSync(join(project, 'form'))) {
        if (!/\.tsx?$/.test(name)) continue;
        expect(readFileSync(formFile(name), 'utf-8'), name).not.toMatch(/@reformer\/renderer-/);
      }
    },
    SLOW
  );

  it(
    'разметка агента переживает пересборку, а её типы проверяются',
    async () => {
      writeIntent(coreIntent);
      await build();
      const stub = readFileSync(formFile('index.tsx'), 'utf-8');
      const withField = (control: string) =>
        `import { FormField } from '@reformer/ui-kit';\n${stub.replace(
          'return null;',
          `return <FormField control={${control}} />;`
        )}`;

      writeFileSync(formFile('index.tsx'), withField('bundle.form.price'));
      const passed = await build();
      expect(passed.text).toContain('✓ form_build');
      expect(passed.text).not.toContain('Разметки ещё нет');
      expect(readFileSync(formFile('index.tsx'), 'utf-8')).toContain('bundle.form.price');

      writeFileSync(formFile('index.tsx'), withField('bundle.form.noSuchField'));
      const failed = await build();
      expect(failed.isError).toBe(true);
      expect(failed.text).toContain('noSuchField');
    },
    SLOW
  );
});

describe('form_build: компилятор недоступен', () => {
  const noRoot = () => {
    delete process.env[TYPECHECK_ROOT_ENV];
  };
  const restoreRoot = () => {
    process.env[TYPECHECK_ROOT_ENV] = repoRoot;
  };

  it('говорит, что типы не проверены, и всё равно ловит несуществующий импорт', async () => {
    noRoot();
    try {
      writeIntent(GRAMMAR_EXAMPLE);
      const passed = await build();
      expect(passed.text).toContain('✓ form_build');
      expect(passed.text).toContain('Типы НЕ проверены');

      const intent = clone(GRAMMAR_EXAMPLE);
      intent.validation[0].rules = ["notARealValidator({ code: 'price.required' })"];
      writeIntent(intent);
      const failed = await build();
      expect(failed.isError).toBe(true);
      expect(failed.text).toContain('notARealValidator');
    } finally {
      restoreRoot();
    }
  });
});

describe('form_build: запись intent не теряет часть формы', () => {
  // Пробник на рабочем сервере 2026-11-04 (ReFormer-j356.5): каждая из этих записей давала ✓ —
  // на пустой форме, на плоской вместо мастера и с Input вместо выбора.
  const base = { formName: 'Заявка', interfaceName: 'Application', target: 'renderer-react' };

  it(
    'поля, описанные прямо в шагах, собираются мастером из двух шагов',
    async () => {
      writeIntent({
        ...base,
        steps: [
          { title: 'Клиент', fields: [{ name: 'fullName', component: 'Input', label: 'ФИО' }] },
          { title: 'Заказ', fields: [{ name: 'comment', component: 'Textarea', label: 'Отзыв' }] },
        ],
      });
      const { text, isError } = await build();
      expect(isError).toBe(false);
      expect(text).toContain('Полей 2');
      const schema = readFileSync(formFile('form.schema.ts'), 'utf-8');
      expect(schema).toContain('Клиент');
      expect(schema).toContain('Заказ');
      expect(schema).toContain('Step');
    },
    SLOW
  );

  it('поле вне шагов сокращения steps — отказ с подсказкой, куда его поставить', async () => {
    writeIntent({
      ...base,
      fields: [
        { name: 'a', component: 'Input', label: 'A' },
        { name: 'b', component: 'Input', label: 'B' },
      ],
      steps: [{ title: 'Первый', fields: ['a'] }, { title: 'Второй' }],
    });
    const { text, isError } = await build();
    expect(isError).toBe(true);
    expect(text).toContain('не стоят в layoutRoot');
    expect(text).toContain('`steps[i].fields`');
    expectNothingWritten();
  });

  it(
    'type: "Select" собирается выбором, а не полем ввода',
    async () => {
      writeIntent({
        ...base,
        fields: [
          {
            name: 'city',
            type: 'Select',
            label: 'Город',
            options: [{ value: 'msk', label: 'Москва' }],
          },
        ],
      });
      const { isError } = await build();
      expect(isError).toBe(false);
      // Registry-имя `Select` на renderer-react — экспорт `SelectAsync`.
      const schema = readFileSync(formFile('form.schema.ts'), 'utf-8');
      expect(schema).toContain('component: SelectAsync');
      expect(schema).not.toMatch(/component: Input\b/);
    },
    SLOW
  );

  it('второе объявление поля — отказ о дубле, а не о testId', async () => {
    writeIntent({
      ...base,
      fields: [
        { name: 'email', component: 'Input', label: 'Почта' },
        { name: 'email', component: 'Input', label: 'Почта ещё раз' },
      ],
    });
    const { text, isError } = await build();
    expect(isError).toBe(true);
    expect(text).toContain('объявлено второй раз');
    expect(text).not.toContain('C10');
    expectNothingWritten();
  });
});

describe('form_build: пустое текстовое поле — null', () => {
  it(
    'метод строки по необязательному полю — ошибка типов, а не падение в браузере [ReFormer-b464]',
    async () => {
      // Текстовые компоненты кита пишут `null` в стёртое поле. С типом `string` сборка
      // принимала `model.promo.trim()`, и стёртый промокод ронял форму.
      const intent = {
        formName: 'Промокод',
        interfaceName: 'Promo',
        target: 'renderer-react',
        fields: [
          { name: 'promo', type: 'string', component: 'Input', label: 'Промокод' },
          { name: 'code', type: 'string', component: 'Input', label: 'Код' },
        ],
        behavior: [
          { kind: 'compute', target: 'code', sources: ['promo'], expr: 'model.promo.trim()' },
        ],
      };
      writeIntent(intent);
      const failed = await build();
      expect(failed.isError).toBe(true);
      expect(failed.text).toContain('ошибки типов');
      expectNothingWritten();

      intent.behavior[0].expr = "(model.promo ?? '').trim()";
      writeIntent(intent);
      const passed = await build();
      expect(passed.isError).toBe(false);
      expect(readFileSync(formFile('model.ts'), 'utf-8')).toContain('promo: string | null;');
    },
    SLOW
  );
});

describe('form_build: подсказки из справочника', () => {
  it(
    'suggestionsSource собирается InputSuggest с подсказками из data-sources [ReFormer-3yx2]',
    async () => {
      writeIntent({
        formName: 'Доставка',
        interfaceName: 'Delivery',
        target: 'renderer-react',
        fields: [{ name: 'city', type: 'string', label: 'Город', suggestionsSource: 'CITIES' }],
        dataSources: [{ name: 'CITIES', values: ['Москва', 'Казань'] }],
      });
      const { text, isError } = await build();
      expect(text).toContain('Типы проверены');
      expect(isError).toBe(false);
      const schema = readFileSync(formFile('form.schema.ts'), 'utf-8');
      expect(schema).toContain('component: InputSuggest');
      expect(schema).toContain('suggestions: CITIES');
    },
    SLOW
  );
});

describe('form_build: замечание cross — предупреждение с параметрами', () => {
  it(
    'severity и params собираются и проходят проверку типов [ReFormer-j356.4.21: A13, A15]',
    async () => {
      writeIntent({
        formName: 'Кредит',
        interfaceName: 'Loan',
        target: 'renderer-react',
        fields: [
          { name: 'amount', type: 'number', component: 'InputNumber', label: 'Сумма' },
          { name: 'income', type: 'number', component: 'InputNumber', label: 'Доход' },
        ],
        validation: [
          {
            target: 'amount',
            rules: [],
            cross: 'values.amount <= values.income * 10',
            code: 'amount.tooHigh',
            message: 'Сумма больше {maximum}',
            severity: 'warning',
            params: { maximum: 'values.income * 10' },
          },
        ],
      });
      const { text, isError } = await build();
      expect(text).toContain('Типы проверены');
      expect(isError).toBe(false);
      const validation = readFileSync(formFile('form.validation.ts'), 'utf-8');
      expect(validation).toContain(
        "{ code: 'amount.tooHigh', severity: 'warning', params: { maximum: values.income * 10 } }"
      );
    },
    SLOW
  );
});

describe('form_build: условие вычисления', () => {
  it(
    'when у compute и computeFrom печатается { when } и проходит проверку типов [ReFormer-j356.4.21: A8]',
    async () => {
      writeIntent({
        formName: 'Ипотека',
        interfaceName: 'Mortgage',
        target: 'renderer-react',
        fields: [
          { name: 'loanType', type: 'string', component: 'Input', label: 'Тип' },
          { name: 'propertyValue', type: 'number', component: 'InputNumber', label: 'Стоимость' },
          { name: 'initialPayment', type: 'number', component: 'InputNumber', label: 'Взнос' },
          { name: 'fee', type: 'number', component: 'InputNumber', label: 'Комиссия' },
        ],
        behavior: [
          {
            kind: 'computeFrom',
            target: 'initialPayment',
            sources: ['propertyValue'],
            expr: 'propertyValue * 0.2',
            when: "model.loanType === 'mortgage'",
          },
          {
            kind: 'compute',
            target: 'fee',
            sources: ['propertyValue'],
            expr: 'model.propertyValue * 0.01',
            options: { when: "model.loanType === 'mortgage'" },
          },
        ],
      });
      const { text, isError } = await build();
      expect(text).toContain('Типы проверены');
      expect(isError).toBe(false);
      const behavior = readFileSync(formFile('form.behavior.ts'), 'utf-8');
      expect(behavior).toContain("{ when: () => model.loanType === 'mortgage' }");
      expect(behavior.match(/when: \(\) =>/g)).toHaveLength(2);
    },
    SLOW
  );
});

describe('form_build: включение группы', () => {
  it(
    'enableWhen на группу проходит кросс-проверку и типы [ReFormer-j356.4.21: A9]',
    async () => {
      writeIntent({
        formName: 'Адрес',
        interfaceName: 'Address',
        target: 'renderer-react',
        fields: [
          { name: 'other', type: 'boolean', component: 'Checkbox', label: 'Другой адрес' },
          { name: 'residence.city', type: 'string', component: 'Input', label: 'Город' },
          { name: 'residence.street', type: 'string', component: 'Input', label: 'Улица' },
        ],
        behavior: [
          { kind: 'enableWhen', target: 'residence', sources: ['other'], expr: 'model.other' },
        ],
      });
      const { text, isError } = await build();
      expect(text).toContain('Типы проверены');
      expect(isError).toBe(false);
      expect(readFileSync(formFile('form.behavior.ts'), 'utf-8')).toContain(
        'enableWhen(model.$.residence, () => model.other);'
      );
    },
    SLOW
  );
});
