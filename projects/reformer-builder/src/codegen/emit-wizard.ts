/**
 * Эмиттер `renderer.wizard.tsx` — прикладной шим под `$component(Wizard)` и тело шага под
 * `$component(Step)`.
 *
 * Зачем он в кодогене. Библиотека компонент под `$component(Wizard)` не экспортирует: `FormWizard`
 * из ui-kit не умеет ни JSON-шаги, ни рендер `RenderNode`, поэтому переходник пишет приложение —
 * канон раскладки держит под него опциональный файл `renderer.wizard.tsx` (`@reformer/mcp`
 * docs/llms/06-form-directory-layout.md §1). Пока этого файла у кодогена не было, экспорт
 * визарда печатал `reg.component('Wizard', Placeholder)`, и выгруженная форма не работала: шаги
 * не рисовались, submit было некому послать.
 *
 * Тот же шим печатает встроенный шаблон визарда (`app/wizard-templates.ts`). Здесь он повторён, а
 * не импортирован: у кодогена другой контекст — тип формы называется по имени формы
 * (`Names.TypeName`), а не `FormShape`, и файл собирается вместе с остальными эмиттерами.
 *
 * @module reformer-builder/codegen/emit-wizard
 */

import type { Names } from './naming';

export function emitWizard(n: Names): string {
  return `// renderer.wizard.tsx — шим под $component(Wizard) и тело шага. Регенерируется билдером.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from 'react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormProxy } from '@reformer/core';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import type { ${n.TypeName} } from './types';

/** Узел шага после конвертации: \`title\`/\`icon\` лежат в его \`componentProps\`. */
interface StepNode {
  componentProps?: { title?: string; icon?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface WizardProps {
  /** Приходит от рендерера (см. \`__selfManagedChildren\`). */
  form?: FormProxy<${n.TypeName}>;
  /** Узлы шагов из \`componentProps.steps\`. */
  steps?: StepNode[];
  className?: string;
  /** Вешается снаружи — renderer.behavior.ts через onComponentEvent(node, 'onSubmit'). */
  onSubmit?: (values: ${n.TypeName}) => void | Promise<void>;
}

/**
 * Визард: узлы шагов из схемы → шаги ui-kit \`FormWizard\`. Отрисовку тела шага даём пропом
 * \`renderStepBody\` — ui-kit намеренно не зависит от \`@reformer/renderer-react\`.
 */
export function Wizard({ form, steps = [], className, onSubmit }: WizardProps): ReactNode {
  const wizardSteps: FormWizardStep<${n.TypeName}, RenderNode<${n.TypeName}>>[] = steps.map(
    (node, i) => ({
      number: i + 1,
      title: node.componentProps?.title ?? \`Шаг \${i + 1}\`,
      icon: node.componentProps?.icon,
      body: node as any,
    })
  );

  return (
    <FormWizard<${n.TypeName}, RenderNode<${n.TypeName}>>
      form={form as FormProxy<${n.TypeName}>}
      className={className}
      steps={wizardSteps}
      config={{}}
      renderStepBody={(body, wizardForm) => <RenderNodeComponent node={body} form={wizardForm} />}
      onSubmit={onSubmit ? () => onSubmit(form?.getValue() as ${n.TypeName}) : undefined}
    />
  );
}

// Контракт с рендерером: получить \`form\` пропом и сырые \`steps\`, без обхода детей.
(Wizard as any).__selfManagedChildren = true;

export interface StepProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Тело шага — компонент под \`$component(Step)\`. Маркер: \`title\`/\`icon\` из его
 * \`componentProps\` снимает \`Wizard\` выше, сюда доезжает только вёрстка.
 */
export function Step({ className, children }: StepProps): ReactNode {
  return <div className={className}>{children}</div>;
}
`;
}
