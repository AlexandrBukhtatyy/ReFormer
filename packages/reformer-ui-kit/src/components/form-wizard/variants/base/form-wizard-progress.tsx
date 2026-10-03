/**
 * FormWizardProgress — текстовый индикатор прогресса
 * («Step N of M • X% complete»; под русской локалью — «Шаг N из M • X% завершено»).
 *
 * Получает props через render-prop API из `<FormWizard.Progress>` слота.
 * Формат строки переопределяется через prop `format`.
 */

import type { FC, ReactNode } from 'react';
import type { FormWizardProgressRenderProps } from '@reformer/cdk/form-wizard';
import { useKitMessages } from '@/i18n/messages';
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
   * По умолчанию — строка `kit.formWizard.progress` из словаря локали.
   */
  format?: (props: FormWizardProgressRenderProps) => ReactNode;
}

/**
 * Текстовый индикатор прогресса wizard'а — по умолчанию рендерит строку из словаря локали
 * («Step N of M • X% complete»). Формат строки переопределяется пропом `format`.
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
  format,
  ...renderProps
}) => {
  const t = useKitMessages();
  const classes = cn('text-center text-sm text-muted-foreground', className);
  const progress = renderProps as FormWizardProgressRenderProps;
  return (
    <div data-slot="form-wizard-progress" className={classes}>
      {format
        ? format(progress)
        : t('kit.formWizard.progress', {
            current: progress.current,
            total: progress.total,
            percent: progress.percent,
          })}
    </div>
  );
};
