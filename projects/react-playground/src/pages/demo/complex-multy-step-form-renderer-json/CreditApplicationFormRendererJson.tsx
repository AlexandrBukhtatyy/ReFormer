/**
 * CreditApplicationFormRendererJson
 *
 * Та же форма кредитной заявки, но layout описан в JSON-схеме.
 *
 * Архитектура (файлы в папке):
 * - [json-schema.json] — layout формы как ЧИСТЫЙ JSON (операторы — строки `$model(...)` и т.п.;
 *   так схема может прийти строкой с сервера/CMS).
 * - [registry.ts] — реестр компонентов и source-значений.
 * - [render-behavior.ts] — обёртка над TS-variant behavior-ом: инжектит форму и валидацию
 *   в wizard через `onInit`, остальное делегирует общему поведению.
 * - [CreditApplicationFormRendererJson.tsx] — этот файл: собирает форму ОДНИМ вызовом
 *   `createJsonForm` (модель + форма + валидация + render-behavior) и рендерит бандл.
 */

import { ValidationMessagesProvider } from '@reformer/cdk';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { createCreditApplicationModel } from '../complex-multy-step-form/schemas/model';
import { creditApplicationBehavior } from '../complex-multy-step-form/schemas/behavior';
import { creditApplicationValidation } from '../complex-multy-step-form/schemas/validation';
import { fileUploadMessages } from '../complex-multy-step-form/constants/file-upload-messages';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import rawJsonSchema from './json-schema.json';
import { createCreditApplicationRegistry } from './registry';
import { createCreditApplicationJsonRenderBehavior } from './render-behavior';

// Чистый JSON импортируется как данные; операторы-строки (`$model(...)`) типизируются как `string`,
// поэтому приводим к JsonFormSchema (это и есть сценарий «схема пришла строкой с сервера»).
const creditApplicationJsonSchema =
  rawJsonSchema as unknown as JsonFormSchema<CreditApplicationForm>;

export default function CreditApplicationFormRendererJson() {
  // Сборка ОДНИМ вызовом: модель + форма из JSON-схемы + реестр + поведение + валидация +
  // render-behavior. `useJsonForm` (ленивый useState) зовёт фабрику ровно один раз — в отличие от
  // useMemo, кэш которого React вправе сбросить, потеряв введённое.
  const jsonForm = useJsonForm(() =>
    createJsonForm<CreditApplicationForm>({
      schema: creditApplicationJsonSchema,
      registry: createCreditApplicationRegistry(),
      model: createCreditApplicationModel(),
      behavior: creditApplicationBehavior,
      validation: creditApplicationValidation,
      renderBehavior: createCreditApplicationJsonRenderBehavior,
    })
  );

  return (
    <div className="w-full">
      {/* Резолвер текстов для кодов отбора FileUpload (поле «Документы», шаг 5) — настройка хоста. */}
      <ValidationMessagesProvider resolver={fileUploadMessages}>
        <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
          <JsonFormRenderer<CreditApplicationForm>
            form={jsonForm}
            validateSchema={import.meta.env.DEV}
          />
        </JsonRendererProvider>
      </ValidationMessagesProvider>
    </div>
  );
}
