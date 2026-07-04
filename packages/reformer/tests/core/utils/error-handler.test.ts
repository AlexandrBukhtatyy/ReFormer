/**
 * Unit-тесты FormErrorHandler.
 *
 * Покрывают стратегии THROW/LOG/CONVERT, извлечение сообщения и DEV-логирование.
 * DEV-логирование теперь завязано на process.env.NODE_ENV (а не import.meta.env.DEV), поэтому
 * оно доживает до dev-сборок консумеров в опубликованном dist (F8).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { FormErrorHandler, ErrorStrategy } from '../../../src/core/utils/error-handler';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FormErrorHandler.handle', () => {
  it('THROW пробрасывает исходную ошибку', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('nope');
    expect(() => FormErrorHandler.handle(err, 'Ctx', ErrorStrategy.THROW)).toThrow(err);
  });

  it('THROW — стратегия по умолчанию', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => FormErrorHandler.handle(new Error('x'), 'Ctx')).toThrow('x');
  });

  it('LOG проглатывает ошибку и возвращает undefined', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = FormErrorHandler.handle(new Error('x'), 'Ctx', ErrorStrategy.LOG);
    expect(result).toBeUndefined();
  });

  it('CONVERT возвращает ValidationError с сообщением и полем', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = FormErrorHandler.handle(
      new Error('bad'),
      'EmailValidator',
      ErrorStrategy.CONVERT
    );
    expect(result).toEqual({
      code: 'validator_error',
      message: 'bad',
      params: { field: 'EmailValidator' },
    });
  });

  it('F8: логирует в non-production (NODE_ENV=test), с тегом контекста', () => {
    // vitest выставляет NODE_ENV='test' (!== 'production'), поэтому ветка лога активна и достижима —
    // именно то, что теперь доживёт до dev-сборки консумера в dist.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    FormErrorHandler.handle(new Error('boom'), 'MyCtx', ErrorStrategy.LOG);
    expect(errSpy).toHaveBeenCalledWith('[MyCtx]', expect.any(Error));
  });
});

describe('FormErrorHandler.extractMessage (через CONVERT)', () => {
  const msgOf = (error: unknown): string => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    return FormErrorHandler.handle(error, 'C', ErrorStrategy.CONVERT).message;
  };

  it('Error → error.message', () => {
    expect(msgOf(new Error('e-msg'))).toBe('e-msg');
  });
  it('string → как есть', () => {
    expect(msgOf('s-msg')).toBe('s-msg');
  });
  it('объект с message → message', () => {
    expect(msgOf({ message: 'o-msg' })).toBe('o-msg');
  });
  it('прочее → String(error)', () => {
    expect(msgOf(42)).toBe('42');
  });
});

describe('FormErrorHandler helpers', () => {
  it('createValidationError с полем и без', () => {
    expect(FormErrorHandler.createValidationError('required', 'msg', 'email')).toEqual({
      code: 'required',
      message: 'msg',
      params: { field: 'email' },
    });
    expect(FormErrorHandler.createValidationError('required', 'msg')).toEqual({
      code: 'required',
      message: 'msg',
      params: undefined,
    });
  });

  it('isValidationError — type guard', () => {
    expect(FormErrorHandler.isValidationError({ code: 'c', message: 'm' })).toBe(true);
    expect(FormErrorHandler.isValidationError({ code: 'c' })).toBe(false);
    expect(FormErrorHandler.isValidationError(null)).toBe(false);
    expect(FormErrorHandler.isValidationError('x')).toBe(false);
  });
});
