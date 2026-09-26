/**
 * Шаблоны RJSF из компонентов кита: поле — в рамке поля кита, объект — в его контейнере, отправка —
 * его кнопкой.
 *
 * Рамка поля (`kit.infra.fieldFrame`) — та же разметка, что у обёртки поля ReFormer, но без узла
 * формы: подпись, обязательность, описание и ошибки приходят пропсами. Кит без рамки получает
 * минимальную собственную — подпись, контрол, описание, ошибки: стандартный шаблон RJSF не знает,
 * что контрол кита подписывает себя сам, и подпись флажка вышла бы дважды.
 *
 * @module @reformer/rjsf-kit-theme/templates
 */

import { Fragment, type ComponentType, type ReactNode } from 'react';
import {
  ADDITIONAL_PROPERTY_FLAG,
  buttonId,
  canExpand,
  getSubmitButtonOptions,
  type FieldTemplateProps,
  type ObjectFieldTemplateProps,
  type SubmitButtonProps,
} from '@rjsf/utils';
import type { KitFieldFrameProps } from './types';

type Frame = ComponentType<KitFieldFrameProps>;

const joinClasses = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ');

/** Рамка поля, когда у кита своей нет. */
export function PlainFieldFrame({
  id,
  label,
  description,
  required,
  errors,
  inlineLabel,
  hidden,
  className,
  children,
}: KitFieldFrameProps): ReactNode {
  if (hidden === true) return null;
  const messages = [...new Set(errors ?? [])].filter((message) => message !== '');
  const showLabel = inlineLabel !== true && label !== undefined && label !== null && label !== '';
  return (
    <div className={joinClasses('flex flex-col gap-1', className)}>
      {showLabel && (
        <label htmlFor={id} className="text-sm font-medium">
          {label as ReactNode}
          {required === true && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {children as ReactNode}
      {description !== undefined && description !== null && description !== '' && (
        <p className="text-sm text-muted-foreground">{description as ReactNode}</p>
      )}
      {messages.length > 0 && (
        <ul role="alert" className="text-sm text-destructive">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Короткие имена `ui:widget`, у которых контрол может подписывать себя сам, — к имени виджета. */
const WIDGET_ALIASES: Readonly<Record<string, string>> = {
  checkbox: 'CheckboxWidget',
  radio: 'RadioWidget',
  select: 'SelectWidget',
};

/** Имя виджета поля в реестре: `ui:widget` или флажок по умолчанию у `boolean`. */
function widgetName({ schema, uiSchema }: FieldTemplateProps): string | undefined {
  const named = uiSchema?.['ui:widget'];
  if (typeof named === 'string') return WIDGET_ALIASES[named] ?? named;
  return schema.type === 'boolean' ? 'CheckboxWidget' : undefined;
}

/**
 * Шаблон поля на рамке кита.
 *
 * @param inlineWidgets виджеты реестра, чей контрол подписывает себя сам: верхней подписи им не надо
 */
export function createFieldTemplate(
  frame: Frame | undefined,
  inlineWidgets: ReadonlySet<string>
): ComponentType<FieldTemplateProps> {
  const Frame = frame ?? PlainFieldFrame;
  function KitFieldTemplate(props: FieldTemplateProps): ReactNode {
    const {
      id,
      label,
      displayLabel,
      rawDescription,
      rawHelp,
      rawErrors,
      hidden,
      hideError,
      required,
      classNames,
      children,
      schema,
      registry,
    } = props;
    if (hidden === true) return <div className="hidden">{children}</div>;
    // Объект и массив — контейнеры: подпись, описание и ошибки у них рисует свой шаблон.
    if (schema.type === 'object' || schema.type === 'array') return children;
    const additional = ADDITIONAL_PROPERTY_FLAG in schema;
    const widget = widgetName(props);
    const description = [rawDescription, rawHelp].filter(Boolean).join(' ');
    const framed = (
      <Frame
        id={id}
        label={displayLabel === true ? label : undefined}
        description={description === '' ? undefined : description}
        required={required}
        errors={hideError === true ? [] : (rawErrors ?? [])}
        inlineLabel={widget !== undefined && inlineWidgets.has(widget)}
        className={additional ? undefined : classNames}
      >
        {children}
      </Frame>
    );
    if (!additional) return framed;
    // Свойство из `additionalProperties`: ключ правится и удаляется обёрткой RJSF.
    const { WrapIfAdditionalTemplate } = registry.templates;
    return <WrapIfAdditionalTemplate {...props}>{framed}</WrapIfAdditionalTemplate>;
  }
  return KitFieldTemplate;
}

/** Шаблон объекта: заголовок, описание и поля — в контейнере кита. */
export function createObjectTemplate(
  Container: ComponentType<Record<string, unknown>>
): ComponentType<ObjectFieldTemplateProps> {
  function KitObjectFieldTemplate({
    className,
    title,
    description,
    properties,
    schema,
    uiSchema,
    formData,
    disabled,
    readonly,
    registry,
    fieldPathId,
    onAddProperty,
    optionalDataControl,
  }: ObjectFieldTemplateProps): ReactNode {
    // Чистое объединение (`oneOf`/`anyOf` без своих полей) рисует поле выбора варианта само.
    if ((schema.oneOf || schema.anyOf) && !schema.properties && properties.length === 0) {
      return null;
    }
    const { AddButton } = registry.templates.ButtonTemplates;
    return (
      <Container className={joinClasses('flex flex-col gap-4', className)}>
        {title !== '' && <h3 className="text-base font-semibold">{title}</h3>}
        {typeof description === 'string'
          ? description !== '' && <p className="text-sm text-muted-foreground">{description}</p>
          : description}
        {optionalDataControl}
        {properties.map((property) => (
          <Fragment key={property.name}>{property.content}</Fragment>
        ))}
        {canExpand(schema, uiSchema, formData) && (
          <AddButton
            id={buttonId(fieldPathId, 'add')}
            className="rjsf-object-property-expand"
            onClick={onAddProperty}
            disabled={disabled === true || readonly === true}
            uiSchema={uiSchema}
            registry={registry}
          />
        )}
      </Container>
    );
  }
  return KitObjectFieldTemplate;
}

/** Кнопка отправки — кнопкой кита. `ui:submitButtonOptions` работают как у RJSF. */
export function createSubmitButton(
  Button: ComponentType<Record<string, unknown>>
): ComponentType<SubmitButtonProps> {
  function KitSubmitButton({ uiSchema }: SubmitButtonProps): ReactNode {
    const { norender, submitText, props } = getSubmitButtonOptions(uiSchema);
    if (norender === true) return null;
    // Своя строка, как у стандартной темы RJSF: в раскладке формы кнопка не растягивается.
    return (
      <div>
        <Button type="submit" {...props}>
          {submitText}
        </Button>
      </div>
    );
  }
  return KitSubmitButton;
}
