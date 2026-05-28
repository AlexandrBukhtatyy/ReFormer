/**
 * ReFormer renderer-react — операторы поведения схемы рендера и их контракты.
 *
 * Шесть standalone-хелперов навешивают реактивные эффекты, условия и lifecycle на ноды:
 *   hideWhen, renderEffect, onComponentEvent, onInit, onMount, onUnmount
 * Подсхему можно вынести в отдельный RenderBehaviorFn<T> и встроить прямым вызовом —
 * apply/applyWhen у renderer-react нет, схема — это обычная функция (schema) => void.
 */
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import {
  hideWhen,
  onComponentEvent,
  onInit,
  onMount,
  onUnmount,
  renderEffect,
  type RenderBehaviorFn,
} from '@reformer/renderer-react';

type Order = {
  loanType: 'consumer' | 'mortgage';
  amount: number;
};

// onComponentEvent handler: контракт повторяет проп компонента
const submitOrder = async (values: Order) => {
  await fetch('/api/submit', { method: 'POST', body: JSON.stringify(values) });
};

// Подсхема — обычный RenderBehaviorFn<T>: (schema) => void.
// Применяется прямым вызовом из главной функции.
const visibilityRules: RenderBehaviorFn<Order> = (schema) => {
  const wizardRef = schema.node('wizard').getRef<FormWizardHandle<Order>>();
  // hideWhen — реактивно скрывает ноду, пока conditionFn() === true
  hideWhen(
    schema.node('mortgage-section'),
    () => wizardRef.current?.form.loanType.value.value !== 'mortgage'
  );
};

export const orderRender: RenderBehaviorFn<Order> = (schema) => {
  const wizardNode = schema.node('wizard');

  // hideWhen — реактивно скрывает ноду, пока conditionFn() === true
  hideWhen(schema.node('amount-hint'), () => {
    const ref = wizardNode.getRef<FormWizardHandle<Order>>();
    return !ref.current?.form.amount.value.value;
  });

  // renderEffect — реактивный side-effect (оборачивается в Preact effect())
  renderEffect(schema, () => {
    const ref = wizardNode.getRef<FormWizardHandle<Order>>();
    if (ref.current?.form.loanType.value.value === 'mortgage') {
      ref.current?.goToStep(1);
    }
  });

  // onComponentEvent — handler на проп-событие компонента (тот же контракт что у пропа)
  onComponentEvent(wizardNode, 'onSubmit', submitOrder);

  // onInit — build-time hook (синхронно один раз перед первым рендером)
  onInit(wizardNode, () => console.log('init'));

  // onMount — после mount ноды (опционально возвращает cleanup)
  onMount(wizardNode, () => {
    console.log('mounted');
    return () => console.log('cleanup');
  });

  // onUnmount — при unmount ноды
  onUnmount(wizardNode, () => console.log('unmounted'));

  // Выносимость: подсхема — обычный RenderBehaviorFn<T>, встраивается прямым вызовом
  visibilityRules(schema);
};
