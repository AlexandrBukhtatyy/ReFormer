/**
 * Сигнал поля `shouldShowIssues` — «есть что показать».
 *
 * `shouldShowError` отвечает за состояние ошибки (`aria-invalid`, рамка) и истинен только у
 * невалидного поля. Предупреждение (`severity: 'warning'`) поле невалидным не делает, поэтому показ
 * текстов замечаний по `shouldShowError` прятал предупреждение без ошибки рядом. Тексты показывают
 * по `shouldShowIssues`: условия раскрытия те же (поле трогали или меняли, оно не выключено,
 * проверка не идёт), но в счёт идёт любое замечание [ReFormer-dp34].
 */

import { describe, expect, it } from 'vitest';
import { effect, signal } from '@preact/signals-core';
import { FormControlNode } from '../../../src/form/nodes/form-control-node';
import type { ValidationIssue } from '../../../src/form/types/index';

const REQUIRED: ValidationIssue = { code: 'required' };
const WEAK: ValidationIssue = { code: 'password.weak', severity: 'warning' };

const createField = (value = ''): FormControlNode<string> =>
  new FormControlNode({ valueSignal: signal(value), component: undefined });

/** Что поле показывает: состояние ошибки и тексты замечаний. */
const shown = (field: FormControlNode<string>): { error: boolean; issues: boolean } => ({
  error: field.shouldShowError.value,
  issues: field.shouldShowIssues.value,
});

describe('FormControlNode — shouldShowIssues', () => {
  it('без замечаний показывать нечего — и у тронутого поля', () => {
    const field = createField();
    field.markAsTouched();

    expect(shown(field)).toEqual({ error: false, issues: false });
  });

  it('ошибка у нетронутого поля не показывается, у тронутого — показывается', () => {
    const field = createField();
    field.setIssues([REQUIRED]);
    const untouched = shown(field);

    field.markAsTouched();

    expect({ untouched, touched: shown(field) }).toEqual({
      untouched: { error: false, issues: false },
      touched: { error: true, issues: true },
    });
  });

  it('одно предупреждение: текст показывается, а состояния ошибки нет — поле валидно', () => {
    const field = createField();
    field.markAsTouched();

    field.setIssues([WEAK]);

    // Было: единственный сигнал показа — `shouldShowError` — оставался false, и предупреждение
    // без ошибки рядом пользователь не видел.
    expect({ ...shown(field), valid: field.valid.value }).toEqual({
      error: false,
      issues: true,
      valid: true,
    });
  });

  it('предупреждение рядом с ошибкой: показываются оба, поле невалидно', () => {
    const field = createField();
    field.markAsTouched();

    field.setIssues([WEAK, REQUIRED]);

    expect({ ...shown(field), codes: field.issues.value.map((issue) => issue.code) }).toEqual({
      error: true,
      issues: true,
      codes: ['password.weak', 'required'],
    });
  });

  it('поле меняли, но из него не уходили — замечания уже показываются', () => {
    const field = createField();
    field.setIssues([WEAK]);

    field.setValue('123');

    expect({ touched: field.touched.value, ...shown(field) }).toEqual({
      touched: false,
      error: false,
      issues: true,
    });
  });

  it('пока идёт проверка, замечания прошлого прогона не показываются', () => {
    const field = createField();
    field.markAsTouched();
    field.setIssues([WEAK]);

    field.setPending(true);
    const whilePending = shown(field);
    field.setPending(false);

    expect({ whilePending, after: shown(field) }).toEqual({
      whilePending: { error: false, issues: false },
      after: { error: false, issues: true },
    });
  });

  it('выключенное поле замечаний не показывает — и поставленных после выключения', () => {
    const field = createField();
    field.markAsTouched();
    field.disable();

    field.setIssues([WEAK]);
    const whileDisabled = shown(field);
    field.enable();

    expect({ whileDisabled, enabled: shown(field) }).toEqual({
      whileDisabled: { error: false, issues: false },
      enabled: { error: false, issues: true },
    });
  });

  it.each<[name: string, hide: (field: FormControlNode<string>) => void]>([
    ['clearIssues', (field) => field.clearIssues()],
    ['пустой список замечаний от следующего прогона', (field) => field.setIssues([])],
    ['reset', (field) => field.reset()],
    ['markAsUntouched', (field) => field.markAsUntouched()],
  ])('%s — показывать больше нечего', (_name, hide) => {
    const field = createField();
    field.markAsTouched();
    field.setIssues([WEAK]);

    hide(field);

    expect(shown(field)).toEqual({ error: false, issues: false });
  });

  it('сигнал реактивен: подписчик видит появление и снятие предупреждения', () => {
    const field = createField();
    const seen: boolean[] = [];
    const stop = effect(() => void seen.push(field.shouldShowIssues.value));

    field.markAsTouched();
    field.setIssues([WEAK]);
    field.setIssues([]);
    stop();

    expect(seen).toEqual([false, true, false]);
  });
});
