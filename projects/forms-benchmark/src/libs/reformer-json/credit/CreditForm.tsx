/**
 * Кредитная заявка на `@reformer/renderer-json` — порт демо
 * `react-playground/src/pages/demo/complex-multy-step-form-renderer-json` на нейтральный UI.
 *
 * Разметка, поля, шаги и массивы — JSON-документ формата 2 (./form.json: адрес и строки массивов —
 * части `parts`), компоненты — реестр (../kit/credit-registry.ts). Сборка, правила шагов, поведение
 * и старт страницы — общие с JSX-вариантом (../../reformer-kit/credit). Сверх них здесь только
 * правила узлов: скрытие условных секций `hideWhen` по селекторам документа — его исполняет
 * рендерер (renderer-json 07-form-wizard.md, renderer-react 03-render-behavior.md).
 *
 * Отправка — `<form>` реестра (`Form`) через `bundle.submission.submit`, обработчик приходит со
 * страницы контекстом (JSON не выражает функции). Справочники — сигналы страницы в реестре
 * (`reg.dataSource`), документ ссылается на них: `$dataSource(REGIONS)`,
 * `$dataSource(PROPERTY_TYPES)` (packages/reformer/docs/llms/32-async-options-loading.md).
 */
import { useFormBundle } from '@reformer/core/react';
import { defineFormBehavior, hideWhen } from '@reformer/core/behaviors';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormRenderer } from '@reformer/renderer-react';
import { composeRegistries, defineRegistry, type JsonFormSchema } from '@reformer/renderer-json';
import {
  isCarLoan,
  isEmployed,
  isMortgage,
  isSelfEmployed,
  livesElsewhere,
  type CreditValues,
} from '../../../shared/domain/credit';
import { creditRules } from '../../reformer-kit/credit/behavior';
import {
  createCreditForm,
  sendCredit,
  useCreditStart,
  type CreditDictionaries,
} from '../../reformer-kit/credit/form';
import { creditMessages } from '../../reformer-kit/credit/rules';
import { creditRegistry } from '../kit/credit-registry';
import { FormActionsContext, type FormActions } from '../kit/form-shell';
import rawSchema from './form.json';

// JSON-операторы типизируются строками — приведение и есть сценарий «схема пришла с сервера».
const schema = rawSchema as unknown as JsonFormSchema<CreditValues>;

const actions: FormActions = { submit: (values) => sendCredit(values as CreditValues) };

/** Поведение общее + скрытие узлов документа по тем же предикатам, что у `enableWhen`. */
const jsonBehavior = defineFormBehavior<CreditValues>((scope) => {
  creditRules(scope);
  const { model, schema: nodes } = scope;
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

/** Реестр формы + справочники этой страницы (загрузка — по одному запросу на монтирование). */
const withDictionaries = (dictionaries: CreditDictionaries) =>
  composeRegistries(
    creditRegistry,
    defineRegistry((reg) => {
      reg.dataSource('REGIONS', dictionaries.regions);
      reg.dataSource('PROPERTY_TYPES', dictionaries.propertyTypes);
    })
  );

function CreditRenderer({
  initial,
  dictionaries,
}: {
  initial: CreditValues;
  dictionaries: CreditDictionaries;
}) {
  const bundle = useFormBundle(() =>
    createCreditForm(initial, {
      schema,
      registry: withDictionaries(dictionaries),
      behavior: jsonBehavior,
    })
  );
  return <FormRenderer<CreditValues> form={bundle} />;
}

export function CreditForm() {
  const { dictionaries, initial } = useCreditStart();
  return (
    <ValidationMessagesProvider messages={creditMessages}>
      <FormActionsContext.Provider value={actions}>
        {initial ? <CreditRenderer initial={initial} dictionaries={dictionaries} /> : null}
      </FormActionsContext.Provider>
    </ValidationMessagesProvider>
  );
}
