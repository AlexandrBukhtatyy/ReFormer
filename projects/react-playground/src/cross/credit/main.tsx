/**
 * Страница кросс-фреймворк проверки: кредитная заявка на React и `@reformer/ui-kit`.
 *
 * Документ формы, правила шагов, поведение и API — общие с Vue- и Angular-страницами
 * (forms-benchmark/src/cross/credit.ts); здесь — реестр компонентов ui-kit и рендерер React.
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
  createCreditForm,
  createCreditStart,
  creditMessages,
  submitCredit,
  type CreditDictionaries,
  type CreditValues,
} from '../../../../forms-benchmark/src/cross/credit';
import { FormActionsContext, type FormActions } from '../kit/form-actions';
import { creditRegistry } from '../kit/registry';
import '../../index.css';
import '../cross.css';

const actions: FormActions = {
  submit: (values) => submitCredit(values as CreditValues),
};

function CreditRenderer({
  initial,
  dictionaries,
}: {
  initial: CreditValues;
  dictionaries: CreditDictionaries;
}): ReactNode {
  const bundle = useFormBundle(() => createCreditForm(creditRegistry, initial, dictionaries));
  return <FormRenderer<CreditValues> form={bundle} />;
}

function CreditPage(): ReactNode {
  // Справочники — сигналы страницы: документ формы ссылается на них, значения придут позже.
  const [start] = useState(createCreditStart);
  // Форма собирается с начальными значениями: данные заявки приходят с «сервера».
  const [initial, setInitial] = useState<CreditValues | null>(null);

  useEffect(() => {
    let mounted = true;
    void start.load().then((values) => {
      if (mounted) setInitial(values);
    });
    return () => {
      mounted = false;
    };
  }, [start]);

  return (
    <ValidationMessagesProvider messages={creditMessages}>
      <FormActionsContext.Provider value={actions}>
        {initial ? <CreditRenderer initial={initial} dictionaries={start.dictionaries} /> : null}
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
  root.render(<CreditPage key={generation} />);
};

installBench('credit', container, {
  mount: (sync) => (sync ? flushSync(render) : render()),
  unmount: () => {
    root?.unmount();
    root = null;
  },
});
