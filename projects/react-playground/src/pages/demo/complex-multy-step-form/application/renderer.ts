/**
 * Связка заявки с узлами схемы — для вариантов, где форму рисует рендерер.
 *
 * Загрузка, отправка и навигация по визарду записаны как правила узлов (`schema.node(selector)`);
 * исполняет их рендерер. В варианте «React руками» рендерера нет — там то же самое делает JSX
 * страницы, а общими остаются `load`, `mapping` и `submit`.
 */

import type { FormBundle } from '@reformer/core';
import {
  defineFormBehavior,
  onComponentEvent,
  onMount,
  onUnmount,
  renderEffect,
  type BehaviorScope,
} from '@reformer/core/behaviors';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import { creditApplicationRules } from '../behavior';
import { isMortgage } from '../model/predicates';
import type { CreditApplicationForm } from '../types/credit-application';
import { loadCreditApplication } from './load';
import { applyCreditApplication } from './mapping';
import { reportSubmitOutcome, sendCreditApplication } from './submit';

/** Что нужно связке от места подключения. */
interface RendererOptions {
  /** Идентификатор заявки, которую загружает экран. */
  applicationId: string;
}

/**
 * Записать правила узлов заявки: загрузку, отправку и навигацию.
 *
 * @param scope - Модель, форма и корневая область схемы — область поведения либо то же самое,
 *   собранное из бандла ({@link rendererSetup}).
 */
export function wireRenderer(
  scope: BehaviorScope<CreditApplicationForm>,
  { applicationId }: RendererOptions
): void {
  const { model, schema } = scope;
  const boundary = schema.node('data-boundary');
  const wizard = schema.node('wizard');

  // Загрузка заявки: статус и текст ошибки показывает AsyncBoundary
  const loadApplication = async () => {
    boundary.patchProps({ status: 'loading', error: null });
    try {
      applyCreditApplication(scope, await loadCreditApplication(applicationId));
      boundary.patchProps({ status: 'ready' });
    } catch (error) {
      // Текст ошибки уходит в пропсы: пользователь должен видеть, что именно не загрузилось.
      boundary.patchProps({
        status: 'error',
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        onRetry: () => void loadApplication(),
      });
    }
  };
  onMount(boundary, () => {
    void loadApplication();
  });

  // Отправка: визард зовёт обработчик только после успешной валидации
  onComponentEvent(wizard, 'onSubmit', async (values: CreditApplicationForm) => {
    reportSubmitOutcome(await sendCreditApplication(values));
  });

  // Навигация через ref визарда: эффект запускается после монтирования
  const wizardRef = wizard.getRef<FormWizardHandle<CreditApplicationForm>>();
  renderEffect(schema, () => {
    if (isMortgage(model.loanType)) wizardRef.current?.goToStep(1);
  });

  // Хуки жизненного цикла узла (демонстрация)
  onMount(wizard, () => {
    console.log('[credit-application] wizard mounted');
    return () => console.log('[credit-application] wizard cleanup from onMount');
  });
  onUnmount(wizard, () => {
    console.log('[credit-application] wizard unmounted');
  });
}

/**
 * Связка для сборки `createForm` — поле `setup`: правила пишутся в корневую область бандла.
 *
 * @example
 * ```ts
 * createCreditApplication({ setup: rendererSetup({ applicationId: '1' }) });
 * ```
 */
export const rendererSetup =
  (options: RendererOptions) =>
  (bundle: FormBundle<CreditApplicationForm>): void =>
    wireRenderer(
      {
        model: bundle.model,
        form: bundle.form,
        schema: bundle.render.controller.scopeOf(bundle.model),
      },
      options
    );

/**
 * Поведение заявки вместе со связкой узлов — для записи реестра форм. Там сборку выполняет
 * реестр, поля `setup` у записи нет, и правила узлов доезжают до формы только поведением.
 */
export const creditApplicationRegistryBehavior = (options: RendererOptions) =>
  defineFormBehavior<CreditApplicationForm>((scope) => {
    creditApplicationRules(scope);
    wireRenderer(scope, options);
  });
