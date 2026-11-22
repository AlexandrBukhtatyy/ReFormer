// @vitest-environment happy-dom
/**
 * Императивный handle поля в DOM: `makeElementFieldHandle` и `useFieldHandleRef`.
 *
 * Node-близнец (`src/platforms/react/field-binding/field-binding.test.tsx`) проверяет выбор handle
 * и адаптер на объектах-заглушках. Здесь — настоящий DOM и React: фокус, снятие фокуса и прокрутка
 * доходят до элемента контрола; композит со своим `useImperativeHandle` публикуется как есть; смена
 * контрола переносит handle на новый узел, размонтирование сбрасывает внешний ref. Связка поля
 * целиком (адаптер диалекта + handle, как у `FormField.Control`) проверена на настоящих событиях.
 * Сквозной сценарий — фокус первой ошибки после проверки через `render.node(selector).getRef()`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRef,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type ElementType,
  type InputHTMLAttributes,
  type Ref,
  type RefObject,
} from 'react';
import { createForm, type FormBundle } from '../../src/form/form-bundle';
import { defineValidation, validate } from '../../src/form/validation';
import { required } from '../../src/form/validators';
import type { FormControl } from '../../src/form/types/index';
import {
  bindFieldProps,
  getFieldAdapter,
  type FieldAdapter,
} from '../../src/platforms/react/field-binding/field-adapter';
import {
  makeElementFieldHandle,
  useFieldHandleRef,
  type FieldHandle,
} from '../../src/platforms/react/field-binding/field-handle';
import { useFormControl } from '../../src/platforms/react/hooks/useFormControl';
import { act, cleanup, fireEvent, render, screen } from '../test-utils/react';
import { liveEffects } from '../test-utils/effect-tracker';
import { InputStub } from '../test-utils/stubs';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/** Поле ввода в документе — фокус работает только у подключённого элемента. */
function mountInput(): HTMLInputElement {
  const input = document.createElement('input');
  document.body.appendChild(input);
  return input;
}

describe('makeElementFieldHandle — DOM-элемент', () => {
  it('focus и blur двигают фокус документа', () => {
    const input = mountInput();
    const handle = makeElementFieldHandle({ current: input });

    handle.focus();
    expect(document.activeElement).toBe(input);

    handle.blur();
    expect(document.activeElement).not.toBe(input);
  });

  it('scrollIntoView передаёт опции элементу', () => {
    const input = mountInput();
    const scroll = vi.spyOn(input, 'scrollIntoView').mockImplementation(() => {});

    makeElementFieldHandle({ current: input }).scrollIntoView({ block: 'center' });

    expect(scroll).toHaveBeenCalledWith({ block: 'center' });
  });

  it('пустая ссылка: getElement — null, вызовы без исключений; узел подхватывается позже', () => {
    const ref: { current: HTMLElement | null } = { current: null };
    const handle = makeElementFieldHandle(ref);

    expect(handle.getElement()).toBeNull();
    expect(() => {
      handle.focus();
      handle.blur();
      handle.scrollIntoView();
    }).not.toThrow();

    const input = mountInput();
    ref.current = input;
    handle.focus();
    expect(handle.getElement()).toBe(input);
    expect(document.activeElement).toBe(input);
  });
});

/** Поле на DOM-элементе: ref хука вешается на `input`. */
function TextControl({ handleRef }: { handleRef?: Ref<FieldHandle> }) {
  const inner = useFieldHandleRef(handleRef);
  return <input data-testid="text" ref={inner as RefObject<HTMLInputElement>} />;
}

interface PickerHandle extends FieldHandle {
  open(): void;
}

/** Композит со своим handle: публикует `open` поверх базового контракта. */
const Picker = forwardRef<PickerHandle, { onOpen: () => void }>(function Picker({ onOpen }, ref) {
  const button = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => ({ ...makeElementFieldHandle(button), open: onOpen }), [onOpen]);
  return <button ref={button}>выбрать</button>;
});

function PickerControl({
  handleRef,
  onOpen,
}: {
  handleRef: Ref<PickerHandle>;
  onOpen: () => void;
}) {
  const inner = useFieldHandleRef<PickerHandle>(handleRef);
  return <Picker ref={inner as RefObject<PickerHandle>} onOpen={onOpen} />;
}

describe('useFieldHandleRef — handle для потребителя', () => {
  it('DOM-контрол: на внешний ref публикуется FieldHandle над его узлом', () => {
    const outer = createRef<FieldHandle>();

    render(<TextControl handleRef={outer} />);
    const input = screen.getByTestId('text');

    expect(outer.current?.getElement()).toBe(input);
    act(() => outer.current?.focus());
    expect(document.activeElement).toBe(input);
  });

  it('композит со своим handle: публикуется как есть', () => {
    const outer = createRef<PickerHandle>();
    const onOpen = vi.fn();

    render(<PickerControl handleRef={outer} onOpen={onOpen} />);
    outer.current?.open();

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(outer.current?.getElement()).toBe(screen.getByRole('button'));
  });

  it('без внешнего ref хук безопасен и отдаёт ref контролу', () => {
    render(<TextControl />);

    expect(screen.getByTestId('text')).toBeDefined();
  });

  it('колбэк-ref получает handle при монтировании и null при размонтировании', () => {
    const calls: (FieldHandle | null)[] = [];
    const view = render(<TextControl handleRef={(handle) => void calls.push(handle)} />);
    expect(calls.at(-1)?.getElement()).toBe(screen.getByTestId('text'));

    view.unmount();
    expect(calls.at(-1)).toBeNull();
  });

  it('смена контрола — handle переезжает на новый узел', () => {
    const outer = createRef<FieldHandle>();
    function Switchable({ multiline }: { multiline: boolean }) {
      const inner = useFieldHandleRef(outer);
      return multiline ? (
        <textarea data-testid="area" ref={inner as RefObject<HTMLTextAreaElement>} />
      ) : (
        <input data-testid="line" ref={inner as RefObject<HTMLInputElement>} />
      );
    }
    const view = render(<Switchable multiline={false} />);
    expect(outer.current?.getElement()).toBe(screen.getByTestId('line'));

    view.rerender(<Switchable multiline />);

    expect(outer.current?.getElement()).toBe(screen.getByTestId('area'));
  });

  it('DOM-контрол сменился композитом — публикуется handle композита', () => {
    const outer = createRef<PickerHandle>();
    const onOpen = vi.fn();
    function Switchable({ rich }: { rich: boolean }) {
      const inner = useFieldHandleRef<PickerHandle>(outer);
      return rich ? (
        <Picker ref={inner as RefObject<PickerHandle>} onOpen={onOpen} />
      ) : (
        <input ref={inner as RefObject<HTMLInputElement>} />
      );
    }
    const view = render(<Switchable rich={false} />);
    expect(outer.current).not.toHaveProperty('open');

    view.rerender(<Switchable rich />);
    outer.current?.open();

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // `useImperativeHandle` без deps публикует НОВЫЙ объект handle на каждом коммите: колбэк-ref
  // получает `null` и новый handle, `setState` в нём перерисовывает родителя, родитель — поле, и
  // так по кругу до «Maximum update depth exceeded». С DOM-ref (`ref={setNode}`) этот приём
  // работает: React зовёт колбэк только при смене узла.
  it('колбэк-ref, сохраняющий handle в state, не зацикливает рендер [ReFormer-kiez]', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Parent() {
      const [handle, setHandle] = useState<FieldHandle | null>(null);
      return (
        <>
          <TextControl handleRef={setHandle} />
          <span>{handle ? 'handle есть' : 'handle нет'}</span>
        </>
      );
    }

    expect(() => render(<Parent />)).not.toThrow();
  });

  it('размонтирование сбрасывает внешний ref в null', () => {
    const outer = createRef<FieldHandle>();
    const view = render(<TextControl handleRef={outer} />);
    expect(outer.current).not.toBeNull();

    view.unmount();

    expect(outer.current).toBeNull();
  });

  it('вызовы handle компонент не перерисовывают', () => {
    const outer = createRef<FieldHandle>();
    let renders = 0;
    function Counted() {
      renders++;
      return <TextControl handleRef={outer} />;
    }
    render(<Counted />);
    const before = renders;

    act(() => {
      outer.current?.focus();
      outer.current?.blur();
    });

    expect(renders).toBe(before);
  });

  it('StrictMode: после двойного эффекта handle опубликован и рабочий', () => {
    const outer = createRef<FieldHandle>();

    render(<TextControl handleRef={outer} />, { reactStrictMode: true });
    act(() => outer.current?.focus());

    expect(document.activeElement).toBe(screen.getByTestId('text'));
  });
});

interface Settings {
  nick: string;
  agree: boolean;
}

/** Нативное поле: `onChange` отдаёт DOM-событие — адаптер достаёт из него значение. */
const NativeInput = Object.assign(
  forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    function NativeInput(props, ref) {
      return <input ref={ref} {...props} />;
    }
  ),
  {
    reformerAdapter: {
      fromEmit: (event: unknown) => (event as ChangeEvent<HTMLInputElement>).target.value,
      toValue: (value: unknown) => value ?? '',
    } satisfies FieldAdapter,
  }
);

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onFocusLost: () => void;
}

/** Переключатель в диалекте `checked` / `onCheckedChange`, blur — своим каналом. */
const Toggle = Object.assign(
  forwardRef<HTMLInputElement, ToggleProps>(function Toggle(props, ref) {
    const { checked, onCheckedChange, onFocusLost, ...rest } = props;
    return (
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        onBlur={onFocusLost}
        {...rest}
      />
    );
  }),
  {
    reformerAdapter: {
      valueProp: 'checked',
      changeProp: 'onCheckedChange',
      toValue: (value: unknown) => value ?? false,
      bindBlur: (onBlur: () => void) => ({ onFocusLost: onBlur }),
      strip: ['hint'],
    } satisfies FieldAdapter,
  }
);

interface ValueInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

/** Value-based контрол: событие в значение переводит сам — адаптер ему не нужен. */
const ValueInput = forwardRef<HTMLInputElement, ValueInputProps>(function ValueInput(props, ref) {
  const { value, onChange, onBlur, ...rest } = props;
  return (
    <input
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      {...rest}
    />
  );
});

/** Обёртка поля как у `FormField.Control`: снапшот ноды, props под адаптер, handle наружу. */
function BoundField<T>({
  control,
  component: Component,
  handleRef,
}: {
  control: FormControl<T>;
  component: ElementType;
  handleRef?: Ref<FieldHandle>;
}) {
  const { value, componentProps } = useFormControl(control);
  const inner = useFieldHandleRef(handleRef);
  const props = bindFieldProps(
    getFieldAdapter(Component),
    {
      value,
      onChange: (next) => control.setValue(next as T),
      onBlur: () => control.markAsTouched(),
    },
    componentProps
  );
  return <Component {...props} data-testid="bound" ref={inner} />;
}

const createSettings = () =>
  createForm<Settings>({
    initial: { nick: '', agree: false },
    schema: (model) => ({
      children: [
        {
          model: model.$.nick,
          component: NativeInput,
          componentProps: { placeholder: 'Ник', labelTooltip: 'подсказка обёртки' },
        },
        { model: model.$.agree, component: Toggle, componentProps: { hint: 'только обёртке' } },
      ],
    }),
  });

describe('связка поля с контролом — адаптер и handle вместе', () => {
  it('нативное поле: ввод — в модель, blur — touched, служебные props не в DOM', () => {
    const { form, model } = createSettings();
    const outer = createRef<FieldHandle>();
    render(<BoundField control={form.nick} component={NativeInput} handleRef={outer} />);
    const input = screen.getByTestId('bound') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'neo' } });
    fireEvent.blur(input);

    expect(model.nick).toBe('neo');
    expect(input.value).toBe('neo');
    expect(form.nick.touched.value).toBe(true);
    expect(input.getAttribute('placeholder')).toBe('Ник');
    expect(input.outerHTML).not.toMatch(/tooltip/i);
    act(() => outer.current?.focus());
    expect(document.activeElement).toBe(input);
  });

  it('value-based контрол без адаптера: seam проходит как есть', () => {
    const { form, model } = createSettings();
    render(<BoundField control={form.nick} component={ValueInput} />);
    const input = screen.getByTestId('bound') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'trinity' } });
    fireEvent.blur(input);

    expect(model.nick).toBe('trinity');
    expect(form.nick.touched.value).toBe(true);
    expect(input.outerHTML).not.toMatch(/tooltip/i);
  });

  it('диалект checked: клик — в модель через onCheckedChange, blur — своим каналом', () => {
    const { form, model } = createSettings();
    render(<BoundField control={form.agree} component={Toggle} />);
    const box = screen.getByTestId('bound') as HTMLInputElement;
    expect(box.checked).toBe(false);

    fireEvent.click(box);
    fireEvent.blur(box);

    expect(model.agree).toBe(true);
    expect(box.checked).toBe(true);
    expect(form.agree.touched.value).toBe(true);
    expect(box.outerHTML).not.toMatch(/hint/i);
  });
});

interface Applicant {
  email: string;
  name: string;
  city: string;
}

const FIELDS = ['email', 'name', 'city'] as const;

const applicantRules = defineValidation<Applicant>(({ model }) => {
  validate(model.$.email, [required()]);
  validate(model.$.name, [required()]);
  validate(model.$.city, [required()]);
});

const createApplicant = () =>
  createForm<Applicant>({
    initial: { email: '', name: '', city: 'Москва' },
    schema: (model) => ({
      children: FIELDS.map((field) => ({
        selector: field,
        model: model.$[field],
        component: InputStub,
      })),
    }),
    validation: applicantRules,
  });

let fieldRenders = 0;

/** Поле формы: значение из ноды, ref — по селектору узла схемы. */
function ApplicantField({
  bundle,
  field,
}: {
  bundle: FormBundle<Applicant>;
  field: (typeof FIELDS)[number];
}) {
  fieldRenders++;
  const control = bundle.form[field] as FormControl<string>;
  const { value, invalid } = useFormControl(control);
  const inner = useFieldHandleRef(bundle.render.node(field).getRef<FieldHandle>());
  return (
    <input
      data-testid={field}
      aria-invalid={invalid}
      value={value}
      onChange={(event) => control.setValue(event.target.value)}
      ref={inner as RefObject<HTMLInputElement>}
    />
  );
}

/** Фокус на первое поле с ошибкой — в порядке полей схемы. */
function focusFirstError(bundle: FormBundle<Applicant>): string | undefined {
  const field = FIELDS.find((name) => (bundle.form[name] as FormControl<string>).invalid.value);
  if (field !== undefined) bundle.render.node(field).getRef<FieldHandle>().current?.focus();
  return field;
}

describe('фокус первой ошибки', () => {
  it('после проверки фокус уходит на первое поле с ошибкой в порядке схемы', async () => {
    const bundle = createApplicant();
    render(
      <>
        {FIELDS.map((field) => (
          <ApplicantField key={field} bundle={bundle} field={field} />
        ))}
      </>
    );

    await act(async () => {
      await bundle.validate();
      focusFirstError(bundle);
    });
    expect(document.activeElement).toBe(screen.getByTestId('email'));

    await act(async () => {
      bundle.form.email.setValue('a@b.c');
      await bundle.validate();
      focusFirstError(bundle);
    });
    expect(document.activeElement).toBe(screen.getByTestId('name'));
    expect(screen.getByTestId('name').getAttribute('aria-invalid')).toBe('true');
  });

  it('ошибок нет — фокус на месте; после размонтирования ref пуст, подписок нет', async () => {
    const bundle = createApplicant();
    const base = liveEffects();
    const view = render(
      <>
        {FIELDS.map((field) => (
          <ApplicantField key={field} bundle={bundle} field={field} />
        ))}
      </>
    );
    act(() => {
      bundle.form.email.setValue('a@b.c');
      bundle.form.name.setValue('Анна');
    });

    let focused: string | undefined = 'не вызывали';
    await act(async () => {
      await bundle.validate();
      focused = focusFirstError(bundle);
    });
    expect(focused).toBeUndefined();
    expect(document.activeElement).toBe(document.body);

    view.unmount();
    expect(bundle.render.node('email').getRef<FieldHandle>().current).toBeNull();
    expect(liveEffects()).toBe(base);

    const after = fieldRenders;
    await act(async () => {
      bundle.form.city.setValue('');
      await bundle.validate();
    });
    expect(fieldRenders).toBe(after);
  });
});
