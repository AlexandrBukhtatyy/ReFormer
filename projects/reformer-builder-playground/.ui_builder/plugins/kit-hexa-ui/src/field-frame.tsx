/**
 * Рамка поля (`kit.infra.fieldFrame`) на визуальной базе HexaUI `Field` — без узла формы.
 *
 * `FormField` кита берёт подпись, обязательность и ошибку из `FieldNode` `@reformer/core`; рамке всё
 * приходит пропсами контракта SDK (`KitFieldFrameProps`). В неё кладут контрол, которым управляет не
 * ReFormer: тема RJSF строит на ней шаблон поля.
 *
 * HexaUI `Field` принимает контрол ПРОПОМ `control`, а описание и сообщение — только строками.
 * Поэтому описание-строка уходит в `description`, иное описание — в `additionalComponent`, а
 * несколько ошибок склеиваются в одно сообщение.
 *
 * `className` доходит до корня `Field` — по нему билдер находит узел кликом и подсвечивает
 * выделенный.
 *
 * @module reformer/kit-hexa-ui/field-frame
 */

import * as React from 'react';
import { Field } from '@kaspersky/hexa-ui';
import type { KitFieldFrameProps } from '@reformer/builder-plugin-api';

/** Пропсы рамки — ровно контракт SDK: стек, кладущий в рамку свой контрол, знает только их. */
export type FieldFrameProps = KitFieldFrameProps;

export function FieldFrame({
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
  // Одинаковые сообщения от разных правил человеку не нужны дважды — как у `FieldFrame` ui-kit.
  const messages = [...new Set(errors ?? [])].filter((message) => message !== '');
  const message = messages.length === 0 ? undefined : messages.join('; ');
  const textDescription = typeof description === 'string' ? description : undefined;
  const nodeDescription =
    description === undefined || description === null || typeof description === 'string'
      ? undefined
      : description;

  return (
    <Field
      className={className}
      // Контрол, подписывающий себя сам (чекбокс), верхнюю подпись не получает.
      label={inlineLabel ? undefined : label}
      required={required}
      message={message}
      messageMode={message === undefined ? undefined : 'error'}
      description={textDescription}
      additionalComponent={nodeDescription}
      control={<>{children}</>}
    />
  );
}
