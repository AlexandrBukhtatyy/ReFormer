/**
 * Прелюдия конструктора в настоящей песочнице QuickJS: цепочки записывают правки `form_edit`, у
 * каждой — `$via`; неизвестный метод — ошибка с подсказкой, скрипт идёт дальше; несохранённое
 * сохраняет эпилог, но не после ошибки скрипта.
 */

import { describe, expect, it } from 'vitest';
import { DSL_EPILOGUE, DSL_PRELUDE } from '../src/core/codemode/dsl/prelude';
import type { ScriptFunction } from '../src/core/codemode/run-script';
import { createQuickJsSandbox } from '../src/platform/cli/quickjs-sandbox';

type Rec = Record<string, unknown>;

/** Исполнить скрипт с прелюдией; `formEdit` и `formStatus` — подделки, которые пишут вызовы. */
async function run(code: string) {
  const calls: Array<{ fn: string; args: Rec }> = [];
  const fake =
    (fn: string): ScriptFunction =>
    async (args) => {
      calls.push({ fn, args: args as Rec });
      return `${fn} answered`;
    };
  const functions = {
    formStart: fake('formStart'),
    formEdit: fake('formEdit'),
    formStatus: fake('formStatus'),
    formBuild: fake('formBuild'),
  };
  const outcome = await createQuickJsSandbox().run(code, functions, {
    prelude: DSL_PRELUDE,
    epilogue: DSL_EPILOGUE,
  });
  const edits = calls
    .filter((call) => call.fn === 'formEdit')
    .flatMap((call) => call.args.edits as Rec[]);
  return { outcome, calls, edits };
}

const strip = (edits: Rec[]) =>
  edits.map((edit) => Object.fromEntries(Object.entries(edit).filter(([key]) => key !== '$via')));

describe('прелюдия конструктора', () => {
  it('цепочки → правки: группа проверок закрывается сообщением, when — на правила цепочки', async () => {
    const { outcome, edits, calls } = await run(`
      const f = reformer.form()
      f.add("login", "Логин").required().length(3, 20, "От 3 до 20").pattern(/^[a-z_]+$/i, "Латиница")
      f.add("age", "Возраст").type("number").min(18).toStep("Анкета")
      f.field("address").required().when(m => m.method === "courier")
      f.add("confirm", "Повтор").sameAs("password", "Не совпадают")
      f.field("captcha").asyncCheck(v => v === "ABC123", { delay: 300, message: "Нет" })
      f.field("company").showWhen(m => m.type === "company")
      f.field("total").readonly().compute(m => m.a - m.b)
      f.field("billing").copyFrom("delivery", m => m.same)
      f.array("items", "Товары", { min: 1, max: 5 }).column("price", "Цена").type("number").min(0)
      f.array("items").column("lineTotal").compute(r => r.price * r.qty)
      f.step("Контакты").fields("email", ["phone"])
      f.step("Старый").rename("Новый")
      f.field("login").rename("username", "Имя")
      f.field("old").remove()
      f.field("password").removeRule("pattern").digit()
      f.title("Регистрация").submit("Отправить", "sendForm").markup()
      f.edit({ op: "remove_behavior", target: "total" })
      console.log(await f.save())
    `);
    expect(outcome.error).toBeUndefined();
    expect(outcome.logs).toEqual(['formEdit answered']);
    expect(calls.filter((call) => call.fn === 'formEdit')).toHaveLength(1);
    expect(calls[0].args.dir).toBe('form');
    expect(strip(edits)).toEqual([
      { op: 'add_field', name: 'login', label: 'Логин' },
      {
        op: 'add_rule',
        field: 'login',
        required: true,
        minLength: 3,
        maxLength: 20,
        message: 'От 3 до 20',
      },
      { op: 'add_rule', field: 'login', pattern: '/^[a-z_]+$/i', message: 'Латиница' },
      { op: 'add_field', name: 'age', label: 'Возраст', type: 'number', step: 'Анкета' },
      { op: 'add_rule', field: 'age', min: 18 },
      {
        op: 'add_rule',
        field: 'address',
        required: true,
        when: { $lambda: 'm => m.method === "courier"', $scope: 'model' },
      },
      { op: 'add_field', name: 'confirm', label: 'Повтор' },
      { op: 'add_rule', field: 'confirm', equals: 'password', message: 'Не совпадают' },
      {
        op: 'add_rule',
        field: 'captcha',
        async: { $lambda: 'v => v === "ABC123"', $scope: 'value' },
        delay: 300,
        message: 'Нет',
      },
      {
        op: 'add_visibility',
        field: 'company',
        showWhen: { $lambda: 'm => m.type === "company"', $scope: 'model' },
      },
      { op: 'set_field', name: 'total', readonly: true },
      {
        op: 'add_behavior',
        kind: 'compute',
        target: 'total',
        expr: { $lambda: 'm => m.a - m.b', $scope: 'model' },
      },
      {
        op: 'add_behavior',
        kind: 'copyFrom',
        target: 'billing',
        expr: { $lambda: 'm => m.same', $scope: 'model' },
        sources: ['delivery'],
      },
      { op: 'add_array', name: 'items', label: 'Товары', minItems: 1, maxItems: 5 },
      { op: 'add_item_field', array: 'items', name: 'price', label: 'Цена', type: 'number' },
      { op: 'add_rule', field: 'price', array: 'items', min: 0 },
      {
        op: 'add_behavior',
        kind: 'compute',
        target: 'lineTotal',
        expr: { $lambda: 'r => r.price * r.qty', $scope: 'item' },
        array: 'items',
      },
      { op: 'add_step', title: 'Контакты', fields: ['email', 'phone'] },
      { op: 'rename_step', title: 'Старый', to: 'Новый' },
      { op: 'rename_field', name: 'login', to: 'username', label: 'Имя' },
      { op: 'remove_field', name: 'old' },
      { op: 'remove_rule', field: 'password', rule: 'pattern' },
      { op: 'add_rule', field: 'password', pattern: '\\d' },
      { op: 'set_form', formName: 'Регистрация' },
      { op: 'submit', label: 'Отправить', handler: 'sendForm' },
      { op: 'markup' },
      { op: 'remove_behavior', target: 'total' },
    ]);
    expect(edits[0].$via).toBe(
      'f.add("login", "Логин").required().length(3, 20, "От 3 до 20").pattern(/^[a-z_]+$/i, "Латиница")'
    );
    expect(edits[15].$via).toBe(
      'f.array("items", "Товары", {"min":1,"max":5}).column("price", "Цена").type("number").min(0)'
    );
  });

  it('чужое имя метода — свой метод; неизвестный — ошибка с подсказкой, цепочка идёт дальше', async () => {
    const { outcome, edits } = await run(`
      const f = reformer.form()
      f.add("name", "Имя").nonempty().regex(/^\\w+$/)
      f.add("city", "Город").requird().minLength(2)
      f.colum("x")
      await f.save()
    `);
    expect(outcome.error).toBeUndefined();
    expect(strip(edits)).toEqual([
      { op: 'add_field', name: 'name', label: 'Имя' },
      { op: 'add_rule', field: 'name', required: true, pattern: '/^\\w+$/' },
      { op: 'add_field', name: 'city', label: 'Город' },
      {
        $error: expect.stringMatching(/^no method \.requird on Field — did you mean \.required\?/),
      },
      { op: 'add_rule', field: 'city', minLength: 2 },
      { $error: expect.stringMatching(/^no method \.colum on Form/) },
    ]);
    expect(edits[3].$via).toBe('f.add("city", "Город").requird().minLength(2)');
  });

  it('await на конструкторе не ломает скрипт; status и confirm сначала сохраняют записанное', async () => {
    const { outcome, calls } = await run(`
      const f = await reformer.form()
      const field = await f.add("a", "A")
      field.required()
      console.log(await f.confirm("validation"))
    `);
    expect(outcome.error).toBeUndefined();
    expect(calls.map((call) => call.fn)).toEqual(['formEdit', 'formStatus']);
    expect(calls[1].args).toEqual({ dir: 'form', confirm: 'validation' });
    expect(outcome.logs).toEqual(['formEdit answered\n\nformStatus answered']);
  });

  it('несохранённое сохраняет эпилог; после ошибки скрипта — не сохраняет; дважды — не шлёт', async () => {
    const saved = await run('reformer.form().add("a", "A").required()');
    expect(saved.outcome.logs).toEqual([
      '(unsaved changes saved at the end of the script)',
      'formEdit answered',
    ]);
    expect(saved.edits).toHaveLength(2);

    const failed = await run('reformer.form().add("a", "A"); throw new Error("boom")');
    expect(failed.calls).toEqual([]);
    expect(failed.outcome.error).toMatch(/boom/);
    expect(failed.outcome.logs).toEqual([
      '(1 recorded change was not saved: the script failed before its end — fix it and run the whole script again)',
    ]);

    const once = await run('const f = reformer.form(); f.add("a", "A"); await f.save()');
    expect(once.calls).toHaveLength(1);
    expect(once.outcome.logs).toEqual([]);
  });

  it('asyncCheck позиционно — задержка и сообщение не теряются', async () => {
    const { edits } = await run(`
      const f = reformer.form()
      f.field("a").asyncCheck(v => v === "x", 300, "Нет")
      f.field("b").asyncCheck(v => v === "y", "Не то")
      await f.save()
    `);
    expect(strip(edits)).toEqual([
      {
        op: 'add_rule',
        field: 'a',
        async: { $lambda: 'v => v === "x"', $scope: 'value' },
        delay: 300,
        message: 'Нет',
      },
      {
        op: 'add_rule',
        field: 'b',
        async: { $lambda: 'v => v === "y"', $scope: 'value' },
        message: 'Не то',
      },
    ]);
  });

  it('массив: границы без подписи и проверки числа строк', async () => {
    const { edits } = await run(`
      const f = reformer.form()
      f.array("items", undefined, { min: 1, max: 10 })
      f.array("items").required("Добавьте товар").max(10, "Не больше 10")
      await f.save()
    `);
    expect(strip(edits)).toEqual([
      { op: 'add_array', name: 'items', minItems: 1, maxItems: 10 },
      { op: 'add_rule', field: 'items', minLength: 1, message: 'Добавьте товар' },
      { op: 'add_rule', field: 'items', maxLength: 10, message: 'Не больше 10' },
    ]);
  });

  it('стартовые строки и флажок «ровно у одной строки» [ReFormer-f2fs.36]', async () => {
    const { edits } = await run(`
      const f = reformer.form()
      const r = f.array("recipients", "Получатели", { min: 1 })
      r.column("email", "Email")
      r.column("primary", "Основной").type("boolean").initial(false).exclusive()
      r.startRows([{ primary: true }])
      f.array("contacts").column("main").exclusive({ first: false })
      f.field("email").exclusive()
      await f.save()
    `);
    expect(strip(edits)).toEqual([
      { op: 'add_array', name: 'recipients', label: 'Получатели', minItems: 1 },
      { op: 'add_item_field', array: 'recipients', name: 'email', label: 'Email' },
      {
        op: 'add_item_field',
        array: 'recipients',
        name: 'primary',
        label: 'Основной',
        type: 'boolean',
        initialValue: false,
      },
      { op: 'add_behavior', kind: 'exclusiveFlag', target: 'primary', array: 'recipients' },
      {
        op: 'add_behavior',
        kind: 'aggregateInto',
        target: 'recipients',
        array: 'recipients',
        expr: 'rows.length === 0 || rows.some((row) => row.primary) ? [] : [{ index: 0, patch: { primary: true } }]',
      },
      { op: 'add_array', name: 'recipients', startRows: [{ primary: true }] },
      // { first: false } — без отката на первую строку.
      { op: 'add_behavior', kind: 'exclusiveFlag', target: 'main', array: 'contacts' },
      // Не колонка строк — ошибка цепочки с подсказкой, скрипт идёт дальше.
      {
        $error:
          '.exclusive() is for a yes/no column of rows: f.array("recipients").column("primary").exclusive()',
      },
    ]);
  });

  it('предупреждение, дата в будущем, приведение, синхронизация, реакция на смену', async () => {
    const { edits } = await run(`
      const f = reformer.form()
      f.field("total").warning(v => v.total <= 100000, "Крупный заказ")
      f.field("deliveryDate").future("Не раньше завтра")
      f.field("promoCode").transform(v => (v ?? "").toUpperCase())
      f.field("receiptEmail").sync("email")
      f.field("paymentMethod").setOnChange("customerType", m => m.customerType === "person", "card")
      await f.save()
    `);
    expect(strip(edits)).toEqual([
      {
        op: 'add_rule',
        field: 'total',
        cross: { $lambda: 'v => v.total <= 100000', $scope: 'values' },
        warning: true,
        message: 'Крупный заказ',
      },
      { op: 'add_rule', field: 'deliveryDate', rule: 'futureDate()', message: 'Не раньше завтра' },
      {
        op: 'add_behavior',
        kind: 'transformValue',
        target: 'promoCode',
        expr: { $lambda: 'v => (v ?? "").toUpperCase()', $scope: 'value' },
      },
      { op: 'add_behavior', kind: 'syncFields', target: 'receiptEmail', sources: ['email'] },
      {
        op: 'add_behavior',
        kind: 'onChange',
        target: 'customerType',
        expr: {
          $lambda: 'm => m.customerType === "person"',
          $scope: 'model',
          $assign: { field: 'paymentMethod', value: 'card' },
        },
      },
    ]);
  });

  it('стрелка строкой — лямбда, а не готовое выражение', async () => {
    const { edits } = await run(`
      const f = reformer.form()
      const n = 9
      f.field("inn").check(\`v => Number(String(v.inn).charAt(\${n})) >= 0\`, "Контрольная сумма")
      f.field("a").showWhen("model.b === 1")
      await f.save()
    `);
    expect(strip(edits)).toEqual([
      {
        op: 'add_rule',
        field: 'inn',
        cross: { $lambda: 'v => Number(String(v.inn).charAt(9)) >= 0', $scope: 'values' },
        message: 'Контрольная сумма',
      },
      { op: 'add_visibility', field: 'a', showWhen: 'model.b === 1' },
    ]);
  });

  it('каталог формы — свой конструктор', async () => {
    const { calls } = await run(
      'const f = reformer.form({ dir: "forms/a" }); f.add("x", "X"); await f.save()'
    );
    expect(calls[0].args.dir).toBe('forms/a');
  });
});
