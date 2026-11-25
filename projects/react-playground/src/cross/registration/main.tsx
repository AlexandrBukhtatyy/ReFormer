/**
 * Страница кросс-фреймворк проверки: форма регистрации на React и `@reformer/ui-kit`.
 *
 * Документ формы, правила и API — общие с Vue- и Angular-страницами
 * (forms-benchmark/src/cross/registration.ts); здесь — реестр компонентов ui-kit и рендерер React.
 * Страница идёт мимо `main.tsx` приложения: без роутера и без моков сети — «сервер» формы живёт в
 * памяти страницы. `window.__bench` публикует общий харнесс (готовность первого экрана, покой,
 * вызовы API, отправленные данные) — по нему e2e ведёт три стека одним сценарием.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { useFormBundle } from '@reformer/core/react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormRenderer } from '@reformer/renderer-react';
import { installBench } from '../../../../forms-benchmark/src/cross/page';
import {
  createRegistrationForm,
  loadRegistrationInitial,
  registrationMessages,
  submitRegistration,
  type RegistrationValues,
} from '../../../../forms-benchmark/src/cross/registration';
import { FormActionsContext, type FormActions } from '../kit/form-actions';
import { registrationRegistry } from '../kit/registry';
import '../../index.css';
import '../cross.css';

const actions: FormActions = {
  submit: (values) => submitRegistration(values as RegistrationValues),
};

function RegistrationRenderer({ initial }: { initial: RegistrationValues }): ReactNode {
  const bundle = useFormBundle(() => createRegistrationForm(registrationRegistry, initial));
  return <FormRenderer<RegistrationValues> form={bundle} />;
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
      <FormActionsContext.Provider value={actions}>
        {initial ? <RegistrationRenderer initial={initial} /> : null}
      </FormActionsContext.Provider>
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
