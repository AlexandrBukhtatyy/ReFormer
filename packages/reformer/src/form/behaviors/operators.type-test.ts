/**
 * Compile-time тест операторов поведения `@reformer/core/behaviors`. Проверяется `tsc` (файл под
 * `src`, `include: ["src"]`); vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что:
 *  - область `defineFormBehavior(({ model, form, schema, flow }) => …)` типизирована формой данных,
 *    а поток шагов в ней необязательный;
 *  - тип цели связывает операторы над полем: `compute` / `computeFrom` / `transformValue` /
 *    `resetWhen` / `syncFields` не пишут значение чужого типа, `transform` у `copyFrom` и
 *    `syncFields` получает значение источника, колбэк `onChange` — значение поля и `{ signal }`;
 *  - `enableWhen` / `disableWhen` принимают поле, список полей и группу, а условие — `boolean`;
 *  - операторы коллекций отдают под-схеме под-модель группы или строки массива;
 *  - правила узлов схемы (`hideWhen`, `patchProps`, `onComponentEvent`, …) берут узел своей области.
 *
 * Дефекты типов размечены `[ReFormer-xxxx]`: строка под `@ts-expect-error` с меткой обязана
 * компилироваться после исправления (директива станет лишней и `tsc` упадёт), строка с меткой в
 * комментарии — перестать компилироваться.
 */

import type { FormModel } from '../../model/types';
import type { FormFlow, FlowTransition } from '../flow/flow';
import type { FormGroup } from '../types/nodes';
import {
  aggregateInto,
  apply,
  applyEach,
  compute,
  computeFrom,
  copyFrom,
  defer,
  defineFormBehavior,
  disableWhen,
  effect,
  enableWhen,
  exclusiveFlag,
  getScope,
  hideWhen,
  onChange,
  onComponentEvent,
  onDispose,
  onInit,
  onMount,
  onUnmount,
  renderEffect,
  resetWhen,
  revalidateWhen,
  syncFields,
  transformValue,
  type BehaviorCleanup,
  type BehaviorScope,
  type ChangeContext,
  type FormBehavior,
  type ReadonlySignal,
  type SchemaNodeControl,
  type SchemaScope,
  type Signal,
} from './index';

interface Address {
  region: string;
  city: string;
  postalCode: string;
}
interface Phone {
  number: string;
  primary: boolean;
}
interface Share {
  percent: number;
}
interface Recipient {
  name: string;
}
interface Order {
  title: string;
  /** Пустое числовое поле — `null`. */
  amount: number | null;
  status: 'new' | 'paid';
  price: number;
  quantity: number;
  total: number;
  email: string;
  notifyEmail: string;
  phone: string;
  smsPhone: string;
  promoCode: string;
  sameAddress: boolean;
  registration: Address;
  residence: Address;
  recipient: Recipient;
  phones: Phone[];
  shares: Share[];
  tags: string[];
  savedTags: string[];
}

declare const addressBehavior: FormBehavior<Address>;
declare const phoneBehavior: FormBehavior<Phone>;

/** Область схемы: модель, ноды и схема — формы данных поведения; поток — необязательный. */
export const scopeTypeChecks = defineFormBehavior<Order>(({ model, form, schema, flow }) => {
  const scopedModel: FormModel<Order> = model;
  const scopedForm: FormGroup<Order> = form;
  const scopedSchema: SchemaScope = schema;
  const scopedFlow: FormFlow | undefined = flow;
  const transition: FlowTransition | undefined = flow?.goTo('payment');
  // getScope — та же область для пользовательского оператора; форму данных указывают явно.
  const scope: BehaviorScope<Order> = getScope<Order>();

  // @ts-expect-error — без `flow` в конфиге сборки потока нет: переход — только через проверку
  flow.goTo('payment');
  // @ts-expect-error — в форме заказа нет поля доставки
  void model.delivery;
  // @ts-expect-error — `form` отдаёт ноды, а значение поля читают из модели
  const titleValue: string = form.title;

  void [scopedModel, scopedForm, scopedSchema, scopedFlow, transition, scope, titleValue];
});

/** Поведение привязано к своей форме данных. */
export function behaviorShapeTypeChecks(): void {
  const order: FormBehavior<Order> = scopeTypeChecks;
  // @ts-expect-error — поведение заказа не подходит подформе адреса
  const foreign: FormBehavior<Address> = scopeTypeChecks;
  void [order, foreign];
}

/** Вычисляемые поля: тип результата — тип цели. */
export const computeTypeChecks = defineFormBehavior<Order>(({ model }) => {
  compute(model.$.total, () => model.price * model.quantity);
  compute(model.$.total, () => model.price, { when: () => model.quantity > 0 });
  // Источники — массив ручек; результат `fn` — значение цели.
  computeFrom(
    [model.$.price, model.$.quantity],
    model.$.total,
    (price: number, quantity: number) => price * quantity,
    { when: (price: number) => price > 0 }
  );

  // @ts-expect-error — строка в числовое поле
  compute(model.$.total, () => model.title);
  // @ts-expect-error — цель — ручка `model.$.total`, а не значение `model.total`
  compute(model.total, () => 1);
  // @ts-expect-error — результат `fn` — строка, а цель числовая
  computeFrom([model.$.title], model.$.total, (title: string) => title);
  // @ts-expect-error — источники — массив ручек, а не одна ручка
  computeFrom(model.$.price, model.$.total, (price: number) => price);

  // Тип цели задаёт поле, а не вычисление (`NoInfer`): `Signal` ковариантен, и без этого
  // `number | null` расширял бы цель, а в поле `number` писался бы `null`.
  // @ts-expect-error — `number | null` в поле `number`
  compute(model.$.total, () => model.amount);
  // @ts-expect-error — строка в поле-объединение литералов
  compute(model.$.status, () => model.title);
  // @ts-expect-error — `null` из `fn` в поле `number`
  computeFrom([model.$.amount], model.$.total, (amount: number | null) => amount);

  // поведение под вопросом: значения источников в `fn` не типизированы (`...values: any[]`) —
  // перепутанный порядок источников компилируется; так сигнатура описана и в документации.
  computeFrom([model.$.title, model.$.price], model.$.total, (price: number) => price);
  // поведение под вопросом: ручка группы структурно совпадает с `Signal` (readonly `value`
  // присваиваемости не мешает) — `compute` в группу компилируется, а запись в неё бросает TypeError.
  compute(model.$.registration, () => ({ region: '', city: '', postalCode: '' }));
});

/** Значения полей: копирование, синхронизация, преобразование, сброс, реакция на изменение. */
export const valueOperatorTypeChecks = defineFormBehavior<Order>(({ model }) => {
  // copyFrom: поле в поле того же типа; `transform` получает значение источника.
  copyFrom(model.$.email, model.$.notifyEmail, {
    when: () => model.sameAddress,
    transform: (email) => email.trim().toLowerCase(),
  });
  // Группа в группу той же формы; `transform` получает снимок группы-источника.
  copyFrom(model.$.registration, model.$.residence, {
    when: () => model.sameAddress,
    transform: (address) => ({ ...address, postalCode: address.postalCode.trim() }),
  });
  // Массив — значением целиком.
  copyFrom(model.$.tags, model.$.savedTags, { transform: (tags) => [...tags].sort() });

  // @ts-expect-error — `transform` возвращает значение того же типа
  copyFrom(model.$.email, model.$.notifyEmail, { transform: (email) => email.length });
  copyFrom(model.$.registration, model.$.residence, {
    // @ts-expect-error — `transform` группы возвращает группу той же формы
    transform: (address) => address.city,
  });

  // [ReFormer-9kuc] сейчас компилируется, а не должно: строка копируется в числовое поле — ветка
  // `| object` в типе источника и цели отключает проверку совместимости.
  copyFrom(model.$.title, model.$.amount);
  // [ReFormer-9kuc] сейчас компилируется, а не должно: группа адреса копируется в группу получателя —
  // у форм данных нет ни одного общего поля.
  copyFrom(model.$.registration, model.$.recipient);
  // [ReFormer-9kuc] сейчас компилируется, а не должно: группа адреса копируется в массив телефонов.
  copyFrom(model.$.registration, model.$.phones);
  // [ReFormer-9kuc] сейчас компилируется, а не должно: value-фасады вместо ручек `model.$`.
  copyFrom(model.registration, model.residence);

  // syncFields: два поля одного типа, `transform` — направление `a → b`.
  syncFields(model.$.phone, model.$.smsPhone, { transform: (phone) => phone.replace(/\D/g, '') });
  // @ts-expect-error — поля разных типов не синхронизируются
  syncFields(model.$.phone, model.$.amount);
  // @ts-expect-error — `transform` возвращает значение того же типа
  syncFields(model.$.phone, model.$.smsPhone, { transform: (phone) => phone.length });
  // @ts-expect-error — тип пары задаёт первое поле: `number | null` во второе не расширяет его до `null`
  syncFields(model.$.total, model.$.amount);
  // поведение под вопросом: в обратном порядке пара компилируется — `Signal` ковариантен, поле
  // `number` подходит под `number | null`, и синхронизация пишет `null` в `total`.
  syncFields(model.$.amount, model.$.total);

  // transformValue: значение поля → значение того же типа.
  transformValue(model.$.promoCode, (code) => code.toUpperCase().replace(/\s+/g, ''));
  // @ts-expect-error — преобразование не меняет тип поля
  transformValue(model.$.promoCode, (code) => code.length);
  // @ts-expect-error — и не расширяет его: `null` в поле `number`
  transformValue(model.$.total, (total) => (total > 0 ? total : null));

  // resetWhen: `resetValue` — значение поля; полю с `null` он не нужен (сброс в `null`).
  resetWhen(model.$.promoCode, () => model.sameAddress, { resetValue: '' });
  resetWhen(model.$.amount, () => model.quantity === 0);
  // @ts-expect-error — `resetValue` другого типа
  resetWhen(model.$.total, () => model.sameAddress, { resetValue: 'none' });
  // @ts-expect-error — `resetValue: null` в поле `number`
  resetWhen(model.$.total, () => model.sameAddress, { resetValue: null });
  // [ReFormer-2183] сейчас компилируется, а не должно: без `resetValue` оператор пишет `null` в поле
  // `string` — документация называет это ошибкой, а тип её пропускает.
  resetWhen(model.$.promoCode, () => model.sameAddress);

  // revalidateWhen: зависимости — ручки поля и группы, колбэк без аргументов.
  revalidateWhen([model.$.price, model.$.registration], () => undefined);
  // @ts-expect-error — зависимости — массив ручек
  revalidateWhen(model.$.price, () => undefined);

  // onChange: колбэк получает значение поля и `{ signal }` — отмену устаревшего вызова.
  onChange(
    model.$.registration.region,
    async (region, { signal }) => {
      const value: string = region;
      const abort: AbortSignal = signal;
      void [value, abort];
    },
    { debounce: 300 }
  );
  onChange(model.$.amount, (amount) => void (amount ?? 0).toFixed(), { immediate: true });
  // Группа — значение целиком.
  onChange(model.$.registration, (address) => void address.city.trim());
  const typedContext = (title: string, context: ChangeContext): void => void [title, context];
  onChange(model.$.title, typedContext);

  // @ts-expect-error — значение `model.$.title` — строка
  onChange(model.$.title, (title: number) => void title);
  // @ts-expect-error — у контекста реакции только `signal`
  onChange(model.$.title, (_title, { controller }) => void controller);
  // @ts-expect-error — у реакции нет `throttle`: только `debounce` и `immediate`
  onChange(model.$.title, () => undefined, { throttle: 100 });
});

/** Доступность: поле, список полей, группа и массив; условие — `boolean`. */
export const availabilityTypeChecks = defineFormBehavior<Order>(({ model }) => {
  enableWhen(model.$.promoCode, () => model.quantity > 1);
  enableWhen([model.$.price, model.$.quantity], () => !model.sameAddress, {
    resetOnDisable: true,
  });
  enableWhen(model.$.residence, () => !model.sameAddress);
  disableWhen(model.$.phones, () => model.sameAddress);
  disableWhen([model.$.residence, model.$.promoCode], () => model.sameAddress, {
    resetOnDisable: true,
  });

  // @ts-expect-error — условие возвращает `boolean`, а не строку
  enableWhen(model.$.promoCode, () => model.title);
  // @ts-expect-error — цель — ручка поля, а не его значение
  enableWhen(model.promoCode, () => true);
  // @ts-expect-error — у `disableWhen` нет `resetValue`: только `resetOnDisable`
  disableWhen(model.$.promoCode, () => true, { resetValue: '' });

  // [ReFormer-9kuc] сейчас компилируется, а не должно: value-фасад группы вместо ручки — ноды по нему
  // в реестре нет, и оператор молча ничего не делает (ветка `| object` в `EnableTarget`).
  enableWhen(model.residence, () => !model.sameAddress);
});

/** Коллекции и под-модели: под-схема получает под-модель группы или строки. */
export const collectionTypeChecks = defineFormBehavior<Order>(({ model }) => {
  // apply: группа (одна или несколько) и поведение её формы.
  apply(model.$.registration, addressBehavior);
  apply([model.$.registration, model.$.residence], addressBehavior);
  // applyEach: массив под-форм и поведение строки; под-модель и нода — строки.
  applyEach(model.$.phones, phoneBehavior);
  applyEach(
    model.$.phones,
    defineFormBehavior<Phone>(({ model: phone, form }) => {
      const number: string = phone.number;
      const row: FormGroup<Phone> = form;
      compute(phone.$.number, () => phone.number.trim());
      void [number, row];
    })
  );
  // exclusiveFlag: флаг строки — булева ручка.
  exclusiveFlag(model.$.phones, (phone: FormModel<Phone>) => phone.$.primary);
  // aggregateInto: снимок строк → правки строк.
  aggregateInto(model.$.shares, (shares: Share[]) => [
    { index: shares.length - 1, patch: { percent: 100 } },
  ]);

  // @ts-expect-error — флаг строки — булево поле
  exclusiveFlag(model.$.phones, (phone: FormModel<Phone>) => phone.$.number);
  // @ts-expect-error — правка строки — часть элемента массива
  aggregateInto(model.$.shares, (_shares: Share[]) => [{ index: 0, patch: { percent: '100' } }]);

  // Пример из JSDoc `exclusiveFlag`: тип строки — из ручки массива [ReFormer-hsg0].
  exclusiveFlag(model.$.phones, (phone) => phone.$.primary);
  aggregateInto(model.$.shares, (shares) => {
    const others = shares
      .slice(0, -1)
      // Пример из документации: строки — снимки элементов массива [ReFormer-hsg0].
      .reduce((sum, share) => sum + share.percent, 0);
    return [{ index: shares.length - 1, patch: { percent: 100 - Number(others) } }];
  });
  applyEach(
    model.$.phones,
    // Схема строки на месте: тип строки — из ручки массива [ReFormer-hsg0].
    defineFormBehavior(({ model: phone }) => void phone.$.number)
  );

  // @ts-expect-error — поведение телефона на группе адреса: тип под-схемы — из ручки группы
  apply(model.$.registration, phoneBehavior);
  // @ts-expect-error — поведение адреса на строках телефонов: тип строки — из ручки массива
  applyEach(model.$.phones, addressBehavior);
  // @ts-expect-error — ручка массива вместо группы: под-модели у массива нет
  apply(model.$.phones, addressBehavior);
});

/** Правила узлов схемы и низкоуровневый набор авторинга пользовательского оператора. */
export const schemaNodeTypeChecks = defineFormBehavior<Order>(({ model, schema, flow }) => {
  const summary: SchemaNodeControl = schema.node('summary');
  hideWhen(summary, () => model.quantity === 0);
  // Правки узла — цепочкой на том же узле.
  const chained: SchemaNodeControl = summary
    .patchProps({ title: 'Итого' })
    .setHidden(false)
    .resetHidden()
    .resetProps();
  onInit(summary, () => summary.patchProps({ total: model.total }));
  onMount(summary, () => () => undefined);
  onUnmount(summary, () => undefined);
  onComponentEvent(schema.node('wizard'), 'onStepClick', (stepId: string) => flow?.goTo(stepId));
  const panel: { current: HTMLElement | null } = summary.getRef<HTMLElement>();
  renderEffect(schema, () => {
    panel.current?.scrollIntoView();
    return () => undefined;
  });

  // @ts-expect-error — условие скрытия — `boolean`
  hideWhen(summary, () => model.title);
  // @ts-expect-error — узел берут из схемы области (`schema.node(selector)`), а не строкой
  hideWhen('summary', () => true);
  // @ts-expect-error — пропсы — объект
  summary.patchProps('Итого');
  // @ts-expect-error — `onMount` возвращает очистку либо ничего
  onMount(summary, () => 42);
  // @ts-expect-error — `renderEffect` получает схему области, а не узел
  renderEffect(summary, () => undefined);

  void chained;
});

/** Пользовательский оператор на `getScope` / `effect` / `defer` / `onDispose`. */
export function showProgress(selector: string, handles: readonly ReadonlySignal<unknown>[]): void {
  const node = getScope<unknown>().schema.node(selector);
  effect(() => {
    const filled = handles.filter((handle) => handle.value !== '').length;
    defer(() => node.patchProps({ progress: filled }));
  });
  const cleanup: BehaviorCleanup = () => node.patchProps({ progress: undefined });
  onDispose(cleanup);

  // @ts-expect-error — эффект возвращает очистку либо ничего
  effect(() => 42);
  // @ts-expect-error — отложенная запись — функция без аргументов
  defer((value: number) => void value);
}

/** Ручки модели совместимы с сигнальными типами входа `./behaviors`. */
export function signalTypeChecks(model: FormModel<Order>): void {
  const writable: Signal<string> = model.$.title;
  const readable: ReadonlySignal<Address> = model.$.registration;
  // @ts-expect-error — ручка поля строки — не сигнал числа
  const wrong: Signal<number> = model.$.title;
  void [writable, readable, wrong];
}
