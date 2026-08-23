/**
 * Сквозной тест: спека → intent → бандл → ЖИВАЯ форма.
 *
 * Зачем отдельно от `generate-form.test.ts`. Тот проверяет внутреннюю согласованность: что файлы
 * бандла ссылаются друг на друга без противоречий (`C1..C9`). Это необходимое условие, но не
 * достаточное — согласованный бандл может не работать. Здесь сгенерированный код ЗАПУСКАЕТСЯ,
 * и утверждения сформулированы в терминах спеки: «сумма меньше 50 000 не проходит», «при выборе
 * ипотеки поле стоимости включается».
 *
 * Почему это юнит-тест, а не e2e. Поведение формы ReFormer наблюдаемо headless: `createForm`
 * не требует схемы и отдаёт узлы с `disabled`/`errors`, `validateModel` возвращает boolean.
 * Идиома взята из ядра — `packages/reformer/tests/behaviors/scenarios.test.ts` и
 * `tests/core/validation/validate-model-schema.test.ts`.
 *
 * Песочница обязана лежать ВНУТРИ пакета: снаружи не резолвятся ни `@reformer/*`, ни
 * относительный `./model` из сгенерированных файлов. Приём и опции `tsc` — из
 * `projects/reformer-builder/src/templates/builtin-compiles.test.ts`.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildBundle } from '../src/core/generate/builders.js';
import { intentFromSpec } from '../src/core/generate/from-spec';
import { analyzeSpec, parseValidationCell } from '../src/core/spec/analyze';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/spec-loan-request.md');
const spec = readFileSync(FIXTURE, 'utf-8');
const analysis = analyzeSpec(spec);
const intent = intentFromSpec(spec, 'core');
const bundle = buildBundle(intent);

const field = (name: string) => analysis.fields.find((f) => f.name === name);
const rule = (target: string) => intent.validation.find((r) => r.target === target);

/**
 * `@reformer/core` — необязательный peer пакета; без него поведенческие кейсы пропускаются.
 *
 * Модули резолвятся динамически, поэтому их поверхность здесь намеренно нетипизирована:
 * тест смотрит на наблюдаемое поведение формы, а не на публичные типы ядра (те же соображения,
 * что и у структурного `Node` ниже). Идиома совпадает с соседними тестами пакета.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
let core: Record<string, any> | null = null;
let validation: Record<string, any> | null = null;
/* eslint-enable @typescript-eslint/no-explicit-any */
try {
  core = await import('@reformer/core');
  validation = await import('@reformer/core/validation');
} catch {
  core = null;
}
const hasCore = core !== null;

// Узлы формы типизированы структурно — ровно как в тестах ядра: тест смотрит на две
// наблюдаемые величины, а не на весь публичный тип узла.
type Node = {
  disabled: { value: boolean };
  errors: { value: Array<{ code?: string; message?: string }> };
};
const node = (n: unknown) => n as Node;

/** Дать эффектам ядра сработать: реактивные связи применяются не синхронно. */
const tick = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------

describe('спека → intent: читается то, что в спеке написано', () => {
  it('типы и компоненты взяты из колонки «Тип поля», а не угаданы по имени', () => {
    expect(field('loanAmount')).toMatchObject({ type: 'number', component: 'Input' });
    expect(field('hasCoBorrower')).toMatchObject({ type: 'boolean', component: 'Checkbox' });
    expect(field('comment')).toMatchObject({ type: 'string', component: 'Textarea' });
    // `carBrand` по имени угадался бы как строка и так, но `Input[number]` у `loanAmount`
    // именно эвристика по имени раньше и не давала.
    expect(field('loanType')).toMatchObject({ type: 'string', component: 'Select' });
  });

  it('начальные значения взяты из колонки «Значение»', () => {
    expect(field('loanType')!.initialValue).toBe('consumer');
    expect(field('hasCoBorrower')!.initialValue).toBe(false);
    expect(field('comment')!.initialValue).toBe('');
    // `null` значащий: «пустое число» в ReFormer — штатное состояние, а не отсутствие данных.
    expect(field('loanAmount')!.initialValue).toBeNull();
  });

  it('правила валидации разобраны в вызовы валидаторов', () => {
    expect(rule('loanAmount')!.rules).toEqual(['required()', 'min(50000)', 'max(10000000)']);
    expect(rule('firstName')!.rules).toEqual(['required()', 'minLength(2)', 'maxLength(50)']);
    expect(rule('email')!.rules).toEqual(['required()', 'email()']);
    expect(rule('loanType')!.rules).toEqual(['required()']);
    // Поле без правил не должно порождать пустое правило.
    expect(rule('comment')).toBeUndefined();
  });

  it('условное правило даёт и `when`, и `enableWhen` — это разные слои', () => {
    expect(rule('propertyValue')!.when).toBe("model.loanType === 'mortgage'");
    expect(intent.behavior).toContainEqual({
      kind: 'enableWhen',
      target: 'propertyValue',
      sources: ['loanType'],
      expr: "model.loanType === 'mortgage'",
    });
    expect(rule('carBrand')!.when).toBe("model.loanType === 'car'");
  });

  it('вычисляемое поле даёт warning, а не выдуманную формулу', () => {
    expect(intent.behavior.some((b) => b.target === 'monthlyPayment')).toBe(false);
    expect(intent.warnings.some((w) => w.includes('monthlyPayment') && w.includes('прозой'))).toBe(
      true
    );
  });

  it('нераспознанный фрагмент не теряется молча', () => {
    const parsed = parseValidationCell('Обязательное, min: 20% от стоимости');
    expect(parsed.rules).toEqual(['required()']);
    expect(parsed.unparsed).toEqual(['min: 20% от стоимости']);
    // Прочерк — это «правил нет», а не нераспознанное правило.
    expect(parseValidationCell('-')).toEqual({ rules: [], unparsed: [] });
  });
});

// ---------------------------------------------------------------------------

describe('бандл', () => {
  it('компилируется с реальными типами @reformer/*', async () => {
    const ts = (await import('typescript')).default;
    mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
    const dir = mkdtempSync(join(process.cwd(), '.tmp', 'form-from-spec-tsc-'));
    try {
      const entries: string[] = [];
      for (const f of bundle.files) {
        const target = join(dir, f.path);
        writeFileSync(target, f.content);
        if (f.path.endsWith('.ts')) entries.push(target);
      }
      const program = ts.createProgram(entries, {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        baseUrl: process.cwd(),
      });
      const diagnostics = program
        .getSemanticDiagnostics()
        .concat(program.getSyntacticDiagnostics())
        .map(
          (d) => `${d.file?.fileName ?? ''}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`
        );
      expect(diagnostics).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

// ---------------------------------------------------------------------------

describe.runIf(hasCore)('сгенерированная форма работает', () => {
  let sandbox = '';
  let initialFormModel: Record<string, unknown>;
  let formValidation: unknown;
  let formBehavior: unknown;

  beforeAll(async () => {
    mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
    // Уникальный каталог на прогон: vite кэширует модули по пути, а тест импортирует
    // файлы, которых до прогона не существовало.
    sandbox = mkdtempSync(join(process.cwd(), '.tmp', 'form-from-spec-run-'));
    for (const f of bundle.files) writeFileSync(join(sandbox, f.path), f.content);

    const url = (p: string) => pathToFileURL(join(sandbox, p)).href;
    initialFormModel = (await import(/* @vite-ignore */ url('model.ts'))).initialFormModel;
    formValidation = (await import(/* @vite-ignore */ url('validation.ts'))).formValidation;
    formBehavior = (await import(/* @vite-ignore */ url('form.behavior.ts'))).formBehavior;
  });

  afterAll(() => {
    if (sandbox) rmSync(sandbox, { recursive: true, force: true });
  });

  /** Свежая форма на каждый кейс: поведение реактивно, состояние между кейсами не общее. */
  function makeForm() {
    const model = core!.createModel({ ...initialFormModel });
    const form = core!.createForm({ model, behavior: formBehavior });
    return { model, form };
  }

  const check = (model: unknown) =>
    validation!.validateModel(model, formValidation) as Promise<boolean>;

  /** Минимально валидное заполнение — база, от которой кейсы отклоняются в одну сторону. */
  function fill(model: Record<string, unknown>) {
    model.loanAmount = 100000;
    model.firstName = 'Иван';
    model.email = 'ivan@example.com';
  }

  it('начальные значения модели совпадают со спекой', () => {
    const { model } = makeForm();
    expect(model.loanType).toBe('consumer');
    expect(model.loanAmount).toBeNull();
    expect(model.hasCoBorrower).toBe(false);
  });

  it('пустые обязательные поля не проходят, заполненные — проходят', async () => {
    const { model } = makeForm();
    expect(await check(model)).toBe(false);
    fill(model);
    expect(await check(model)).toBe(true);
  });

  it('границы числового правила работают с обеих сторон', async () => {
    const { model } = makeForm();
    fill(model);
    model.loanAmount = 49999;
    expect(await check(model)).toBe(false);
    model.loanAmount = 50000;
    expect(await check(model)).toBe(true);
    model.loanAmount = 10000001;
    expect(await check(model)).toBe(false);
  });

  it('границы строковых правил и email работают', async () => {
    const { model } = makeForm();
    fill(model);
    model.firstName = 'И';
    expect(await check(model)).toBe(false);
    model.firstName = 'Ин';
    expect(await check(model)).toBe(true);
    model.email = 'без-собаки';
    expect(await check(model)).toBe(false);
  });

  it('ошибки маршрутизируются в узлы и очищаются', async () => {
    const { model, form } = makeForm();
    fill(model);
    model.loanAmount = 100;
    expect(await check(model)).toBe(false);
    expect(node(form.loanAmount).errors.value.some((e) => e.code === 'min')).toBe(true);

    model.loanAmount = 100000;
    expect(await check(model)).toBe(true);
    expect(node(form.loanAmount).errors.value).toEqual([]);
  });

  it('условное ПРАВИЛО активно только при своём типе кредита', async () => {
    const { model } = makeForm();
    fill(model);
    // consumer: propertyValue пуст, но правило выключено — форма валидна.
    expect(model.propertyValue).toBeNull();
    expect(await check(model)).toBe(true);

    model.loanType = 'mortgage';
    model.propertyValue = 500000;
    expect(await check(model)).toBe(false);
    model.propertyValue = 5000000;
    expect(await check(model)).toBe(true);
  });

  it('условное ПОЛЕ включается и выключается реактивно', async () => {
    // `enableWhen` применяется на флаше эффектов, а не синхронно при `createForm`, поэтому
    // между изменением модели и проверкой нужен `tick` — та же идиома, что в тестах ядра
    // (`packages/reformer/tests/behaviors/scenarios.test.ts:130`).
    const { model, form } = makeForm();
    await tick();
    expect(node(form.propertyValue).disabled.value).toBe(true);
    expect(node(form.carBrand).disabled.value).toBe(true);

    model.loanType = 'mortgage';
    await tick();
    expect(node(form.propertyValue).disabled.value).toBe(false);
    expect(node(form.carBrand).disabled.value).toBe(true);

    model.loanType = 'car';
    await tick();
    expect(node(form.propertyValue).disabled.value).toBe(true);
    expect(node(form.carBrand).disabled.value).toBe(false);
  });
});
