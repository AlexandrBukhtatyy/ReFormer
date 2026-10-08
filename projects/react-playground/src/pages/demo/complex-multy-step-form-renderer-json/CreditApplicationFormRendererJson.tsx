/**
 * CreditApplicationFormRendererJson
 *
 * Та же форма кредитной заявки, но схема — документ JSON.
 *
 * Архитектура (файлы в папке):
 * - [form.schema.json] — схема формы как ЧИСТЫЙ JSON формата 2 (операторы — строки `$model(...)`
 *   и т.п.; так схема может прийти строкой с сервера/CMS). Адрес и строки массивов — именованные
 *   части документа (`parts`).
 * - [registry.ts] — реестр компонентов и source-значений.
 * - [CreditApplicationFormRendererJson.tsx] — этот файл: собирает форму общей сборкой заявки
 *   и рендерит бандл.
 *
 * Сборка — общая с вариантами «React руками» и renderer
 * (`../complex-multy-step-form/application/create`). От renderer-варианта она отличается двумя
 * строками: `schema` — документ, а не билдер, и рядом с ним `registry`.
 */

import { useEffect, useState } from 'react';
import { useFormBundle } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { SchemaErrorPanel, type JsonFormSchema } from '@reformer/renderer-json';
import { createCreditApplication } from '../complex-multy-step-form/application/create';
import { rendererSetup } from '../complex-multy-step-form/application/renderer';
import { fileUploadMessages } from '../complex-multy-step-form/constants/file-upload-messages';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import rawJsonSchema from './form.schema.json';
import { createCreditApplicationRegistry } from './registry';

// Чистый JSON импортируется как данные; операторы-строки (`$model(...)`) типизируются как `string`,
// поэтому приводим к JsonFormSchema (это и есть сценарий «схема пришла строкой с сервера»).
const creditApplicationJsonSchema =
  rawJsonSchema as unknown as JsonFormSchema<CreditApplicationForm>;

const registry = createCreditApplicationRegistry();

/**
 * Проверка документа против мета-схемы и реестра — только в dev. Валидатор тянет ajv, поэтому
 * грузится динамически и в прод-бандл не попадает.
 *
 * @returns `undefined`, пока проверка идёт; список ошибок (пустой — документ годен).
 */
function useSchemaErrors(): string[] | undefined {
  const [errors, setErrors] = useState<string[] | undefined>(import.meta.env.DEV ? undefined : []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let cancelled = false;
    import('@reformer/renderer-json/validate')
      .then(({ validateFormSchema }) => {
        if (!cancelled)
          setErrors(validateFormSchema(creditApplicationJsonSchema, { registry }).errors);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrors([`Schema validator failed to load: ${String(error)}`]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return errors;
}

function CreditApplicationJsonForm() {
  // Сборка заявки — общая на все варианты; здесь дерево строит реестр из документа. Связка узлов
  // та же, что у renderer-варианта. `useFormBundle` зовёт фабрику ровно один раз — в отличие от
  // useMemo, кэш которого React вправе сбросить, потеряв введённое.
  const creditForm = useFormBundle(() =>
    createCreditApplication({
      schema: creditApplicationJsonSchema,
      registry,
      setup: rendererSetup({ applicationId: '1' }),
    })
  );

  // Обёртку поля рендерер берёт из бандла: её положил туда реестр (запись FIELD_WRAPPER).
  return <FormRenderer form={creditForm} />;
}

export default function CreditApplicationFormRendererJson() {
  // Негодный документ сборка не переживёт (`$component(...)` без записи в реестре бросает), поэтому
  // форма собирается только после проверки — отдельным компонентом.
  const schemaErrors = useSchemaErrors();
  if (schemaErrors === undefined) return null;
  if (schemaErrors.length > 0) return <SchemaErrorPanel errors={schemaErrors} />;

  return (
    <div className="w-full">
      {/* Резолвер текстов для кодов отбора FileUpload (поле «Документы», шаг 5) — настройка хоста. */}
      <ValidationMessagesProvider resolver={fileUploadMessages}>
        <CreditApplicationJsonForm />
      </ValidationMessagesProvider>
    </div>
  );
}
