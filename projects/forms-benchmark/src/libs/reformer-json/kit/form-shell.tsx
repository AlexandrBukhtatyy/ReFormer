/**
 * Элементы реестра renderer-json, общие для форм бенчмарка: `<form>` с отправкой через сборку и
 * кнопка «Очистить».
 *
 * Отправка — `bundle.submission.submit(handler)` по документации renderer-json
 * (packages/reformer-renderer-json/docs/llms/06-validation.md, 07-form-wizard.md): сборку компонент
 * берёт из контекста рендерера (`useFormBundleContext`), обработчик — страница через
 * `FormActionsContext` (JSON не выражает рантайм-функции). «Очистить» — `bundle.form.reset()`:
 * значения, ноды и тихая фаза `afterFirstSubmit` (packages/reformer/docs/llms/28-submit-and-reset.md);
 * подтверждение прежней отправки при этом скрывается.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useFormBundleContext } from '@reformer/core/react';
import { ResetButton, SubmitResult } from '../../../shared/ui/layout';

export interface FormActions {
  /** Обработчик отправки валидной формы; возвращает текст подтверждения. */
  submit(values: unknown): Promise<string>;
}

export const FormActionsContext = createContext<FormActions | null>(null);

/** «Очистить» формы, внутри которой стоит кнопка. */
const ResetContext = createContext<(() => void) | null>(null);

export function FormShell({ children }: { children?: ReactNode }) {
  const bundle = useFormBundleContext();
  const actions = useContext(FormActionsContext);
  if (!actions) throw new Error('FormActionsContext не задан');
  const [result, setResult] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bundle) return;
    const outcome = await bundle.submission.submit(actions.submit);
    if (outcome.status === 'submitted') setResult(outcome.result);
  };

  const reset = () => {
    bundle?.form.reset();
    setResult(null);
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <ResetContext.Provider value={reset}>{children}</ResetContext.Provider>
      {result ? <SubmitResult>{result}</SubmitResult> : null}
    </form>
  );
}

export function ResetAction({ children }: { children?: ReactNode }) {
  const reset = useContext(ResetContext);
  return <ResetButton onClick={() => reset?.()}>{children}</ResetButton>;
}
