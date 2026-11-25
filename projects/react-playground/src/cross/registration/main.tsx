/**
 * Страница кросс-фреймворк проверки: форма регистрации на React и `@reformer/ui-kit`.
 *
 * Документ формы, правила и API — общие с Vue- и Angular-страницами
 * (forms-benchmark/src/cross/registration.ts); здесь — реестр кита ui-kit (../registry.ts), рендерер
 * React и оболочка страницы: заголовок, `<form>`, «Зарегистрироваться», «Очистить» и
 * подтверждение отправки. Страница идёт мимо `main.tsx` приложения: без роутера и без моков сети —
 * «сервер» формы живёт в памяти страницы. `window.__bench` публикует общий харнесс (готовность
 * первого экрана, покой, вызовы API, отправленные данные) — по нему e2e ведёт три стека одним
 * сценарием.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { useFormBundle } from '@reformer/core/react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormRenderer } from '@reformer/renderer-react';
import { Button } from '@reformer/ui-kit';
import { installBench } from '../../../../forms-benchmark/src/cross/page';
import {
  createRegistrationForm,
  loadRegistrationInitial,
  registrationMessages,
  submitRegistration,
  type RegistrationValues,
} from '../../../../forms-benchmark/src/cross/registration';
import { registrationRegistry } from '../registry';
import '../styles.css';
import '../cross.css';

/**
 * Форма с оболочкой. Отправка — `submission.submit(handler)`: проверяет форму и зовёт обработчик.
 * «Очистить» — `form.reset()`: значения, ноды и тихая фаза живой проверки; подтверждение прежней
 * отправки при этом скрывается.
 */
function RegistrationForm({ initial }: { initial: RegistrationValues }): ReactNode {
  const bundle = useFormBundle(() => createRegistrationForm(registrationRegistry, initial));
  const [result, setResult] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await bundle.submission.submit(submitRegistration);
    if (outcome.status === 'submitted') setResult(outcome.result);
  };

  const reset = () => {
    bundle.form.reset();
    setResult(null);
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <FormRenderer<RegistrationValues> form={bundle} />
      <div className="flex gap-2">
        <Button type="submit" data-testid="btn-submit">
          Зарегистрироваться
        </Button>
        <Button type="button" variant="outline" data-testid="btn-reset" onClick={reset}>
          Очистить
        </Button>
      </div>
      {result ? (
        <p role="status" data-testid="submit-result" className="text-sm font-medium">
          {result}
        </p>
      ) : null}
    </form>
  );
}

function RegistrationPage(): ReactNode {
  // Форма собирается с начальными значениями: по приглашению они приходят с «сервера».
  const [initial, setInitial] = useState<RegistrationValues | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadRegistrationInitial().then((values) => {
      if (mounted) setInitial(values);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ValidationMessagesProvider messages={registrationMessages}>
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">Регистрация</h1>
        {initial ? <RegistrationForm initial={initial} /> : null}
      </main>
    </ValidationMessagesProvider>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

let root: Root | null = null;
let generation = 0;

const render = () => {
  root ??= createRoot(container);
  generation++;
  root.render(<RegistrationPage key={generation} />);
};

installBench('registration', container, {
  mount: (sync) => (sync ? flushSync(render) : render()),
  unmount: () => {
    root?.unmount();
    root = null;
  },
});
