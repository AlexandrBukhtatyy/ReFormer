// @reformer-generated ebbd53bdf0c7
// ContactForm.tsx — страница формы: сборка (application/create.ts) → FormRenderer.
// Регенерируется билдером; правки будут перезаписаны.

import { useState } from 'react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { I18nProvider, useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { createContactForm } from './application/create';
import { formLocale, formMessages } from './validation/messages';

type SubmitResult = { message: string; ok: boolean };

export default function ContactForm() {
  const [result, setResult] = useState<SubmitResult | null>(null);
  // Фабрика выполняется один раз: `useMemo` здесь неверен — React вправе сбросить кэш и потерять
  // введённое. Колбэк места подключения (`onResult`) замыкается прямо здесь.
  const bundle = useFormBundle(() =>
    createContactForm({ onResult: (message, ok) => setResult({ message, ok }) })
  );

  // Тексты замечаний — словарь формы (validation/messages.ts): правила несут только код,
  // строку по коду даёт провайдер. Без него замечания показывались бы текстом локали по умолчанию.
  const page = (
    <ValidationMessagesProvider messages={formMessages}>
      <div className="mx-auto max-w-3xl p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Обратная связь</h1>
        </header>

        {result && (
          <div
            role="status"
            data-testid="submit-result"
            className={
              'mb-4 rounded-md border p-3 text-sm ' +
              (result.ok
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-red-300 bg-red-50 text-red-800')
            }
          >
            {result.message}
          </div>
        )}

        {/* Обёртку поля рендерер берёт из сборки: её кладёт туда реестр (запись FIELD_WRAPPER). */}
        <FormRenderer form={bundle} />
      </div>
    </ValidationMessagesProvider>
  );

  // Язык формы — тоже из словаря (`formLocale`): по нему склоняются тексты замечаний, пишутся
  // единицы размера и подписи кита. `undefined` — форма говорит языком приложения.
  return formLocale === undefined ? page : <I18nProvider locale={formLocale}>{page}</I18nProvider>;
}
