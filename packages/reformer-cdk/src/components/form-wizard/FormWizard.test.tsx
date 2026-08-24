/**
 * Unit-тесты FormWizard.
 *
 * defect #51: completedSteps не инвалидировался при возврате назад — устаревший список
 *   позволял прыгнуть вперёд через теперь-невалидный шаг. Проверяем чистую функцию
 *   pruneCompletedStepsOnBack, на которой построена инвалидация в goToPreviousStep/goToStep.
 * defect #49: у мастера не было объявления смены шага для скринридеров (только scrollTo).
 *   Проверяем, что FormWizard рендерит polite live-region со «Step N of M».
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FormProxy } from '@reformer/core';
import { FormWizard, pruneCompletedStepsOnBack } from './FormWizard';
import type { FormWizardActionsRenderProps } from './FormWizardActions';

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

describe('FormWizard — кнопка отправки гейтит через validateAll', () => {
  /**
   * Дефект: `submit.onClick` звал проп `onSubmit` напрямую, тогда как соседний `next.onClick`
   * гейтил переход через `validateCurrentStep`. В результате форма отправляла невалидные
   * данные — воспроизведено в браузере на форме с пустыми обязательными полями.
   *
   * Гейт (`config.validateAll` → `markAsTouched` → `null`) в FormWizard был, но `submit` не
   * лежал в контексте, поэтому кнопки до него не дотягивались.
   *
   * DOM-окружения в пакете нет (только `react-dom/server`), поэтому клик не имитируется:
   * render-props отдают `submit.onClick` функцией — её и вызываем. Compound-ветка
   * (`FormWizard.Submit`) берёт тот же `submit` из того же контекста.
   */
  function makeForm(submitSpy: ReturnType<typeof vi.fn>, touchedSpy: ReturnType<typeof vi.fn>) {
    return {
      submitting: { value: false },
      markAsTouched: touchedSpy,
      // Реальный GroupNode.submit зовёт колбэк с текущими значениями.
      submit: (cb: (values: Record<string, unknown>) => unknown) => cb({ field: 'value' }),
      ...{ __submitSpy: submitSpy },
    } as unknown as FormProxy<Record<string, unknown>>;
  }

  /** Рендерит мастер и возвращает render-props кнопок последнего шага. */
  function captureActions(
    validateAll: () => Promise<boolean>,
    onSubmit: () => void,
    form: FormProxy<Record<string, unknown>>
  ): FormWizardActionsRenderProps {
    let captured: FormWizardActionsRenderProps | null = null;

    renderToStaticMarkup(
      <FormWizard form={form} config={{ validateAll }}>
        <FormWizard.Step component={() => null} control={form} />
        <FormWizard.Actions onSubmit={onSubmit}>
          {(props) => {
            captured = props;
            return null;
          }}
        </FormWizard.Actions>
      </FormWizard>
    );

    if (!captured) throw new Error('Actions render-props не были вызваны');
    return captured;
  }

  it('при провале validateAll не зовёт onSubmit и помечает поля touched', async () => {
    const onSubmit = vi.fn();
    const touched = vi.fn();
    const validateAll = vi.fn(async () => false);

    const actions = captureActions(validateAll, onSubmit, makeForm(vi.fn(), touched));
    actions.submit.onClick();
    await Promise.resolve();
    await Promise.resolve();

    expect(validateAll).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(touched).toHaveBeenCalledTimes(1);
  });

  it('при успешной validateAll зовёт onSubmit ровно один раз', async () => {
    const onSubmit = vi.fn();
    const touched = vi.fn();
    const validateAll = vi.fn(async () => true);

    const actions = captureActions(validateAll, onSubmit, makeForm(vi.fn(), touched));
    actions.submit.onClick();
    await Promise.resolve();
    await Promise.resolve();

    expect(validateAll).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(touched).not.toHaveBeenCalled();
  });

  it('без config.validateAll отправляет без блокировки (обратная совместимость)', async () => {
    const onSubmit = vi.fn();
    const touched = vi.fn();
    let captured: FormWizardActionsRenderProps | null = null;
    const form = makeForm(vi.fn(), touched);

    renderToStaticMarkup(
      <FormWizard form={form} config={{}}>
        <FormWizard.Step component={() => null} control={form} />
        <FormWizard.Actions onSubmit={onSubmit}>
          {(props) => {
            captured = props;
            return null;
          }}
        </FormWizard.Actions>
      </FormWizard>
    );

    captured!.submit.onClick();
    await Promise.resolve();
    await Promise.resolve();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(touched).not.toHaveBeenCalled();
  });
});
