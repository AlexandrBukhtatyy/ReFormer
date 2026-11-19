/**
 * Профиль `code-guided-dsl` сквозь каталог инструментов: настоящая песочница QuickJS, настоящая
 * сборка с проверкой типов. Конструктор в `execute` → правки `form_edit` → форма; `search` читает
 * данные формы и ничего не меняет.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as ts from 'typescript';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EXECUTE_TOOL } from '../src/core/codemode/dsl/declaration';
import { SEARCH_TOOL } from '../src/core/codemode/dsl/search';
import type { Knowledge } from '../src/core/knowledge';
import { createToolCatalog } from '../src/core/server/tool-catalog';
import { createCliFormWorkspace, TYPECHECK_ROOT_ENV } from '../src/platform/cli/form-workspace';
import { cliKnowledge } from '../src/platform/cli/knowledge';
import { createQuickJsSandbox } from '../src/platform/cli/quickjs-sandbox';

const repoRoot = resolve(__dirname, '../../..');
const SLOW = 180_000;

const text = (result: { content: Array<{ type: string; text?: string }> }): string =>
  result.content.map((block) => (block.type === 'text' ? (block.text ?? '') : '')).join('\n');

describe('профиль code-guided-dsl', () => {
  let project: string;
  const previousRoot = process.env[TYPECHECK_ROOT_ENV];
  beforeAll(() => {
    process.env[TYPECHECK_ROOT_ENV] = repoRoot;
  });
  afterAll(() => {
    if (previousRoot === undefined) delete process.env[TYPECHECK_ROOT_ENV];
    else process.env[TYPECHECK_ROOT_ENV] = previousRoot;
  });
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'code-guided-dsl-'));
    writeFileSync(
      join(project, 'package.json'),
      JSON.stringify({ name: 'consumer', dependencies: { '@reformer/core': '*' } })
    );
  });
  afterEach(() => rmSync(project, { recursive: true, force: true }));

  const catalog = () => {
    const knowledge: Knowledge = { ...cliKnowledge(), forms: createCliFormWorkspace(project) };
    return createToolCatalog(() => knowledge, {
      profile: 'node',
      guided: true,
      codeMode: createQuickJsSandbox(),
      dsl: { typescript: ts },
    });
  };
  const intent = () => JSON.parse(readFileSync(join(project, 'form', 'form.intent.json'), 'utf8'));

  it('два инструмента: search и execute', () => {
    expect(
      catalog()
        .list()
        .map((tool) => tool.name)
    ).toEqual([SEARCH_TOOL, EXECUTE_TOOL]);
  });

  it('execute без кода — образец формы без напоминания «Run that code» [ReFormer-f2fs.35]', async () => {
    // qwen3.5:4b читал напоминание как «вызови execute ещё раз»: после одного пустого вызова
    // повторял его в 7 пробах из 10, после трёх — в 10 из 10; без напоминания — в 0 из 10.
    for (const args of [{}, { code: '' }]) {
      const result = await catalog().call(EXECUTE_TOOL, args);
      const answer = text(result);
      expect(result.isError).toBe(true);
      expect(answer).toMatch(/pass the script text in "code", e\.g\. \{"code": /);
      expect(answer).toMatch(/reformer\.formStart\(/);
      expect(answer).not.toMatch(/Run that code with execute/);
    }
  });

  it(
    'formStart → Next кодом конструктора → цепочки → сборка; лямбда становится выражением над model',
    async () => {
      const tools = catalog();
      const started = text(
        await tools.call(EXECUTE_TOOL, {
          code: 'console.log(await reformer.formStart({ dir: "form", target: "renderer-react", task: "Анкета: тип клиента (customerType: person или company), компания (company) — видна только компании, пароль (password) — обязателен, минимум 10 символов и хотя бы одна цифра" }))',
        })
      );
      expect(started).toMatch(/const f = reformer\.form\(\)/);
      expect(started).toMatch(/console\.log\(await f\.save\(\)\)/);
      expect(started).toMatch(/Run that code with execute/);

      const built = text(
        await tools.call(EXECUTE_TOOL, {
          code: `const f = reformer.form()
f.add("customerType", "Тип клиента").options([{ value: "person", label: "Физлицо" }, { value: "company", label: "Компания" }])
f.add("company", "Компания").showWhen(m => m.customerType === "company")
f.add("password", "Пароль").required().min(10).digit("Нужна цифра")
console.log(await f.save())`,
        })
      );
      expect(built).toMatch(/- ✓ f\.add\("customerType", "Тип клиента"\)\.options\(/);
      expect(built).toMatch(
        /- ✓ f\.add\("company", "Компания"\)\.showWhen\(m => m\.customerType === "company"\)/
      );
      expect(built).toMatch(/^✓ form_build/m);
      const form = intent();
      expect(form.visibility).toEqual([
        { selector: 'company', condition: '!(model.customerType === "company")' },
      ]);
      expect(
        form.validation
          .filter((row: { target: string }) => row.target === 'password')
          .flatMap((row: { rules: string[] }) => row.rules)
      ).toEqual([
        "required({ code: 'password.required' })",
        "minLength(10, { code: 'password.minLength' })",
        "pattern(/\\d/, { code: 'password.pattern' })",
      ]);
    },
    SLOW
  );

  it(
    'забытый save сохраняется в конце; ошибка лямбды и неизвестный метод не теряют другие правки',
    async () => {
      const tools = catalog();
      await tools.call(EXECUTE_TOOL, {
        code: 'await reformer.formStart({ dir: "form", target: "renderer-react", task: "Форма: имя (name), город (city)" })',
      });
      const saved = text(
        await tools.call(EXECUTE_TOOL, {
          code: `const f = reformer.form()
f.add("name", "Имя").required().regex(/^[А-Яа-я ]+$/)
f.add("city", "Город").showWhen(m => m.name = "x")
f.add("zip", "Индекс").nonsense(1)`,
        })
      );
      expect(saved).toMatch(/unsaved changes saved at the end of the script/);
      // `.regex` — частое имя чужих библиотек: читается как `.pattern`, цепочка показывает это.
      expect(saved).toMatch(/- ✓ f\.add\("name", "Имя"\)\.required\(\)\.pattern\(/);
      expect(saved).toMatch(
        /- ✗ f\.add\("city", "Город"\)\.showWhen\(m => m\.name = "x"\): showWhen: an assignment \(=\) — compare with ===/
      );
      expect(saved).toMatch(
        /- ✗ f\.add\("zip", "Индекс"\)\.nonsense\(1\): no method \.nonsense on Field/
      );
      const names = intent().fields.map((field: { name: string }) => field.name);
      expect(names).toEqual(expect.arrayContaining(['name', 'city', 'zip']));
    },
    SLOW
  );

  it(
    'колонка готового массива меняется цепочкой .column(): set_field с array',
    async () => {
      const tools = catalog();
      await tools.call(EXECUTE_TOOL, {
        code: `await reformer.formStart({ dir: "form", target: "renderer-react", task: "Заказ: товары (items) — строки с названием (title) и ценой (price), от 1 строки" })
const f = reformer.form()
f.array("items", "Товары", { min: 1 }).column("title", "Название").required()
f.array("items").column("price", "Цена")
await f.save()`,
      });
      const changed = text(
        await tools.call(EXECUTE_TOOL, {
          code: `const f = reformer.form()
f.array("items").column("price").type("number").min(0)
console.log(await f.save())`,
        })
      );
      expect(changed).toMatch(
        /- ✓ f\.array\("items"\)\.column\("price"\)\.type\("number"\)\.min\(0\): row field `items\.price` changed/
      );
      const price = intent().arrays[0].itemFields.find(
        (item: { name: string }) => item.name === 'price'
      );
      expect(price.type).toBe('number');
    },
    SLOW
  );

  it(
    'основной получатель: .exclusive() и .startRows() собираются в модуль [ReFormer-f2fs.36]',
    async () => {
      const tools = catalog();
      await tools.call(EXECUTE_TOOL, {
        code: `await reformer.formStart({ dir: "form", target: "renderer-react", task: "Уведомления: получатели (recipients) — строки с email (email) и отметкой «основной» (primary); основной ровно один, в стартовой строке — основной" })`,
      });
      const built = text(
        await tools.call(EXECUTE_TOOL, {
          code: `const f = reformer.form()
const r = f.array("recipients", "Получатели", { min: 1 })
r.column("email", "Email").required()
r.column("primary", "Основной").type("boolean").initial(false).exclusive()
r.startRows([{ primary: true }])
console.log(await f.save())`,
        })
      );
      expect(built).toMatch(/- ✓ .*\.exclusive\(\): exclusiveFlag on `recipients\.primary`/);
      expect(built).toMatch(/- ✓ .*\.exclusive\(\): aggregateInto on `recipients`/);
      expect(built).toMatch(
        /- ✓ f\.array\("recipients".*\.startRows\(\[\{"primary":true\}\]\): array `recipients` changed: start rows/
      );
      expect(built).toMatch(/^✓ form_build/m);
      const form = intent();
      expect(form.arrays[0].initialValue).toEqual([{ email: '', primary: true }]);
      expect(
        form.behavior.map((row: { kind: string; target: string }) => `${row.kind} ${row.target}`)
      ).toEqual(['exclusiveFlag recipients.primary', 'aggregateInto recipients']);
      const model = readFileSync(join(project, 'form', 'model.ts'), 'utf8');
      expect(model).toMatch(/arrayOf\(blank\w+, \[\{"email":"","primary":true\}\]\)/);
    },
    SLOW
  );

  it(
    'search читает форму, задание и API и ничего не меняет',
    async () => {
      const tools = catalog();
      const before = text(await tools.call(SEARCH_TOOL, { code: 'return form' }));
      expect(before).toMatch(/no plan yet/);
      await tools.call(EXECUTE_TOOL, {
        code: `await reformer.formStart({ dir: "form", target: "renderer-react", task: "Форма: email (email) — обязателен" })
const f = reformer.form()
f.add("email", "Email").required().email()
await f.save()`,
      });
      const fields = text(
        await tools.call(SEARCH_TOOL, {
          code: 'async () => form.fields.map(f => f.name + ": " + f.rules.join(", "))',
        })
      );
      expect(fields).toMatch(/email: required\(\)/);
      expect(fields).toMatch(/search only reads/);
      const api = text(
        await tools.call(SEARCH_TOOL, {
          code: 'return api.filter(m => m.name === "digit").map(m => m.signature)',
        })
      );
      expect(api).toMatch(/digit\(message\?: string\): Field/);
      const task = text(await tools.call(SEARCH_TOOL, { code: 'return task.text' }));
      expect(task).toMatch(/обязателен/);
      const frozen = text(
        await tools.call(SEARCH_TOOL, {
          code: 'form.fields.push({ name: "x" }); return form.fields.length',
        })
      );
      expect(frozen).toMatch(/search error/);
      expect(intent().fields).toHaveLength(1);
      const long = text(await tools.call(SEARCH_TOOL, { code: 'return "x".repeat(5000)' }));
      expect(long).toMatch(/cut at 4000 characters — return only what you need/);
      const stages = text(
        await tools.call(SEARCH_TOOL, {
          code: 'async () => { console.log(plan.mode); return plan.stages.map(s => s.id) }',
        })
      );
      expect(stages).toMatch(/create/);
      expect(stages).toMatch(/fields/);
    },
    SLOW
  );
});
