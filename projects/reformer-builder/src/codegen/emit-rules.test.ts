/**
 * Правила формы → компилируемый TypeScript.
 *
 * Проверки на вхождение подстрок не отличают валидный код от мусора: `validate(model.$.x, [])`
 * и `validate(model.$.x, [)` одинаково «содержат validate». Поэтому здесь, как и во встроенных
 * шаблонах, результат прогоняется настоящим `tsc` с настоящими типами `@reformer/*`.
 *
 * Что именно ловится этим тестом и не ловится ничем другим: правила приходят от агента, а он
 * ошибается в именах валидаторов и в форме выражений. Сгенерированный из такого правила файл
 * выглядит правдоподобно и ломается только у пользователя, при сборке его проекта.
 */

import { describe, expect, it } from 'vitest';
import { makeNames } from './naming';
import { emitFormBehaviorFromRules, emitValidationFromRules } from './emit-rules';
import { emitFormBehavior } from './emit-form-behavior';
import { emitValidation } from './emit-validation';
import type { Collected } from './collect';
import { emptyRules, type FormRules } from '../model/rules';

const names = makeNames('Заявка на кредит');

/** Правила, покрывающие обе ветки: валидацию с условием и вычисляемое поле. */
function rules(): FormRules {
  return {
    validation: [
      { target: 'applicant.email', rules: ['required', 'email'] },
      {
        target: 'loanAmount',
        rules: ['required', 'min(50000)'],
        when: 'model.loanType === "consumer"',
      },
    ],
    behavior: [
      {
        kind: 'computeFrom',
        target: 'total',
        sources: ['price', 'quantity'],
        expr: '(price ?? 0) * (quantity ?? 0)',
      },
      { kind: 'enableWhen', target: 'city', sources: ['country'], expr: 'model.country !== null' },
    ],
    render: [],
  };
}

/** Модель-заглушка: эмиттеры импортируют тип из `./types`, и он должен существовать. */
function typesTs(): string {
  return `export interface ${names.TypeName} {
  applicant: { email: string };
  loanType: string;
  loanAmount: number | null;
  price: number | null;
  quantity: number | null;
  total: number | null;
  country: string | null;
  city: string | null;
  qty: number | null;
  shippingAddress: string;
  billingAddress: string;
  sameAddress: boolean;
}
`;
}

async function compile(files: Record<string, string>): Promise<string[]> {
  const { mkdtempSync, writeFileSync, rmSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const ts = (await import('typescript')).default;

  // Песочница ВНУТРИ репозитория: снаружи @reformer/* не резолвятся и tsc сыплет ложными
  // ошибками вместо настоящих (тот же приём, что в builtin-compiles.test.ts).
  mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
  const dir = mkdtempSync(join(process.cwd(), '.tmp', 'emit-rules-'));
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
    const program = ts.createProgram(
      Object.keys(files).map((n) => join(dir, n)),
      {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        baseUrl: process.cwd(),
      }
    );
    const sandbox = dir.replace(/\\/g, '/');
    return ts
      .getPreEmitDiagnostics(program)
      .filter((d) => d.file?.fileName.replace(/\\/g, '/').startsWith(sandbox))
      .map(
        (d) =>
          `${d.file?.fileName.replace(/\\/g, '/').slice(sandbox.length + 1)} TS${d.code}: ` +
          ts.flattenDiagnosticMessageText(d.messageText, ' ')
      );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('эмиссия из правил', () => {
  it('валидация и поведение компилируются с реальными типами @reformer/*', async () => {
    const errors = await compile({
      'types.ts': typesTs(),
      'validation.ts': emitValidationFromRules(rules(), names),
      'form.behavior.ts': emitFormBehaviorFromRules(rules(), names),
    });
    expect(errors).toEqual([]);
  }, 60_000);

  it('импорт типа переписан на раскладку билдера', () => {
    // MCP кладёт тип в `model.ts`, билдер — в `types.ts`. Несостыковка адаптируется здесь, и
    // без этой проверки она всплыла бы только при сборке проекта пользователя.
    const code = emitValidationFromRules(rules(), names);
    expect(code).toContain(`from './types'`);
    expect(code).not.toContain(`from './model'`);
  });

  it('правила попадают в код, а не теряются по дороге', () => {
    const validation = emitValidationFromRules(rules(), names);
    expect(validation).toContain('applicant.email');
    // Условное правило обязано прийти через validateWhen, иначе оно применится всегда.
    expect(validation).toContain('validateWhen');

    const behavior = emitFormBehaviorFromRules(rules(), names);
    expect(behavior).toContain('computeFrom');
    expect(behavior).toContain('enableWhen');
  });

  it('пример в заглушке компилируется, если его раскомментировать', async () => {
    // Закомментированный код не проверяется ничем и гниёт молча: прежний пример дожил до сих
    // пор с четырьмя ошибками сразу. А переписывает его пользователь — он копирует ровно эти
    // строки. Поэтому блок вырезается по границам, раскомментируется и идёт в настоящий tsc.
    const stub = emitFormBehavior(names);
    const lines = stub.split('\n');
    const from = lines.findIndex((l) => l.includes('ПРИМЕР'));
    const to = lines.findIndex((l) => l.includes('конец примера'));
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);

    const example = lines
      .slice(from + 1, to)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n');
    // Раскомментировали именно код, а не прозу: без объявления проверять было бы нечего.
    expect(example).toContain('defineFormBehavior');

    // Дальше воспроизводится ровно то, что сделает пользователь по инструкции в заглушке:
    // объявление и импорт операторов заменяются блоком примера, всё остальное — включая
    // `import type … from './types'` — остаётся на месте.
    const patched = lines
      .slice(0, from)
      .filter(
        (l) =>
          !l.startsWith('import { defineFormBehavior }') &&
          !l.startsWith('export const formBehavior')
      )
      .concat(example)
      .join('\n');

    const errors = await compile({ 'types.ts': typesTs(), 'form.behavior.ts': patched });
    expect(errors).toEqual([]);
  }, 60_000);

  it('заглушка без правки пользователя компилируется как есть', async () => {
    const errors = await compile({
      'types.ts': typesTs(),
      'form.behavior.ts': emitFormBehavior(names),
    });
    expect(errors).toEqual([]);
  }, 60_000);

  it('заглушка validation.ts компилируется в обеих своих ветках', async () => {
    // Оба user-owned файла уезжают в проект пользователя, и оба до сих пор проверялись только
    // на вхождение подстрок. У этого эмиттера ветки расходятся по импортам: с required-полями
    // он тянет `validate`/`required`, без них — нет. Ошибка в любой ветке всплыла бы у
    // пользователя, а не здесь.
    const collected = (paths: string[]) =>
      ({
        root: { t: 'obj', fields: {} },
        components: [],
        ds: {},
        requiredPaths: paths,
        arrayPaths: [],
      }) as unknown as Collected;

    const withRequired = await compile({
      'types.ts': typesTs(),
      'validation.ts': emitValidation(collected(['loanAmount']), names),
    });
    expect(withRequired).toEqual([]);

    const without = await compile({
      'types.ts': typesTs(),
      'validation.ts': emitValidation(collected([]), names),
    });
    expect(without).toEqual([]);
  }, 60_000);

  it('пустые правила тоже дают компилируемый файл', async () => {
    const errors = await compile({
      'types.ts': typesTs(),
      'validation.ts': emitValidationFromRules(emptyRules(), names),
      'form.behavior.ts': emitFormBehaviorFromRules(emptyRules(), names),
    });
    expect(errors).toEqual([]);
  }, 60_000);
});
