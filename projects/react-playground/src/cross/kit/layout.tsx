/**
 * Страница, форма и кнопки кита кросс-фреймворк проверки: своя разметка с кнопками
 * `@reformer/ui-kit` и testid DOM-контракта (`btn-submit`, `btn-reset`, `submit-result`).
 *
 * Заголовок страницы один — `<h1>`: сценарии снимают фокус с поля кликом по заголовку.
 */
import { useContext, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { useFormBundleContext } from '@reformer/core/react';
import { Button } from '@reformer/ui-kit';
import { FormActionsContext, ResetContext } from './form-actions';

export function Page({ title, children }: { title: string; children?: ReactNode }): ReactNode {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

/**
 * `<form>` с отправкой через сборку: `submission.submit(handler)` проверяет форму и зовёт
 * обработчик страницы. «Очистить» — `form.reset()`: значения, ноды и тихая фаза живой проверки;
 * подтверждение прежней отправки при этом скрывается.
 */
export function Form({ children }: { children?: ReactNode }): ReactNode {
  const bundle = useFormBundleContext();
  const actions = useContext(FormActionsContext);
  if (!actions) throw new Error('FormActionsContext не задан');
  const [result, setResult] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
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
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <ResetContext.Provider value={reset}>{children}</ResetContext.Provider>
      {result ? (
        <p role="status" data-testid="submit-result" className="text-sm font-medium">
          {result}
        </p>
      ) : null}
    </form>
  );
}

export function Actions({ children }: { children?: ReactNode }): ReactNode {
  return <div className="flex gap-2">{children}</div>;
}

type ButtonProps = ComponentProps<typeof Button>;

export function SubmitButton({ children = 'Отправить', ...rest }: ButtonProps): ReactNode {
  return (
    <Button type="submit" data-testid="btn-submit" {...rest}>
      {children}
    </Button>
  );
}

export function ResetButton({ children = 'Очистить', ...rest }: ButtonProps): ReactNode {
  const reset = useContext(ResetContext);
  return (
    <Button
      type="button"
      variant="outline"
      data-testid="btn-reset"
      onClick={() => reset?.()}
      {...rest}
    >
      {children}
    </Button>
  );
}
