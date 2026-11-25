/**
 * Страница кросс-фреймворк проверки: кредитная заявка на React и `@reformer/ui-kit`.
 *
 * Документ формы, правила шагов, поведение и API — общие с Vue- и Angular-страницами
 * (forms-benchmark/src/cross/credit.ts); здесь — реестр кита ui-kit (../registry.ts), рендерер React
 * и оболочка страницы: заголовок, `<form>` и подтверждение отправки. Кнопки шагов и «Отправить»
 * рисует визард кита. Страница идёт мимо `main.tsx` приложения: без роутера и без моков сети —
 * «сервер» формы живёт в памяти страницы. `window.__bench` публикует общий харнесс (готовность
 * первого экрана, покой, вызовы API, отправленные данные) — по нему e2e ведёт три стека одним
 * сценарием.
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
  type CreditDictionaries,
  type CreditValues,
} from '../../../../forms-benchmark/src/cross/credit';
import { creditRegistry } from '../registry';
import '../styles.css';
import '../cross.css';

function CreditForm({
  initial,
  dictionaries,
}: {
  initial: CreditValues;
  dictionaries: CreditDictionaries;
}): ReactNode {
  // Текст подтверждения приходит из поведения формы: визард кита проверил и отправил заявку.
  const [result, setResult] = useState<string | null>(null);
  const bundle = useFormBundle(() =>
    createCreditForm(creditRegistry, initial, dictionaries, setResult)
  );
  // Кнопки визарда — `type="button"`; Enter в поле не отправляет форму в обход визарда.
  return (
    <form noValidate onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-4">
      <FormRenderer<CreditValues> form={bundle} />
      {result ? (
        <p role="status" data-testid="submit-result" className="text-sm font-medium">
          {result}
        </p>
      ) : null}
    </form>
  );
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
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">Заявка на кредит</h1>
        {initial ? <CreditForm initial={initial} dictionaries={start.dictionaries} /> : null}
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
  root.render(<CreditPage key={generation} />);
};

installBench('credit', container, {
  mount: (sync) => (sync ? flushSync(render) : render()),
  unmount: () => {
    root?.unmount();
    root = null;
  },
});
