/**
 * Грамматика `form.intent.json`: её отдаёт `form_build`, пока файла нет.
 *
 * Примеры строк берутся из {@link GRAMMAR_EXAMPLE}, а тест собирает этот intent настоящей сборкой.
 * Текст-образец без такой проверки уже подводил: пример `copyFrom` на группу выглядел правдоподобно,
 * и агенты споткнулись о него в каждом прогоне прототипа.
 *
 * Компоненты и правила грамматика называет по справочникам ({@link FormCatalogs}): поля — из
 * каталога установленного кита, правила — из индекса установленного ядра. Чего не нашлось, о том
 * грамматика говорит прямо, а не подставляет список, которого у потребителя нет.
 *
 * @module reformer-mcp/core/generate/intent-grammar
 */

import type { FormCatalogs } from './catalogs.js';
import { renderRuleList } from './core-operators.js';
import { VALIDATION_OPERATORS } from './operator-catalog.js';

/** Рабочая форма, на которой показана вся грамматика. */
export const GRAMMAR_EXAMPLE = {
  formName: 'Заявка',
  interfaceName: 'Application',
  target: 'renderer-react',
  fields: [
    {
      name: 'loanType',
      type: 'string',
      component: 'Select',
      label: 'Тип',
      initialValue: 'consumer',
      optionsSource: 'LOAN_TYPES',
    },
    {
      name: 'price',
      type: 'number',
      component: 'InputNumber',
      label: 'Цена',
      initialValue: null,
      componentProps: { placeholder: 'Введите цену', min: 1 },
    },
    { name: 'quantity', type: 'number', component: 'InputNumber', label: 'Штук', initialValue: 1 },
    { name: 'total', type: 'number', component: 'InputNumber', label: 'Итог', initialValue: 0 },
    { name: 'vat', type: 'number', component: 'InputNumber', label: 'НДС', initialValue: 0 },
    {
      name: 'propertyValue',
      type: 'number',
      component: 'InputNumber',
      label: 'Стоимость',
      initialValue: null,
    },
    {
      name: 'password',
      type: 'string',
      component: 'InputPassword',
      label: 'Пароль',
      initialValue: '',
    },
    {
      name: 'confirm',
      type: 'string',
      component: 'InputPassword',
      label: 'Повтор',
      initialValue: '',
    },
    { name: 'smsCode', type: 'string', component: 'Input', label: 'Код', initialValue: '' },
    {
      name: 'birthDate',
      type: 'date',
      component: 'Input',
      label: 'Дата рождения',
      initialValue: '',
      componentProps: { type: 'date' },
    },
    {
      name: 'phone',
      type: 'string',
      component: 'InputMask',
      label: 'Телефон',
      initialValue: '',
      componentProps: { mask: '+7 (999) 999-99-99' },
    },
    { name: 'postalCode', type: 'string', component: 'Input', label: 'Индекс', initialValue: '' },
    {
      name: 'sameAddress',
      type: 'boolean',
      component: 'Checkbox',
      label: 'Совпадает',
      initialValue: false,
    },
    {
      name: 'registrationAddress.city',
      type: 'string',
      component: 'Input',
      label: 'Город',
      initialValue: '',
    },
    {
      name: 'residenceAddress.city',
      type: 'string',
      component: 'Input',
      label: 'Город',
      initialValue: '',
    },
    {
      name: 'hasContacts',
      type: 'boolean',
      component: 'Checkbox',
      label: 'Есть контакты',
      initialValue: false,
    },
    {
      name: 'income',
      type: 'number',
      component: 'InputNumber',
      label: 'Сумма дохода',
      initialValue: 0,
    },
    { name: 'email', type: 'string', component: 'Input', label: 'Email', initialValue: '' },
    { name: 'login', type: 'string', component: 'Input', label: 'Логин', initialValue: '' },
  ],
  arrays: [
    {
      name: 'contacts',
      itemInterfaceName: 'Contact',
      initialValue: [],
      component: 'FieldArray',
      componentProps: { title: 'Контакты', addButtonLabel: '+ Добавить', itemLabel: 'Контакт' },
      itemFields: [
        { name: 'phone', type: 'string', component: 'Input', label: 'Телефон', initialValue: '' },
        {
          name: 'income',
          type: 'number',
          component: 'InputNumber',
          label: 'Доход',
          initialValue: 0,
        },
        {
          name: 'primary',
          type: 'boolean',
          component: 'Checkbox',
          label: 'Основной',
          initialValue: false,
        },
      ],
    },
  ],
  parts: {
    address: { kind: 'container', component: 'Box', children: ['city'] },
  },
  layoutRoot: {
    kind: 'container',
    component: 'Box',
    selector: 'wizard',
    componentProps: { submitLabel: 'Отправить' },
    children: [
      {
        kind: 'step',
        title: 'Кредит',
        selector: 'loan',
        children: [
          'loanType',
          'price',
          'quantity',
          'total',
          'vat',
          {
            kind: 'container',
            component: 'Section',
            selector: 'mortgage-section',
            componentProps: { title: 'Ипотека' },
            children: ['propertyValue'],
          },
        ],
      },
      {
        kind: 'step',
        title: 'Данные',
        selector: 'person',
        children: [
          'password',
          'confirm',
          'smsCode',
          'birthDate',
          'phone',
          'postalCode',
          'sameAddress',
          { kind: 'part', ref: 'registrationAddress', part: 'address' },
          { kind: 'part', ref: 'residenceAddress', part: 'address' },
          'hasContacts',
          'income',
          'email',
          'login',
          { kind: 'array', ref: 'contacts' },
        ],
      },
    ],
  },
  validation: [
    {
      target: 'price',
      rules: ["required({ code: 'price.required' })"],
      message: 'Укажите цену',
    },
    {
      target: 'price',
      rules: ["min(1, { code: 'price.min' })"],
      message: 'Цена не меньше 1',
    },
    {
      target: 'propertyValue',
      when: "model.loanType === 'mortgage'",
      rules: ["required({ code: 'propertyValue.required' })"],
      message: 'Укажите стоимость',
    },
    {
      target: 'phone',
      each: 'contacts',
      rules: ["required({ code: 'contact.phone.required' })"],
      message: 'Укажите телефон',
    },
    {
      target: 'confirm',
      rules: [],
      cross: 'values.confirm === values.password',
      code: 'mismatch',
      message: 'Пароли не совпадают',
    },
    {
      target: 'smsCode',
      rules: [],
      async: "async (value) => (value === '1' ? null : { code: 'bad' })",
      code: 'bad',
      message: 'Неверный код',
    },
    {
      target: 'income',
      each: 'contacts',
      rules: [],
      cross: '(values.income ?? 0) >= 0',
      code: 'contact.income.negative',
      message: 'Доход не может быть отрицательным',
    },
    {
      target: 'postalCode',
      rules: ["postalCodeRu({ code: 'postalCode.format' })"],
      message: 'Индекс — 6 цифр',
    },
    {
      target: 'phone',
      call: 'phoneOrEmail(model.$.phone, model.$.email)',
      code: 'contact.missing',
      message: 'Укажите телефон или email',
    },
  ],
  behavior: [
    {
      kind: 'compute',
      target: 'total',
      sources: ['price', 'quantity'],
      expr: '(model.price ?? 0) * (model.quantity ?? 0)',
    },
    {
      kind: 'enableWhen',
      target: 'propertyValue',
      sources: ['loanType'],
      expr: "model.loanType === 'mortgage'",
      options: { resetOnDisable: true },
    },
    {
      kind: 'onChange',
      target: 'hasContacts',
      sources: [],
      expr: 'if (!value) model.contacts.clear();',
    },
    {
      kind: 'transformValue',
      target: 'postalCode',
      sources: [],
      expr: "(value ?? '').replace(/\\D/g, '').slice(0, 6)",
    },
    {
      kind: 'copyFrom',
      target: 'residenceAddress.city',
      sources: ['registrationAddress.city'],
      expr: 'model.sameAddress === true',
    },
    {
      kind: 'compute',
      target: 'income',
      sources: ['contacts', 'contacts.income'],
      expr: 'model.contacts.map((row) => row.income).reduce((sum, income) => sum + (income || 0), 0)',
    },
    {
      kind: 'disableWhen',
      target: 'residenceAddress',
      sources: ['sameAddress'],
      expr: 'model.sameAddress === true',
    },
    { kind: 'computeFrom', target: 'vat', sources: ['total'], expr: 'Math.round(total * 0.2)' },
    { kind: 'syncFields', target: 'login', sources: ['email'] },
    {
      kind: 'resetWhen',
      target: 'smsCode',
      sources: ['phone'],
      expr: '!model.phone',
      options: { resetValue: '' },
    },
    {
      kind: 'revalidateWhen',
      target: 'confirm',
      sources: ['password'],
      expr: 'form.confirm.markAsTouched()',
    },
    { kind: 'exclusiveFlag', target: 'primary', each: 'contacts', sources: [] },
    {
      kind: 'aggregateInto',
      target: 'contacts',
      sources: [],
      expr: 'rows.length === 0 || rows.some((row) => row.primary) ? [] : [{ index: 0, patch: { primary: true } }]',
    },
    { kind: 'call', target: 'price', sources: [], expr: 'roundTo(model.$.price, 100)' },
    {
      kind: 'onComponentEvent',
      selector: 'wizard',
      event: 'onSubmit',
      expr: 'await submitApplication(model.get())',
    },
    {
      kind: 'renderEffect',
      expr: "if (model.loanType === 'mortgage') schema.node('mortgage-section').getRef<HTMLElement>().current?.scrollIntoView();",
    },
    {
      kind: 'onInit',
      selector: 'mortgage-section',
      expr: "schema.node('mortgage-section').patchProps({ title: 'Ипотечный кредит' })",
    },
    {
      kind: 'onMount',
      selector: 'wizard',
      expr: 'const timer = setInterval(() => saveDraft(model.get()), 30000); return () => clearInterval(timer);',
    },
    { kind: 'onUnmount', selector: 'wizard', expr: 'saveDraft(model.get())' },
  ],
  operators: {
    postalCodeRu: './operators',
    phoneOrEmail: './operators',
    roundTo: './operators',
    saveDraft: './operators',
    submitApplication: './api',
  },
  visibility: [{ selector: 'mortgage-section', condition: "model.loanType !== 'mortgage'" }],
  dataSources: [
    {
      name: 'LOAN_TYPES',
      values: [
        { value: 'consumer', label: 'Потребительский' },
        { value: 'mortgage', label: 'Ипотека' },
      ],
    },
  ],
};

const json = (value: unknown): string => JSON.stringify(value);
const { fields, arrays, validation, behavior } = GRAMMAR_EXAMPLE;

/** Поле примера по имени: индекс сдвигается, когда в пример добавляют поле. */
const field = (name: string) => {
  const found = fields.find((f) => f.name === name);
  if (!found) throw new Error(`В GRAMMAR_EXAMPLE нет поля ${name}`);
  return found;
};

/** Запись `behavior` примера по её `kind` (у `compute` — первая). */
const behaviorRow = (kind: string, nth = 0): string =>
  json(behavior.filter((row) => row.kind === kind)[nth]);

/** Ключи правила intent → операторы схемы валидации ядра. */
const validationKeys = Object.entries(VALIDATION_OPERATORS)
  .filter(([, key]) => !key.includes(' '))
  .map(([operator, key]) => `${key} → ${operator}`)
  .join(', ');

/** Строка о компонентах полей: поля кита из его каталога. */
function componentLine({ uiKit }: FormCatalogs): string {
  return uiKit.found
    ? `- component: ${Object.keys(uiKit.fields).join(' ')}.`
    : '- component: каталог @reformer/ui-kit не найден — пиши имя компонента из своего реестра.';
}

/** Строка о правилах: фабрики ядра из его индекса. */
function rulesLine({ core }: FormCatalogs): string {
  const list = core.found
    ? renderRuleList(core)
    : 'индекс @reformer/core не найден — имена правил не сверяются';
  return `- rules — фабрики @reformer/core/validators: ${list}. Последний аргумент — { code: '…' }.`;
}

/** Грамматика intent для установленных кита и ядра. */
export function intentGrammar(catalogs: FormCatalogs): string {
  return `# form.intent.json — грамматика

Ты пишешь только этот файл, остальные файлы модуля записывает form_build. Сам файл формы не создаёт: работа закончена только после ответа ✓ от form_build. Экономь токены: JSON компактный, одна запись на строку. Большую форму пиши частями: поля и раскладка → form_build → Edit: правила → form_build → Edit: поведение → form_build.

{"formName":"Заявка","interfaceName":"Application","target":"renderer-react","fields":[…],"arrays":[…],"parts":{…},"layoutRoot":{…},"validation":[…],"behavior":[…],"visibility":[…],"dataSources":[…],"operators":{…}}

target — стек из задания, не меняй его: core | renderer-react | renderer-json.
На core сборка пишет всё, кроме разметки: в index.tsx будет заглушка, её замени своим JSX и собери снова. Поле: <FormField control={bundle.form.price} /> из @reformer/ui-kit. visibility там не работает — условие пиши в JSX. Массив и шаги: find_recipe.

## fields
${json(field('price'))}
- Поле группы — имя через точку: "registrationAddress.city".
- type: string | number | boolean | date | array (атомарное значение файлов у FileUpload*).
${componentLine(catalogs)}
- componentProps — свойства компонента; незнакомое form_build назовёт и перечислит, какие есть.
- Варианты выбора: "optionsSource":"LOAN_TYPES" и запись в dataSources либо componentProps.options:[{"value":"a","label":"А"}].
- Свободный ввод с подсказками: "suggestionsSource":"CITIES" и запись в dataSources — поле рисует InputSuggest.
- Дата строкой: ${json(field('birthDate'))}. DatePicker хранит Date.
- Маска: "component":"InputMask","componentProps":${json(field('phone').componentProps)}.

## arrays
${json(arrays[0])}

## layoutRoot — каждое поле и массив должны в нём стоять
${json(GRAMMAR_EXAMPLE.layoutRoot.children[0])}
- Корень с шагами: {"kind":"container","component":"Box","selector":"wizard","componentProps":{"submitLabel":"Отправить"},"children":[шаги]}. Форма без шагов — те же контейнеры без узлов step. Значок шага: "icon":"💰".
- Строка в children — ссылка на поле. Массив: {"kind":"array","ref":"contacts"}.
- Подформа: parts ${json(GRAMMAR_EXAMPLE.parts)}, узел {"kind":"part","ref":"registrationAddress","part":"address"}; ссылки в части — от группы.

## validation — одна строка на правило, текст в message
${json(validation[0])}
${rulesLine(catalogs)}
- Ключи правила — операторы схемы ядра: ${validationKeys}; правило поля группы — путь через точку.
- Одна строка — один код: иначе текст не к чему привязать, и сборка откажет.
- Проверки поля сборка печатает одним validate(…, […]). Новую проверку без своего текста добавляй в rules строки этого поля, а не новой строкой; проверку со своим текстом — строкой с тем же target, как price выше.
- Условие: ${json(validation[2])}
- Строка массива: ${json(validation[3])}
- Между полями (выражение ИСТИННО, когда всё верно): ${json(validation[4])}
- Между полями строки массива (values — снимок строки): ${json(validation[6])}
- Асинхронно: ${json(validation[5])}
- У cross: "severity":"warning" — предупреждение, отправку не блокирует; "params":{"max":"values.income * 10"} — числа для {max} в message.
- Своё правило — имя из operators: ${json(validation[7])}
- Свой оператор валидации — вызов печатается в схему как есть: ${json(validation[8])}. В правиле с each model в вызове — строка.

## behavior — kind это оператор ядра, expr это TS, sources это поля, которые оно читает
${behaviorRow('compute')}
${behaviorRow('computeFrom')} — параметры expr — sources по последнему сегменту пути.
${behaviorRow('enableWhen')}
${behaviorRow('disableWhen')} — группа целиком.
${behaviorRow('onChange')} — value: новое значение target.
${behaviorRow('transformValue')}
${behaviorRow('copyFrom')} — expr: условие копирования.
${behaviorRow('syncFields')} — в обе стороны.
${behaviorRow('resetWhen')} — без resetValue поле сбрасывается в null.
${behaviorRow('revalidateWhen')} — expr: что сделать при смене sources. Перезапуск своей схемы — void validateModel(model, схема): validateModel сборка импортирует сама, схему объяви в operators.
${behaviorRow('exclusiveFlag')} — флаг true только у одной строки.
${behaviorRow('aggregateInto')} — rows: снимок строк, ответ — [{ index, patch }].
${behaviorRow('call')} — свой оператор поведения из operators, вызов как есть.
target и sources — только листовые поля и массивы; enableWhen и disableWhen принимают и группу ("target":"residenceAddress"). В compute проверяй null: у числа без значения тип number | null, у необязательного текста — string | null. Условие пересчёта у compute и computeFrom: "when":"model.loanType === 'mortgage'". Цель compute заблокирована для ввода сама.
Поведение строки массива: "each":"contacts", строка в expr — item. Узел формы (снять замечания, пометить тронутым) — form.<поле>.

Массив в модели — НЕ обычный массив: есть length, at(i), map(fn), forEach(fn), toArray(), push(), removeAt(i), clear(); нет get, reduce, filter — сначала map(...) или toArray(). Сумма:
${behaviorRow('compute', 1)}

## Узлы схемы — тоже behavior: узел по selector из layoutRoot, в expr есть schema; на core не печатаются
${behaviorRow('onComponentEvent')} — событие компонента, аргументы — args. Так подключается отправка.
${behaviorRow('renderEffect')} — эффект после монтирования схемы, ref узла — getRef().
${behaviorRow('onInit')} — до первого рендера.
${behaviorRow('onMount')} — тело может вернуть очистку.
${behaviorRow('onUnmount')}
С await обработчик асинхронный.

## operators — свои операторы: имя → модуль импорта
${json(GRAMMAR_EXAMPLE.operators)}
- Модуль каталога формы ("./operators" → operators.ts, "./api" → api.ts) form_build пишет заготовкой: сигнатура принимает любые аргументы, тело пустое. Тела напиши сам (Edit): правка делает файл твоим — сборка его больше не трогает, но проверяет типы. Модуль проекта ("@/shared/validators") подключается как есть.
- Правило — функция, возвращающая Rule<T> из @reformer/core/validation; оператор валидации — на validate, cross, validateWhen; оператор поведения — на операторах @reformer/core/behaviors или effect + onDispose.

## visibility и dataSources
${json(GRAMMAR_EXAMPLE.visibility[0])} — узел СКРЫТ, когда условие истинно; selector задан в layoutRoot.
${json(GRAMMAR_EXAMPLE.dataSources[0])}
`;
}
