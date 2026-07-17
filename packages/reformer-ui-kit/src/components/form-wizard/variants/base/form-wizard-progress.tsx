/**
 * FormWizardProgress — текстовый индикатор прогресса
 * («Шаг N из M • X% завершено»).
 *
 * Получает props через render-prop API из `<FormWizard.Progress>` слота.
 * Формат строки переопределяется через prop `format`.
 */

import type { FC, ReactNode } from 'react';
import type { FormWizardProgressRenderProps } from '@reformer/cdk/form-wizard';
import { cn } from '@/lib/utils';

/**
 * Пропсы {@link FormWizardProgress}: render-props прогресса из слота
 * `<FormWizard.Progress>` (`current`, `total`, `percent`) плюс `className` и
 * переопределяемый `format`.
 */
export interface FormWizardProgressProps extends FormWizardProgressRenderProps {
  /** Внешний CSS-класс контейнера. */
  className?: string;
  /**
   * Кастомный форматтер строки прогресса. Получает `{ current, total, percent }`.
   * По умолчанию — `'Шаг N из M • X% завершено'`.
   */
  format?: (props: FormWizardProgressRenderProps) => ReactNode;
}

const defaultFormat = ({ current, total, percent }: FormWizardProgressRenderProps): string =>
  `Шаг ${current} из ${total} • ${percent}% завершено`;

/**
 * Текстовый индикатор прогресса wizard'а — по умолчанию рендерит
 * «Шаг N из M • X% завершено». Формат строки переопределяется пропом `format`.
 *
 * Рендерится из headless-слота `<FormWizard.Progress>` через render-prop
 * (`current`/`total`/`percent` приходят автоматически). Готовый {@link FormWizard}
 * уже подключает этот компонент; напрямую нужен только для кастомной раскладки.
 *
 * @example Свой формат строки прогресса
 * ```tsx
 * <FormWizard.Progress>
 *   {(progress) => (
 *     <FormWizardProgress
 *       {...progress}
 *       format={({ current, total }) => `${current} / ${total}`}
 *     />
 *   )}
 * </FormWizard.Progress>
 * ```
 */
export const FormWizardProgress: FC<FormWizardProgressProps> = ({
  className,
  format = defaultFormat,
  ...renderProps
}) => {
  const classes = cn('text-center text-sm text-gray-600', className);
  return (
    <div data-slot="form-wizard-progress" className={classes}>
      {format(renderProps as FormWizardProgressRenderProps)}
    </div>
  );
};
