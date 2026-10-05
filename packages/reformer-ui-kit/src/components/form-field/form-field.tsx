import * as React from 'react';
import { type FieldNode } from '@reformer/core';
import { FormField as CdkFormField, useFormFieldContext } from '@reformer/cdk/form-field';

import { Field, FieldContent } from '@/components/field';
import { InfoHint } from '@/components/info-hint';
import { useKitMessages } from '@/i18n/messages';
import { cn } from '@/lib/utils';

/** Раскладка подписи относительно контрола: `col` — над ним, `row` — слева от него. */
export type FormFieldDirection = 'col' | 'row';

/** Props компонента {@link FormField}. */
export interface FormFieldProps {
  /**
   * Поле формы. Из него берутся `component` (тип контрола), `componentProps`, `value`, `error`,
   * `pending`, `setValue`, `blur`. Контрол инстанцируется автоматически через `CdkFormField.Control`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: FieldNode<any>;
  /** Дополнительный CSS-класс корневого `Field`. */
  className?: string;
  /**
   * Префикс `data-testid` (`field-<id>`, `label-<id>`, `input-<id>`, `error-<id>`).
   * Если опущен — берётся `componentProps.testId`, иначе `'unknown'`.
   */
  testId?: string;
  /**
   * Раскладка подписи и контрола: `'col'` — подпись над контролом, `'row'` — слева от него.
   * Описание, ошибка и «Проверка…» в обоих случаях остаются под контролом. У inline-контролов
   * (Checkbox/Switch) верхней подписи нет — для них раскладка не меняется.
   *
   * @default 'col'
   */
  direction?: FormFieldDirection;
  /**
   * Кастомный input — оборачивается в `CdkFormField.Control asChild` (нестандартный контрол,
   * не зарегистрированный в `control.component`).
   */
  children?: React.ReactNode;
}

/**
 * Поправки к `orientation="horizontal"` shadcn `Field` — тот рассчитан на пару «чекбокс + текст»,
 * а здесь справа стоит колонка «контрол → описание → ошибка»:
 * - подпись не растягивается (у shadcn — `flex-auto`) и занимает не больше половины ряда: длинная
 *   переносится, а не выдавливает контрол;
 * - выравнивание по базовой линии первой строки контрола (у shadcn — `items-start`): подпись стоит
 *   на уровне текста в поле при любой его высоте, а не у верхнего края.
 */
const ROW_CLASS =
  'gap-3 has-[>[data-slot=field-content]]:items-baseline [&>[data-slot=field-label]]:flex-none [&>[data-slot=field-label]]:max-w-1/2 [&>[data-slot=field-label-row]]:max-w-1/2';

/**
 * Контролы с inline-раскладкой (CheckboxWithLabel/SwitchWithLabel — сами рисуют подпись рядом с
 * контролом) объявляют маркер `reformerLayout = 'inline-label'` (`defineFieldControl`). Для них FormField
 * НЕ рендерит верхнюю подпись (иначе она задвоится).
 *
 * ⚠️ ИНВАРИАНТ: каждый контрол, рисующий подпись сам (CheckboxWithLabel/SwitchWithLabel), ОБЯЗАН
 * объявить `layout: 'inline-label'`. Маркер — неэнфорсимая конвенция: если
 * inline-контрол его не выставит, верхняя подпись задвоится молча (замена v6-детекции `=== Checkbox`).
 */
function hasInlineLabel(component: unknown): boolean {
  return (component as { reformerLayout?: string } | null)?.reformerLayout === 'inline-label';
}

interface FormFieldInnerProps {
  className?: string;
  testIdProp?: string;
  direction: FormFieldDirection;
  inlineLabel: boolean;
  description?: string;
  labelTooltip?: string;
  customChildren?: React.ReactNode;
}

/**
 * Читает контекст `CdkFormField.Root`: `componentProps` (fallback testId) и `pending`.
 * Визуал — shadcn `Field`/`FieldContent`; данные и a11y-wiring (htmlFor/id/aria-*) — из CDK-слотов.
 */
function FormFieldInner({
  className,
  testIdProp,
  direction,
  inlineLabel,
  description,
  labelTooltip,
  customChildren,
}: FormFieldInnerProps) {
  const { componentProps, pending, ids, label, disabled } = useFormFieldContext();
  const t = useKitMessages();
  const testId = testIdProp ?? (componentProps as { testId?: string })?.testId ?? 'unknown';

  // Иконка-подсказка живёт снаружи <label>: внутри него клик активировал бы контрол. Скрытый дубль
  // текста (ids.hintId) — цель aria-describedby контрола, см. hasHint у Root.
  const hint = labelTooltip ? (
    <InfoHint
      content={labelTooltip}
      descriptionId={ids.hintId}
      aria-label={label ? t('kit.formField.hintLabel', { label }) : undefined}
      data-testid={`label-tooltip-${testId}`}
    />
  ) : null;

  // CdkFormField.Label остаётся нативным <label> (htmlFor→controlId): asChild уронил бы htmlFor.
  // shadcn-вид даём классами field-label.
  const fieldLabel = (
    <CdkFormField.Label
      data-slot="field-label"
      className="flex w-fit items-center gap-2 text-sm leading-snug font-medium select-none group-data-[disabled=true]/field:opacity-50"
      data-testid={`label-${testId}`}
    />
  );

  const fieldControl = customChildren ? (
    <CdkFormField.Control asChild>{customChildren}</CdkFormField.Control>
  ) : (
    <CdkFormField.Control data-testid={`input-${testId}`} />
  );

  const row = direction === 'row';

  return (
    <Field
      orientation={row ? 'horizontal' : 'vertical'}
      className={row ? cn(ROW_CLASS, className) : className}
      data-testid={`field-${testId}`}
      // Маркер для `group-data-[disabled=true]/field:*` (shadcn Field): без него подпись выключенного
      // поля оставалась яркой. Атрибут ставится только у выключенного поля — иначе DOM прежний.
      data-disabled={disabled ? true : undefined}
    >
      {/* Ряды-обёртки добавляются ТОЛЬКО при подсказке — без неё DOM прежний. */}
      {!inlineLabel &&
        (hint ? (
          <div data-slot="field-label-row" className="flex items-center gap-1.5">
            {fieldLabel}
            {hint}
          </div>
        ) : (
          fieldLabel
        ))}

      <FieldContent>
        {/* Inline-контрол (Checkbox/Switch) рисует подпись сам — иконка встаёт справа от него. */}
        {inlineLabel && hint ? (
          <div data-slot="field-control-row" className="flex items-center gap-1.5">
            {fieldControl}
            {hint}
          </div>
        ) : (
          fieldControl
        )}

        {description && (
          <CdkFormField.Description
            data-slot="field-description"
            className="text-sm leading-normal font-normal text-muted-foreground"
          >
            {description}
          </CdkFormField.Description>
        )}

        <CdkFormField.Error
          data-slot="field-error"
          className="text-sm font-normal text-destructive"
          data-testid={`error-${testId}`}
        />

        {pending && (
          <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {t('kit.formField.validating')}
          </span>
        )}
      </FieldContent>
    </Field>
  );
}

const FormFieldComponent: React.FC<FormFieldProps> = ({
  control,
  className,
  testId,
  direction = 'col',
  children,
}) => {
  const inlineLabel = hasInlineLabel(control.component);
  // peek: structural, без подписки — hasDescription нужен ДО Root. Ограничение: `description`
  // фиксируется первым рендером (компонент memo'ится по control). Динамическая смена description
  // через updateComponentProps не подхватится (в отличие от реактивных label/required из контекста).
  // Допущение осознанное: description поля статичен, как и раскладка. Нужна динамика — пересоздать поле.
  // labelTooltip читается так же: hasHint обязан совпадать с фактом рендера скрытого текста подсказки,
  // иначе aria-describedby получит висячий id. Пустая строка = подсказки нет.
  const own = control.componentProps.peek() as { description?: string; labelTooltip?: string };
  const description = own?.description;
  const labelTooltip = own?.labelTooltip || undefined;

  return (
    <CdkFormField.Root
      control={control}
      hasDescription={Boolean(description)}
      hasHint={Boolean(labelTooltip)}
    >
      <FormFieldInner
        className={className}
        testIdProp={testId}
        direction={direction}
        inlineLabel={inlineLabel}
        description={description}
        labelTooltip={labelTooltip}
        customChildren={children}
      />
    </CdkFormField.Root>
  );
};

/**
 * Готовый wrapper поля на визуальной базе shadcn `Field`, поверх headless
 * `@reformer/cdk/form-field`: `Label` → `Control` → `Error` (+ опц. `Description`, pending).
 * Подключается `<FormField control={…} />` или как `fieldWrapper` для `FormRenderer`.
 *
 * - `direction` — подпись над контролом (`'col'`, по умолчанию) или слева от него (`'row'`).
 * - Для inline-контролов (Checkbox/Switch — `reformerLayout='inline-label'`) верхняя подпись не рендерится.
 * - `componentProps.labelTooltip` — иконка (i) с тултипом после подписи (у inline-контролов — справа от
 *   контрола). Подсказка внутри самого контрола — отдельный проп `tooltip`.
 * - При `pending` (async-валидация) под полем показывается «Проверка…».
 * - `React.memo` по ссылке `control` — критично для больших форм.
 */
export const FormField = React.memo(
  FormFieldComponent,
  (prev, next) =>
    prev.control === next.control &&
    prev.className === next.className &&
    prev.testId === next.testId &&
    prev.direction === next.direction &&
    prev.children === next.children
);
