/**
 * «Кредитная заявка через реестр форм» — та же форма, что в `complex-multy-step-form-renderer-json`,
 * но смонтированная реестром.
 *
 * Сравнение двух файлов — суть примера. В прямом варианте страница знает про форму всё: строит
 * модель, конвертирует схему, собирает реестр компонентов и render-behavior, ловит ошибку
 * конвертации. Здесь она не знает ничего, кроме `id`: описание формы лежит в `form-setup.ts`
 * (запись реестра), регистрация — в `src/forms/registry.ts`. Ровно это и нужно микрофронтам:
 * форму отдаёт одно приложение, а решает, где её показать, другое.
 *
 * `ValidationMessagesProvider` остаётся на странице намеренно: это настройка ХОСТА (тексты кодов
 * отбора файлов), а не часть формы. `JsonRendererProvider` больше не нужен — реестр компонентов
 * приходит в рендерер пропом, потому что React-контекст не пересекает границу бандла.
 */
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormOutlet } from '@reformer/form-registry/react';
import { fileUploadMessages } from '../complex-multy-step-form/constants/file-upload-messages';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';

export default function CreditApplicationFormRegistry() {
  return (
    <div className="w-full">
      {/* Резолвер текстов для кодов отбора FileUpload (поле «Документы», шаг 5). */}
      <ValidationMessagesProvider resolver={fileUploadMessages}>
        <FormOutlet<CreditApplicationForm> id="credit-application" />
      </ValidationMessagesProvider>
    </div>
  );
}
