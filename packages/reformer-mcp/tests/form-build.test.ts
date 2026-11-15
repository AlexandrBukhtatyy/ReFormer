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
import { HOSTILE_INTENTS } from './support/hostile-intents';
import { GRAMMAR_EXAMPLE, intentGrammar } from '../src/core/generate/intent-grammar';
import { originOf, withMarker } from '../src/core/generate/generated-marker';
import { createKnowledge, type Knowledge } from '../src/core/knowledge';
import { formBuildTool, INTENT_FILE, MAX_ERRORS, MAX_WARNINGS } from '../src/core/tools/form-build';
import type { FormWorkspace } from '../src/core/workspace/form-workspace';
import { parseFormBuild } from '../eval/calibration/lib/bundle.mjs';
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
    expect(text).toBe(
      '⚠️ form_build: nothing built — form/form.intent.json does not exist yet. Write it by the ' +
        `grammar below, then call form_build again.\n\n${intentGrammar(CATALOGS)}`
    );
    expect(existsSync(join(project, 'form'))).toBe(false);
  });

  it(
    'форма из грамматики собирается, и ответ не содержит файлов',
    async () => {
      writeIntent(GRAMMAR_EXAMPLE);
      const { text, isError } = await build();
      expect(text).toContain('✓ form_build');
      expect(isError).toBe(false);
      expect(text).toContain('Types checked');
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
      // Функция отправки (её зовут только со значениями формы) — рабочая заглушка без метки: о ней
      // не напоминают (ReFormer-f2fs.17).
      expect(readFileSync(formFile('api.ts'), 'utf-8')).toContain(
        'export async function submitApplication(values: LoanApplication): Promise<void>'
      );
      expect(text).toContain('Your operators are still stubs: operators.ts.');
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
    'renderer-json: схема — документ form.schema.json, его открывает ui-builder',
    async () => {
      writeIntent({ ...GRAMMAR_EXAMPLE, target: 'renderer-json' });
      const { isError } = await build();
      expect(isError).toBe(false);
      expect(existsSync(formFile('form.schema.ts'))).toBe(false);
      // Ровно то, что билдер ищет: имя `*.schema.json` и документ формата 2 с маркером сборки.
      const text = readFileSync(formFile('form.schema.json'), 'utf-8');
      const document = JSON.parse(text);
      expect(document.format).toBe(2);
      expect(document.meta.description).toMatch(/^@reformer-form-build [0-9a-f]{16} /);
      expect(originOf(text, 'form.schema.json')).toBe('generated');
      const { validateFormSchema } = await import('@reformer/renderer-json/validate');
      expect(validateFormSchema(document).errors).toEqual([]);
      // Повторная сборка его не переписывает.
      expect((await build()).text).toContain('written 0');
    },
    SLOW
  );

  it(
    'renderer-json: документ, правленный в ui-builder, сборка не трогает',
    async () => {
      writeIntent({ ...GRAMMAR_EXAMPLE, target: 'renderer-json' });
      await build();
      const document = JSON.parse(readFileSync(formFile('form.schema.json'), 'utf-8'));
      document.root.children.reverse();
      const edited = `${JSON.stringify(document, null, 2)}\n`;
      writeFileSync(formFile('form.schema.json'), edited);
      const { text } = await build();
      expect(text).toContain('form.schema.json');
      expect(readFileSync(formFile('form.schema.json'), 'utf-8')).toBe(edited);
    },
    SLOW
  );

  it(
    'сборка до 2026-11-11 оставила form.schema.ts — он убирается, правленный руками остаётся',
    async () => {
      writeIntent({ ...GRAMMAR_EXAMPLE, target: 'renderer-json' });
      writeFileSync(formFile('form.schema.ts'), withMarker('export const formSchema = {};\n'));
      await build();
      expect(existsSync(formFile('form.schema.ts'))).toBe(false);

      // Правленный руками остаётся, но сборка говорит, что модуль его больше не читает: так
      // правка текста кнопок в прогоне L5-registration молча перестала бы действовать.
      const edited = withMarker('export const formSchema = {};\n').replace('{}', '{ x: 1 }');
      writeFileSync(formFile('form.schema.ts'), edited);
      const { text } = await build();
      expect(readFileSync(formFile('form.schema.ts'), 'utf-8')).toBe(edited);
      expect(text).toContain(
        'Edited by hand, but this build no longer produces them: form.schema.ts'
      );
      expect(text).toContain('the schema of renderer-json is form.schema.json');
      rmSync(formFile('form.schema.ts'));

      // Смена таргета: прежний документ уходит так же.
      writeIntent({ ...GRAMMAR_EXAMPLE, target: 'renderer-react' });
      await build();
      expect(existsSync(formFile('form.schema.json'))).toBe(false);
      expect(existsSync(formFile('form.schema.ts'))).toBe(true);
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
        expect(text).toContain('the field «price»: InputNumber has no prop «minValue»');
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
      expect(text).toContain('written 0');
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
    expect(text).toContain('is not JSON');
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
    expect(text).toContain('lost-message');
    expect(text).toContain("required({ code: 'price.required' }), min(1, { code: 'price.min' })");
    // Пример — сама починка: общая подсказка «строка на код» с ним бы спорила.
    expect(text).not.toContain('one `validation` row per issue code');
    expectNothingWritten();
  });

  it('потерянный текст ошибки: пример кода — по полю и проверкам правила, а не про цену', async () => {
    const intent = clone(GRAMMAR_EXAMPLE);
    intent.validation[0] = {
      ...intent.validation[0],
      target: 'email',
      rules: ['email()'],
      message: 'Неверный email',
    };
    writeIntent(intent);
    const { text } = await build();
    expect(text).toContain(
      'The text «Неверный email» of the rule on `email` is not in form.messages.ts: its checks ' +
        "have no code — give each one as the last argument: email({ code: 'email.email' })."
    );
    expect(text).not.toContain('price.required');
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
      expect(text).toContain('in line:');
      // Ошибка в сгенерированном файле правится через intent: файл перепишет следующая сборка.
      expect(text).toContain('fix form.intent.json — the build writes form.behavior.ts');
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
      expect(text).toContain('Declare your own rule in operators');
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
    expect(text).toContain('`roundTo` is not declared in operators');
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
      expect(text).toContain('inside the project');
    }
  });

  it('в node_modules и .git писать нельзя', async () => {
    for (const dir of ['node_modules/x', '.git/hooks']) {
      const { isError, text } = await build(dir);
      expect(isError, dir).toBe(true);
      expect(text).toContain('are not writable');
    }
  });

  it('символическая ссылка не выводит за границу проекта', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'form-build-outside-'));
    try {
      symlinkSync(outside, join(project, 'escape'), 'junction');
      const { isError, text } = await build('escape/form');
      expect(isError).toBe(true);
      expect(text).toContain('inside the project');
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

describe('form_build: сборки не было — первая строка говорит почему [ReFormer-11oe.23]', () => {
  const call = async (args: { dir?: string; grammar?: string }) => {
    const result = await formBuildTool(args, knowledge);
    return { text: result.content[0].text, isError: result.isError === true };
  };
  const firstLine = (text: string) => text.split('\n')[0];

  it('intent в корне проекта, а не в каталоге формы — ответ называет найденный файл', async () => {
    writeFileSync(join(project, INTENT_FILE), JSON.stringify(GRAMMAR_EXAMPLE));
    const { text, isError } = await call({ dir: 'form' });
    expect(isError).toBe(false);
    expect(firstLine(text)).toBe(
      '⚠️ form_build: nothing built — form/form.intent.json does not exist yet. Write it by the ' +
        'grammar below, then call form_build again. ./form.intent.json lies outside the form ' +
        'folder: the build reads only form/form.intent.json — move it there.'
    );
    expect(text.endsWith(intentGrammar(CATALOGS))).toBe(true);
    expect(existsSync(join(project, 'form'))).toBe(false);
  });

  it('intent под чужим именем в каталоге формы — ответ называет файл, без грамматики', async () => {
    mkdirSync(join(project, 'form'), { recursive: true });
    writeFileSync(join(project, 'form', 'intent.json'), JSON.stringify(GRAMMAR_EXAMPLE));
    writeFileSync(join(project, 'form', 'intents.json'), '{}');
    writeFileSync(join(project, 'form', 'form.schema.json'), '{}');
    const { text, isError } = await call({ dir: 'form' });
    expect(isError).toBe(false);
    expect(text).toBe(
      '⚠️ form_build: nothing built — form/form.intent.json does not exist yet. form/intent.json, ' +
        'form/intents.json are in the form folder under another name: the build reads only ' +
        'form/form.intent.json — write the intent under that name. Then call form_build again.'
    );
    expect(parseFormBuild(text).status).toBe('unknown');
  });

  it('grammar вместе с dir: intent под чужим именем назван и тут', async () => {
    mkdirSync(join(project, 'form'), { recursive: true });
    writeFileSync(join(project, 'form', 'Form-Intent.JSON'), '{}');
    const { text } = await call({ dir: 'form', grammar: 'base' });
    expect(firstLine(text)).toContain(
      'form/Form-Intent.JSON is in the form folder under another name: the build reads only ' +
        'form/form.intent.json — write the intent under that name.'
    );
    expect(text.endsWith(intentGrammar(CATALOGS))).toBe(true);
  });

  it('вложенный каталог формы: найденные выше файлы — ближний первым', async () => {
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'src', INTENT_FILE), '{}');
    writeFileSync(join(project, INTENT_FILE), '{}');
    const { text } = await call({ dir: 'src/forms/profile' });
    expect(firstLine(text)).toContain('src/forms/profile/form.intent.json does not exist yet');
    expect(firstLine(text)).toContain('./src/form.intent.json, ./form.intent.json lie outside');
  });

  it('grammar вместе с dir при готовом intent: грамматика, а не сборка, и диск не тронут', async () => {
    writeIntent(GRAMMAR_EXAMPLE);
    const { text, isError } = await call({ dir: 'form', grammar: 'all' });
    expect(isError).toBe(false);
    expect(text).toBe(
      '⚠️ form_build: nothing built — with "grammar" the tool returns the grammar only. ' +
        'form/form.intent.json was not read. To build it, call form_build {"dir":"form"} without ' +
        `"grammar".\n\n${intentGrammar(CATALOGS, { sections: 'all' })}`
    );
    expectNothingWritten();
    // Стенды не примут пометку ни за успех, ни за отказ сборки.
    expect(parseFormBuild(text).status).toBe('unknown');
  });

  it('grammar вместе с dir без intent: что написать и куда, и где лежит промах', async () => {
    writeFileSync(join(project, INTENT_FILE), '{}');
    const { text } = await call({ dir: 'form', grammar: 'base' });
    expect(firstLine(text)).toBe(
      '⚠️ form_build: nothing built — with "grammar" the tool returns the grammar only. ' +
        'form/form.intent.json does not exist yet: write it by this grammar, then call ' +
        'form_build {"dir":"form"} without "grammar". ./form.intent.json lies outside the form ' +
        'folder: the build reads only form/form.intent.json — move it there.'
    );
    expect(text.endsWith(intentGrammar(CATALOGS))).toBe(true);
  });

  it('grammar с каталогом вне проекта — пометка без чтения диска', async () => {
    const { text, isError } = await call({ dir: '../outside', grammar: 'base' });
    expect(isError).toBe(false);
    expect(firstLine(text)).toBe(
      '⚠️ form_build: nothing built — with "grammar" the tool returns the grammar only. To build, ' +
        'call form_build {"dir":"../outside"} without "grammar".'
    );
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
      expect(rebuilt.text).toContain('Edited by hand');
      expect(rebuilt.text).toContain('form.behavior.ts');
      expect(readFileSync(formFile('form.behavior.ts'), 'utf-8')).toBe(edited);

      rmSync(formFile('form.behavior.ts'));
      const returned = await build();
      expect(returned.text).not.toContain('Edited by hand');
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

  it('маркер JSON — в meta.description: порядок ключей и отступы правкой не считаются', () => {
    const body = { format: 2, meta: { name: 'Форма' }, root: { component: '$component(Box)' } };
    const file = withMarker(JSON.stringify(body), 'form.schema.json');
    const marked = JSON.parse(file);
    expect(Object.keys(marked)).toEqual(['format', 'meta', 'root']);
    expect(marked.meta.name).toBe('Форма');
    expect(originOf(file, 'form.schema.json')).toBe('generated');
    // Так сохранит ui-builder: другие отступы и порядок ключей.
    const { root, meta, format } = marked;
    expect(originOf(JSON.stringify({ root, meta, format }), 'form.schema.json')).toBe('generated');
    expect(originOf(file.replace('$component(Box)', '$component(Card)'), 'form.schema.json')).toBe(
      'edited'
    );
    expect(originOf(JSON.stringify(body), 'form.schema.json')).toBe('handwritten');
    // Свой `meta.description` документа место маркеру уступает, и хэш от этого не плывёт.
    const described = withMarker(
      JSON.stringify({ ...body, meta: { description: 'своё' } }),
      'form.schema.json'
    );
    expect(originOf(described, 'form.schema.json')).toBe('generated');
    expect(originOf('{ not json', 'form.schema.json')).toBe('handwritten');
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
        '// TODO(form_build): тело функции.',
        'export function saveDraft(..._args: unknown[]): void {}',
        '',
      ].join('\n');
      writeFileSync(formFile('operators.ts'), own);

      const rebuilt = await build();
      expect(rebuilt.isError).toBe(false);
      expect(readFileSync(formFile('operators.ts'), 'utf-8')).toBe(own);
      expect(rebuilt.text).not.toContain('Edited by hand');
      // Метка осталась в своём файле — напоминание о нём; отправка в api.ts — не заготовка.
      expect(rebuilt.text).toContain('Your operators are still stubs: operators.ts.');
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
  // Видимость и правила узлов на core — ошибка судьи (`not-on-target`): их пишут в JSX.
  const NODE_KINDS = ['onComponentEvent', 'renderEffect', 'onInit', 'onMount', 'onUnmount'];
  const coreIntent = {
    ...GRAMMAR_EXAMPLE,
    target: 'core',
    visibility: [],
    behavior: GRAMMAR_EXAMPLE.behavior.filter((b) => !NODE_KINDS.includes(b.kind)),
  };

  it(
    'видимость и правила узлов на core — отказ с образцом JSX, диск не меняется',
    async () => {
      writeIntent({ ...GRAMMAR_EXAMPLE, target: 'core' });
      const { text, isError } = await build();
      expect(isError).toBe(true);
      expect(text).toContain('not-on-target at `visibility`');
      expect(text).toContain('not-on-target at `behavior`');
      expect(text).toContain('<FormField control={bundle.form.propertyValue} />');
      expect(existsSync(formFile('model.ts'))).toBe(false);
    },
    SLOW
  );

  it(
    'собирает всё, кроме разметки, и не тянет рендерер',
    async () => {
      writeIntent(coreIntent);
      const { text, isError } = await build();
      expect(text).toContain('✓ form_build');
      expect(isError).toBe(false);
      expect(text).toContain('No markup yet');
      expect(readFileSync(formFile('form.behavior.ts'), 'utf-8')).not.toContain('onMount');
      // Заготовка разметки — с меткой сборки: нетронутую сборка обновляет и заменяет при смене таргета.
      const stub = readFileSync(formFile('index.tsx'), 'utf-8');
      expect(originOf(stub)).toBe('generated');
      // Образец отправки и шагов — вместо выдуманных bundle.form.submit() (ReFormer-qo9b.33).
      expect(stub).toContain('bundle.submission.submit(');
      expect(stub).toContain('useFormFlow(bundle.flow!)');
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
      expect(passed.text).not.toContain('No markup yet');
      expect(readFileSync(formFile('index.tsx'), 'utf-8')).toContain('bundle.form.price');

      writeFileSync(formFile('index.tsx'), withField('bundle.form.noSuchField'));
      const failed = await build();
      expect(failed.isError).toBe(true);
      expect(failed.text).toContain('noSuchField');
      // Разметка на core — файл агента: ошибку правят в нём, а не в intent.
      expect(failed.text).toContain('fix index.tsx — it is your file');

      // Пакет @reformer, которого нет, — окружение, а не ошибка формы (TS2307).
      writeFileSync(
        formFile('index.tsx'),
        `import { nothing } from '@reformer/no-such-package';\nvoid nothing;\n${stub}`
      );
      const missing = await build();
      expect(missing.isError).toBe(true);
      expect(missing.text).toContain('✗ form_build: the environment');
      expect(missing.text).toContain('@reformer/no-such-package do not resolve');
    },
    SLOW
  );
});

describe('form_build: index.tsx при смене таргета [B6]', () => {
  const NODE_KINDS = ['onComponentEvent', 'renderEffect', 'onInit', 'onMount', 'onUnmount'];
  const onCore = {
    ...GRAMMAR_EXAMPLE,
    target: 'core',
    visibility: [],
    behavior: GRAMMAR_EXAMPLE.behavior.filter((b) => !NODE_KINDS.includes(b.kind)),
  };

  it(
    'нетронутая заготовка core заменяется сборкой рендерера, и обратно',
    async () => {
      writeIntent(onCore);
      expect((await build()).isError).toBe(false);
      expect(readFileSync(formFile('index.tsx'), 'utf-8')).toContain('return null;');

      writeIntent({ ...onCore, target: 'renderer-react' });
      const react = await build();
      expect(react.isError, react.text).toBe(false);
      expect(readFileSync(formFile('index.tsx'), 'utf-8')).toContain('<FormRenderer');

      writeIntent(onCore);
      const back = await build();
      expect(back.isError, back.text).toBe(false);
      const stub = readFileSync(formFile('index.tsx'), 'utf-8');
      expect(stub).toContain('return null;');
      expect(stub).not.toContain('@reformer/renderer-react');
    },
    SLOW
  );

  it(
    'разметка, написанная для core, не остаётся молча при смене таргета',
    async () => {
      writeIntent(onCore);
      await build();
      const stub = readFileSync(formFile('index.tsx'), 'utf-8');
      writeFileSync(
        formFile('index.tsx'),
        `import { FormField } from '@reformer/ui-kit';\n${stub.replace(
          'return null;',
          'return <FormField control={bundle.form.price} />;'
        )}`
      );
      writeIntent({ ...onCore, target: 'renderer-react' });
      const { text, isError } = await build();
      expect(isError).toBe(true);
      expect(text).toContain('index.tsx is not a renderer-react assembly');
      expect(text).toContain(
        '- The target comes from form.intent.json: "target":"renderer-react". If the form is on ' +
          '@reformer/core with markup written by hand, set "target":"core" and build again.'
      );
      expect(readFileSync(formFile('index.tsx'), 'utf-8')).toContain('bundle.form.price');
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

  it('пакеты @reformer не резолвятся из проекта — ошибка окружения с их именами [B3]', async () => {
    noRoot();
    try {
      writeIntent(GRAMMAR_EXAMPLE);
      // Раньше сборка писала модуль с пометкой «типы не проверены»: в таком проекте он не соберётся.
      const missing = await build();
      expect(missing.isError).toBe(true);
      expect(missing.text).toContain('✗ form_build: the environment');
      expect(missing.text).toMatch(/@reformer\/core.* do not resolve from the form folder/);
      expect(existsSync(formFile('model.ts'))).toBe(false);

      // Ошибку самого intent судья находит и без компилятора: несуществующий валидатор — C12.
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

  it('без индексов пакетов — ошибка окружения, а не отказ собственному выводу [ReFormer-j356.9, B3]', async () => {
    noRoot();
    try {
      const blind = createKnowledge({
        docs: { has: () => false, read: () => null },
        index: { read: () => null },
        forms: createCliFormWorkspace(project),
      });
      writeIntent(GRAMMAR_EXAMPLE);
      const result = await formBuildTool({}, blind);
      const text = result.content[0].text;
      expect(result.isError, text).toBe(true);
      expect(text).toContain('✗ form_build: the environment');
      // Без индекса проверка импортов объявляла `createForm` несуществующим — этого больше нет.
      expect(text).not.toContain('RF002');
      expect(text).toContain('@reformer/core');
      expect(text).toContain('reformer://status');
      expect(existsSync(formFile('model.ts'))).toBe(false);
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
      expect(text).toContain('Fields 2');
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
    expect(text).toContain('not placed in layoutRoot');
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
    expect(text).toContain('declared a second time');
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
      expect(failed.text).toContain('type errors');
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
      expect(text).toContain('Types checked');
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
      expect(text).toContain('Types checked');
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
      expect(text).toContain('Types checked');
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
      expect(text).toContain('Types checked');
      expect(isError).toBe(false);
      expect(readFileSync(formFile('form.behavior.ts'), 'utf-8')).toContain(
        'enableWhen(model.$.residence, () => model.other);'
      );
    },
    SLOW
  );
});

describe('form_build: любой вход — диагностика, а не ошибка протокола', () => {
  it(
    'ни один вход не уходит исключением',
    async () => {
      for (const raw of HOSTILE_INTENTS) {
        writeIntent(raw);
        const { text } = await build();
        expect(text, JSON.stringify(raw)).toMatch(/form_build/);
        expect(text, JSON.stringify(raw)).not.toMatch(/internal build error/);
      }
    },
    SLOW
  );
});

/**
 * Строки ответа, которые разбирают стенды (`eval/calibration/lib/bundle.mjs` — `parseFormBuild`,
 * `eval/scenarios/catalog.mjs` — префикс `✓ form_build`). Формат описан в `docs/llms/02-tools.md`
 * § form_build; правка строки в `form-build.ts` без правки разборщика ломала бы замеры молча.
 */
describe('form_build: ответ — контракт стендов', () => {
  /** Каталог, где проверить типы нечем: строка «Types NOT checked» без запуска компилятора. */
  const withoutCompiler = (forms: FormWorkspace): FormWorkspace => ({
    open(dir) {
      const opened = forms.open(dir);
      if (!opened.ok) return opened;
      return {
        ok: true,
        directory: {
          label: opened.directory.label,
          read: (name) => opened.directory.read(name),
          write: (name, content) => opened.directory.write(name, content),
          remove: (name) => opened.directory.remove(name),
          list: () => opened.directory.list(),
          typecheck: async () => ({ status: 'unavailable', reason: 'no compiler in this test' }),
        },
      };
    },
  });

  it('отказ: заголовок, не больше MAX_ERRORS пунктов и хвост «… and N more.»', async () => {
    const extra = 2;
    writeIntent({
      formName: 'Много ошибок',
      fields: Array.from({ length: MAX_ERRORS + extra }, (_, at) => ({
        name: `f${at}`,
        type: 'string',
        bogus: true,
      })),
    });
    const { text, isError } = await build();
    expect(isError).toBe(true);
    const lines = text.split('\n');
    expect(lines[0]).toMatch(/^✗ form_build: .+ — nothing written\.$/);
    expect(lines.filter((line) => line.startsWith('- '))).toHaveLength(MAX_ERRORS);
    expect(lines.at(-1)).toBe(`… and ${extra} more.`);
    expect(parseFormBuild(text)).toMatchObject({ status: 'fail', typesChecked: false });
    expect(parseFormBuild(text).errors).toHaveLength(MAX_ERRORS);
    expectNothingWritten();
  });

  it('успех без проверки типов: «⚠️ Types NOT checked», «Warnings: N.» с потолком', async () => {
    knowledge = { ...knowledge, forms: withoutCompiler(knowledge.forms) };
    const extra = 1;
    writeIntent({
      formName: 'Много предупреждений',
      target: 'renderer-react',
      fields: [{ name: 'a', type: 'string', component: 'Input', label: 'A' }],
      layoutRoot: {
        kind: 'container',
        component: 'Box',
        children: [
          'a',
          // Чужой пропс у кнопки — предупреждение `component-props` на каждое место.
          ...Array.from({ length: MAX_WARNINGS + extra }, () => ({
            kind: 'container',
            component: 'Button',
            componentProps: { colour: 'red' },
          })),
        ],
      },
    });
    const { text, isError } = await build();
    expect(isError, text).toBe(false);
    const lines = text.split('\n');
    expect(lines[0]).toMatch(
      /^✓ form_build: written \d+, unchanged \d+\. Fields 1, arrays 0, rules \d+, behaviors \d+\.$/
    );
    expect(lines[1]).toBe(
      '⚠️ Types NOT checked: no compiler in this test. Only the imports were checked.'
    );
    const warningsAt = lines.findIndex((line) => /^Warnings: \d+\.$/.test(line));
    expect(lines[warningsAt]).toBe(`Warnings: ${MAX_WARNINGS + extra}.`);
    expect(lines.slice(warningsAt + 1).filter((line) => line.startsWith('- '))).toHaveLength(
      MAX_WARNINGS
    );
    expect(lines.at(-1)).toBe(`… and ${extra} more.`);
    const parsed = parseFormBuild(text);
    expect(parsed).toMatchObject({ status: 'ok', typesChecked: false, errors: [] });
    expect(parsed.warnings).toHaveLength(MAX_WARNINGS);
  });

  it(
    'успех с проверкой типов: строка «Types checked, no errors.» второй',
    async () => {
      writeIntent(GRAMMAR_EXAMPLE);
      const { text } = await build();
      expect(text.split('\n')[1]).toBe('Types checked, no errors.');
      expect(parseFormBuild(text)).toMatchObject({ status: 'ok', typesChecked: true, errors: [] });
    },
    SLOW
  );
});
