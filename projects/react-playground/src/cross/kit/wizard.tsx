/**
 * Визард кита кросс-фреймворк проверки: шапка — `StepIndicator` ui-kit, кнопки — `Button`, шаги и
 * переходы — поток сборки `createForm({ flow })`.
 *
 * Готовый `FormWizard` ui-kit не берётся: у DOM-контракта свои testid и правила кнопок — `btn-prev`
 * есть и на первом шаге (выключена: кнопки не сдвигаются между шагами), заголовок текущего шага —
 * `step-current` с номером в `data-step`.
 */
import type { Key, ReactNode } from 'react';
import { useFormBundleContext, useFormFlow } from '@reformer/core/react';
import { Button, StepIndicator } from '@reformer/ui-kit';

/** Узел шага, как его отдаёт рендерер компоненту, который ведёт детей сам. */
interface StepNode {
  /** Идентификатор шага потока. */
  selector?: string;
  props?: { title?: string };
}

interface WizardProps {
  children?: readonly StepNode[];
  renderNode: (node: StepNode, key?: Key) => ReactNode;
}

/**
 * Визард: рендерер отдаёт ему узлы шагов данными и `renderNode`, поток шагов он берёт из сборки в
 * контексте. «Далее» — `flow.next()`: правила текущего шага, при замечаниях шаг не меняется;
 * «Назад» — `flow.previous()`. Рисуется только текущий шаг.
 */
export function Wizard({ children = [], renderNode }: WizardProps): ReactNode {
  const flow = useFormBundleContext()?.flow;
  if (!flow) throw new Error('Wizard: у сборки нет потока шагов — createForm({ flow })');
  const { current, index, completed, isFirst, isLast } = useFormFlow(flow);

  const currentNode = children.find((node) => node.selector === current);
  const steps = children.map((node, position) => ({
    number: position + 1,
    // Шагов шесть, заголовки длинные: в шапке — номера, заголовок текущего шага — под ней.
    title: '',
    isCurrent: node.selector === current,
    isCompleted: node.selector !== undefined && completed.has(node.selector),
    // Переходы — только кнопками: шаг вперёд открывает проверка текущего.
    canNavigate: false,
  }));

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator
        steps={steps}
        currentStep={index + 1}
        totalSteps={steps.length}
        completedSteps={steps.filter((step) => step.isCompleted).map((step) => step.number)}
        goToStep={() => false}
        navAriaLabel="Шаги заявки"
        stepAriaLabel={(step) => `Шаг ${step.number}: ${children[step.number - 1]?.props?.title}`}
      />
      <h2 className="text-lg font-semibold" data-testid="step-current" data-step={index + 1}>
        {`Шаг ${index + 1} из ${children.length}. ${currentNode?.props?.title ?? ''}`}
      </h2>
      {currentNode ? renderNode(currentNode, current) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          data-testid="btn-prev"
          disabled={isFirst}
          onClick={() => flow.previous()}
        >
          Назад
        </Button>
        {/* Ключи разные: тот же элемент, ставший `type="submit"` посреди клика по «Далее»,
            отправил бы форму. */}
        {isLast ? (
          <Button key="submit" type="submit" data-testid="btn-submit">
            Отправить
          </Button>
        ) : (
          <Button key="next" type="button" data-testid="btn-next" onClick={() => void flow.next()}>
            Далее
          </Button>
        )}
      </div>
    </div>
  );
}
Wizard.__selfManagedChildren = true;

/** Шаг визарда: рисует своих детей; `title` узла читает визард. */
export function Step({ children }: { children?: ReactNode }): ReactNode {
  return <div className="flex flex-col gap-4">{children}</div>;
}
