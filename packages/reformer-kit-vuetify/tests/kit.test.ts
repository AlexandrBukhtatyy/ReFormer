// @vitest-environment happy-dom
/**
 * Кит Vuetify на формах из `kit-fixtures`: документы renderer-json на именах каталога рисуются
 * целиком, поля пишут в модель, массив и визард работают, роли — как у ui-kit.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, nextTick, type App, type Component } from 'vue';
import { createForm, type FormBundle } from '@reformer/core';
import { defineRegistry, type JsonFormSchema } from '@reformer/renderer-json/neutral';
import { FormRenderer } from '@reformer/renderer-vue';
import { VApp } from 'vuetify/components/VApp';
import { Checkbox } from '../src/checkbox';
import { DatePicker } from '../src/date-picker';
import { FieldArray } from '../src/field-array';
import { FormWizard, Step } from '../src/form-wizard';
import { Input } from '../src/input';
import { InputMask } from '../src/input-mask';
import { InputNumber } from '../src/input-number';
import { InputPassword } from '../src/input-password';
import { Box, Card, Section } from '../src/layout';
import { RadioGroup } from '../src/radio-group';
import { Select } from '../src/select';
import { Switch } from '../src/switch';
import { Textarea } from '../src/textarea';
import { createKitVuetify } from '../src/vuetify';
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
const Placeholder = defineComponent({
  name: 'Placeholder',
  inheritAttrs: false,
  setup: () => () => h('div', { 'data-placeholder': '' }),
});

const KIT: Record<string, Component> = {
  Box,
  Card,
  Checkbox,
  DatePicker,
  FieldArray,
  FormWizard,
  Input,
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

let app: App | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  app?.unmount();
  host?.remove();
  app = null;
  host = null;
});

function mount(bundle: AnyBundle, messages?: Record<string, unknown>): HTMLElement {
  host = document.body.appendChild(document.createElement('div'));
  app = createApp({
    setup: () => () =>
      h(VApp, null, {
        default: () => h(FormRenderer, { form: bundle, messages: messages as never }),
      }),
  });
  app.use(createKitVuetify());
  app.mount(host);
  return host;
}

const settle = async (): Promise<void> => {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
};

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

describe('кит Vuetify: регистрация', () => {
  const form = () =>
    createForm({
      model: createRegistrationModel(),
      schema: registrationDocument as unknown as AnySchema,
      registry,
    });

  it('каждое поле документа — корень field-, подпись label- и нативный элемент input-', () => {
    const root = mount(form());
    const ids = fieldIds(registrationDocument);
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) {
      expect(byTestId(root, `field-${id}`), `field-${id}`).not.toBeNull();
      expect(byTestId(root, `label-${id}`), `label-${id}`).not.toBeNull();
      const input = get(root, `input-${id}`);
      expect(input.tagName, `input-${id}`).toBe('INPUT');
    }
    expect(get<HTMLInputElement>(root, 'input-password').type).toBe('password');
    expect(get<HTMLInputElement>(root, 'input-acceptTerms').type).toBe('checkbox');
  });

  it('ввод пишет в модель, маска форматирует телефон, флажок — boolean', async () => {
    const bundle = form();
    const root = mount(bundle);

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
    const root = mount(bundle, registrationMessages);
    const field = bundle.form.username as unknown as {
      setIssues(issues: unknown[]): void;
      markAsTouched(): void;
      clearIssues(): void;
    };
    expect(byTestId(root, 'error-username')).toBeNull();

    field.setIssues([{ code: 'username.required' }]);
    field.markAsTouched();
    await settle();
    const text = get(root, 'error-username').textContent;
    expect(text).toBe(
      String((registrationMessages as Record<string, unknown>)['username.required'])
    );

    field.clearIssues();
    await settle();
    expect(byTestId(root, 'error-username')).toBeNull();
  });
});

describe('кит Vuetify: визард и массив', () => {
  // Поток без правил шагов: проверяется визард, а не правила формы.
  const form = () =>
    createForm({
      model: createLoanModel(),
      schema: loanDocument as unknown as AnySchema,
      registry,
      flow: { steps: [{ id: 'step1' }, { id: 'step2' }] },
    });

  it('шапка шагов, кнопки ui-kit: на первом шаге нет «Назад», на последнем — «Отправить»', async () => {
    const root = mount(form());
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
    const root = mount(bundle);
    get(root, 'btn-next').click();
    await settle();
    const rows = (): number =>
      root.querySelectorAll(
        '[data-testid^="array-item-"]:not([data-testid*="-remove"]):not([data-testid*="-move"])'
      ).length;
    expect(rows()).toBe(0);

    get(root, 'array-add').click();
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

describe('кит Vuetify: кредитная заявка', () => {
  it('документ со всеми компонентами рисуется; список и радио берут варианты из справочников', () => {
    const bundle = createForm({
      model: createCreditModel(),
      schema: creditDocument as unknown as AnySchema,
      registry,
      flow: creditFlow,
    });
    const root = mount(bundle);

    expect(byTestId(root, 'field-loanType')).not.toBeNull();
    expect(get(root, 'input-loanType').getAttribute('data-value')).toBe(
      String((bundle.model.get() as { loanType: unknown }).loanType ?? '')
    );
    expect(root.querySelectorAll('section.kit-section').length).toBeGreaterThan(0);
  });
});
