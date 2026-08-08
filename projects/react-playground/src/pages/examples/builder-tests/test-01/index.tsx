/**
 * Форма «test-01» — сборка и рендер. В JSX только провайдер реестра и рендерер: весь layout
 * живёт в form.json, значения/поведение/валидация — в model.ts / form-behavior.ts / validation.ts / render-behavior.ts.
 *
 * Готова к работе сразу: рендерится на `initialFormModel`, «Отправить» гоняет валидацию. Подключение
 * в react-playground: `import Test01Form from './pages/examples/<папка>';` + `<Route element={<Test01Form />} />`.
 */
import { useState } from 'react';
import { validateModel } from '@reformer/core/validation';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { Button } from '@reformer/ui-kit';
import rawSchema from './form.json';
import { createRegistry } from './registry';
import { initialFormModel, type FormShape } from './model';
import { formBehavior } from './form-behavior';
import { formValidation } from './validation';
import { formRenderBehavior } from './render-behavior';

// В чистом JSON операторы типизируются как `string` — приведение = сценарий «схема пришла с сервера».
const schema = rawSchema as unknown as JsonFormSchema<FormShape>;

export default function Test01Form() {
  const [status, setStatus] = useState<string | null>(null);

  // Сборка одним проходом (§7): createJsonForm бандлит model+form+registry из одной схемы;
  // useJsonForm (ленивый useState) держит бандл стабильным между рендерами.
  const jsonForm = useJsonForm(() =>
    createJsonForm<FormShape>({
      schema,
      registry: createRegistry(),
      initial: { ...initialFormModel },
      behavior: formBehavior,
    })
  );

  const submit = async (): Promise<void> => {
    jsonForm.form.markAsTouched();
    const valid = await validateModel(jsonForm.model, formValidation);
    if (!valid) {
      setStatus('Проверьте выделенные поля');
      return;
    }
    // TODO: отправка на бэкенд (пример флоу — в renderer-json examples: api.ts + submit).

    console.info('[test-01] submit', jsonForm.model.get());
    setStatus('Форма валидна — данные готовы к отправке');
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-800">test-01</h1>
      </header>

      {status && (
        <div role="status" className="rounded-md border p-3 text-sm">
          {status}
        </div>
      )}

      <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
        <JsonFormRenderer<FormShape>
          form={jsonForm}
          renderBehavior={formRenderBehavior}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>

      <Button onClick={() => void submit()}>Отправить</Button>
    </div>
  );
}
