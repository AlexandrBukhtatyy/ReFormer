/**
 * Кит Taiga UI на формах из `kit-fixtures`: документы renderer-json на именах каталога рисуются
 * целиком, поля пишут в модель, массив и визард работают, роли — как у ui-kit.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ErrorHandler,
  createComponent,
  input,
  provideZonelessChangeDetection,
  type ApplicationRef,
  type Type,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { createForm, type FormBundle } from '@reformer/core';
import type { IssueMessages } from '@reformer/core/i18n';
import { defineRegistry, type JsonFormSchema } from '@reformer/renderer-json/neutral';
import { FormRenderer } from '@reformer/renderer-angular';
import { TuiRoot } from '@taiga-ui/core/components/root';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox } from '../src/lib/checkbox';
import { DatePicker } from '../src/lib/date-picker';
import { FieldArray } from '../src/lib/field-array';
import { FormWizard, Step } from '../src/lib/form-wizard';
import { Input as KitInput } from '../src/lib/input';
import { InputMask } from '../src/lib/input-mask';
import { InputNumber } from '../src/lib/input-number';
import { InputPassword } from '../src/lib/input-password';
import { Box, Card, Section } from '../src/lib/layout';
import { RadioGroup } from '../src/lib/radio-group';
import { Select } from '../src/lib/select';
import { Switch } from '../src/lib/switch';
import { provideKitTaiga } from '../src/lib/taiga';
import { Textarea } from '../src/lib/textarea';
import { credit, loan, registration } from 'kit-fixtures';

const {
  sources: creditSources,
  document: creditDocument,
  flow: creditFlow,
  createModel: createCreditModel,
} = credit;
const { document: loanDocument, createModel: createLoanModel } = loan;
const {
  messages: registrationMessages,
  document: registrationDocument,
  createModel: createRegistrationModel,
} = registration;

/** Сборки и схемы тестов: модель у каждой формы своя, тесту она безразлична. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBundle = FormBundle<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySchema = JsonFormSchema<any>;

/** Компонент, которого нет в ките: реестр формы держит на его месте заглушку. */
@Component({
  selector: 'div[kitPlaceholder]',
  template: '',
  host: { 'data-placeholder': '' },
})
class Placeholder {}

const KIT: Record<string, Type<unknown>> = {
  Box,
  Card,
  Checkbox,
  DatePicker,
  FieldArray,
  FormWizard,
  Input: KitInput,
  InputMask,
  InputNumber,
  InputPassword,
  RadioGroup,
  Section,
  Select,
  Step,
  Switch,
  Textarea,
};

const registry = defineRegistry((reg) => {
  for (const [name, component] of Object.entries(KIT)) reg.component(name, component);
  reg.component('FileUploadDropzone', Placeholder);
  for (const [name, value] of Object.entries(creditSources)) reg.dataSource(name, value);
});

/** Страница формы: Taiga UI требует `tui-root` вокруг. */
@Component({
  selector: 'kit-test-host',
  imports: [FormRenderer, TuiRoot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tui-root><reformer-form [form]="form()" [messages]="messages()" /></tui-root>`,
})
class Host {
  readonly form = input.required<AnyBundle>();
  readonly messages = input<IssueMessages | undefined>(undefined);
}

let active: { app: ApplicationRef; root: HTMLElement } | null = null;

afterEach(() => {
  active?.app.destroy();
  active?.root.remove();
  active = null;
});

async function mount(
  bundle: AnyBundle,
  messages?: IssueMessages
): Promise<{ root: HTMLElement; settle(): Promise<void> }> {
  let failure: unknown;
  const app = await createApplication({
    providers: [
      provideZonelessChangeDetection(),
      provideKitTaiga({ animations: false }),
      {
        provide: ErrorHandler,
        useValue: {
          handleError(error: unknown): void {
            failure ??= error;
          },
        },
      },
    ],
  });
  const root = document.body.appendChild(document.createElement('div'));
  active = { app, root };
  const ref = createComponent(Host, { environmentInjector: app.injector, hostElement: root });
  ref.setInput('form', bundle);
  if (messages) ref.setInput('messages', messages);
  app.attachView(ref.hostView);
  app.tick();
  const settle = async (): Promise<void> => {
    await app.whenStable();
    if (failure !== undefined) throw failure;
  };
  await settle();
  return { root, settle };
}

const byTestId = <E extends Element = HTMLElement>(root: ParentNode, id: string): E | null =>
  root.querySelector<E>(`[data-testid="${id}"]`);

function get<E extends Element = HTMLElement>(root: ParentNode, id: string): E {
  const element = byTestId<E>(root, id);
  if (!element) throw new Error(`нет элемента ${id}`);
  return element;
}

function type(input: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Пути полей документа (`model`), как их видит DOM-контракт: точки — дефисами. */
function fieldIds(document: unknown): string[] {
  const ids: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const model = typeof record.model === 'string' ? /^\$model\((.+)\)$/.exec(record.model) : null;
    const props = record.componentProps as { testId?: string } | undefined;
    if (model && record.item === undefined) ids.push(props?.testId ?? model[1].replace(/\./g, '-'));
    if (record.children) walk(record.children);
  };
  walk((document as { root: unknown }).root);
  return ids;
}

describe('кит Taiga UI: регистрация', () => {
  const form = () =>
    createForm({
      model: createRegistrationModel(),
      schema: registrationDocument as unknown as AnySchema,
      registry,
    });

  it('каждое поле документа — корень field-, подпись label- и нативный элемент input-', async () => {
    const { root } = await mount(form());
    const ids = fieldIds(registrationDocument);
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) {
      expect(byTestId(root, `field-${id}`), `field-${id}`).not.toBeNull();
      expect(byTestId(root, `label-${id}`), `label-${id}`).not.toBeNull();
      expect(get(root, `input-${id}`).tagName, `input-${id}`).toBe('INPUT');
    }
    expect(get<HTMLInputElement>(root, 'input-password').type).toBe('password');
    expect(get<HTMLInputElement>(root, 'input-acceptTerms').type).toBe('checkbox');
  });

  it('ввод пишет в модель, маска форматирует телефон, флажок — boolean', async () => {
    const bundle = form();
    const { root, settle } = await mount(bundle);

    type(get(root, 'input-username'), 'anna_k');
    type(get(root, 'input-phone'), '9001234567');
    get<HTMLInputElement>(root, 'input-acceptTerms').click();
    await settle();

    const values = bundle.model.get() as Record<string, unknown>;
    expect(values.username).toBe('anna_k');
    expect(values.phone).toBe('+7 (900) 123-45-67');
    expect(values.acceptTerms).toBe(true);
  });

  it('ошибка — error-{testId} с текстом из словаря, без замечания элемента нет', async () => {
    const bundle = form();
    const { root, settle } = await mount(bundle, registrationMessages as IssueMessages);
    const field = bundle.form.username as unknown as {
      setIssues(issues: unknown[]): void;
      markAsTouched(): void;
      clearIssues(): void;
    };
    expect(byTestId(root, 'error-username')).toBeNull();

    field.setIssues([{ code: 'username.required' }]);
    field.markAsTouched();
    await settle();
    const expected = String((registrationMessages as Record<string, unknown>)['username.required']);
    expect(get(root, 'error-username').textContent?.trim()).toBe(expected);

    field.clearIssues();
    await settle();
    expect(byTestId(root, 'error-username')).toBeNull();
  });
});

describe('кит Taiga UI: визард и массив', () => {
  // Поток без правил шагов: проверяется визард, а не правила формы.
  const form = () =>
    createForm({
      model: createLoanModel(),
      schema: loanDocument as unknown as AnySchema,
      registry,
      flow: { steps: [{ id: 'step1' }, { id: 'step2' }] },
    });

  it('шапка шагов, кнопки ui-kit: на первом шаге нет «Назад», на последнем — «Отправить»', async () => {
    const { root, settle } = await mount(form());
    expect(byTestId(root, 'step-indicator')).not.toBeNull();
    expect(byTestId(root, 'step-indicator-2')).not.toBeNull();
    expect(byTestId(root, 'btn-previous')).toBeNull();
    expect(byTestId(root, 'input-loanAmount')).not.toBeNull();
    expect(byTestId(root, 'input-firstName')).toBeNull();

    get(root, 'btn-next').click();
    await settle();
    expect(byTestId(root, 'input-firstName')).not.toBeNull();
    expect(byTestId(root, 'btn-previous')).not.toBeNull();
    expect(byTestId(root, 'btn-submit')).not.toBeNull();
    expect(byTestId(root, 'btn-next')).toBeNull();

    get(root, 'btn-previous').click();
    await settle();
    expect(byTestId(root, 'input-loanAmount')).not.toBeNull();
  });

  it('массив: «Добавить» — строка по шаблону, «Удалить» — по строке, пока строк больше одной', async () => {
    const bundle = form();
    const { root, settle } = await mount(bundle);
    get(root, 'btn-next').click();
    await settle();
    const rows = (): number =>
      root.querySelectorAll(
        '[data-testid^="array-item-"]:not([data-testid*="-remove"]):not([data-testid*="-move"])'
      ).length;
    expect(rows()).toBe(0);

    get(root, 'array-add').click();
    await settle();
    get(root, 'array-add').click();
    await settle();
    expect(rows()).toBe(2);
    expect((bundle.model.get() as { coBorrowers: unknown[] }).coBorrowers).toHaveLength(2);

    get(root, 'array-item-1-remove').click();
    await settle();
    expect(rows()).toBe(1);
    // Одна строка — кнопки удаления нет (как у ui-kit без showRemoveOnSingle).
    expect(byTestId(root, 'array-item-0-remove')).toBeNull();
  });
});

describe('кит Taiga UI: кредитная заявка', () => {
  it('документ со всеми компонентами рисуется; список берёт значение из модели', async () => {
    const bundle = createForm({
      model: createCreditModel(),
      schema: creditDocument as unknown as AnySchema,
      registry,
      flow: creditFlow,
    });
    const { root } = await mount(bundle);

    expect(byTestId(root, 'field-loanType')).not.toBeNull();
    expect(get(root, 'input-loanType').getAttribute('data-value')).toBe(
      String((bundle.model.get() as { loanType: unknown }).loanType ?? '')
    );
    expect(root.querySelectorAll('section.kit-section').length).toBeGreaterThan(0);
  });
});
