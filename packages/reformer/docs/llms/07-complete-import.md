## Import Patterns

```typescript
// Модель, форма, уровень формы, типы — из @reformer/core. React здесь нет: корень работает и на сервере
import {
  createModel,
  createForm,
  createFormFromModel,
  disposeForm, // снять форму из createFormFromModel; сборку снимает bundle.dispose()
  createSubmission, // отправка без сборки (визард в разметке без createForm)
  arrayOf, // массив модели с шаблоном новой строки
  compileSchema, // авторское дерево → CompiledSchema (обычно не нужен: createForm компилирует сам)
  createFormFlow, // поток шагов без сборки
  isFormControl,
  isFormGroup,
  isFormArray,
} from '@reformer/core';

// Привязка к React — хуки, контекст сборки, связка поля с контролом, провайдер локали — из /react
import {
  useFormBundle,
  useFormControl,
  useFormControlValue,
  useArrayLength,
  useFormFlow, // снимок потока шагов для рендера
  useFormValidation, // стратегия без сборки: submit() — попытка отправки, validate() — проверка
  useIssueMessage, // текст замечания: словарь формы → локаль → английский → код
  I18nProvider,
} from '@reformer/core/react';
import type { FieldControlState } from '@reformer/core/react';

// Типы
import type {
  FormModel, // реактивная модель данных
  FormBundle, // результат createForm: { model, form, render, flow, validate, validateStep, submission, dispose, … }
  FormNode, // общий контракт ноды
  FormControl, // нода одного поля
  FormGroup, // нода группы — тип формы для props компонентов
  FormArray, // нода массива под-форм
  ModelArray, // реактивный массив модели (push/removeAt/at/map/length)
  ModelSignals, // дерево ручек ($)
  PathAwareSignal, // ручка, знающая свой путь
  ValidationIssue, // { code, params?, severity? } — без текста
  RuleOptions, // { code?, params? } — опции фабрик правил
  FormSchemaNode, // узел схемы: поле | массив под-форм | подформа | контейнер
  CompiledSchema, // скомпилированная схема: bundle.render.tree
  FormValidation, // правила формы как данные: { rules?, extras?, strategy?, debounce? }
  FormFlowConfig, // поток шагов в конфиге: { steps: [{ id, rules? }] }
  FormFlow, // поток шагов сборки: current, next(), previous(), goTo(id)
  FlowTransition, // итог перехода: moved | stayed
  FormSubmission, // отправка сборки (bundle.submission): submit(handler), submitting
  SubmitResult, // итог bundle.submission.submit: submitted | invalid | error | cancelled | failed
} from '@reformer/core';

// Схема валидации: операторы + раннер — из /validation
import {
  defineValidation,
  validate,
  validateAsync,
  validateWhen,
  apply, // правила подформы: apply(model.$.group, rules); композиция: apply(rulesA, rulesB)
  applyEach, // правила строк массива: applyEach(model.$.items, rules)
  validateModel, // раннер без сборки: сбор + разнос, Promise<boolean>
  runValidation, // только сбор: Promise<ValidationResult>
  applyValidationResult, // разнос собранного результата по нодам
} from '@reformer/core/validation';
import type {
  Rule, // (value) => ValidationIssue | null
  AsyncRule, // (value, { signal }) => Promise<ValidationIssue | null>
  ValidationDefinition, // ({ model, cross }) => void — cross берётся из аргумента схемы
  ValidationResult, // { status, issues, failures }
} from '@reformer/core/validation';

// Валидаторы — чистые фабрики из /validators (кладутся в validate(sig, [...]))
import { required, min, max, email, minLength, pattern } from '@reformer/core/validators';

// Тексты замечаний и локаль без React — из /i18n
import { defineIssueMessages, resolveIssueMessage, createI18n } from '@reformer/core/i18n';

// Декларативный DSL behaviors — из /behaviors
import {
  defineFormBehavior,
  compute,
  computeFrom,
  copyFrom,
  onChange,
  enableWhen,
  disableWhen,
  transformValue,
  resetWhen,
  syncFields,
  revalidateWhen,
  apply,
  applyEach,
  aggregateInto,
  exclusiveFlag,
  hideWhen, // операторы узлов схемы — исполняет рендерер
  renderEffect,
} from '@reformer/core/behaviors';

// Примитивы над сигналами (принимают сигналы, возвращают cleanup) — из /model, в корне их нет
import { computeFrom, copyFrom, watchField } from '@reformer/core/model';
// Утилиты значений модели — тоже из /model
import {
  deepEqual, // сравнение значений модели (на нём isDirty)
  deferredWritesSettled, // дождаться отложенных записей поведения тика; undefined — ждать нечего
} from '@reformer/core/model';
```

### Форма данных — `interface` или `type`

Оба варианта работают одинаково: `createModel<T>`, `createForm<T>`, `FormGroup<T>` и `FormArray<T>`
принимают и `interface`, и `type`-alias — для корня, вложенных групп и элементов массивов. Группу
от поля сборка отличает по виду значения (обычный объект — группа; массив объектов — массив
под-форм; примитив, массив примитивов, дата, файл — поле), а не по index signature.

```typescript
export interface AddressForm {
  street: string;
  city: string;
}

export interface CoBorrower {
  fullName: string;
  phone: string;
}
```

Оговорка для своих обобщённых хелперов: `interface` не присваивается `Record<string, unknown>`, поэтому
ограничение пиши `T extends object`. См. `30-type-safety-recipes.md`.
