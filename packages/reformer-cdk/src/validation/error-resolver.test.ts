/**
 * Unit tests: резолвер сообщений валидации (i18n).
 */

import { describe, it, expect } from 'vitest';
import type { ValidationError } from '@reformer/core';
import { defaultErrorResolver, createMessageResolver } from './error-resolver';

const err = (e: Partial<ValidationError> & { code: string }): ValidationError => ({
  message: '',
  ...e,
});

describe('defaultErrorResolver', () => {
  it('отдаёт готовое сообщение', () => {
    expect(defaultErrorResolver(err({ code: 'required', message: 'Обязательно' }))).toBe(
      'Обязательно'
    );
  });

  it('fallback на код, если сообщения нет', () => {
    expect(defaultErrorResolver(err({ code: 'required', message: '' }))).toBe('required');
  });
});

describe('createMessageResolver', () => {
  const resolve = createMessageResolver({
    required: () => 'Обязательное поле',
    minLength: (p) => `Минимум ${p?.minLength} символов`,
  });

  it('берёт текст из таблицы по коду (приоритет над message)', () => {
    expect(resolve(err({ code: 'required', message: 'старое' }))).toBe('Обязательное поле');
  });

  it('подставляет params в шаблон', () => {
    expect(resolve(err({ code: 'minLength', message: '', params: { minLength: 3 } }))).toBe(
      'Минимум 3 символов'
    );
  });

  it('fallback на message, если кода нет в таблице', () => {
    expect(resolve(err({ code: 'pattern', message: 'Неверный формат' }))).toBe('Неверный формат');
  });

  it('fallback на код, если нет ни в таблице, ни message', () => {
    expect(resolve(err({ code: 'custom', message: '' }))).toBe('custom');
  });
});
