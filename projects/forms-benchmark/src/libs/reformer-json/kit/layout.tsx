/**
 * Контейнеры реестра renderer-json для многошаговых форм — на общей разметке (`shared/ui`):
 *
 * - `Wizard` — визард: `__selfManagedChildren` (renderer-react 02-render-schema.md) — рендерер
 *   отдаёт ему узлы шагов данными и `renderNode`; поток шагов визард берёт из сборки в контексте
 *   (`useFormBundleContext`), как `FormWizard` из ui-kit (renderer-json 07-form-wizard.md), разметку
 *   и переходы — `FlowWizard` (../../reformer-kit/wizard.tsx). Заголовок шага — `title` узла шага.
 * - `ArraySection` — компонент массива под-форм: рендерер итерирует строки сам и отдаёт их пропом
 *   `items` с колбэками `onAdd`/`onRemove` (`ArrayComponentProps`), компонент только оформляет их
 *   общими `ArrayFrame`/`ArrayRow`. Путь DOM-контракта поля строки (`properties-0-description`)
 *   рендерер выводит из живого пути поля в модели — он следует за индексом строки.
 * - `Group` — контейнер без своей разметки: корень части документа (адрес, строка массива), чтобы
 *   поля стояли прямо в секции, как в эталонной разметке.
 */
import type { Key, ReactNode } from 'react';
import { useFormBundleContext } from '@reformer/core/react';
import type { ArrayComponentProps } from '@reformer/renderer-react';
import { ArrayFrame, ArrayRow } from '../../../shared/ui/array';
import { FlowWizard } from '../../reformer-kit/wizard';

interface StepNode {
  selector?: string;
  props?: { title?: string };
}

interface WizardProps {
  children?: readonly StepNode[];
  renderNode: (node: StepNode, key?: Key) => ReactNode;
}

export function Wizard({ children = [], renderNode }: WizardProps) {
  const flow = useFormBundleContext()?.flow;
  if (!flow) throw new Error('Wizard: нет потока шагов — createForm({ flow })');
  const steps = children.map((node) => ({ title: node.props?.title ?? '' }));
  return (
    <FlowWizard flow={flow} steps={steps}>
      {(stepId) => {
        const node = children.find((child) => child.selector === stepId);
        return node ? renderNode(node, stepId) : null;
      }}
    </FlowWizard>
  );
}
Wizard.__selfManagedChildren = true;

interface ArraySectionProps extends ArrayComponentProps {
  /** Путь массива DOM-контракта. */
  path: string;
  title: string;
  rowTitle: string;
  addLabel: string;
}

export function ArraySection({
  items,
  onAdd,
  onRemove,
  path,
  title,
  rowTitle,
  addLabel,
}: ArraySectionProps) {
  return (
    <ArrayFrame path={path} title={title} addLabel={addLabel} onAdd={onAdd}>
      {items.map((item) => (
        <ArrayRow
          key={item.key}
          path={path}
          index={item.index}
          title={rowTitle}
          onRemove={() => onRemove(item.index)}
        >
          {item.children}
        </ArrayRow>
      ))}
    </ArrayFrame>
  );
}

export function Group({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
