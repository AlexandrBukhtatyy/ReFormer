// @reformer-generated abff2ed6c168
// index.tsx — сборка формы одним проходом: createJsonForm → JsonFormRenderer (проп form).
// Здесь же запись реестра форм. Регенерируется билдером; правки будут перезаписаны.

import { useState } from 'react';
import type { FormEntry } from '@reformer/form-registry';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import rawSchema from './renderer.schema.json';
import { createRegistry } from './registry';
import { createTest04BreakFormModel } from './model';
import { formBehavior } from './form.behavior';
import { createJsonRenderBehavior } from './renderer.behavior';
import type { Test04BreakForm } from './types';

type SubmitResult = { message: string; ok: boolean };

// В чистом JSON операторы типизируются как `string` — приведение к схеме модели формы.
const typedSchema = rawSchema as unknown as JsonFormSchema<Test04BreakForm>;

export default function Test04BreakPage() {
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Сборка ОДНИМ вызовом: model + form + registry + behavior + render-behavior из одной схемы.
  // useJsonForm (ленивый useState) зовёт фабрику ровно один раз, поэтому ссылка на поведение
  // стабильна, а колбэк хоста (onResult) безопасно замыкается прямо здесь.
  const jsonForm = useJsonForm(() =>
    createJsonForm<Test04BreakForm>({
      schema: typedSchema,
      registry: createRegistry(),
      model: createTest04BreakFormModel(),
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
        <h1 className="text-2xl font-bold">Test04Break</h1>
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
        <JsonFormRenderer<Test04BreakForm> form={jsonForm} validateSchema={import.meta.env.DEV} />
      </JsonRendererProvider>
    </div>
  );
}

/**
 * Запись формы «Test04Break» в реестре форм.
 *
 * Регистрация в приложении — одна строка:
 * ```ts
 * import { getFormRegistry } from '@reformer/form-registry';
 * import { test04BreakFormEntry } from './pages/demo/test04Break';
 *
 * getFormRegistry().register(test04BreakFormEntry);
 * ```
 *
 * После этого форма монтируется где угодно: `<FormOutlet id="test04Break" />`, либо через
 * слот или маршрут, если заполнить `placement`.
 */
export const test04BreakFormEntry: FormEntry<Test04BreakForm> = {
  id: 'test04Break',
  version: '1.0.0',
  // Кто зарегистрировал: по этому полю различаются одинаковые id из разных микрофронтов.
  owner: 'app', // TODO: имя вашего приложения-хоста

  // Данные — единственная часть, которую можно доставить по сети.
  schema: { kind: 'inline', value: typedSchema },

  // Код — только из бандла.
  registry: { kind: 'inline', value: createRegistry() },
  model: { kind: 'inline', value: createTest04BreakFormModel },
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
  placement: { slots: [], routes: ['/examples/test04Break'] },

  meta: {
    name: 'Test04Break',
    tags: ['renderer-json', 'form-registry'],
  },
};
