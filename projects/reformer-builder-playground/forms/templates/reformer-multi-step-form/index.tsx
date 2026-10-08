// @reformer-generated d2b10a325eba
// index.tsx — сборка формы одним проходом: createJsonForm → JsonFormRenderer (проп form).
// Здесь же запись реестра форм. Регенерируется билдером; правки будут перезаписаны.

import { useState } from 'react';
import type { FormEntry } from '@reformer/form-registry';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  composeJsonFormSchema,
  createJsonForm,
  useJsonForm,
  type JsonFormSchemaV1 as JsonFormSchema,
} from '@reformer/renderer-json';
import rawSchema from './form.schema.json';
import { createRegistry } from './registry';
import { createReformerMultiStepFormFormModel } from './model';
import { formBehavior } from './form.behavior';
import { createJsonRenderBehavior } from './form.render';
import type { ReformerMultiStepFormForm } from './types';
import { stepSchemas } from './steps';

type SubmitResult = { message: string; ok: boolean };

// Шаги визарда лежат в своих файлах: корневая схема держит ссылки, форма собирается здесь.
// В чистом JSON операторы типизируются как `string` — приведение к схеме модели формы.
const typedSchema = composeJsonFormSchema(
  rawSchema as unknown as JsonFormSchema,
  stepSchemas
) as unknown as JsonFormSchema<ReformerMultiStepFormForm>;

export default function ReformerMultiStepFormPage() {
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Сборка ОДНИМ вызовом: model + form + registry + behavior + render-behavior из одной схемы.
  // useJsonForm (ленивый useState) зовёт фабрику ровно один раз, поэтому ссылка на поведение
  // стабильна, а колбэк хоста (onResult) безопасно замыкается прямо здесь.
  const jsonForm = useJsonForm(() =>
    createJsonForm<ReformerMultiStepFormForm>({
      schema: typedSchema,
      registry: createRegistry(),
      model: createReformerMultiStepFormFormModel(),
      behavior: formBehavior,
      renderBehavior: (form, model) =>
        createJsonRenderBehavior(form, model, {
          onResult: (message, ok) => setResult({ message, ok }),
        }),
    })
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">ReformerMultiStepForm</h1>
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

      <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
        <JsonFormRenderer<ReformerMultiStepFormForm>
          form={jsonForm}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>
    </div>
  );
}

/**
 * Запись формы «ReformerMultiStepForm» в реестре форм.
 *
 * Регистрация в приложении — одна строка:
 * ```ts
 * import { getFormRegistry } from '@reformer/form-registry';
 * import { reformerMultiStepFormFormEntry } from './pages/demo/reformerMultiStepForm';
 *
 * getFormRegistry().register(reformerMultiStepFormFormEntry);
 * ```
 *
 * После этого форма монтируется где угодно: `<FormOutlet id="reformerMultiStepForm" />`, либо через
 * слот или маршрут, если заполнить `placement`.
 */
export const reformerMultiStepFormFormEntry: FormEntry<ReformerMultiStepFormForm> = {
  id: 'reformerMultiStepForm',
  version: '1.0.0',
  // Кто зарегистрировал: по этому полю различаются одинаковые id из разных микрофронтов.
  owner: 'app', // TODO: имя вашего приложения-хоста

  // Данные — единственная часть, которую можно доставить по сети.
  schema: { kind: 'inline', value: typedSchema },

  // Код — только из бандла.
  registry: { kind: 'inline', value: createRegistry() },
  model: { kind: 'inline', value: createReformerMultiStepFormFormModel },
  behavior: { kind: 'inline', value: formBehavior },
  // Адаптер, а не прямая ссылка: у `createJsonRenderBehavior` третий параметр — настройки места
  // (`{ onResult }`), а реестр третьим отдаёт правила валидации и только четвёртым — настройки
  // хоста. Без переходника это не компилируется, а `onResult` не доезжает никогда.
  renderBehavior: {
    kind: 'inline',
    value: (form, model, _validation, options) =>
      createJsonRenderBehavior(
        form,
        model,
        options as { onResult?: (m: string, ok: boolean) => void }
      ),
  },

  // Где показывать. Пусто — форма доступна только по id; заполните, чтобы показывать её
  // в слоте хоста или на маршруте.
  placement: { slots: [], routes: ['/examples/reformerMultiStepForm'] },

  meta: {
    name: 'ReformerMultiStepForm',
    tags: ['renderer-json', 'form-registry'],
  },
};
