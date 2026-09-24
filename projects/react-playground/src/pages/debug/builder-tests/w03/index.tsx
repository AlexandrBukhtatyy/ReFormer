// @reformer-generated a76df728b5cf
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
import rawSchema from './form.schema.json';
import { createRegistry } from './registry';
import { createW03FormModel } from './model';
import { formBehavior } from './form.behavior';
import { createJsonRenderBehavior } from './form.render';
import type { W03Form } from './types';

type SubmitResult = { message: string; ok: boolean };

// В чистом JSON операторы типизируются как `string` — приведение к схеме модели формы.
const typedSchema = rawSchema as unknown as JsonFormSchema<W03Form>;

export default function W03Page() {
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Сборка ОДНИМ вызовом: model + form + registry + behavior + render-behavior из одной схемы.
  // useJsonForm (ленивый useState) зовёт фабрику ровно один раз, поэтому ссылка на поведение
  // стабильна, а колбэк хоста (onResult) безопасно замыкается прямо здесь.
  const jsonForm = useJsonForm(() =>
    createJsonForm<W03Form>({
      schema: typedSchema,
      registry: createRegistry(),
      model: createW03FormModel(),
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
        <h1 className="text-2xl font-bold">W03</h1>
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
        <JsonFormRenderer<W03Form> form={jsonForm} validateSchema={import.meta.env.DEV} />
      </JsonRendererProvider>
    </div>
  );
}

/**
 * Запись формы «W03» в реестре форм.
 *
 * Регистрация в приложении — одна строка:
 * ```ts
 * import { getFormRegistry } from '@reformer/form-registry';
 * import { w03FormEntry } from './pages/demo/w03';
 *
 * getFormRegistry().register(w03FormEntry);
 * ```
 *
 * После этого форма монтируется где угодно: `<FormOutlet id="w03" />`, либо через
 * слот или маршрут, если заполнить `placement`.
 */
export const w03FormEntry: FormEntry<W03Form> = {
  id: 'w03',
  version: '1.0.0',
  // Кто зарегистрировал: по этому полю различаются одинаковые id из разных микрофронтов.
  owner: 'app', // TODO: имя вашего приложения-хоста

  // Данные — единственная часть, которую можно доставить по сети.
  schema: { kind: 'inline', value: typedSchema },

  // Код — только из бандла.
  registry: { kind: 'inline', value: createRegistry() },
  model: { kind: 'inline', value: createW03FormModel },
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
  placement: { slots: [], routes: ['/examples/w03'] },

  meta: {
    name: 'W03',
    tags: ['renderer-json', 'form-registry'],
  },
};
