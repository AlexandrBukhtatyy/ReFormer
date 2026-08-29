/**
 * Эмиттер `renderer.wizard.tsx` — прикладной шим под `$component(Wizard)` и тело шага.
 *
 * ## Зачем он вообще
 *
 * Кит компонент под `$component(Wizard)` не экспортирует: его `FormWizard` не умеет ни
 * JSON-шаги, ни рендер `RenderNode`, поэтому переходник пишет приложение — канон раскладки
 * держит под него опциональный файл `renderer.wizard.tsx`. Пока этого файла у кодогена не было,
 * экспорт визарда печатал `reg.component('Wizard', Placeholder)`, и выгруженная форма не
 * работала: шаги не рисовались, submit было некому послать.
 *
 * ## Что изменилось против v1
 *
 * Символ и его subpath берутся из `kit.adapters.wizard`, а не зашиты как
 * `@reformer/ui-kit/form-wizard`. Отсюда же следует новое честное поведение: **кит без адаптера
 * визарда шима не получает** — файл не печатается, а `registry.ts` регистрирует заглушку
 * с внятной причиной. Раньше в этом случае печатался импорт из чужого пакета, и форма
 * не собиралась у пользователя.
 *
 * @module reformer-builder/lib/codegen/emit/wizard
 */

import { isStepsHostName } from '../../form-model/node-kind';
import type { EmitContext } from '../context';

/** Имя, под которым в схеме лежит тело шага. */
export const STEP_NAME = 'Step';

/** Что именно уедет в шим и под какими именами он регистрируется. */
export interface WizardShim {
  /** Имена из схемы, которые обслуживает компонент `Wizard` шима. */
  readonly hostNames: readonly string[];
  /** Есть ли в схеме узел тела шага. */
  readonly hasStep: boolean;
  /** Символ компонента визарда в ките. */
  readonly symbol: string;
  /** Откуда его импортировать (спецификатор с учётом subpath). */
  readonly importFrom: string;
}

/**
 * Нужен ли форме шим визарда и можно ли его напечатать.
 *
 * `null` в двух разных случаях, и различать их вызывающему не нужно: визарда в схеме нет
 * либо кит не поставляет адаптера. В обоих случаях файла не будет, а разницу объясняет
 * `registry.ts` — там она видна на месте регистрации.
 */
export function wizardShimOf(ctx: EmitContext): WizardShim | null {
  const adapter = ctx.kit.kit.adapters.wizard;
  if (adapter === null || adapter === undefined) return null;

  const needsShim = ctx.kit.kit.codegen.needsShim;
  const hostNames = ctx.collected.components.filter(
    (name) => isStepsHostName(name) && needsShim.has(name)
  );
  if (hostNames.length === 0) return null;

  const specifier = ctx.kit.kit.codegen.importSpecifier;
  return {
    hostNames,
    hasStep: ctx.collected.components.includes(STEP_NAME),
    symbol: adapter.symbol,
    importFrom: adapter.subpath === undefined ? specifier : `${specifier}/${adapter.subpath}`,
  };
}

export function emitWizard(ctx: EmitContext): string {
  const shim = wizardShimOf(ctx);
  if (shim === null) {
    throw new Error(
      'emitWizard: шим визарда этой форме не нужен — цель не должна была примениться'
    );
  }
  const { TypeName } = ctx.names;
  const step = `\${i + 1}`;

  return `// renderer.wizard.tsx — шим под $component(Wizard) и тело шага. Регенерируется.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from 'react';
import { ${shim.symbol}, type FormWizardStep } from '${shim.importFrom}';
import type { FormProxy } from '@reformer/core';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import type { ${TypeName} } from './types';

/** Узел шага после конвертации: \`title\`/\`icon\` лежат в его \`componentProps\`. */
interface StepNode {
  componentProps?: { title?: string; icon?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface WizardProps {
  /** Приходит от рендерера (см. \`__selfManagedChildren\`). */
  form?: FormProxy<${TypeName}>;
  /** Узлы шагов из \`componentProps.steps\`. */
  steps?: StepNode[];
  className?: string;
  /** Вешается снаружи — renderer.behavior.ts через onComponentEvent(node, 'onSubmit'). */
  onSubmit?: (values: ${TypeName}) => void | Promise<void>;
}

/**
 * Визард: узлы шагов из схемы — в шаги кита. Отрисовку тела шага даём пропом
 * \`renderStepBody\`: кит намеренно не зависит от \`@reformer/renderer-react\`.
 */
export function Wizard({ form, steps = [], className, onSubmit }: WizardProps): ReactNode {
  const wizardSteps: FormWizardStep<${TypeName}, RenderNode<${TypeName}>>[] = steps.map(
    (node, i) => ({
      number: i + 1,
      title: node.componentProps?.title ?? \`Шаг ${step}\`,
      icon: node.componentProps?.icon,
      body: node as any,
    })
  );

  return (
    <${shim.symbol}<${TypeName}, RenderNode<${TypeName}>>
      form={form as FormProxy<${TypeName}>}
      className={className}
      steps={wizardSteps}
      config={{}}
      renderStepBody={(body, wizardForm) => <RenderNodeComponent node={body} form={wizardForm} />}
      onSubmit={onSubmit ? () => onSubmit(form?.getValue() as ${TypeName}) : undefined}
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
export function ${STEP_NAME}({ className, children }: StepProps): ReactNode {
  return <div className={className}>{children}</div>;
}
`;
}
