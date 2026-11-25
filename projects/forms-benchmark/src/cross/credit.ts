/**
 * Кредитная заявка без слоя представления — для страниц кросс-фреймворк проверки.
 *
 * Документ формы (./credit.form.json) — документ участника бенчмарка на `@reformer/renderer-json`
 * (../libs/reformer-json/credit/form.json) с именами каталога китов (`InputNumber`, `InputMask`,
 * `FieldArray`, `FormWizard`, …) и без оболочки страницы: корень — визард, заголовок и `<form>`
 * рисует хост. Поток шагов с правилами (../libs/reformer-kit/credit/rules.ts), поведение
 * (../libs/reformer-kit/credit/behavior.ts), тексты ошибок и API — те же, что у участника. Хост
 * стека (React, Vue, Angular) приносит реестр кита своей библиотеки и монтирует сборку своим
 * рендерером — поэтому различие в поведении страниц означает различие рендереров или китов, а не
 * форм.
 *
 * «Отправить» — кнопка визарда кита: он проверяет форму и зовёт событие `onSubmit` узла `wizard`.
 * Обработчик ставит поведение формы, текст подтверждения уходит хосту колбэком.
 *
 * Старт страницы (BENCH-CONTRACT §8): справочники и заявка `?application=1` — параллельно, по
 * одному запросу на монтирование. Данные заявки — начальные значения сборки, поэтому форма
 * монтируется, когда они пришли. Справочники — сигналы: документ ссылается на них
 * (`$dataSource(REGIONS)`, `$dataSource(PROPERTY_TYPES)`), значение приходит позже и реактивно.
 */
import { arrayOf, createForm, type FormBundle } from '@reformer/core';
import { defineFormBehavior, hideWhen, onComponentEvent } from '@reformer/core/behaviors';
import { signal, type ReadonlySignal } from '@reformer/core/signals';
import {
  composeRegistries,
  defineRegistry,
  type ComponentRegistry,
  type JsonFormSchema,
} from '@reformer/renderer-json/neutral';
import { creditApi } from '../shared/api/credit-client';
import { serverConfig } from '../shared/api/server';
import {
  CREDIT_INITIAL,
  emptyCoBorrower,
  emptyExistingLoan,
  emptyProperty,
  isCarLoan,
  isEmployed,
  isMortgage,
  isSelfEmployed,
  livesElsewhere,
  toCreditPayload,
  type CreditValues,
  type Option,
} from '../shared/domain/credit';
import { creditRules } from '../libs/reformer-kit/credit/behavior';
import { creditFlow, creditMessages } from '../libs/reformer-kit/credit/rules';
import rawSchema from './credit.form.json';

export { creditMessages };
export type { CreditValues, Option };

// JSON-операторы типизируются строками — приведение и есть сценарий «схема пришла с сервера».
const schema = rawSchema as unknown as JsonFormSchema<CreditValues>;

/** Справочники формы: сигналы, значение придёт после загрузки при старте страницы. */
export interface CreditDictionaries {
  regions: ReadonlySignal<Option[]>;
  propertyTypes: ReadonlySignal<Option[]>;
}

/** Старт страницы: справочники формы и запросы, которые их наполняют. */
export interface CreditStart {
  dictionaries: CreditDictionaries;
  /**
   * Запросить справочники и начальные значения формы: пустые либо данные заявки
   * (`?application=`). Зовётся один раз на монтирование страницы: каждый вызов — новые запросы.
   */
  load(): Promise<CreditValues>;
}

/** Справочники страницы — пустыми; запросов нет, пока хост не позвал `load()`. */
export function createCreditStart(): CreditStart {
  const regions = signal<Option[]>([]);
  const propertyTypes = signal<Option[]>([]);
  return {
    dictionaries: { regions, propertyTypes },
    load() {
      void creditApi.getRegions().then((options) => (regions.value = options));
      void creditApi
        .getDictionaries()
        .then((dictionaries) => (propertyTypes.value = dictionaries.propertyTypes));
      const application = serverConfig.application;
      return application ? creditApi.getApplication(application) : Promise.resolve(CREDIT_INITIAL);
    },
  };
}

/** Начальные значения модели: массивы — `arrayOf(шаблон строки, строки)` для «Добавить». */
function creditInitial(values: CreditValues): CreditValues {
  const copy = structuredClone(values);
  return {
    ...copy,
    properties: arrayOf(emptyProperty, copy.properties),
    existingLoans: arrayOf(emptyExistingLoan, copy.existingLoans),
    coBorrowers: arrayOf(emptyCoBorrower, copy.coBorrowers),
  };
}

/**
 * Поведение формы и скрытие узлов документа по тем же предикатам, что у условных полей: секцию
 * прячет рендерер, а её поля выключает общее поведение. Отправку проверенной формы визард кита
 * отдаёт событием `onSubmit` своего узла: обработчик отправляет заявку и сообщает хосту текст
 * подтверждения.
 */
const creditBehavior = (onSubmitted: (message: string) => void) =>
  defineFormBehavior<CreditValues>((scope) => {
    creditRules(scope);
    const { model, schema: nodes } = scope;
    onComponentEvent(nodes.node('wizard'), 'onSubmit', async (values: CreditValues) => {
      onSubmitted(await submitCredit(values));
    });
    hideWhen(nodes.node('mortgage'), () => !isMortgage(model.loanType));
    hideWhen(nodes.node('car'), () => !isCarLoan(model.loanType));
    hideWhen(nodes.node('employer'), () => !isEmployed(model.employmentStatus));
    hideWhen(nodes.node('business'), () => !isSelfEmployed(model.employmentStatus));
    hideWhen(nodes.node('residence'), () => !livesElsewhere(model.sameAsRegistration));
    hideWhen(nodes.node('properties'), () => !model.hasProperty);
    hideWhen(nodes.node('existingLoans'), () => !model.hasExistingLoans);
    hideWhen(nodes.node('coBorrowers'), () => !model.hasCoBorrower);
    hideWhen(nodes.node('coBorrowersIncome'), () => !model.hasCoBorrower);
  });

/**
 * Сборка формы на реестре компонентов хоста. Владелец сборки — хост: он же зовёт `dispose()`.
 *
 * @param registry - Компоненты кита стека под именами каталога.
 * @param initial - Начальные значения из {@link CreditStart.load}.
 * @param dictionaries - Справочники страницы из {@link createCreditStart}.
 * @param onSubmitted - Заявка отправлена: текст подтверждения для `submit-result`.
 */
export function createCreditForm(
  registry: ComponentRegistry,
  initial: CreditValues,
  dictionaries: CreditDictionaries,
  onSubmitted: (message: string) => void
): FormBundle<CreditValues> {
  return createForm<CreditValues>({
    schema,
    registry: composeRegistries(
      registry,
      defineRegistry((reg) => {
        reg.dataSource('REGIONS', dictionaries.regions);
        reg.dataSource('PROPERTY_TYPES', dictionaries.propertyTypes);
      })
    ),
    initial: creditInitial(initial),
    validation: { strategy: 'afterFirstSubmit', liveAfterStep: 'change' },
    flow: creditFlow,
    behavior: creditBehavior(onSubmitted),
  });
}

/** Отправка валидной формы: канонический payload, текст подтверждения — из ответа. */
export async function submitCredit(values: CreditValues): Promise<string> {
  return (await creditApi.submitApplication(toCreditPayload(values))).message;
}
