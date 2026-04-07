import React, { forwardRef, useImperativeHandle, useRef, type ForwardedRef } from 'react';
import {
  FormWizard as FormWizardHeadless,
  type FormWizardActionsProps,
  type FormWizardHandle,
  type FormWizardProps as FormWizardHeadlessProps,
  type FormWizardIndicatorStep,
} from '@reformer/cdk/form-wizard';
import { FormWizardProgress } from './FormWizardProgress';
import { StepIndicator } from './StepIndicator';
import { FormWizardActions } from './FormWizardActions';

type FormValue = Record<string, unknown>;

export interface FormWizardProps<T extends FormValue> extends FormWizardHeadlessProps<T> {
  className?: string;
  steps: FormWizardIndicatorStep[];
  onSubmit: FormWizardActionsProps['onSubmit'];
}

function FormWizardInner<T extends FormValue>(
  props: FormWizardProps<T>,
  ref: ForwardedRef<FormWizardHandle<T>>
) {
  const formWizardRef = useRef<FormWizardHandle<T>>(null);

  useImperativeHandle(ref, () => formWizardRef.current as FormWizardHandle<T>);

  return (
    <>
      <FormWizardHeadless ref={formWizardRef} form={props.form} config={props.config}>
        {/* Индикатор шагов (headless) */}
        <FormWizardHeadless.Indicator steps={props.steps}>
          {(indicatorProps) => <StepIndicator {...indicatorProps} className="mb-8"></StepIndicator>}
        </FormWizardHeadless.Indicator>

        {/* Форма текущего шага */}
        <div className="bg-white p-8 rounded-lg shadow-md">
          {props.steps.map((step) =>
            // FIXME: В компонент передаются типа разные вещи из за чего возникают ошибки - нужно пофиксить (конкретно в рендерере компонент оборачивается в RenderNode)
            typeof step.component === 'function' ? (
              <FormWizardHeadless.Step
                key={step.number}
                component={step.component}
                control={props.form}
              />
            ) : (
              <FormWizardHeadless.Step key={step.number}>{step.component}</FormWizardHeadless.Step>
            )
          )}
        </div>

        {/* Кнопки навигации (render props API) */}
        <FormWizardHeadless.Actions onSubmit={props.onSubmit}>
          {(actionsProps) => <FormWizardActions {...actionsProps} className="mt-8" />}
        </FormWizardHeadless.Actions>

        {/* Информация о прогрессе (headless) */}
        <FormWizardHeadless.Progress>
          {(progressProps) => <FormWizardProgress {...progressProps} className={'mt-4'} />}
        </FormWizardHeadless.Progress>
      </FormWizardHeadless>
    </>
  );
}

export const FormWizard = forwardRef(FormWizardInner) as <T extends FormValue>(
  props: FormWizardProps<T> & { ref?: React.Ref<FormWizardHandle<T>> }
) => React.ReactElement | null;
