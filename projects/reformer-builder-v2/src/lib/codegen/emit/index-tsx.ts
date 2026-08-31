/**
 * Эмиттер `index.tsx` — точка входа модуля формы: сборка ОДНИМ проходом плюс запись реестра форм.
 *
 * `createJsonForm` бандлит модель, форму и реестр из схемы, бандл целиком уходит рендереру
 * пропом `form`. Схема не передаётся дважды.
 *
 * **Почему запись реестра живёт здесь, а не в отдельном `entry.ts`.** Она закрывает исходную
 * дыру билдера: связка «id формы → модуль» была ручной — билдер печатал сниппет из трёх шагов,
 * человек копировал его в приложение, и с этого момента ничто не гарантировало, что копия
 * соответствует сгенерированному коду. Запись описывает форму данными, поэтому регистрация
 * становится одной строкой. Отдельного файла под неё в каноне раскладки нет: роль «точка входа»
 * там называется `index.tsx`, а `entry.ts` канон читает как её неканоничное имя и требует слить.
 *
 * @module reformer-builder/lib/codegen/emit/index-tsx
 */

import type { EmitContext } from '../context';

export function emitIndex(ctx: EmitContext): string {
  const n = ctx.names;
  return `// index.tsx — сборка формы одним проходом: createJsonForm → JsonFormRenderer (проп form).
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
import { ${n.modelFactory} } from './model';
import { formBehavior } from './form.behavior';
import { createJsonRenderBehavior } from './renderer.behavior';
import type { ${n.TypeName} } from './types';

type SubmitResult = { message: string; ok: boolean };

// В чистом JSON операторы типизируются как \`string\` — приведение к схеме модели формы.
const typedSchema = rawSchema as unknown as JsonFormSchema<${n.TypeName}>;

export default function ${n.pageComponent}() {
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Сборка ОДНИМ вызовом: model + form + registry + behavior + render-behavior из одной схемы.
  // useJsonForm (ленивый useState) зовёт фабрику ровно один раз, поэтому ссылка на поведение
  // стабильна, а колбэк хоста (onResult) безопасно замыкается прямо здесь.
  const jsonForm = useJsonForm(() =>
    createJsonForm<${n.TypeName}>({
      schema: typedSchema,
      registry: createRegistry(),
      model: ${n.modelFactory}(),
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
        <h1 className="text-2xl font-bold">${n.title}</h1>
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
        <JsonFormRenderer<${n.TypeName}> form={jsonForm} validateSchema={import.meta.env.DEV} />
      </JsonRendererProvider>
    </div>
  );
}

/**
 * Запись формы «${n.title}» в реестре форм.
 *
 * Регистрация в приложении — одна строка:
 * \`\`\`ts
 * import { getFormRegistry } from '@reformer/form-registry';
 * import { ${n.entryConst} } from './pages/demo/${n.dir}';
 *
 * getFormRegistry().register(${n.entryConst});
 * \`\`\`
 *
 * После этого форма монтируется где угодно: \`<FormOutlet id="${n.exampleId}" />\`, либо через
 * слот или маршрут, если заполнить \`placement\`.
 */
export const ${n.entryConst}: FormEntry<${n.TypeName}> = {
  id: '${n.exampleId}',
  version: '1.0.0',
  // Кто зарегистрировал: по этому полю различаются одинаковые id из разных микрофронтов.
  owner: 'app', // TODO: имя вашего приложения-хоста

  // Данные — единственная часть, которую можно доставить по сети.
  schema: { kind: 'inline', value: typedSchema },

  // Код — только из бандла.
  registry: { kind: 'inline', value: createRegistry() },
  model: { kind: 'inline', value: ${n.modelFactory} },
  behavior: { kind: 'inline', value: formBehavior },
  // Адаптер, а не прямая ссылка: у \`createJsonRenderBehavior\` третий параметр — настройки места
  // (\`{ onResult }\`), а реестр третьим отдаёт правила валидации и только четвёртым — настройки
  // хоста. Без переходника это не компилируется, а \`onResult\` не доезжает никогда.
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
  placement: { slots: [], routes: ['${n.routePath}'] },

  meta: {
    name: '${n.title}',
    tags: ['renderer-json', 'form-registry'],
  },
};
`;
}
