/**
 * Визард ReFormer на общей разметке: шаги, проверку шага и переходы держит поток сборки
 * `createForm({ flow })`, разметку — общий `WizardShell`.
 *
 * `FlowWizard` — снимок потока `useFormFlow` (headless-путь «Шаги без визарда»,
 * packages/reformer/docs/llms/13-multi-step.md): «Далее» — `flow.next()` (правила текущего шага,
 * при замечаниях шаг не меняется), «Назад» — `flow.previous()`; неактивные шаги размонтированы.
 * Живую проверку шага после первого «Далее» включает опция сборки `liveAfterStep`
 * (./credit/form.ts).
 */
import type { ReactNode } from 'react';
import type { FormFlow } from '@reformer/core';
import { useFormFlow } from '@reformer/core/react';
import { WizardShell, type WizardStepTitle } from '../../shared/ui/wizard';

export interface FlowWizardProps {
  flow: FormFlow;
  /** Заголовки шагов в порядке потока. */
  steps: readonly WizardStepTitle[];
  /** Содержимое текущего шага по его id. */
  children: (stepId: string) => ReactNode;
}

export function FlowWizard({ flow, steps, children }: FlowWizardProps) {
  const { current, index } = useFormFlow(flow);
  return (
    <WizardShell
      step={index + 1}
      steps={steps}
      onPrev={() => flow.previous()}
      onNext={() => void flow.next()}
    >
      {children(current)}
    </WizardShell>
  );
}
