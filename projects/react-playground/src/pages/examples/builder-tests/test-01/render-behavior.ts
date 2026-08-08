/**
 * Поведение UI формы «test-01» — декларативные правила над деревом рендера (скрытие узлов,
 * патч пропсов, события, lifecycle) по selector'ам из form.json. Docs: @reformer/renderer-react
 * render-behavior. `form` берётся из замыкания фабрики или через getRef() wizard-узла.
 *
 * Ниже — шпаргалка частых случаев (раскомментируйте нужное + импорт хелпера).
 */
import type { RenderBehaviorFn } from '@reformer/renderer-react';
// import { hideWhen, renderEffect, onComponentEvent, onInit, onMount, onUnmount } from '@reformer/renderer-react';
import type { FormShape } from './model';

export const formRenderBehavior: RenderBehaviorFn<FormShape> = (schema) => {
  // Скрыть узел по условию (реактивно — читай сигнал целиком):
  // hideWhen(schema.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');

  // Патч пропсов узла при инициализации (напр. инъекция конфига валидации в wizard):
  // onInit(schema.node('wizard'), () => schema.node('wizard').patchProps({ ...config }));

  // Обработчик проп-события компонента (onSubmit и т.п.):
  // onComponentEvent(schema.node('wizard'), 'onSubmit', async (values) => { await submit(values); });

  // Реактивный эффект на уровне всего дерева (первый аргумент — СХЕМА, не узел):
  // renderEffect(schema, () => { if (form.done.value.value) goToLastStep(); });

  // Lifecycle узла (onMount может вернуть cleanup):
  // onMount(schema.node('data'), () => { void load(); return () => cleanup(); });
  // onUnmount(schema.node('wizard'), () => console.log('unmounted'));

  void schema;
};
