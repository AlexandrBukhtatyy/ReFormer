import * as React from 'react';

import { cn } from '@/lib/utils';
import { Field, FieldContent } from '@/components/field/variants/base/field-base';

/**
 * Props компонента {@link FieldFrame}.
 *
 * Форма совпадает с контрактом рамки поля SDK билдера (`KitFieldFrameProps`, блок
 * `kit.infra.fieldFrame` каталога): стек, который кладёт в рамку СВОЙ контрол, знает только эти
 * пропсы. Импорта из SDK нет намеренно — кит не зависит от билдера, совпадение держит тест.
 */
export interface FieldFrameProps {
  /** Идентификатор контрола — для `htmlFor` подписи. */
  id?: string;
  /** Подпись поля над контролом. */
  label?: React.ReactNode;
  /** Пояснение под контролом. */
  description?: React.ReactNode;
  /** Поле обязательно — к подписи добавляется `*`. */
  required?: boolean;
  /** Сообщения об ошибках; пусто — ошибок нет. */
  errors?: readonly string[];
  /** Контрол подписывает себя сам (чекбокс, переключатель) — верхняя подпись не рисуется. */
  inlineLabel?: boolean;
  /** Поле скрыто — рамка не рисует ничего. */
  hidden?: boolean;
  /** CSS-класс корневого элемента рамки. */
  className?: string;
  /** Контрол, который рамка обрамляет. */
  children?: React.ReactNode;
}

/**
 * Рамка поля: подпись, контрол, описание и ошибки — та же разметка, что у {@link FormField},
 * но без узла формы. `FormField` берёт всё это из `FieldNode` `@reformer/core`; рамке всё
 * приходит пропсами, поэтому в неё можно положить контрол, которым управляет не ReFormer
 * (тема RJSF строит на ней шаблон поля).
 *
 * `className` доходит до корневого элемента — по нему билдер находит узел кликом и подсвечивает
 * выделенный.
 */
function FieldFrame({
  id,
  label,
  description,
  required,
  errors,
  inlineLabel,
  hidden,
  className,
  children,
}: FieldFrameProps) {
  if (hidden) return null;
  // Одинаковые сообщения от разных правил человеку не нужны дважды — как у `FieldError`.
  const messages = [...new Set(errors ?? [])].filter((message) => message !== '');
  const invalid = messages.length > 0;
  const showLabel = !inlineLabel && label !== undefined && label !== null && label !== '';

  return (
    <Field data-invalid={invalid ? true : undefined} className={cn(className)}>
      {showLabel && (
        <label
          data-slot="field-label"
          htmlFor={id}
          className="flex w-fit items-center gap-2 text-sm leading-snug font-medium select-none group-data-[disabled=true]/field:opacity-50"
        >
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      <FieldContent>
        {children}
        {description ? (
          <p
            data-slot="field-description"
            className="text-sm leading-normal font-normal text-muted-foreground"
          >
            {description}
          </p>
        ) : null}
        {invalid && (
          <div
            role="alert"
            data-slot="field-error"
            className="text-sm font-normal text-destructive"
          >
            {messages.length === 1 ? (
              messages[0]
            ) : (
              <ul className="ml-4 flex list-disc flex-col gap-1">
                {messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </FieldContent>
    </Field>
  );
}

export { FieldFrame };
