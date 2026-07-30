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

  return `// renderer.behavior.ts — рантайм-обвязка (submit, условная видимость). МОК: реализуйте методы.
// Пишется один раз (не затирается при регенерации).

import { hideWhen, onComponentEvent, type RenderBehaviorFn } from '@reformer/renderer-react';
import type { FormModel, FormProxy } from '@reformer/core';
import { makeValidationConfig } from './validation';
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

    const submit = schema.node('${sel.submitSelector}');
    onComponentEvent(submit, 'onClick', async () => {
      const { validateAll } = makeValidationConfig(model);
      if (!(await validateAll())) return;
      const res = await submitForm(model.get());
      onResult?.(res.success ? 'Форма отправлена' : res.error, res.success);
    });

    // Условная видимость секций — раскомментируйте и впишите условие:
${hideWhens}
  };
}
`;
}
