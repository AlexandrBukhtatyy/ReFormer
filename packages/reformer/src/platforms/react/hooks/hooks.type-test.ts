/**
 * Compile-time тест React-хуков `@reformer/core/react`. Проверяется `tsc` (файл под `src`,
 * `include: ["src"]`); vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что снимок `useFormControl` следует виду контрола: поле — `FieldControlState<T>` со
 * значением поля, массив под-форм — `ArrayControlState<T>` с длиной и собственными замечаниями,
 * `undefined` — пустой снимок массива; что `useFormControlValue` и `useArrayLength` принимают только
 * свой вид ноды, `useFormBundle` выводит форму данных из фабрики, а хуки потока, проверки и связки
 * поля отдают типизированные снимки.
 *
 * Хуки вызываются внутри функции-хука (`use…`) — так требует правило хуков React; сама функция
 * нигде не вызывается.
 */

import type { Ref, RefObject } from 'react';
import { createForm, type FormBundle } from '../../../form/form-bundle';
import type { FormFlow } from '../../../form/flow/flow';
import type { ValidationIssue } from '../../../form/types/contracts';
import type { FormArray, FormControl, FormGroup } from '../../../form/types/nodes';
import type { ValidationDefinition } from '../../../form/validation/types';
import type { FormModel } from '../../../model/types';
import {
  useArrayLength,
  useFieldHandleRef,
  useFormBundle,
  useFormControl,
  useFormControlValue,
  useFormFlow,
  useFormValidation,
  type ArrayControlState,
  type FieldControlState,
  type FieldHandle,
  type FormFlowSnapshot,
  type UseFormValidationResult,
} from '../index';

interface Phone {
  number: string;
}
interface Profile {
  email: string;
  /** Пустое числовое поле — `null`. */
  age: number | null;
  address: { city: string };
  phones: Phone[];
  tags: string[];
}

/** Handle композита со своими командами — расширяет базовый контракт поля. */
interface PickerHandle extends FieldHandle {
  open(): void;
}

declare const form: FormGroup<Profile>;
declare const model: FormModel<Profile>;
declare const rules: ValidationDefinition<Profile>;
declare const addressRules: ValidationDefinition<{ city: string }>;
declare const optionalPhones: FormArray<Phone> | undefined;
declare const optionalEmail: FormControl<string> | undefined;
declare const flow: FormFlow;
declare const optionalFlow: FormFlow | undefined;
declare const fieldRef: Ref<FieldHandle>;
declare const pickerRef: Ref<PickerHandle>;

/** `useFormControl`: снимок по виду контрола. */
export function useFormControlTypeChecks(): void {
  // Поле — значение поля и состояние для разметки.
  const email: FieldControlState<string> = useFormControl(form.email);
  const emailIssues: ValidationIssue[] = email.issues;
  const showError: boolean = email.shouldShowError;
  const props: Record<string, unknown> = email.componentProps;
  // Пустое значение поля остаётся в типе снимка.
  const age: number | null = useFormControl(form.age).value;
  // Массив как значение поля (мультивыбор) — тоже поле, а не массив под-форм.
  const tags: FieldControlState<string[]> = useFormControl(form.tags);
  // Массив под-форм — длина, значения строк и собственные замечания массива.
  const phones: ArrayControlState<Phone> = useFormControl(form.phones);
  const phoneCount: number = phones.length;
  const phoneValues: Phone[] = phones.value;
  const ownIssues: ValidationIssue[] = phones.ownIssues;
  // `undefined` и необязательный массив — снимок массива: пустой, пока контрола нет.
  const empty: ArrayControlState<object> = useFormControl(undefined);
  const optional: ArrayControlState<Phone> = useFormControl(optionalPhones);

  // @ts-expect-error — пустое значение из снимка не пропадает
  const strictAge: number = useFormControl(form.age).value;
  // @ts-expect-error — у поля нет длины: это не массив под-форм
  void email.length;
  // @ts-expect-error — массив целиком в значении поля — поле, у снимка нет `length`
  void tags.length;
  // @ts-expect-error — у массива под-форм нет `shouldShowError`: ошибку строки показывает строка
  void phones.shouldShowError;
  // @ts-expect-error — у группы снимка нет: хук — для поля и массива под-форм
  useFormControl(form.address);
  // поведение под вопросом: `undefined` даёт снимок МАССИВА (`length`, `value: []`), поэтому
  // необязательное поле хук не принимает — пример из JSDoc с `FormArray<string>` тоже не собрать.
  // @ts-expect-error — необязательное поле: перегрузка с `undefined` есть только у массива
  useFormControl(optionalEmail);

  void [emailIssues, showError, props, age, phoneCount, phoneValues, ownIssues, empty, optional];
  void strictAge;
}

/** `useFormControlValue` и `useArrayLength` — точечные подписки своего вида ноды. */
export function useNarrowSubscriptionTypeChecks(): void {
  const email: string = useFormControlValue(form.email);
  const age: number | null = useFormControlValue(form.age);
  const tags: string[] = useFormControlValue(form.tags);
  const phoneCount: number = useArrayLength(form.phones);

  // @ts-expect-error — значение массива под-форм хук не отдаёт: строки — ноды, а не значения
  useFormControlValue(form.phones);
  // @ts-expect-error — тип значения — тип поля
  const wrong: number = useFormControlValue(form.email);
  // @ts-expect-error — длина — только у массива под-форм: мультивыбор — поле
  useArrayLength(form.tags);

  void [email, age, tags, phoneCount, wrong];
}

/** `useFormFlow`, `useFormValidation`, `useFormBundle`, `useFieldHandleRef`. */
export function useAssemblyHookTypeChecks(): void {
  // Поток — снимок сигналов потока.
  const snapshot: FormFlowSnapshot = useFormFlow(flow);
  const current: string = snapshot.current;
  const index: number = snapshot.index;
  const completed: ReadonlySet<string> = snapshot.completed;
  // поведение под вопросом: хук потока требует поток — `bundle.flow` есть не у каждой сборки, и
  // вызвать хук условно нельзя; сужают сам бандл (`if (!bundle.flow) return null`) до хуков.
  // @ts-expect-error — поток может отсутствовать
  useFormFlow(optionalFlow);

  // Стратегия живой проверки — модель и схема одной формы данных.
  const validation: UseFormValidationResult = useFormValidation({
    model,
    schema: rules,
    strategy: 'afterFirstSubmit',
    debounce: 300,
    liveAfterSubmit: 'blur',
  });
  const submitted: Promise<boolean> = validation.submit();
  const validating: boolean = validation.isValidating;
  // @ts-expect-error — схема адреса не подходит модели профиля
  useFormValidation({ model, schema: addressRules });
  // @ts-expect-error — стратегий четыре: `submit`, `blur`, `change`, `afterFirstSubmit`
  useFormValidation({ model, schema: rules, strategy: 'input' });

  // Бандл: форма данных выводится из фабрики.
  const bundle = useFormBundle(() => createForm({ initial: { email: '', agree: false } }));
  const typedBundle: FormBundle<{ email: string; agree: boolean }> = bundle;
  const agree: FormControl<boolean> = bundle.form.agree;
  const profile: FormBundle<Profile> = useFormBundle(() => createForm<Profile>({ model }));
  const profileFlow: FormFlow | undefined = profile.flow;
  // @ts-expect-error — такого поля в выведенной форме данных нет
  void bundle.form.phone;
  // @ts-expect-error — фабрика возвращает бандл сборки
  useFormBundle(() => 42);

  // Связка поля: ref потребителя получает handle, контролу отдаётся свой ref.
  const controlRef: RefObject<unknown> = useFieldHandleRef(fieldRef);
  const withoutConsumer: RefObject<unknown> = useFieldHandleRef(undefined);
  const pickerControlRef: RefObject<unknown> = useFieldHandleRef<PickerHandle>(pickerRef);
  // @ts-expect-error — возвращённый ref вешается на контрол: handle из него не прочитать
  const handle: FieldHandle | null = useFieldHandleRef(fieldRef).current;
  // @ts-expect-error — ref потребителя — ref на handle указанного вида
  useFieldHandleRef<PickerHandle>(fieldRef);

  void [current, index, completed, submitted, validating, typedBundle, agree, profileFlow];
  void [controlRef, withoutConsumer, pickerControlRef, handle];
}

/** Снимки только для чтения: менять их бессмысленно — следующий рендер отдаст новый. */
export function snapshotTypeChecks(
  snapshot: FormFlowSnapshot,
  field: FieldControlState<string>
): void {
  // @ts-expect-error — шаг меняют методы потока (`flow.goTo`), а не снимок
  snapshot.current = 'contacts';
  // @ts-expect-error — пройденные шаги снимка — только для чтения
  snapshot.completed.add('contacts');
  // поведение под вопросом: снимок поля, в отличие от снимка потока, не `readonly` — запись
  // компилируется, на ноду не влияет и портит закэшированный снимок до следующего изменения.
  field.value = 'user@mail.com';
}
