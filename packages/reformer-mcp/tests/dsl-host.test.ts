/**
 * Хост конструктора и его объявление.
 *
 * - `dslFormEdit`: строки ✓/✗ ответа `form_edit` подписываются цепочками, ошибки конструктора встают
 *   на свои места; чужой формат ответа не ломается.
 * - `executeDeclaration`: скрипт со всеми методами проходит проверку типов, выдуманный метод — нет.
 * - Покрытие: каждая операция `form_edit` достижима методом конструктора.
 */

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { executeDeclaration } from '../src/core/codemode/dsl/declaration';
import { asBody, dslFormEdit } from '../src/core/codemode/dsl/host';
import { BUILDER_METHODS } from '../src/core/codemode/dsl/methods';
import { keepsWhole } from '../eval/agents/ollama.mjs';
import { EDIT_OPS } from '../src/core/guided/edit-spec';

type Rec = Record<string, unknown>;

/** Поддельный `form_edit`: пишет отправленные правки и отвечает заданным текстом. */
function fakeCall(answer: (edits: Rec[]) => string) {
  const sent: Rec[][] = [];
  const call = async (_name: string, args: Rec) => {
    const edits = args.edits as Rec[];
    sent.push(edits);
    return { content: [{ type: 'text' as const, text: answer(edits) }] };
  };
  return { call, sent };
}

const textOf = (result: { content: Array<{ type: string; text?: string }> }) =>
  result.content.map((block) => block.text ?? '').join('\n');

describe('dslFormEdit', () => {
  it('строки исходов — против цепочек; ошибка конструктора и лямбды — на своём месте', async () => {
    const { call, sent } = fakeCall(() =>
      [
        'form_edit: 1 of 2 edits applied.',
        '- ✓ add_field: phone',
        '- ✗ edit 2 add_rule: "options" is not a rule key — use set_field',
        '✓ form_build — 6 files',
        'Next: …',
      ].join('\n')
    );
    const result = await dslFormEdit(
      {
        dir: 'form',
        edits: [
          { op: 'add_field', name: 'phone', label: 'Телефон', $via: 'f.add("phone", "Телефон")' },
          {
            $error: 'no method .colum on Rows — did you mean .column?',
            $via: 'f.array("a").colum("x")',
          },
          {
            op: 'add_rule',
            field: 'phone',
            options: ['a'],
            $via: 'f.field("phone").options(["a"])',
          },
          {
            op: 'add_visibility',
            field: 'x',
            showWhen: { $lambda: 'm => m.a = 1', $scope: 'model' },
            $via: 'f.field("x").showWhen(m => m.a = 1)',
          },
        ],
      },
      call,
      ts
    );
    // На сервер ушли только правки без ошибок и без служебных ключей.
    expect(sent).toEqual([
      [
        { op: 'add_field', name: 'phone', label: 'Телефон' },
        { op: 'add_rule', field: 'phone', options: ['a'] },
      ],
    ]);
    expect(textOf(result).split('\n')).toEqual([
      'form_edit: 1 of 4 edits applied.',
      '- ✓ f.add("phone", "Телефон"): phone',
      '- ✗ f.array("a").colum("x"): no method .colum on Rows — did you mean .column?',
      '- ✗ f.field("phone").options(["a"]): "options" is not a rule key — use set_field',
      expect.stringMatching(
        /^- ✗ f\.field\("x"\)\.showWhen\(m => m\.a = 1\): showWhen: an assignment \(=\) — compare with ===/
      ),
      '✓ form_build — 6 files',
      'Next: …',
    ]);
  });

  it('лямбда становится выражением своей области', async () => {
    const { call, sent } = fakeCall(
      () => 'form_edit: 2 of 2 edits applied.\n- ✓ add_rule: a\n- ✓ add_behavior: b'
    );
    await dslFormEdit(
      {
        edits: [
          { op: 'add_rule', field: 'a', cross: { $lambda: 'x => x.a > x.b', $scope: 'values' } },
          {
            op: 'add_behavior',
            kind: 'compute',
            target: 'b',
            array: 'rows',
            expr: { $lambda: 'row => row.p * row.q', $scope: 'item' },
          },
        ],
      },
      call,
      ts
    );
    expect(sent[0]).toEqual([
      { op: 'add_rule', field: 'a', cross: 'values.a > values.b' },
      { op: 'add_behavior', kind: 'compute', target: 'b', array: 'rows', expr: 'item.p * item.q' },
    ]);
  });

  it('setOnChange: условие-лямбда становится телом реакции onChange', async () => {
    const { call, sent } = fakeCall(() => 'form_edit: 1 of 1 edits applied.\n- ✓ add_behavior: x');
    await dslFormEdit(
      {
        edits: [
          {
            op: 'add_behavior',
            kind: 'onChange',
            target: 'customerType',
            expr: {
              $lambda: 'm => m.customerType === "person" && m.paymentMethod === "invoice"',
              $scope: 'model',
              $assign: { field: 'paymentMethod', value: 'card' },
            },
          },
        ],
      },
      call,
      ts
    );
    expect(sent[0][0].expr).toBe(
      'if (model.customerType === "person" && model.paymentMethod === "invoice") model.paymentMethod = "card";'
    );
  });

  it('число строк не совпало — ошибки перед ответом, ответ сервера как есть', async () => {
    const server = 'form_edit: refused — no plan\nNext: form_start {…}';
    const { call } = fakeCall(() => server);
    const result = await dslFormEdit(
      {
        edits: [
          { op: 'add_field', name: 'a', label: 'A', $via: 'f.add("a", "A")' },
          { $error: 'no method .x on Field', $via: 'f.field("a").x()' },
        ],
      },
      call,
      ts
    );
    expect(textOf(result)).toBe(`- ✗ f.field("a").x(): no method .x on Field\n${server}`);
  });

  it('всё с ошибками — на сервер ничего не уходит', async () => {
    const { call, sent } = fakeCall(() => 'never');
    const result = await dslFormEdit(
      { edits: [{ $error: 'no method .x on Field', $via: 'f.field("a").x()' }] },
      call,
      ts
    );
    expect(sent).toEqual([]);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(
      /^form_edit: 0 of 1 edits applied\.\n- ✗ f\.field\("a"\)\.x\(\)/
    );
    expect(textOf(result)).toMatch(/Nothing was sent/);
  });

  it('правки без $via — вызов как есть', async () => {
    const { call, sent } = fakeCall(() => 'form_edit: 1 of 1 edits applied.\n- ✓ markup: done');
    const result = await dslFormEdit({ dir: 'form', edits: [{ op: 'markup' }] }, call, ts);
    expect(sent).toEqual([[{ op: 'markup' }]]);
    expect(textOf(result)).toBe('form_edit: 1 of 1 edits applied.\n- ✓ markup: done');
  });
});

describe('asBody', () => {
  it('async-стрелка и функция-выражение — вызываются; тело функции — как есть', () => {
    expect(asBody('async () => { return 1 }')).toBe('return await (async () => { return 1 })();');
    expect(asBody('async function () { return 1 };')).toBe(
      'return await (async function () { return 1 })();'
    );
    expect(asBody('() => form.fields')).toBe('return await (() => form.fields)();');
    expect(asBody('return form.fields')).toBe('return form.fields');
  });
});

describe('объявление execute', () => {
  const declaration = executeDeclaration();

  function typeErrors(script: string): string[] {
    const files = new Map([
      ['reformer.d.ts', declaration],
      [
        'script.ts',
        `export {};\nasync function main(): Promise<void> {\n${script}\n}\nvoid main;\n`,
      ],
    ]);
    const options: ts.CompilerOptions = {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
      types: [],
    };
    const host = ts.createCompilerHost(options);
    const read = host.getSourceFile.bind(host);
    host.getSourceFile = (name, language, ...rest) =>
      files.has(name)
        ? ts.createSourceFile(name, files.get(name)!, language)
        : read(name, language, ...rest);
    host.fileExists = (name) => files.has(name) || ts.sys.fileExists(name);
    host.readFile = (name) => files.get(name) ?? ts.sys.readFile(name);
    const program = ts.createProgram([...files.keys()], options, host);
    return ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));
  }

  it('скрипт со всеми методами проходит проверку типов', () => {
    const script = `
      console.log(await reformer.formStart({ dir: "form", target: "renderer-react", task: "t" }));
      const f = reformer.form();
      const g = reformer.form({ dir: "forms/b" });
      f.add("login", "Логин").label("Login").type("string").placeholder("p").initial("x")
        .component("Textarea").toStep("1").required("m").optional().email().min(1).max(2)
        .minLength(1, "m").maxLength(2).length(3, 20, "m").pattern(/^a$/i, "m").pattern("\\\\d")
        .digit().rule("integer()").sameAs("b", "m").check(v => v.a > v.b, "m")
        .asyncCheck(v => v === "a", { delay: 300, message: "m" }).when(m => m.a === 1)
        .showWhen(m => m.a).hideWhen("model.b").enableWhen(m => m.c, { resetOnDisable: true })
        .disableWhen(m => !m.c).resetWhen(m => m.d).compute(m => m.x * 2).copyFrom("y", m => m.same)
        .options(["a", 1, { value: "b", label: "B" }]).mask("+7 (999) 999-99-99").readonly()
        .rename("username", "Имя").remove().removeRule("pattern").removeBehavior("compute");
      f.field("x").removeRule();
      f.array("items", "Товары", { min: 1, max: 5, step: "2" }).column("price", "Цена").type("number");
      f.array("items").column("total").compute(r => r.price * r.qty);
      f.step("Контакты").fields("email", "phone").rename("Связь").remove();
      f.title("T").submit("Отправить", "send").markup().edit({ op: "markup" });
      console.log(await f.save(), await f.status(), await g.build());
      console.log(await f.confirm("validation"), await f.confirm("edit"));
      console.log(await f.skip("behavior"), await f.addStage("arrays"));
    `;
    expect(typeErrors(script)).toEqual([]);
  });

  it('выдуманный метод и неверный тип — ошибки типов', () => {
    const errors = typeErrors(`
      reformer.form().add("a", "A").regex(/x/);
      reformer.form().add("a", "A").type("text");
      reformer.form().confirm("fields");
    `).join('\n');
    expect(errors).toMatch(/Property 'regex' does not exist on type 'Field'/);
    expect(errors).toMatch(/'"text"' is not assignable/);
    expect(errors).toMatch(/'"fields"' is not assignable/);
  });

  it('каждая операция form_edit достижима методом конструктора', () => {
    const reachable = new Set(BUILDER_METHODS.flatMap((method) => method.ops ?? []));
    expect(EDIT_OPS.filter((op) => !reachable.has(op))).toEqual([]);
  });
});

describe('стенд Ollama: execute со сборкой держится целиком, search — нет', () => {
  it('конструктор и formStart — как ответ сборки', () => {
    expect(keepsWhole('execute', { code: 'console.log(await reformer.formStart({}))' })).toBe(true);
    expect(keepsWhole('execute', { code: 'const f = reformer.form()\nf.add("a", "A")' })).toBe(
      true
    );
    expect(keepsWhole('execute', { code: 'console.log(await f.confirm("validation"))' })).toBe(
      true
    );
    expect(keepsWhole('search', { code: 'return form.fields' })).toBe(false);
  });
});
