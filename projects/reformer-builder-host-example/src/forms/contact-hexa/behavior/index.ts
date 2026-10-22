// behavior/index.ts — поведение формы: связи над моделью и правила узлов схемы.
// Ваш файл: правлен руками, при регенерации не затирается.

import { defineFormBehavior, onMount, type BehaviorScope } from '@reformer/core/behaviors';
import { notify } from '../../../notifications/notifications';
import { loadCityOptions } from '../../../services/cities';
import type { ContactHexaForm } from '../types/contact-hexa';

/** Правила поведения формы. Функцией — чтобы сборка добавила к ним отправку (application/create.ts). */
export function behaviorRules({ form, schema }: BehaviorScope<ContactHexaForm>): void {
  // Список городов — из API приложения, через его сервис: в схеме у поля опций нет.
  // Пропсы ПОЛЯ меняет его узел формы; `schema.node(…).patchProps` действует на контейнеры.
  onMount(schema.node('city'), () => {
    let cancelled = false;
    loadCityOptions().then(
      (cities) => {
        if (!cancelled) form.city.updateComponentProps({ options: cities });
      },
      (error: unknown) => {
        if (!cancelled) notify(error instanceof Error ? error.message : String(error), 'error');
      }
    );
    return () => {
      cancelled = true;
    };
  });
}

export const formBehavior = defineFormBehavior<ContactHexaForm>(behaviorRules);
