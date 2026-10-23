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
