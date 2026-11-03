/**
 * Грамматика `form.intent.json`: её отдаёт `form_build`, пока файла нет.
 *
 * Примеры строк берутся из {@link GRAMMAR_EXAMPLE}, а тест собирает этот intent настоящей сборкой.
 * Текст-образец без такой проверки уже подводил: пример `copyFrom` на группу выглядел правдоподобно,
 * и агенты споткнулись о него в каждом прогоне прототипа.
 *
 * @module reformer-mcp/core/generate/intent-grammar
 */

import { UI_KIT_FIELD_EXPORTS } from './ui-kit-components.js';

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
  ],
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

const behaviorRow = (index: number): string => json(behavior[index]);

export const INTENT_GRAMMAR = `# form.intent.json — грамматика

Ты пишешь только этот файл, остальные файлы модуля записывает form_build. Сам файл формы не создаёт: работа закончена только после ответа ✓ от form_build. Экономь токены: JSON компактный, одна запись на строку. Большую форму пиши частями: поля и раскладка → form_build → Edit: правила → form_build → Edit: поведение → form_build.

{"formName":"Заявка","interfaceName":"Application","target":"renderer-react","fields":[…],"arrays":[…],"parts":{…},"layoutRoot":{…},"validation":[…],"behavior":[…],"visibility":[…],"dataSources":[…]}

target — стек из задания, не меняй его: core | renderer-react | renderer-json.
На core сборка пишет всё, кроме разметки: в index.tsx будет заглушка, её замени своим JSX и собери снова. Поле: <FormField control={bundle.form.price} /> из @reformer/ui-kit. visibility там не работает — условие пиши в JSX. Массив и шаги: find_recipe.

## fields
${json(fields[1])}
- Поле группы — имя через точку: "registrationAddress.city".
- type: string | number | boolean | date | array (атомарное значение файлов у FileUpload*).
- component: ${Object.keys(UI_KIT_FIELD_EXPORTS).join(' ')}.
- componentProps — свойства компонента; незнакомое form_build назовёт и перечислит, какие есть.
- Варианты выбора: "optionsSource":"LOAN_TYPES" и запись в dataSources либо componentProps.options:[{"value":"a","label":"А"}].
- Дата строкой: ${json(fields[8])}. DatePicker хранит Date.
- Маска: "component":"InputMask","componentProps":${json(fields[9].componentProps)}.

## arrays
${json(arrays[0])}

## layoutRoot — каждое поле и массив должны в нём стоять
${json(GRAMMAR_EXAMPLE.layoutRoot.children[0])}
- Корень с шагами: {"kind":"container","component":"Box","selector":"wizard","componentProps":{"submitLabel":"Отправить"},"children":[шаги]}. Форма без шагов — те же контейнеры без узлов step.
- Строка в children — ссылка на поле. Массив: {"kind":"array","ref":"contacts"}.
- Подформа: parts ${json(GRAMMAR_EXAMPLE.parts)}, узел {"kind":"part","ref":"registrationAddress","part":"address"}; ссылки в части — от группы.

## validation — одна строка на правило, текст в message
${json(validation[0])}
- rules: required, email, minLength(n), maxLength(n), min(n), max(n), pattern(/re/); последний аргумент — { code: '…' }.
- Одна строка — один код: иначе текст не к чему привязать, и сборка откажет.
- Условие: ${json(validation[2])}
- Строка массива: ${json(validation[3])}
- Между полями (выражение ИСТИННО, когда всё верно): ${json(validation[4])}
- Между полями строки массива (values — снимок строки): ${json(validation[6])}
- Асинхронно: ${json(validation[5])}

## behavior — expr это TS, sources это поля, которые оно читает
${behaviorRow(0)}
${behaviorRow(1)}
${behaviorRow(2)} — value: новое значение target.
${behaviorRow(3)}
${behaviorRow(4)} — expr: условие копирования.
target и sources — только листовые поля и массивы: группа не путь, опиши каждое её поле отдельно. В compute проверяй null: у числа без значения тип number | null.
Ещё kind: disableWhen computeFrom syncFields resetWhen revalidateWhen exclusiveFlag aggregateInto — детали в find_recipe.
Поведение строки массива: "each":"contacts", строка в expr — item.

Массив в модели — НЕ обычный массив: есть length, at(i), map(fn), forEach(fn), toArray(), push(), removeAt(i), clear(); нет get, reduce, filter — сначала map(...) или toArray(). Сумма:
${behaviorRow(5)}

## visibility и dataSources
${json(GRAMMAR_EXAMPLE.visibility[0])} — узел СКРЫТ, когда условие истинно; selector задан в layoutRoot.
${json(GRAMMAR_EXAMPLE.dataSources[0])}
`;
