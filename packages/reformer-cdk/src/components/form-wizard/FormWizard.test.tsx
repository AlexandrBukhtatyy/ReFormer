/**
 * Unit-тесты FormWizard.
 *
 * defect #51: completedSteps не инвалидировался при возврате назад — устаревший список
 *   позволял прыгнуть вперёд через теперь-невалидный шаг. Проверяем чистую функцию
 *   pruneCompletedStepsOnBack, на которой построена инвалидация в goToPreviousStep/goToStep.
 * defect #49: у мастера не было объявления смены шага для скринридеров (только scrollTo).
 *   Проверяем, что FormWizard рендерит polite live-region со «Step N of M».
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FormProxy } from '@reformer/core';
import { FormWizard, pruneCompletedStepsOnBack } from './FormWizard';

describe('pruneCompletedStepsOnBack (#51)', () => {
  it('оставляет только шаги строго меньше того, к которому вернулись', () => {
    // 1→2→3 даёт completedSteps=[1,2]; возврат на шаг 2 инвалидирует 2 и далее.
    expect(pruneCompletedStepsOnBack([1, 2], 2)).toEqual([1]);
  });

  it('возврат на первый шаг очищает завершённость полностью', () => {
    expect(pruneCompletedStepsOnBack([1, 2, 3], 1)).toEqual([]);
  });

  it('идемпотентен и не трогает уже валидный префикс', () => {
    expect(pruneCompletedStepsOnBack([1, 2, 3, 4], 3)).toEqual([1, 2]);
  });

  it('пустой вход остаётся пустым', () => {
    expect(pruneCompletedStepsOnBack([], 2)).toEqual([]);
  });
});

describe('FormWizard — live-region объявления шага (#49)', () => {
  // Минимальный мок формы: FormWizard читает form.submitting.value при рендере.
  const mockForm = { submitting: { value: false } } as unknown as FormProxy<
    Record<string, unknown>
  >;

  it('рендерит polite live-region с «Step 1 of 2»', () => {
    const html = renderToStaticMarkup(
      <FormWizard form={mockForm} config={{}}>
        <FormWizard.Step component={() => null} control={mockForm} />
        <FormWizard.Step component={() => null} control={mockForm} />
      </FormWizard>
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Step 1 of 2');
  });
});
