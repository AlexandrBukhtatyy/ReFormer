/**
 * Compile-time проверка входов сабпатов `@reformer/core`. Проверяется `tsc`
 * (`tsconfig.tests.json`); vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что каждый вход — `.` (`src/index.ts`), `./model`, `./behaviors`, `./validation`,
 * `./validators`, `./i18n`, `./signals`, `./react` — отдаёт документированные типы и значения
 * (`packages/reformer/docs/llms/07-complete-import.md`), а имена, удалённые вторым проходом контракта
 * (таблица «Было → Стало» в `docs/plans/idempotent-mixing-sutherland.md`, раздел «Удалено» в
 * `docs/llms/17-nonexistent-api.md`), из входов не импортируются. Корень и `./i18n` React не отдают.
 * Имена значений во время выполнения сверяет `tests/core/utils/root-exports.test.ts`; здесь — типы,
 * которых в рантайме нет.
 */

import { expectTypeOf } from 'vitest';
import type * as Behaviors from '../../src/form/behaviors/index';
import type * as Validation from '../../src/form/validation/index';
import type * as Validators from '../../src/form/validators/index';
import type * as I18n from '../../src/i18n';
import type * as Root from '../../src/index';
import type * as Model from '../../src/model/index';
import type * as ReactEntry from '../../src/react';
import type * as Signals from '../../src/signals';

// ─── Удалённые имена ─────────────────────────────────────────────────────────────────────────

// @ts-expect-error — `ValidationError` удалён: замечание — `ValidationIssue`
import type { ValidationError as _ValidationError } from '../../src/index';
// @ts-expect-error — `ValidateOptions` удалён: опции правила — `RuleOptions`
import type { ValidateOptions as _ValidateOptions } from '../../src/index';
// @ts-expect-error — `ValidationSchema` удалён: схема — `ValidationDefinition`
import type { ValidationSchema as _ValidationSchema } from '../../src/form/validation/index';
// @ts-expect-error — `defineValidationSchema` удалён: схему объявляет `defineValidation`
import { defineValidationSchema as _defineValidationSchema } from '../../src/form/validation/index';
// @ts-expect-error — `resolveValidationError` удалён: текст замечания даёт `resolveIssueMessage`
import { resolveValidationError as _resolveValidationError } from '../../src/i18n';
// @ts-expect-error — `useValidationMessage` удалён: хук текста — `useIssueMessage`
import { useValidationMessage as _useValidationMessage } from '../../src/react';
// @ts-expect-error — `FieldNode` удалён: нода поля — `FormControl`
import type { FieldNode as _FieldNode } from '../../src/index';
// @ts-expect-error — `GroupNode` удалён: нода группы — `FormGroup`
import type { GroupNode as _GroupNode } from '../../src/index';
// @ts-expect-error — `FormProxy` удалён: тип группы — `FormGroup`
import type { FormProxy as _FormProxy } from '../../src/index';
// @ts-expect-error — `ModelArrayNode` — внутренний класс модели: нода массива — `FormArray`
import type { ModelArrayNode as _ModelArrayNode } from '../../src/model/index';
// @ts-expect-error — `isFieldNode` удалён: гард поля — `isFormControl`
import { isFieldNode as _isFieldNode } from '../../src/index';
// @ts-expect-error — `isGroupNode` удалён: гард группы — `isFormGroup`
import { isGroupNode as _isGroupNode } from '../../src/index';
// @ts-expect-error — `isArrayNode` удалён: гард массива — `isFormArray`
import { isArrayNode as _isArrayNode } from '../../src/index';
// @ts-expect-error — `useFormArray` удалён: хук массива — `useFieldArray` (`@reformer/cdk`)
import { useFormArray as _useFormArray } from '../../src/react';
// @ts-expect-error — `FormValue` удалён: тип значения поля либо `unknown`
import type { FormValue as _FormValue } from '../../src/index';
// @ts-expect-error — `FieldStatus` удалён: состояние ноды — `valid` / `invalid` / `pending` / …
import type { FieldStatus as _FieldStatus } from '../../src/index';
// @ts-expect-error — `ErrorFilterOptions` удалён: фильтр — `node.issues.value.filter(…)`
import type { ErrorFilterOptions as _ErrorFilterOptions } from '../../src/index';

// ─── React — только во входе `./react` ───────────────────────────────────────────────────────

// @ts-expect-error — корень без React: хуки нод — во входе `@reformer/core/react`
import { useFormControl as _rootUseFormControl } from '../../src/index';
// @ts-expect-error — корень без React: сборка в компоненте — `useFormBundle` из `./react`
import { useFormBundle as _rootUseFormBundle } from '../../src/index';
// @ts-expect-error — корень без React: снимок потока — `useFormFlow` из `./react`
import { useFormFlow as _rootUseFormFlow } from '../../src/index';
// @ts-expect-error — корень без React: контекст сборки — во входе `./react`
import { FormBundleContext as _rootFormBundleContext } from '../../src/index';
// @ts-expect-error — корень без React: типы снимков хука — во входе `./react`
import type { FieldControlState as _rootFieldControlState } from '../../src/index';
// @ts-expect-error — корень без React: связка поля с контролом — во входе `./react`
import type { FieldHandle as _rootFieldHandle } from '../../src/index';
// @ts-expect-error — `./i18n` без React: провайдер локали — во входе `./react`
import { I18nProvider as _i18nProvider } from '../../src/i18n';
// @ts-expect-error — `./i18n` без React: хук локали — во входе `./react`
import { useI18n as _i18nUseI18n } from '../../src/i18n';
// @ts-expect-error — `./i18n` без React: хук текста замечания — во входе `./react`
import { useIssueMessage as _i18nUseIssueMessage } from '../../src/i18n';
// @ts-expect-error — `./model` — реактивный субстрат без React
import { useFormControlValue as _modelUseFormControlValue } from '../../src/model/index';

// ─── Границы входов ──────────────────────────────────────────────────────────────────────────

// @ts-expect-error — операторы над сигналами — в `./model`, в корень они не входят
import { computeFrom as _rootComputeFrom } from '../../src/index';
// @ts-expect-error — операторы поведения — в `./behaviors`, в корень они не входят
import { enableWhen as _rootEnableWhen } from '../../src/index';
// @ts-expect-error — `./model` форм не знает: сборка — в корне
import { createForm as _modelCreateForm } from '../../src/model/index';
// @ts-expect-error — `./model` форм не знает: ноды — в корне
import type { FormGroup as _modelFormGroup } from '../../src/model/index';
// @ts-expect-error — операторы валидации — в `./validation`, а не среди правил
import { validate as _validatorsValidate } from '../../src/form/validators/index';
// @ts-expect-error — правила — в `./validators`, а не в корне
import { required as _rootRequired } from '../../src/index';

interface Phone {
  number: string;
}
interface Shape {
  email: string;
  phones: Phone[];
}

// ─── Документированные типы каждого входа ───────────────────────────────────────────────────

/** `.` — модель, сборка, ноды, схема, компилятор, контроллер, уровень формы и поток. */
export type RootTypes = [
  Root.FormModel<Shape>,
  Root.ModelArray<Phone>,
  Root.ModelSignals<Shape>,
  Root.ModelGroupSignals<Shape>,
  Root.ModelArraySignals<Phone, Phone[]>,
  Root.ModelObject<Shape>,
  Root.ModelValue<Phone[]>,
  Root.ModelApi<Shape>,
  Root.ModelOf<Phone[]>,
  Root.PathAwareSignal<string>,
  Root.DeepPartial<Shape>,
  Root.BehaviorCleanup,
  Root.FormBundle<Shape>,
  Root.CreateFormConfig<Shape>,
  Root.CreateFormFromModelArgs<Shape>,
  Root.FormRender,
  Root.ResolvedSchema,
  Root.SchemaResolver,
  Root.CoreForm<Shape>,
  Root.CreateFormConfigBase<Shape, Root.FormBundle<Shape>>,
  Root.FormNode<string>,
  Root.FormControl<string>,
  Root.FormGroup<Shape>,
  Root.FormArray<Phone>,
  Root.FormFields<Shape>,
  Root.ValidationIssue,
  Root.RuleOptions,
  Root.FieldConfig<string>,
  Root.ComponentRef,
  Root.FormSchemaNode,
  Root.SchemaFieldNode,
  Root.SchemaArrayNode,
  Root.SchemaPartNode,
  Root.SchemaContainerNode,
  Root.SchemaChild,
  Root.SchemaValueHandle,
  Root.SchemaArrayHandle,
  Root.SchemaGroupHandle,
  Root.SchemaArrayControl,
  Root.CompiledSchema,
  Root.CompiledNode,
  Root.CompiledChild,
  Root.CompiledFieldNode,
  Root.CompiledArrayNode,
  Root.CompiledPartNode,
  Root.CompiledContainerNode,
  Root.CompiledTextNode,
  Root.SchemaNodeId,
  Root.SchemaScopeId,
  Root.SchemaTextPart,
  Root.CompileSchemaOptions,
  Root.SchemaController,
  Root.SchemaScope,
  Root.SchemaNodeControl,
  Root.SchemaOverrideMaps,
  Root.NodeLifecycleHooks,
  Root.FormLevel<Shape>,
  Root.FormValidation<Shape>,
  Root.FormValidationState<Shape>,
  Root.FormFlowConfig<Shape>,
  Root.FlowStep<Shape>,
  Root.SubmitResult<number>,
  Root.FormFlow,
  Root.FormFlowOptions,
  Root.FlowTransition,
  Root.FlowStayReason,
];

/** `.` — значения: модель, сборка, компилятор, контроллер, поток, реестр и гарды. */
export type RootValues = [
  typeof Root.createModel,
  typeof Root.eachLeafSignal,
  typeof Root.eachValueSignal,
  typeof Root.arrayOf,
  typeof Root.isModelContainerSignal,
  typeof Root.isValueSignal,
  typeof Root.modelOf,
  typeof Root.markDerived,
  typeof Root.isDerived,
  typeof Root.unmarkDerived,
  typeof Root.runOutsideEffect,
  typeof Root.safeCallback,
  typeof Root.safeDebouncedCallback,
  typeof Root.createForm,
  typeof Root.createFormFromModel,
  typeof Root.schemaSubtree,
  typeof Root.compileSchema,
  typeof Root.isCompiledNode,
  typeof Root.createSchemaController,
  typeof Root.createSchemaScope,
  typeof Root.unknownSchemaSelectors,
  typeof Root.createFormLevel,
  typeof Root.createFormFlow,
  typeof Root.registerSignalNode,
  typeof Root.getNodeForSignal,
  typeof Root.isFormNode,
  typeof Root.isFormControl,
  typeof Root.isFormGroup,
  typeof Root.isFormArray,
  typeof Root.CORE_RUNTIME_TOKEN,
];

/** `./model` — модель, value-операции над сигналами и утилиты субстрата. */
export type ModelEntry = [
  Model.FormModel<Shape>,
  Model.ModelArray<Phone>,
  Model.ModelArraySignals<Phone, Phone[]>,
  Model.ModelGroupSignals<Shape>,
  Model.ModelObject<Shape>,
  Model.ModelValue<string>,
  Model.ModelSignals<Shape>,
  Model.ModelApi<Shape>,
  Model.ModelOf<Phone[]>,
  Model.PathAwareSignal<string>,
  Model.DeepPartial<Shape>,
  Model.BehaviorCleanup,
  typeof Model.createModel,
  typeof Model.arrayOf,
  typeof Model.modelOf,
  typeof Model.computeFrom,
  typeof Model.copyFrom,
  typeof Model.watchField,
  typeof Model.transformValue,
  typeof Model.resetWhen,
  typeof Model.syncFields,
  typeof Model.revalidateWhen,
  typeof Model.markDerived,
  typeof Model.runOutsideEffect,
];

/** `./behaviors` — контракт схемы поведения, набор авторинга и операторы. */
export type BehaviorsEntry = [
  Behaviors.BehaviorScope<Shape>,
  Behaviors.FormBehavior<Shape>,
  Behaviors.ChangeContext,
  Behaviors.Signal<string>,
  Behaviors.ReadonlySignal<string>,
  Behaviors.BehaviorCleanup,
  Behaviors.SchemaScope,
  Behaviors.SchemaNodeControl,
  typeof Behaviors.defineFormBehavior,
  typeof Behaviors.getScope,
  typeof Behaviors.onDispose,
  typeof Behaviors.effect,
  typeof Behaviors.defer,
  typeof Behaviors.compute,
  typeof Behaviors.computeFrom,
  typeof Behaviors.copyFrom,
  typeof Behaviors.onChange,
  typeof Behaviors.enableWhen,
  typeof Behaviors.disableWhen,
  typeof Behaviors.transformValue,
  typeof Behaviors.resetWhen,
  typeof Behaviors.syncFields,
  typeof Behaviors.revalidateWhen,
  typeof Behaviors.apply,
  typeof Behaviors.applyEach,
  typeof Behaviors.exclusiveFlag,
  typeof Behaviors.aggregateInto,
  typeof Behaviors.hideWhen,
  typeof Behaviors.onComponentEvent,
  typeof Behaviors.renderEffect,
  typeof Behaviors.onInit,
  typeof Behaviors.onMount,
  typeof Behaviors.onUnmount,
];

/** `./validation` — контракт правил, операторы схемы, раннер и стратегия. */
export type ValidationEntry = [
  Validation.Rule<string>,
  Validation.AsyncRule<string>,
  Validation.ValidationDefinition<Shape>,
  Validation.ValidationScope<Shape>,
  Validation.ValidationStatus,
  Validation.ValidationFailure,
  Validation.ValidationResult,
  Validation.ValidationStrategyKind,
  Validation.ValidationStrategyOptions,
  Validation.FormValidationController,
  typeof Validation.defineValidation,
  typeof Validation.validate,
  typeof Validation.validateAsync,
  typeof Validation.validateWhen,
  typeof Validation.apply,
  typeof Validation.applyEach,
  typeof Validation.runValidation,
  typeof Validation.applyValidationResult,
  typeof Validation.validateModel,
  typeof Validation.createFormValidation,
];

/** `./validators` — все 27 фабрик правил, опции и файловые утилиты. */
export type ValidatorsEntry = [
  Validators.UrlValidatorOptions,
  Validators.PhoneFormat,
  Validators.PhoneValidatorOptions,
  Validators.FileLike,
  typeof Validators.required,
  typeof Validators.min,
  typeof Validators.max,
  typeof Validators.minLength,
  typeof Validators.maxLength,
  typeof Validators.email,
  typeof Validators.pattern,
  typeof Validators.url,
  typeof Validators.phone,
  typeof Validators.isNumber,
  typeof Validators.integer,
  typeof Validators.multipleOf,
  typeof Validators.nonNegative,
  typeof Validators.nonZero,
  typeof Validators.isDate,
  typeof Validators.minDate,
  typeof Validators.maxDate,
  typeof Validators.pastDate,
  typeof Validators.futureDate,
  typeof Validators.minAge,
  typeof Validators.maxAge,
  typeof Validators.maxFileSize,
  typeof Validators.minFileSize,
  typeof Validators.fileType,
  typeof Validators.maxFiles,
  typeof Validators.minFiles,
  typeof Validators.maxTotalFileSize,
  typeof Validators.isFileLike,
  typeof Validators.matchesFileAccept,
  typeof Validators.toFileArray,
];

/** `./i18n` — формат сообщений, локаль, загрузка, перевод, тексты замечаний, описатели. */
export type I18nEntry = [
  I18n.MessageNode,
  I18n.MessagePattern,
  I18n.MessageBranches,
  I18n.MessageValues,
  I18n.MessageFormatOptions,
  I18n.FormLocale,
  I18n.Messages,
  I18n.WeekStart,
  I18n.LocaleIssue,
  I18n.LocaleLoader,
  I18n.LocaleSource,
  I18n.LocaleSourceResult,
  I18n.LocaleLoad,
  I18n.LocaleStore,
  I18n.LocaleStoreState,
  I18n.LocaleStoreOptions,
  I18n.I18nHandle,
  I18n.IssueMessage,
  I18n.IssueMessages,
  I18n.MessageDescriptor,
  I18n.LocalizableText,
  typeof I18n.parseMessage,
  typeof I18n.formatPattern,
  typeof I18n.createMessageFormatter,
  typeof I18n.MessageSyntaxError,
  typeof I18n.DEFAULT_LOCALE,
  typeof I18n.extendLocale,
  typeof I18n.validateLocale,
  typeof I18n.messageArguments,
  typeof I18n.createLocaleLoader,
  typeof I18n.fetchMessages,
  typeof I18n.bundledLocaleSource,
  typeof I18n.createLocaleStore,
  typeof I18n.createI18n,
  typeof I18n.translateBuiltin,
  typeof I18n.resolveIssueMessage,
  typeof I18n.defineIssueMessages,
  typeof I18n.msg,
  typeof I18n.defineMessages,
  typeof I18n.isMessageDescriptor,
  typeof I18n.MESSAGE_DESCRIPTOR,
  typeof I18n.resolveLocalized,
];

/** `./signals` — единственный владелец реактивного рантайма. */
export type SignalsEntry = [
  Signals.ReadonlySignal<string>,
  Signals.Signal<string>,
  typeof Signals.signal,
  typeof Signals.computed,
  typeof Signals.effect,
  typeof Signals.batch,
  typeof Signals.untracked,
  typeof Signals.isSignal,
];

/** `./react` — хуки нод, контекст сборки, связка поля и React-часть локализации. */
export type ReactEntryExports = [
  ReactEntry.FieldControlState<string>,
  ReactEntry.ArrayControlState<Phone>,
  ReactEntry.UseFormValidationArgs<Shape>,
  ReactEntry.UseFormValidationResult,
  ReactEntry.FormBundleLike,
  ReactEntry.FormFlowSnapshot,
  ReactEntry.FieldAdapter,
  ReactEntry.FieldAdapterCarrier,
  ReactEntry.FieldSeam,
  ReactEntry.FieldHandle,
  ReactEntry.I18nProviderProps,
  ReactEntry.I18nStaticProviderProps,
  ReactEntry.I18nLoadingProviderProps,
  ReactEntry.I18nContextValue,
  typeof ReactEntry.useFormControl,
  typeof ReactEntry.useFormControlValue,
  typeof ReactEntry.useArrayLength,
  typeof ReactEntry.useFormValidation,
  typeof ReactEntry.useFormBundle,
  typeof ReactEntry.useFormFlow,
  typeof ReactEntry.FormBundleContext,
  typeof ReactEntry.useFormBundleContext,
  typeof ReactEntry.getFieldAdapter,
  typeof ReactEntry.bindFieldProps,
  typeof ReactEntry.FIELD_WRAPPER_ONLY_PROPS,
  typeof ReactEntry.makeElementFieldHandle,
  typeof ReactEntry.useFieldHandleRef,
  typeof ReactEntry.I18nProvider,
  typeof ReactEntry.useI18n,
  typeof ReactEntry.useMessages,
  typeof ReactEntry.useIssueMessage,
  typeof ReactEntry.I18N_CONTEXT_MARKER,
];

// ─── Один тип — одно имя на всех входах ────────────────────────────────────────────────────

/** Тип, реэкспортированный несколькими входами, — тот же самый, а не копия с тем же именем. */
export function sharedTypeChecks(
  rootModel: Root.FormModel<Shape>,
  rootCleanup: Root.BehaviorCleanup,
  scope: Behaviors.SchemaScope,
  signal: Signals.ReadonlySignal<string>
): void {
  const modelFromModel: Model.FormModel<Shape> = rootModel;
  const cleanupFromBehaviors: Behaviors.BehaviorCleanup = rootCleanup;
  const scopeFromRoot: Root.SchemaScope = scope;
  const signalFromBehaviors: Behaviors.ReadonlySignal<string> = signal;
  // Совпадение точное, а не «присваивается»: входы отдают один и тот же тип.
  expectTypeOf<Root.FormModel<Shape>>().toEqualTypeOf<Model.FormModel<Shape>>();
  expectTypeOf<Root.ModelArray<Phone>>().toEqualTypeOf<Model.ModelArray<Phone>>();
  expectTypeOf<Root.PathAwareSignal<string>>().toEqualTypeOf<Model.PathAwareSignal<string>>();
  expectTypeOf<Root.BehaviorCleanup>().toEqualTypeOf<Behaviors.BehaviorCleanup>();
  expectTypeOf<Root.SchemaScope>().toEqualTypeOf<Behaviors.SchemaScope>();
  expectTypeOf<Root.SchemaNodeControl>().toEqualTypeOf<Behaviors.SchemaNodeControl>();
  expectTypeOf<Signals.ReadonlySignal<string>>().toEqualTypeOf<Behaviors.ReadonlySignal<string>>();
  expectTypeOf<Signals.Signal<string>>().toEqualTypeOf<Behaviors.Signal<string>>();
  // Значение контекста локали из `./react` — та же ручка `I18nHandle` из `./i18n` с добавками.
  expectTypeOf<ReactEntry.I18nContextValue>().toExtend<I18n.I18nHandle>();
  // @ts-expect-error — замечание из корня — тот же `ValidationIssue`: текста в нём нет
  const issue: Root.ValidationIssue = { code: 'required', message: 'Обязательное поле' };
  void [modelFromModel, cleanupFromBehaviors, scopeFromRoot, signalFromBehaviors, issue];
}
