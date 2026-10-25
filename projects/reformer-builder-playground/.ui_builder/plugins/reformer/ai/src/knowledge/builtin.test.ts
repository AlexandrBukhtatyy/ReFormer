/**
 * Встроенная справка по требованию и выбор справки: когда грузится MCP и чья справка отвечает.
 *
 * Модуль встроенной справки подменён загрузчиком — тем же параметром, которым его подменяет
 * любой тест: проверяется порядок загрузки и выбора, а не MCP.
 *
 * @module plugins/reformer/ai/knowledge/builtin.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LibraryReferenceService } from '../reference';
import { chooseReference, createBuiltinReference } from './builtin';

/** Встроенная справка-двойник: подписывается своим именем — и в ответе, и в единственной находке. */
function fakeBuiltin(label = 'builtin'): Required<LibraryReferenceService> {
  return {
    ask: () => Promise.resolve({ text: label }),
    checkCode: () =>
      Promise.resolve({ findings: [{ code: label, severity: 'error', message: label }] }),
  };
}

const REQUEST = { maxChars: 100 };

describe('createBuiltinReference', () => {
  it('не грузит модуль, пока к справке не обратились', () => {
    const load = vi.fn(() => Promise.resolve({ createMcpReference: () => fakeBuiltin() }));
    createBuiltinReference(undefined, load);
    expect(load).not.toHaveBeenCalled();
  });

  it('параллельные обращения ждут одной загрузки', async () => {
    const createMcpReference = vi.fn(() => fakeBuiltin());
    const load = vi.fn(() => Promise.resolve({ createMcpReference }));
    const reference = createBuiltinReference(undefined, load);

    const [answer, checked] = await Promise.all([
      reference.ask('вопрос', REQUEST),
      reference.checkCode('x();', {}),
    ]);

    expect(answer).toEqual({ text: 'builtin' });
    expect(checked?.findings).toHaveLength(1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(createMcpReference).toHaveBeenCalledTimes(1);
  });

  it('отдаёт модулю чтение файлов проекта', async () => {
    const files = () => undefined;
    const createMcpReference = vi.fn(() => fakeBuiltin());
    const reference = createBuiltinReference(files, () => Promise.resolve({ createMcpReference }));
    await reference.ask('вопрос', REQUEST);
    expect(createMcpReference).toHaveBeenCalledWith(files);
  });

  it('сорвавшаяся загрузка не запоминается: следующее обращение грузит заново', async () => {
    const load = vi
      .fn<() => Promise<{ createMcpReference: () => Required<LibraryReferenceService> }>>()
      .mockRejectedValueOnce(new Error('сеть'))
      .mockResolvedValue({ createMcpReference: () => fakeBuiltin() });
    const reference = createBuiltinReference(undefined, load);

    await expect(reference.ask('вопрос', REQUEST)).rejects.toThrow('сеть');
    expect(await reference.ask('вопрос', REQUEST)).toEqual({ text: 'builtin' });
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('chooseReference', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('поставщика нет — встроенная', () => {
    const builtin = fakeBuiltin();
    expect(chooseReference(undefined, builtin)).toBe(builtin);
  });

  it('поставщик со справкой и проверкой — отвечает он', async () => {
    const provided: LibraryReferenceService = {
      ask: () => Promise.resolve({ text: 'provider' }),
      checkCode: () => Promise.resolve(null),
    };
    const reference = chooseReference(provided, fakeBuiltin());

    expect(await reference.ask('вопрос', REQUEST)).toEqual({ text: 'provider' });
    // `null` поставщика — осознанное «проверить нечем», встроенная его не перекрывает.
    expect(await reference.checkCode('x();', {})).toBeNull();
  });

  it('поставщик без проверки кода — проверяет встроенная', async () => {
    const provided: LibraryReferenceService = { ask: () => Promise.resolve({ text: 'provider' }) };
    const reference = chooseReference(provided, fakeBuiltin());

    expect(await reference.ask('вопрос', REQUEST)).toEqual({ text: 'provider' });
    expect((await reference.checkCode('x();', {}))?.findings[0]?.code).toBe('builtin');
  });

  it('методы поставщика зовутся с ним в роли `this`', async () => {
    class ClassReference implements LibraryReferenceService {
      private readonly label = 'class';
      ask() {
        return Promise.resolve({ text: this.label });
      }
      checkCode() {
        return Promise.resolve({
          findings: [{ code: this.label, severity: 'warning' as const, message: '' }],
        });
      }
    }
    const reference = chooseReference(new ClassReference(), fakeBuiltin());

    expect(await reference.ask('вопрос', REQUEST)).toEqual({ text: 'class' });
    expect((await reference.checkCode('x();', {}))?.findings[0]?.code).toBe('class');
  });

  it('поставщик не по форме контракта — встроенная и одно предупреждение', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stale = { question: () => Promise.resolve('старая копия контракта') };
    const builtin = fakeBuiltin();

    expect(chooseReference(stale, builtin)).toBe(builtin);
    expect(chooseReference(stale, builtin)).toBe(builtin);
    expect(chooseReference({ ask: () => null, checkCode: 'нет' }, builtin)).toBe(builtin);
    // Один и тот же негодный поставщик предупреждает один раз, а не на каждый вызов.
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
