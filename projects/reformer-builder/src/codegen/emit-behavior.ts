/**
 * Эмиттер `renderer.behavior.ts` (user-owned) — submit на реальный selector + scaffold `hideWhen`
 * по selector-ам секций. Форма отправляется сразу (console-стаб в `api.ts`), условия видимости —
 * закомменчены с реальными узлами (впишите предикат).
 *
 * @module reformer-builder/codegen/emit-behavior
 */

import type { SelectorInfo } from './assign-selectors';
import type { Names } from './naming';

export function emitBehavior(n: Names, sel: SelectorInfo): string {
  const hideWhens = sel.sections
    .map(
      (s) =>
        `    // hideWhen(schema.node('${s.selector}'), () => /* TODO: условие для «${s.label}» */ false);`
    )
    .join('\n');

  // Визард отправляет форму сам (`onSubmit` с последнего шага) и требует инъекции `form`: рендерер
  // отдаёт форму пропом только вложенным узлам, а визард — корень схемы. Без этого ui-kit
  // `FormWizard` читает `form.submitting` у `undefined` и роняет первый же рендер.
  const isWizard = sel.submitEvent === 'onSubmit';
  const target = isWizard ? 'wizard' : 'submit';
  // Импорт `onInit` только там, где он нужен: экспортированный каталог собирается с
  // `noUnusedLocals`, и лишний импорт стал бы ошибкой компиляции у пользователя.
  const imports = ['hideWhen', 'onComponentEvent', ...(isWizard ? ['onInit'] : [])]
    .sort()
    .join(', ');
  const injectForm = isWizard
    ? `
    // Визард — self-managed компонент: форму ему передаём явно.
    onInit(${target}, () => ${target}.patchProps({ form }));
`
    : '';

  return `// renderer.behavior.ts — рантайм-обвязка (submit, условная видимость). МОК: реализуйте методы.
// Пишется один раз (не затирается при регенерации).

import { ${imports}, type RenderBehaviorFn } from '@reformer/renderer-react';
import { validateModel } from '@reformer/core/validation';
import type { FormModel, FormProxy } from '@reformer/core';
import { formValidation } from './validation';
import { submitForm } from './api';
import type { ${n.TypeName} } from './types';

export type RenderBehaviorOptions = { onResult?: (message: string, ok: boolean) => void };

export function createJsonRenderBehavior(
  form: FormProxy<${n.TypeName}>,
  model: FormModel<${n.TypeName}>,
  options: RenderBehaviorOptions = {}
): RenderBehaviorFn<${n.TypeName}> {
  const { onResult } = options;
  return (schema) => {
    void form; // используется в условиях hideWhen ниже (form.<поле>.value.value)
    void hideWhen;

    const ${target} = schema.node('${sel.submitSelector}');
${injectForm}
    onComponentEvent(${target}, '${sel.submitEvent}', async () => {
      if (!(await validateModel(model, formValidation))) return;
      const res = await submitForm(model.get());
      onResult?.(res.success ? 'Форма отправлена' : res.error, res.success);
    });

    // Условная видимость секций — раскомментируйте и впишите условие:
${hideWhens}
  };
}
`;
}
