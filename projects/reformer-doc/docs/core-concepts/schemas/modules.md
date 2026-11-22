---
sidebar_position: 7
---

# Модуль группы

Группу полей, которая нужна во многих формах — контакты, адрес, платёжные данные, — удобно
оформить модулем: папкой с типом группы, частью схемы, правилами и поведением. Форма подключает
модуль к своей группе — по одной строке на разметку, правила и поведение.

## Когда нужно

- Одна и та же группа полей встречается во многих формах приложения.
- У группы есть свои правила и поведение, и их нельзя забыть подключить вместе с разметкой.

Как устроены файлы одной формы — в [Структуре проекта](/docs/patterns/project-structure).

## Минимальный пример

```
modules/contact-info/
├── schema.ts       # тип группы и часть схемы
├── validation.ts   # правила группы
├── behavior.ts     # поведение группы
└── index.ts        # что модуль отдаёт наружу
```

```typescript title="modules/contact-info/schema.ts"
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

export type ContactInfo = { email: string; phone: string };

export const contactInfoPart = (m: FormModel<ContactInfo>): FormSchemaNode => ({
  children: [
    { model: m.$.email, component: Input, componentProps: { label: 'Email', type: 'email' } },
    { model: m.$.phone, component: Input, componentProps: { label: 'Телефон', type: 'tel' } },
  ],
});
```

```typescript title="modules/contact-info/validation.ts"
import { defineValidation, validate } from '@reformer/core/validation';
import { email, pattern, required } from '@reformer/core/validators';
import type { ContactInfo } from './schema';

export const contactInfoRules = defineValidation<ContactInfo>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.phone, [required(), pattern(/^\+?\d{10,15}$/, { code: 'phone.pattern' })]);
});
```

```typescript title="modules/contact-info/behavior.ts"
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';
import type { ContactInfo } from './schema';

export const contactInfoBehavior = defineFormBehavior<ContactInfo>(({ model }) => {
  // Убираем пробелы и скобки, которые часто вставляют вместе с номером.
  transformValue(model.$.phone, (value) => value.replace(/[\s()-]/g, ''));
});
```

```typescript title="modules/contact-info/index.ts"
export { contactInfoPart, type ContactInfo } from './schema';
export { contactInfoRules } from './validation';
export { contactInfoBehavior } from './behavior';
```

Подключение к форме — разметка, правила и поведение, каждое своим оператором:

```typescript
import { createForm } from '@reformer/core';
import { apply, defineFormBehavior } from '@reformer/core/behaviors';
import { apply as applyRules, defineValidation } from '@reformer/core/validation';
import {
  contactInfoBehavior,
  contactInfoPart,
  contactInfoRules,
  type ContactInfo,
} from './modules/contact-info';

type Application = { contacts: ContactInfo };

const application = createForm<Application>({
  initial: { contacts: { email: '', phone: '' } },
  schema: (model) => ({ children: [{ model: model.$.contacts, part: contactInfoPart }] }),
  validation: defineValidation<Application>(({ model }) => {
    applyRules(model.$.contacts, contactInfoRules);
  }),
  behavior: defineFormBehavior<Application>(({ model }) => {
    apply(model.$.contacts, contactInfoBehavior);
  }),
});
```

## Где хранить общие куски

Модули и общие поля живут отдельно от форм, которые их используют:

```
src/
├── forms/              # формы приложения: по папке на форму
├── modules/            # группы целиком: разметка + правила + поведение
│   ├── contact-info/
│   └── address/
└── shared/             # мелкие общие куски
    ├── fields.ts       # функции полей: emailField, phoneField
    └── rules.ts        # наборы правил: nameRules, zipRules
```

Модуль не знает, к какой форме его подключат: он описан над типом своей группы. Поэтому его можно
проверить отдельно от форм.

## Проверка модуля отдельно

Правила модуля прогоняет `runValidation` — без формы и без компонентов:

```typescript
import { createModel } from '@reformer/core';
import { runValidation } from '@reformer/core/validation';
import { contactInfoRules } from './modules/contact-info';

it('требует email', async () => {
  const model = createModel({ email: '', phone: '+79990000000' });

  const result = await runValidation(model, contactInfoRules);

  expect(result.status).toBe('invalid');
  expect(result.issues.get(model.$.email)?.[0]?.code).toBe('required');
});
```

## Подводные камни

- **Подключайте все три части.** Разметка без правил даст форму без проверки, правила без разметки —
  замечания у полей, которых не видно. `index.ts` модуля помогает не забыть ни одну.
- **Экспортируйте тип группы вместе с частью.** Форма объявляет свою группу этим типом — и TypeScript
  проверит, что модуль подключён к подходящей группе.
- **Правила — константа модуля.** Схему правил создают один раз; сборка отменяет устаревшие проверки
  по ссылке на неё.

## См. также

- [Повторяющиеся группы](./composition.md) — `part`, `apply` и `applyEach` подробно.
- [Общие поля и правила](./shared-parts.md) — мелкие общие куски: поля и наборы правил.
- [Структура проекта](/docs/patterns/project-structure) — файлы одной формы.
