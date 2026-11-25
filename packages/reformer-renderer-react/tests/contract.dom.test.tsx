// @vitest-environment happy-dom
/**
 * Контрактный набор рендерера на React: те же сценарии проходят рендереры Vue и Angular.
 *
 * Здесь только то, что у стека своё, — кит компонентов-зондов и монтирование. Что именно
 * проверяется, описано сценариями пакета `renderer-contract`.
 */
import type { ComponentType, ReactElement, ReactNode, Ref } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { I18nProvider, useFormBundleContext, useFormControl } from '@reformer/core/react';
import { describeRendererContract, type ContractKit, type Mounted } from 'renderer-contract';
import { FormRenderer } from '../src/core/form-renderer';
import type { ArrayComponentProps, FieldWrapperProps } from '../src/core/types';

// ---------------------------------------------------------------------------
// Кит: компоненты-зонды пишут полученные пропсы в атрибуты
// ---------------------------------------------------------------------------

interface InputProps {
  value?: unknown;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  caption?: string;
  placeholder?: string;
  options?: unknown[];
  label?: string;
  description?: string;
  required?: boolean;
  control?: { path: { value: string } };
  ref?: Ref<HTMLInputElement>;
  'data-testid'?: string;
}

function Input({
  value,
  onChange,
  onBlur,
  disabled,
  caption,
  placeholder,
  options,
  label,
  description,
  required,
  control,
  ref,
  'data-testid': testId,
}: InputProps): ReactElement {
  return (
    <input
      ref={ref}
      data-testid={testId}
      value={String(value ?? '')}
      disabled={disabled}
      placeholder={placeholder}
      data-caption={caption}
      data-options={options === undefined ? undefined : options.length}
      data-label={label}
      data-description={description}
      data-required={required === undefined ? undefined : String(required)}
      data-path={control?.path.value}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={() => onBlur?.()}
    />
  );
}

const InlineInput = (props: InputProps): ReactElement => <Input {...props} />;
InlineInput.reformerLayout = 'inline-label';

const ControlInput = (props: InputProps): ReactElement => <Input {...props} />;
ControlInput.reformerAdapter = { passControl: true };

interface ToggleProps {
  checked?: boolean;
  onToggle?: (checked: boolean) => void;
  disabled?: boolean;
  caption?: string;
  ref?: Ref<HTMLButtonElement>;
  'data-testid'?: string;
}

function Toggle({
  checked,
  onToggle,
  disabled,
  caption,
  ref,
  'data-testid': testId,
}: ToggleProps): ReactElement {
  return (
    <button
      ref={ref}
      type="button"
      data-testid={testId}
      data-checked={String(checked === true)}
      data-caption={caption}
      disabled={disabled}
      onClick={() => onToggle?.(checked !== true)}
    />
  );
}
Toggle.reformerAdapter = { valueProp: 'checked', changeProp: 'onToggle' };

interface SectionProps {
  title?: string;
  tone?: string;
  items?: unknown[];
  selector?: string;
  className?: string;
  onSubmit?: (payload: string) => void;
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

function Section({
  title,
  tone,
  items,
  selector,
  className,
  onSubmit,
  children,
  ref,
}: SectionProps): ReactElement {
  return (
    <section
      ref={ref}
      className={className}
      data-title={title}
      data-tone={tone}
      data-items={Array.isArray(items) ? items.join('+') : undefined}
      data-selector={selector}
    >
      {onSubmit ? (
        <button type="button" data-action="submit" onClick={() => onSubmit('payload')} />
      ) : null}
      {children}
    </section>
  );
}

function List({
  items = [],
  onAdd,
  onRemove,
  onMove,
  title,
  addLabel,
}: ArrayComponentProps & { title?: string; addLabel?: string }): ReactElement {
  return (
    <div data-list="" data-title={title} data-add-label={addLabel}>
      <ul>
        {items.map((item) => (
          <li key={item.key} data-index={item.index}>
            {item.children}
            <button type="button" data-action="remove" onClick={() => onRemove(item.index)} />
            <button
              type="button"
              data-action="up"
              onClick={() => onMove(item.index, item.index - 1)}
            />
            <button
              type="button"
              data-action="down"
              onClick={() => onMove(item.index, item.index + 1)}
            />
          </li>
        ))}
      </ul>
      <button type="button" data-action="add" onClick={() => onAdd()} />
    </div>
  );
}

/** Узел скомпилированной схемы — то, что получает компонент, ведущий детей сам. */
interface StepNode {
  kind: string;
  selector?: string;
  props?: { title?: string };
}

function Steps({
  children,
  renderNode,
}: {
  children: StepNode[];
  renderNode: (node: StepNode) => ReactNode;
}): ReactElement {
  return (
    <ol data-count={children.length}>
      {children.map((child, index) => (
        <li
          key={index}
          data-step={child.selector}
          data-kind={child.kind}
          data-title={child.props?.title}
        >
          {renderNode(child)}
        </li>
      ))}
    </ol>
  );
}
Steps.__selfManagedChildren = true;

function FieldWrapper({ control, className, testId, children }: FieldWrapperProps): ReactElement {
  const { issues } = useFormControl(control);
  return (
    <div
      data-wrap="field"
      data-testid={`field-${testId}`}
      data-issues={issues.length}
      className={className}
    >
      {children}
    </div>
  );
}

function PlainWrapper({ className, children }: FieldWrapperProps): ReactElement {
  return (
    <div data-wrap="plain" className={className}>
      {children}
    </div>
  );
}

function BundleProbe(): ReactElement {
  const bundle = useFormBundleContext<{ kind: string }>();
  return (
    <b data-testid="bundle-probe">
      {bundle ? `форма:${bundle.form.kind.value.value}` : 'нет сборки'}
    </b>
  );
}

const kit: ContractKit = {
  Input,
  InlineInput,
  Toggle,
  ControlInput,
  Section,
  List,
  Steps,
  FieldWrapper,
  PlainWrapper,
  BundleProbe,
};

// ---------------------------------------------------------------------------
// Монтирование
// ---------------------------------------------------------------------------

/** Дать React дорисовать: обновления по сигналам и эффекты уходят в очередь задач. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 2; turn++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

describeRendererContract({
  name: 'renderer-react',
  kit,

  async mount(bundle, options = {}): Promise<Mounted> {
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Ошибку рендера React отдаёт обработчику корня, а не бросает из `render`.
    let failure: unknown;
    const root = createRoot(container, {
      onUncaughtError: (error) => {
        failure = error;
      },
    });

    const settings = options.fieldWrapper
      ? { fieldWrapper: options.fieldWrapper as ComponentType<FieldWrapperProps> }
      : undefined;
    let tree = <FormRenderer form={bundle} settings={settings} />;
    if (options.locale) tree = <I18nProvider locale={options.locale}>{tree}</I18nProvider>;

    flushSync(() => root.render(tree));
    await settle();

    if (failure !== undefined) {
      root.unmount();
      container.remove();
      throw failure;
    }

    return {
      root: container,
      settle,
      async unmount() {
        flushSync(() => root.unmount());
        await settle();
        container.remove();
      },
    };
  },
});
