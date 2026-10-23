/**
 * Прогон хозяина на двойнике стека: выбор стека, цели стека, отказы, состояние.
 *
 * @module plugins/reformer/codegen/pipeline/run.test
 */

import { describe, expect, it } from 'vitest';
import type { CodegenTarget, ResourceId } from '@reformer/builder-plugin-api';
import { runCodegen } from './run';
import { createCodegenSessions } from './state';
import {
  createFakeDocument,
  createFakeHost,
  createFakeStack,
  stacksOf,
  type FakeStackOptions,
} from '../testing';

const DOC = 'src/forms/demo/form.schema.json' as ResourceId;

const target = (id: string, path: string, over: Partial<CodegenTarget> = {}): CodegenTarget => ({
  id,
  path,
  cls: 'derived',
  template: '',
  ...over,
});

function setup(stackOptions: FakeStackOptions = {}, resourceKind = 'form.schema') {
  const document = createFakeDocument(DOC, '{}', 'form.schema.json', resourceKind);
  const host = createFakeHost({ document });
  const stack = createFakeStack(stackOptions);
  const store = createCodegenSessions().storeFor(DOC);
  const run = (targets: readonly CodegenTarget[] = [target('t.a', 'a.ts')], formName?: string) =>
    runCodegen({
      host,
      stacks: stacksOf(stack),
      targets,
      documentId: DOC,
      store,
      ...(formName === undefined ? {} : { formName }),
    });
  return { host, stack, store, run };
}

describe('прогон через стек', () => {
  it('стек документа печатает, хозяин пишет в корень, который назвал стек', async () => {
    const { host, stack, store, run } = setup({ root: 'src/forms/demo' });
    await run();

    expect(store.get().error).toBeNull();
    expect(store.get().stack).toBe('fake');
    expect(store.get().rootPath).toBe('src/forms/demo');
    expect(host.written.has('src/forms/demo/a.ts')).toBe(true);
    // Читает стек рабочую область хозяина — один ответ на «что лежит на диске».
    expect(stack.readers).toEqual([host]);
  });

  it('стеку уходят его цели и общие — не чужие и не заменённые', async () => {
    const { stack, run } = setup();
    await run([
      target('fake.a', 'a.ts', { stack: 'fake' }),
      target('other.b', 'b.ts', { stack: 'other' }),
      target('any.c', 'c.ts'),
      target('user.a', 'a.ts', { overrides: 'fake.a' }),
    ]);
    expect(stack.printed[0].targets.map((t) => t.id)).toEqual(['any.c', 'user.a']);
  });

  it('устаревшую замену стек снимает своим крючком — печатается заменяемая', async () => {
    const { stack, run } = setup({ staleOverride: (t) => (t.id === 'user.a' ? 'устарела' : null) });
    await run([
      target('fake.a', 'a.ts', { stack: 'fake' }),
      target('user.a', 'a.ts', { overrides: 'fake.a' }),
    ]);
    expect(stack.printed[0].targets.map((t) => t.id)).toEqual(['fake.a']);
  });

  it('имя формы по умолчанию — от стека, введённое — сильнее', async () => {
    const first = setup({ formName: 'demo' });
    await first.run();
    expect(first.stack.printed[0].formName).toBe('demo');
    expect(first.store.get().formName).toBe('demo');

    const second = setup({ formName: 'demo' });
    await second.run(undefined, '  Заявка  ');
    expect(second.stack.printed[0].formName).toBe('Заявка');
  });

  it('документ, который не печатает ни один стек, — «не схема формы»', async () => {
    const { stack, store, run } = setup({}, 'text/typescript');
    await run();
    expect(store.get().error).toEqual({ key: 'error.not-a-schema' });
    expect(stack.readers).toEqual([]);
  });

  it('стек не узнал своей формы — тоже «не схема формы»', async () => {
    const { store, run } = setup({ open: null });
    await run();
    expect(store.get().error).toEqual({ key: 'error.not-a-schema' });
  });

  it('отказ стека — его ключом, с подстановками и подробностью', async () => {
    const { host, store, run } = setup({
      open: { refusal: { key: 'error.step-parts', params: { n: 2 } }, detail: 'нет файла' },
    });
    await run();
    expect(store.get().error).toEqual({
      key: 'error.step-parts',
      params: { n: 2 },
      detail: 'нет файла',
      stack: 'fake',
    });
    expect(host.written.size).toBe(0);
  });

  it('отказ стека перед записью — его ключом, отчёт о печати остаётся', async () => {
    const { host, store, run } = setup({ check: { refusal: { key: 'error.kit-mismatch' } } });
    await run();
    expect(store.get().error).toEqual({ key: 'error.kit-mismatch', stack: 'fake' });
    expect(store.get().files.map((file) => file.path)).toEqual(['a.ts']);
    expect(store.get().delivery).toBeNull();
    expect(host.written.size).toBe(0);
  });

  it('заметки стека доезжают до отчёта записи', async () => {
    const note = {
      id: 'flat',
      paths: ['index.tsx'],
      title: { key: 'flat.title' },
      detail: { key: 'flat.detail' },
      notify: { key: 'notify.flat' },
    };
    const { store, run } = setup({ notes: [note] });
    await run();
    expect(store.get().delivery?.notes).toEqual([note]);
  });

  it('источник без записи — отказ хозяина, а не исключение', async () => {
    const document = createFakeDocument(DOC, '{}');
    const host = createFakeHost({ document, write: false });
    const store = createCodegenSessions().storeFor(DOC);
    await runCodegen({
      host,
      stacks: stacksOf(createFakeStack()),
      targets: [target('t.a', 'a.ts')],
      documentId: DOC,
      store,
    });
    expect(store.get().error).toEqual({ key: 'error.read-only' });
  });

  it('документ закрыли — отказ хозяина', async () => {
    const host = createFakeHost({ document: null });
    const store = createCodegenSessions().storeFor(DOC);
    await runCodegen({ host, stacks: stacksOf(), targets: [], documentId: DOC, store });
    expect(store.get().error).toEqual({ key: 'error.no-document' });
  });
});
