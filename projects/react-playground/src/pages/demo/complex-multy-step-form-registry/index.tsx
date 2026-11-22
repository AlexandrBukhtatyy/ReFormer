/**
 * «Кредитная заявка через реестр форм» — та же форма, что в `complex-multy-step-form-renderer-json`,
 * но смонтированная реестром.
 *
 * Сравнение двух файлов — суть примера. В прямом варианте страница знает про форму всё: строит
 * модель, собирает реестр компонентов, передаёт документ, правила и поведение в сборку, проверяет
 * документ. Здесь она не знает ничего, кроме `id`: описание формы лежит в `form-setup.ts`
 * (запись реестра), регистрация — в `src/forms/registry.ts`. Ровно это и нужно микрофронтам:
 * форму отдаёт одно приложение, а решает, где её показать, другое.
 *
 * `ValidationMessagesProvider` со словарём формы стоит на странице: тексты замечаний — слой
 * представления, их подключает тот, кто показывает форму. Реестр компонентов уходит в сборку
 * формы явно, а не через React-контекст: контекст не пересекает границу бандла.
 */
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormOutlet } from '@reformer/form-registry/react';
import { creditApplicationMessages } from '../complex-multy-step-form/validation/messages';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';

export default function CreditApplicationFormRegistry() {
  return (
    <div className="w-full">
      {/* Тексты замечаний формы: правила несут коды, строки по кодам — в словаре формы. */}
      <ValidationMessagesProvider messages={creditApplicationMessages}>
        <FormOutlet<CreditApplicationForm> id="credit-application" />
      </ValidationMessagesProvider>
    </div>
  );
}
