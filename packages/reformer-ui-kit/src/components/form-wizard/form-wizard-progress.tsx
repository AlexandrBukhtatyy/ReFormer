/**
 * FormWizardProgress — текстовый индикатор прогресса
 * («Шаг N из M • X% завершено»).
 *
 * Получает props через render-prop API из `<FormWizard.Progress>` слота.
 * Формат строки переопределяется через prop `format`.
 */

import type { FC, ReactNode } from 'react';
import type { FormWizardProgressRenderProps } from '@reformer/cdk/form-wizard';
import { cn } from '../../lib/utils';

/* eslint-disable @typescript-eslint/no-unused-vars */

export interface FormWizardProgressProps extends FormWizardProgressRenderProps {
  className?: string;
  format?: (props: FormWizardProgressRenderProps) => ReactNode;
}

const defaultFormat = ({ current, total, percent }: FormWizardProgressRenderProps): string =>
  `Шаг ${current} из ${total} • ${percent}% завершено`;

export const FormWizardProgress: FC<FormWizardProgressProps> = ({
  className,
  format = defaultFormat,
  ...renderProps
}) => {
  const classes = cn('text-center text-sm text-gray-600', className);
  return <div className={classes}>{format(renderProps as FormWizardProgressRenderProps)}</div>;
};
