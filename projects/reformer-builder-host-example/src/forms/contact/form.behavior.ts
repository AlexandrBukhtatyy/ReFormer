// form.behavior.ts — реактивное поведение модели (вычисляемые поля, enableWhen, copyFrom).
// МОК: заготовка, реализуйте по необходимости. Пишется один раз.

import { defineFormBehavior } from '@reformer/core/behaviors';
import type { ContactForm } from './types';

export const formBehavior = defineFormBehavior<ContactForm>(() => {});
