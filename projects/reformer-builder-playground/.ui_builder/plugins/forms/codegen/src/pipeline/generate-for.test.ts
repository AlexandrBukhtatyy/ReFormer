import { describe, expect, it } from 'vitest';
import type { CodegenRefusal, CodegenTarget, ResourceId } from '@reformer/builder-plugin-api';
import { generateFor, type GenerateWrite } from './generate-for';
import { createCodegenSessions } from './state';
import { createFakeDocument, createFakeHost, createFakeStack, stacksOf } from '../testing';

const DOC = 'src/forms/credit.schema.json' as ResourceId;

const TARGETS: readonly CodegenTarget[] = [
  { id: 't.types', path: 'types/credit.ts', cls: 'derived', template: '' },
  { id: 't.model', path: 'model/model.ts', cls: 'derived', template: '' },
];

function setup(open: CodegenRefusal | null | 'form' = 'form') {
  const document = createFakeDocument(DOC, '{}', 'credit.schema.json');
  const host = createFakeHost({ document, withSave: true });
  const store = createCodegenSessions().storeFor(DOC);
  const stack = createFakeStack({ root: 'src/forms/credit', formName: 'credit', open });
  const options = {
    host,
    stacks: stacksOf(stack),
    targets: TARGETS,
    store,
    translate: (key: string) => `«${key}»`,
  };
  return { host, store, options };
}

/** Хозяин с целью проекта, заменяющей встроенную, и стек, который запоминает заказы печати. */
function partial(stackId = 'fake') {
  const document = createFakeDocument(DOC, '{}', 'credit.schema.json');
  const host = createFakeHost({ document });
  const checked: (readonly string[] | undefined)[] = [];
  const stack = createFakeStack({
    id: stackId,
    root: 'src/forms/credit',
    formName: 'credit',
    onCheck: (delivered) => checked.push(delivered?.map((file) => file.path)),
  });
  const targets: readonly CodegenTarget[] = [
    ...TARGETS,
    {
      id: 't.validation',
      path: 'validation/form.ts',
      cls: 'user',
      regenerable: true,
      template: '',
    },
    {
      id: 'project.validation',
      overrides: 't.validation',
      origin: 'user',
      path: 'validation/form.ts',
      cls: 'user',
      regenerable: true,
      template: '',
    },
  ];
  const options = {
    host,
    stacks: stacksOf(stack),
    targets,
    store: createCodegenSessions().storeFor(DOC),
    translate: (key: string) => key,
  };
  return { host, stack, options, checked };
}

describe('генерация части модуля и вход стеку (1.1)', () => {
  it('only — пишутся только файлы этих целей; цель проекта считается той, что заменяет', async () => {
    const { host, options, checked } = partial();
    const report = await generateFor(options, DOC, { only: ['t.validation'] });

    expect(report.ok && report.written).toEqual(['validation/form.ts']);
    expect(host.written.has('src/forms/credit/types/credit.ts')).toBe(false);
    // Проверка перед записью — по тому, что пишется, а не по всему модулю.
    expect(checked).toEqual([['validation/form.ts']]);
  });

  it('без only проверка — по всему модулю', async () => {
    const { options, checked } = partial();
    await generateFor(options, DOC);
    expect(checked).toEqual([undefined]);
  });

  it('вход стеку доезжает до печати своего стека и не доезжает до чужого', async () => {
    const own = partial('reformer');
    await generateFor(own.options, DOC, { stackInput: { stack: 'reformer', value: { rules: 1 } } });
    expect(own.stack.printed[0]?.input).toEqual({ rules: 1 });

    const other = partial('rjsf');
    await generateFor(other.options, DOC, {
      stackInput: { stack: 'reformer', value: { rules: 1 } },
    });
    expect(other.stack.printed[0]?.input).toBeUndefined();
  });
});

describe('генерация по заказу', () => {
  it('пишет дверью заказчика и не сохраняет', async () => {
    const { host, options } = setup();
    const writes: string[] = [];
    const write: GenerateWrite = async (id, text) => {
      writes.push(id);
      host.written.set(id, text);
      return null;
    };

    const report = await generateFor(options, DOC, { write });

    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.dir).toBe('src/forms/credit');
    expect(report.formName).toBe('credit');
    expect(report.written).toContain('types/credit.ts');
    expect(writes).toContain('src/forms/credit/types/credit.ts');
    // Сохранить — решение человека: прогон по заказу оставляет рабочую копию.
    expect(host.saved).toEqual([]);
  });

  it('отказ записи — пропущенный файл с причиной, а не сбой', async () => {
    const { host, options } = setup();
    const write: GenerateWrite = async (id, text) => {
      if (id.endsWith('model/model.ts')) return 'The assistant keeps this file.';
      host.written.set(id, text);
      return null;
    };

    const report = await generateFor(options, DOC, { write });

    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.failed).toEqual([]);
    expect(report.skipped).toContainEqual({
      path: 'model/model.ts',
      reason: 'refused',
      message: 'The assistant keeps this file.',
    });
    expect(report.written).not.toContain('model/model.ts');
    expect(host.written.has('src/forms/credit/model/model.ts')).toBe(false);
  });

  it('без двери пишет в рабочую копию — и тоже не сохраняет', async () => {
    const { host, options } = setup();
    const report = await generateFor(options, DOC);
    expect(report.ok).toBe(true);
    expect(host.written.has('src/forms/credit/types/credit.ts')).toBe(true);
    expect(host.saved).toEqual([]);
  });

  it('отказ прогона — ключ словаря хозяина и текст', async () => {
    const { options } = setup(null);
    const report = await generateFor(options, DOC);
    expect(report).toEqual({
      ok: false,
      error: 'error.not-a-schema',
      message: '«error.not-a-schema»',
    });
  });

  it('отказ стека — его ключ и его слова, с подробностью', async () => {
    const { options } = setup({ refusal: { key: 'error.step-parts' }, detail: 'нет файла шага' });
    const report = await generateFor(options, DOC);
    expect(report).toEqual({
      ok: false,
      error: 'error.step-parts',
      message: 'error.step-parts нет файла шага',
    });
  });

  it('прогон виден панели: состояние документа обновлено', async () => {
    const { options, store } = setup();
    await generateFor(options, DOC);
    expect(store.get().delivery?.written).toContain('types/credit.ts');
  });
});
