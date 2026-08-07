/**
 * Builder-адаптер визарда для Runtime-preview: рисует ЖИВОЙ ui-kit `FormWizard` из JSON-узла
 * `$component(Wizard)` (спека §9). Аналог golden-шима `RendererFormWizard`
 * (`projects/react-playground/src/components/RendererFormWizard.tsx`), но для data-only превью —
 * без валидации и submit.
 *
 * Как работает: узел визарда держит шаги в `componentProps.steps[]` (каждый шаг — `$component(Step)`
 * с `componentProps.title/icon` и `children`). Конвертер renderer-json уже превратил эти шаги в
 * RenderNode-узлы (рекурсивно обходит `componentProps`), поэтому сюда `props.steps` приходят готовыми
 * узлами. Мы поднимаем `title`/`icon` на уровень шага, кладём сам узел шага в `body` и передаём
 * стратегию `renderStepBody` — ui-kit `FormWizard` намеренно не знает про `@reformer/renderer-react`
 * (дизайн-система от рендерера не зависит), поэтому отрисовку узла инъектим здесь, прокидывая
 * `form` (живые поля тела шага).
 *
 * `form` берём из builder-контекста {@link useWizardForm} (реальный `FormProxy` из `buildPreview`),
 * с override из `props.form`, если рендерер его инъектит в self-managed компонент. Через штатный
 * render-context формы нет: `FormRenderer` кладёт туда только `settings`.
 *
 * @module reformer-builder/preview-runtime/wizard-preview
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentType, ReactNode } from 'react';
import type { FormProxy } from '@reformer/core';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import { useWizardForm } from './wizard-form-context';

/** Форма модели превью — гетерогенная, поэтому `Record<string, unknown>`. */
type PreviewForm = Record<string, unknown>;

/**
 * Компонент пошаговой формы из кита. Тип структурный, а не `FormWizard` из `@reformer/ui-kit`:
 * адаптер не должен знать, какой кит активен — конкретный компонент ему передаёт
 * `known-components`, взяв его из namespace по `descriptor.adapters.wizard.symbol`.
 */
export type KitFormWizard = ComponentType<{
  form: unknown;
  steps: Array<{ number: number; title: string; icon?: string; body: unknown }>;
  config: Record<string, unknown>;
  renderStepBody: (body: any, form: any) => ReactNode;
  onSubmit: () => void;
}>;

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
 * Собрать адаптер визарда поверх компонента пошаговой формы активного кита.
 *
 * Фабрика, а не готовый компонент: `FormWizard` приходит из namespace кита, поэтому модуль
 * остаётся кит-агностичным. Кит без пошаговой формы (`descriptor.adapters.wizard === null`)
 * адаптер просто не получает — синтетические записи `Wizard`/`Step` тогда не резолвятся и
 * деградируют в стаб штатным путём политики рендера.
 */
export function createWizardPreview(FormWizard: KitFormWizard): ComponentType<WizardPreviewProps> {
  /**
   * Живой предпросмотр визарда. Пустой список шагов допустим (только что вставленный/очищенный
   * визард) — рисуем `FormWizard` без шагов, без падений.
   */
  function WizardPreview(props: WizardPreviewProps): ReactNode {
    const contextForm = useWizardForm();
    const form = props.form ?? (contextForm as FormProxy<PreviewForm> | undefined);
    const rawSteps = props.steps ?? [];

    const steps = rawSteps.map((node, i) => ({
      number: i + 1,
      title: node.componentProps?.title ?? `Шаг ${i + 1}`,
      icon: node.componentProps?.icon,
      // Узел шага целиком → body; отрисует его стратегия `renderStepBody` ниже.
      body: node as unknown,
    }));

    // `className` (в превью — класс-токен узла) вешаем на собственную обёртку: ui-kit `FormWizard`
    // проп объявляет, но не применяет — иначе узел визарда нельзя было бы выделить кликом.
    return (
      <div className={props.className}>
        <FormWizard
          form={form}
          steps={steps}
          config={{}}
          renderStepBody={(body: RenderNode<PreviewForm>, wizardForm: FormProxy<PreviewForm>) => (
            <RenderNodeComponent node={body} form={wizardForm} />
          )}
          onSubmit={() => {}}
        />
      </div>
    );
  }

  // Контракт с рендерером: получить `form` пропом и сырые `steps`/children без рекурсивного обхода.
  (WizardPreview as any).__selfManagedChildren = true;
  return WizardPreview;
}
