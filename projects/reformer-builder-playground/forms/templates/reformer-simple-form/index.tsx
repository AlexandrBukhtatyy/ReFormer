// @reformer-generated c4bb55a41871
// index.tsx — сборка формы одним проходом: createJsonForm → JsonFormRenderer (проп form).
// Здесь же запись реестра форм. Регенерируется билдером; правки будут перезаписаны.

import { useState } from 'react';
import type { FormEntry } from '@reformer/form-registry';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  type JsonFormSchemaV1 as JsonFormSchema,
} from '@reformer/renderer-json';
import rawSchema from './form.schema.json';
import { createRegistry } from './registry';
import { createReformerSimpleFormFormModel } from './model';
import { formBehavior } from './form.behavior';
import { createJsonRenderBehavior } from './form.render';
import type { ReformerSimpleFormForm } from './types';

type SubmitResult = { message: string; ok: boolean };

// В чистом JSON операторы типизируются как `string` — приведение к схеме модели формы.
const typedSchema = rawSchema as unknown as JsonFormSchema<ReformerSimpleFormForm>;

export default function ReformerSimpleFormPage() {
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Сборка ОДНИМ вызовом: model + form + registry + behavior + render-behavior из одной схемы.
  // useJsonForm (ленивый useState) зовёт фабрику ровно один раз, поэтому ссылка на поведение
  // стабильна, а колбэк хоста (onResult) безопасно замыкается прямо здесь.
  const jsonForm = useJsonForm(() =>
    createJsonForm<ReformerSimpleFormForm>({
      schema: typedSchema,
      registry: createRegistry(),
      model: createReformerSimpleFormFormModel(),
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
        <h1 className="text-2xl font-bold">ReformerSimpleForm</h1>
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
        <JsonFormRenderer<ReformerSimpleFormForm>
          form={jsonForm}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>
    </div>
  );
}

/**
 * Запись формы «ReformerSimpleForm» в реестре форм.
 *
 * Регистрация в приложении — одна строка:
 * ```ts
 * import { getFormRegistry } from '@reformer/form-registry';
 * import { reformerSimpleFormFormEntry } from './pages/demo/reformerSimpleForm';
 *
 * getFormRegistry().register(reformerSimpleFormFormEntry);
 * ```
 *
 * После этого форма монтируется где угодно: `<FormOutlet id="reformerSimpleForm" />`, либо через
 * слот или маршрут, если заполнить `placement`.
 */
export const reformerSimpleFormFormEntry: FormEntry<ReformerSimpleFormForm> = {
  id: 'reformerSimpleForm',
  version: '1.0.0',
  // Кто зарегистрировал: по этому полю различаются одинаковые id из разных микрофронтов.
  owner: 'app', // TODO: имя вашего приложения-хоста

  // Данные — единственная часть, которую можно доставить по сети.
  schema: { kind: 'inline', value: typedSchema },

  // Код — только из бандла.
  registry: { kind: 'inline', value: createRegistry() },
  model: { kind: 'inline', value: createReformerSimpleFormFormModel },
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
  placement: { slots: [], routes: ['/examples/reformerSimpleForm'] },

  meta: {
    name: 'ReformerSimpleForm',
    tags: ['renderer-json', 'form-registry'],
  },
};
