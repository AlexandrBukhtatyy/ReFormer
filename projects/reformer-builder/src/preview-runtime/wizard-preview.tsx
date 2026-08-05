/**
 * Builder-адаптер визарда для Runtime-preview: рисует ЖИВОЙ ui-kit `FormWizard` из JSON-узла
 * `$component(Wizard)` (спека §9). Аналог golden-шима `RendererFormWizard`
 * (`projects/react-playground/src/components/RendererFormWizard.tsx`), но для data-only превью —
 * без валидации и submit.
 *
 * Как работает: узел визарда держит шаги в `componentProps.steps[]` (каждый шаг — `$component(Step)`
 * с `componentProps.title/icon` и `children`). Конвертер renderer-json уже превратил эти шаги в
 * RenderNode-узлы (рекурсивно обходит `componentProps`), поэтому сюда `props.steps` приходят готовыми
 * узлами. Мы поднимаем `title`/`icon` на уровень шага и кладём сам узел шага в `body` — ui-kit
 * `renderStepBody` увидит объект с `.component` и отрисует его через `RenderNodeComponent`, прокинув
 * `form` (живые поля тела шага).
 *
 * `form` берём из builder-контекста {@link useWizardForm} (реальный `FormProxy` из `buildPreview`),
 * с override из `props.form`, если рендерер его инъектит в self-managed компонент. Через штатный
 * render-context формы нет: `FormRenderer` кладёт туда только `settings`.
 *
 * @module reformer-builder/preview-runtime/wizard-preview
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from 'react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormProxy } from '@reformer/core';
import { useWizardForm } from './wizard-form-context';

/** Форма модели превью — гетерогенная, поэтому `Record<string, unknown>`. */
type PreviewForm = Record<string, unknown>;

/** Шаг после конвертации: узел-объект с поднимаемыми `title`/`icon` в `componentProps`. */
interface StepNodeLike {
  componentProps?: { title?: string; icon?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** Пропсы адаптера: `steps` из `componentProps.steps`, `form` инъектится рендерером. */
interface WizardPreviewProps {
  steps?: StepNodeLike[];
  form?: FormProxy<PreviewForm>;
  className?: string;
}

/**
 * Живой предпросмотр визарда. Пустой список шагов допустим (только что вставленный/очищенный
 * визард) — рисуем ui-kit `FormWizard` без шагов, без падений.
 */
export function WizardPreview(props: WizardPreviewProps): ReactNode {
  const contextForm = useWizardForm();
  const form = props.form ?? (contextForm as FormProxy<PreviewForm> | undefined);
  const rawSteps = props.steps ?? [];

  const steps: FormWizardStep<PreviewForm>[] = rawSteps.map((node, i) => ({
    number: i + 1,
    title: node.componentProps?.title ?? `Шаг ${i + 1}`,
    icon: node.componentProps?.icon,
    // Узел шага целиком → body; ui-kit `renderStepBody` отрисует его как RenderNode.
    body: node as any,
  }));

  // `className` (в превью — класс-токен узла) вешаем на собственную обёртку: ui-kit `FormWizard`
  // проп объявляет, но не применяет — иначе узел визарда нельзя было бы выделить кликом.
  return (
    <div className={props.className}>
      <FormWizard<PreviewForm>
        form={form as FormProxy<PreviewForm>}
        steps={steps}
        config={{}}
        onSubmit={() => {}}
      />
    </div>
  );
}

// Контракт с рендерером: получить `form` пропом и сырые `steps`/children без рекурсивного обхода.
(WizardPreview as any).__selfManagedChildren = true;
