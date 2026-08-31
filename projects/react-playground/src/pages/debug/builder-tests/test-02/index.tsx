/**
 * Пошаговая форма «test-02» — сборка и рендер. В JSX только провайдер реестра и рендерер:
 * шаги и layout живут в form.json, значения/поведение/валидация — в model.ts / form-behavior.ts /
 * validation.ts / render-behavior.ts, навигация и кнопки — в ui-kit FormWizard (адаптер wizard.tsx).
 *
 * Подключение в react-playground: `import Test02Form from './pages/examples/<папка>';`
 * + `<Route element={<Test02Form />} />`.
 */
import { useMemo } from 'react';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import rawSchema from './form.json';
import { createRegistry } from './registry';
import { initialFormModel, type FormShape } from './model';
import { formBehavior } from './form-behavior';
import { createRenderBehavior } from './render-behavior';

// В чистом JSON операторы типизируются как `string` — приведение = сценарий «схема пришла с сервера».
const schema = rawSchema as unknown as JsonFormSchema<FormShape>;

export default function Test02Form() {
  // Сборка одним проходом: createJsonForm бандлит model+form+registry из одной схемы;
  // useJsonForm (ленивый useState) держит бандл стабильным между рендерами.
  const jsonForm = useJsonForm(() =>
    createJsonForm<FormShape>({
      schema,
      registry: createRegistry(),
      initial: { ...initialFormModel },
      behavior: formBehavior,
    })
  );

  // Поведение UI держит форму (её получает визард) и модель (валидация на submit) — собираем его
  // один раз на бандл формы.
  const renderBehavior = useMemo(
    () => createRenderBehavior(jsonForm.form, jsonForm.model),
    [jsonForm]
  );

  return (
    <div className="mx-auto max-w-2xl p-6">
      <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
        <JsonFormRenderer<FormShape>
          form={jsonForm}
          renderBehavior={renderBehavior}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>
    </div>
  );
}
