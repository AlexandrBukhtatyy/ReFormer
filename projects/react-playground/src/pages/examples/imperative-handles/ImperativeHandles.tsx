/**
 * Императивные handle полей UI-kit, доступные из render-схемы по селектору.
 *
 * Демонстрирует мост «селектор → живой компонент»: `schema.node(sel).getRef<H>()` отдаёт
 * императивный handle поля, которым behaviors/кнопки управляют тем, что НЕ выражается реактивно
 * (focus / scrollIntoView / открыть дропдаун / переключить видимость пароля / очистить выбор).
 *
 * Реактивное состояние (value / disabled / visible / options / validation) через handle НЕ трогаем —
 * оно остаётся в слое behaviors. См. docs/plans/useimperativehandle-refactored-blossom.md.
 *
 * Покрывает оба способа адресации листа:
 *  - явный `selector` (поле пароля — `'pwd'`);
 *  - неявный `__path` сигнала модели (`email`, `city`, `amount`, `nickname`) — фича Фазы 4,
 *    благодаря которой пути из `validateFormModel().errors` напрямую годятся как ключ ref.
 */

import { useMemo } from 'react';
import { createModel, createForm, validateFormModel, type FormModel } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { FormRenderer, createRenderSchema } from '@reformer/renderer-react';
import type { RenderNode, RenderSchemaProxy } from '@reformer/renderer-react';
import {
  Box,
  FormField,
  InputField,
  InputPasswordField,
  SelectField,
  type FieldHandle,
  type InputPasswordHandle,
  type SelectAsyncHandle,
} from '@reformer/ui-kit';

interface ImperativeDemoForm {
  email: string;
  password: string;
  city: string;
  amount: number | null;
  nickname: string;
}

const INITIAL: ImperativeDemoForm = {
  email: '',
  password: '',
  city: '',
  amount: null,
  nickname: '',
};

const CITIES = [
  { value: 'msk', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
  { value: 'nsk', label: 'Новосибирск' },
];

/**
 * Единая схема (M1): лист несёт `value` (сигнал модели) + `component` + `componentProps`.
 * Селектор задан ТОЛЬКО у пароля — остальные адресуются по `__path` сигнала.
 */
function buildSchema(model: FormModel<ImperativeDemoForm>): RenderNode<ImperativeDemoForm> {
  return {
    component: Box,
    componentProps: { className: 'space-y-4 bg-white p-6 rounded-lg shadow-md' },
    children: [
      {
        value: model.$.email,
        component: InputField,
        componentProps: { label: 'Email', placeholder: 'you@example.com' },
        validators: [required({ message: 'Укажите email' })],
      },
      {
        // Явный selector — проверяет ветку адресации по селектору (а не по __path).
        selector: 'pwd',
        value: model.$.password,
        component: InputPasswordField,
        componentProps: { label: 'Пароль', placeholder: 'Пароль' },
      },
      {
        value: model.$.city,
        component: SelectField,
        componentProps: {
          label: 'Город',
          placeholder: 'Выберите город',
          options: CITIES,
          clearable: true,
        },
      },
      {
        value: model.$.amount,
        component: InputField,
        componentProps: { label: 'Сумма', type: 'number', placeholder: '0' },
      },
      {
        value: model.$.nickname,
        component: InputField,
        componentProps: { label: 'Никнейм', placeholder: 'nickname' },
        validators: [required({ message: 'Укажите никнейм' })],
      },
    ],
  } as unknown as RenderNode<ImperativeDemoForm>;
}

/** Порядок полей для сценария «сфокусировать первое невалидное» (ключи = __path/selector). */
const FIELD_ORDER: Array<{ path: string; refKey: string }> = [
  { path: 'email', refKey: 'email' },
  { path: 'password', refKey: 'pwd' },
  { path: 'city', refKey: 'city' },
  { path: 'amount', refKey: 'amount' },
  { path: 'nickname', refKey: 'nickname' },
];

/**
 * Render-схема + поведение. КЛЮЧЕВОЕ: `getRef()` вызывается здесь, на этапе применения поведения,
 * ДО первого рендера — getRef намеренно не бампает version-сигнал, поэтому ref, запрошенный позже,
 * уже не будет прикреплён к ноде (см. R2 в плане).
 */
function createImperativeRenderSchema(model: FormModel<ImperativeDemoForm>) {
  const schema = createRenderSchema<ImperativeDemoForm>(() => buildSchema(model));
  for (const { refKey } of FIELD_ORDER) {
    schema.node(refKey).getRef();
  }
  return schema;
}

function ControlPanel({
  schema,
  model,
}: {
  schema: RenderSchemaProxy<ImperativeDemoForm>;
  model: FormModel<ImperativeDemoForm>;
}) {
  const btn =
    'rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50';

  const focusFirstInvalid = async () => {
    const res = await validateFormModel(model, buildSchema(model) as never);
    if (res.valid) return;
    const first = FIELD_ORDER.find(({ path }) => (res.errors[path]?.length ?? 0) > 0);
    if (!first) return;
    const ref = schema.node(first.refKey).getRef<FieldHandle>();
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ref.current?.focus();
  };

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p className="mb-3 text-sm font-semibold text-blue-800">
        Императивное управление компонентами по селектору (schema.node(sel).getRef())
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          className={btn}
          data-testid="btn-focus-email"
          onClick={() => schema.node('email').getRef<FieldHandle>().current?.focus()}
        >
          Focus email (по __path)
        </button>
        <button
          className={btn}
          data-testid="btn-toggle-password"
          onClick={() =>
            schema.node('pwd').getRef<InputPasswordHandle>().current?.toggleVisibility()
          }
        >
          Переключить видимость пароля (по selector)
        </button>
        <button
          className={btn}
          data-testid="btn-open-city"
          onClick={() => schema.node('city').getRef<SelectAsyncHandle>().current?.open()}
        >
          Открыть список городов
        </button>
        <button
          className={btn}
          data-testid="btn-close-city"
          onClick={() => schema.node('city').getRef<SelectAsyncHandle>().current?.close()}
        >
          Закрыть список
        </button>
        <button
          className={btn}
          data-testid="btn-clear-city"
          onClick={() => schema.node('city').getRef<SelectAsyncHandle>().current?.clear()}
        >
          Очистить город
        </button>
        <button
          className={btn}
          data-testid="btn-focus-amount"
          onClick={() => schema.node('amount').getRef<FieldHandle>().current?.focus()}
        >
          Focus суммы (number-буфер)
        </button>
        <button className={btn} data-testid="btn-focus-first-invalid" onClick={focusFirstInvalid}>
          Focus первого невалидного
        </button>
      </div>
    </div>
  );
}

function ImperativeHandles() {
  const { form, model } = useMemo(() => {
    const model = createModel<ImperativeDemoForm>({ ...INITIAL });
    const form = createForm<ImperativeDemoForm>({
      model,
      schema: buildSchema(model) as never,
    });
    return { model, form };
  }, []);
  void form;

  const schema = useMemo(() => createImperativeRenderSchema(model), [model]);

  return (
    <div className="w-full">
      <ControlPanel schema={schema} model={model} />
      <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}

export default ImperativeHandles;
