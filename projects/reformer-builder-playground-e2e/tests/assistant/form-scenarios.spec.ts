import { call, say, type ModelReply } from './shared/model-mock';
import {
  FORM_B,
  FORM_B_FIELD,
  FORM_B_MODULE,
  inputNode,
  savedText,
  seedFormB,
} from './shared/forms';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент: сценарии разработки форм — по документу билдера `docs/assistant-form-scenarios.md`.
 *
 * Каталог `SCENARIOS.md` проверяет МЕХАНИКУ хода (попытки, отмена, вопросы); здесь — что обвязка
 * билдера выдерживает каждый сценарий разработки формы, доступный структурному режиму: ответы
 * модели — вызовы настоящих инструментов в том виде, в каком их пишет модель, а проверка — то,
 * что легло в форму, в файл правил и в дерево структуры. Номер в заголовке — номер сценария
 * документа.
 *
 * Все сценарии идут на форме B (вложенная раскладка, одно поле `fullName`): её корень — `/root`,
 * поле — `/root/children/0`. Где форма несёт то, что генерация печатает особо (мастер, правила,
 * связи, массив, части), ход заказывает и генерацию кода — она тоже должна выдержать.
 */

const RULES_B = `${FORM_B_MODULE}/schema/form.rules.json`;

/** Узел поля с вариантами выбора. */
function choiceNode(component: string, model: string, label: string): Record<string, unknown> {
  return {
    component,
    model,
    props: {
      label,
      options: [
        { value: 'a', label: 'Вариант А' },
        { value: 'b', label: 'Вариант Б' },
      ],
    },
  };
}

/** Узел поля произвольного компонента. */
function fieldNode(component: string, model: string, label: string): Record<string, unknown> {
  return { component, model, props: { label } };
}

interface FormScenario {
  /** Номера сценариев документа. */
  readonly ids: string;
  readonly title: string;
  readonly request: string;
  /** Ответы модели: вызовы инструментов, последним — текст. */
  readonly replies: readonly ModelReply[];
  /** Подписи, которые после хода видны в дереве структуры. */
  readonly labels?: readonly string[];
  /** Подписи, которых после хода в дереве нет. */
  readonly gone?: readonly string[];
  /** Фрагменты сохранённого документа формы. */
  readonly schema?: readonly (string | RegExp)[];
  /** Фрагменты файла правил формы. */
  readonly rules?: readonly string[];
  /** Фрагменты прочих файлов модуля после хода: путь от корня проекта → фрагменты. */
  readonly files?: Readonly<Record<string, readonly string[]>>;
}

/** Ход заказал генерацию кода — её исход должен быть строкой успеха. */
const generates = (scenario: FormScenario): boolean =>
  scenario.replies.some((reply) => JSON.stringify(reply).includes('generate_code'));

const SCENARIOS: readonly FormScenario[] = [
  {
    ids: '3.1',
    title: 'поля всех видов одним вызовом',
    request: 'Добавь поля всех видов: почта, возраст, пароль, телефон, комментарий и выборы.',
    replies: [
      call('insert_node', {
        parent: '/root',
        nodes: [
          inputNode('email', 'Почта'),
          fieldNode('InputNumber', 'age', 'Возраст'),
          fieldNode('InputPassword', 'password', 'Пароль'),
          fieldNode('InputMask', 'phone', 'Телефон'),
          fieldNode('Textarea', 'comment', 'Комментарий'),
          choiceNode('Select', 'city', 'Город'),
          choiceNode('SelectMulti', 'tags', 'Теги'),
          choiceNode('RadioGroup', 'gender', 'Пол'),
          fieldNode('DatePicker', 'birthDate', 'Дата рождения'),
          fieldNode('Checkbox', 'agree', 'Согласие'),
          fieldNode('Switch', 'notify', 'Уведомления'),
          fieldNode('FileUpload', 'docs', 'Документы'),
        ],
      }),
      say('Добавил двенадцать полей.'),
    ],
    labels: ['Почта', 'Возраст', 'Пароль', 'Телефон', 'Комментарий', 'Город', 'Теги', 'Пол'],
    schema: ['$component(SelectMulti)', '$component(FileUpload)', '$model(birthDate)'],
  },
  {
    ids: '3.4, 3.6, 10.1',
    title: 'блок полей в секции, под вложенной группой модели',
    request: 'Добавь секцию «Паспорт»: серия, номер, кем выдан, дата выдачи.',
    replies: [
      call('insert_node', { parent: '/root', nodes: [{ component: 'Section' }] }),
      call('insert_node', {
        parent: '/root/children/1',
        nodes: [
          inputNode('passport.series', 'Серия'),
          inputNode('passport.number', 'Номер'),
          inputNode('passport.issuedBy', 'Кем выдан'),
          fieldNode('DatePicker', 'passport.issuedAt', 'Дата выдачи'),
        ],
      }),
      say('Секция добавлена.'),
    ],
    labels: ['Серия', 'Номер', 'Кем выдан', 'Дата выдачи'],
    schema: ['$component(Section)', '$model(passport.series)', '$model(passport.issuedAt)'],
  },
  {
    ids: '3.3, 6.1',
    title: 'варианты готового поля меняются',
    request: 'Добавь выбор города, а потом замени варианты на Москву и Казань.',
    replies: [
      call('insert_node', { parent: '/root', nodes: [choiceNode('Select', 'city', 'Город')] }),
      call('set_node_prop', {
        refs: ['/root/children/1'],
        props: {
          options: [
            { value: 'msk', label: 'Москва' },
            { value: 'kzn', label: 'Казань' },
          ],
        },
      }),
      say('Варианты заменены.'),
    ],
    labels: ['Город'],
    schema: ['"label": "Казань"'],
  },
  {
    ids: '4.1, 13.1',
    title: 'подпись и подсказка поля',
    request: 'Переименуй поле в «Фамилия, имя, отчество» и добавь подсказку.',
    replies: [
      call('set_node_prop', {
        refs: ['/root/children/0'],
        props: { label: 'Фамилия, имя, отчество', placeholder: 'Иванов Иван Иванович' },
      }),
      say('Готово.'),
    ],
    labels: ['Фамилия, имя, отчество'],
    gone: [FORM_B_FIELD],
    schema: ['"placeholder": "Иванов Иван Иванович"'],
  },
  {
    ids: '4.2',
    title: 'дублирование, удаление, перестановка и группировка в ряд',
    request: 'Добавь почту, телефон и город; город — наверх, почту с телефоном — в один ряд.',
    replies: [
      call('insert_node', {
        parent: '/root',
        nodes: [
          inputNode('email', 'Почта'),
          inputNode('phone', 'Телефон'),
          inputNode('city', 'Город'),
        ],
      }),
      // [ФИО, почта, телефон, город] → копия почты → [ФИО, почта, почта', телефон, город]
      call('duplicate_node', { ref: '/root/children/1' }),
      call('remove_node', { refs: ['/root/children/2'] }),
      // [ФИО, почта, телефон, город] → город наверх → [город, ФИО, почта, телефон]
      call('move_node', { refs: ['/root/children/3'], parent: '/root', index: 0 }),
      call('group_nodes', { refs: ['/root/children/2', '/root/children/3'], direction: 'row' }),
      say('Переставил и сгруппировал.'),
    ],
    labels: ['Почта', 'Телефон', 'Город'],
    schema: [/"\$model\(city\)"[\s\S]*"\$model\(fullName\)"[\s\S]*"\$model\(email\)"/],
  },
  {
    ids: '5.1, 5.3, 3.4',
    title: 'форма → мастер: поля пачкой по шагам, новый шаг, переименование шага',
    request: 'Сделай мастер: ФИО — в шаге «Заявитель», почта и телефон — в шаге «Контакты».',
    replies: [
      call('insert_node', {
        parent: '/root',
        nodes: [inputNode('email', 'Почта'), inputNode('phone', 'Телефон')],
      }),
      // [ФИО, почта, телефон] → мастер с шагом «Шаг 1» в конце корня.
      call('insert_node', { parent: '/root', nodes: [{ component: 'Wizard' }] }),
      call('insert_node', {
        parent: '/root/children/3',
        nodes: [{ component: 'Step', props: { title: 'Контакты' } }],
      }),
      // Пачкой и по адресам ДО переноса: почта и телефон — во второй шаг, ФИО — в первый.
      call('move_node', {
        refs: ['/root/children/1', '/root/children/2'],
        parent: '/root/children/3/children/1',
      }),
      call('move_node', { refs: ['/root/children/0'], parent: '/root/children/1/children/0' }),
      call('set_node_prop', {
        refs: ['/root/children/0/children/0'],
        props: { title: 'Заявитель' },
      }),
      call('generate_code', {}),
      say('Мастер собран.'),
    ],
    labels: [FORM_B_FIELD, 'Почта', 'Телефон'],
    schema: [
      '$component(Wizard)',
      '"title": "Заявитель"',
      /"title": "Контакты"[\s\S]*"\$model\(email\)"[\s\S]*"\$model\(phone\)"/,
    ],
  },
  {
    ids: '7.1, 7.3, 7.4, 7.9',
    title: 'обязательность и формат со своим текстом, кросс-полевая и условная проверки',
    request: 'Почта обязательна, пароли совпадают, ИНН обязателен для юрлица.',
    replies: [
      call('insert_node', {
        parent: '/root',
        nodes: [
          inputNode('email', 'Почта'),
          fieldNode('InputPassword', 'password', 'Пароль'),
          fieldNode('InputPassword', 'passwordConfirm', 'Повтор пароля'),
          choiceNode('Select', 'kind', 'Тип клиента'),
          inputNode('inn', 'ИНН'),
        ],
      }),
      call('set_form_rules', {
        validation: [
          { target: 'email', rules: ['required'], message: 'Укажите почту' },
          { target: 'email', rules: ['email'] },
          {
            target: 'passwordConfirm',
            cross: 'values.password === values.passwordConfirm',
            message: 'Пароли не совпадают',
          },
          { target: 'inn', rules: ['required'], when: "model.kind === 'b'" },
        ],
      }),
      call('generate_code', {}),
      say('Правила заданы.'),
    ],
    labels: ['Повтор пароля', 'ИНН'],
    rules: [
      "required({ code: 'email.required' })",
      '"values.password === values.passwordConfirm"',
      '"Пароли не совпадают"',
    ],
    // Текст обычного правила доходит до словаря формы, который печатает генерация.
    files: { [`${FORM_B_MODULE}/validation/messages.ts`]: ["'email.required'", 'Укажите почту'] },
  },
  {
    ids: '8.1, 8.3',
    title: 'вычисляемое поле и включение по условию',
    request: 'Сумма = цена × количество; комментарий доступен только с флажком.',
    replies: [
      call('insert_node', {
        parent: '/root',
        nodes: [
          fieldNode('InputNumber', 'price', 'Цена'),
          fieldNode('InputNumber', 'qty', 'Количество'),
          fieldNode('InputNumber', 'total', 'Сумма'),
          fieldNode('Checkbox', 'withComment', 'Есть комментарий'),
          fieldNode('Textarea', 'comment', 'Комментарий'),
        ],
      }),
      call('set_form_rules', {
        behavior: [
          { kind: 'computeFrom', target: 'total', sources: ['price', 'qty'], expr: 'price * qty' },
          {
            kind: 'enableWhen',
            target: 'comment',
            sources: ['withComment'],
            expr: 'model.withComment === true',
          },
        ],
      }),
      call('generate_code', {}),
      say('Связи заданы.'),
    ],
    labels: ['Сумма', 'Есть комментарий'],
    rules: ['"computeFrom"', '"price * qty"', '"enableWhen"'],
  },
  {
    ids: '8.4',
    title: 'блок скрыт по условию',
    request: 'Поле «Подробности» показывай только с согласием.',
    replies: [
      call('insert_node', {
        parent: '/root',
        nodes: [fieldNode('Checkbox', 'agree', 'Согласие'), inputNode('details', 'Подробности')],
      }),
      call('set_render_rules', {
        rules: [{ ref: '/root/children/2', kind: 'hideWhen', condition: 'model.agree !== true' }],
      }),
      say('Скрываю без согласия.'),
    ],
    labels: ['Подробности'],
    rules: ['"hideWhen"', '"model.agree !== true"'],
  },
  {
    ids: '9.1, 9.3, 7.6, 8.7',
    title: 'массив блоков: поля строки, шаблон новой строки, правила и связи строки',
    request: 'Добавь список детей: имя и дата рождения; имя обязательно; «основной» — у одного.',
    replies: [
      call('insert_node', {
        parent: '/root',
        nodes: [{ component: 'FieldArray', model: 'children' }],
      }),
      call('insert_node', {
        parent: '/root/children/1/item/$template',
        nodes: [
          inputNode('childName', 'Имя ребёнка'),
          fieldNode('DatePicker', 'childBirth', 'Дата рождения ребёнка'),
          fieldNode('Checkbox', 'primary', 'Основной'),
        ],
      }),
      call('set_node_prop', {
        refs: ['/root/children/1'],
        props: { $newRow: { childName: '', childBirth: null, primary: false } },
      }),
      call('set_form_rules', {
        validation: [{ each: 'children', target: 'childName', rules: ['required'] }],
        behavior: [{ kind: 'exclusiveFlag', each: 'children', target: 'primary' }],
      }),
      call('generate_code', {}),
      say('Список детей готов.'),
    ],
    labels: ['Имя ребёнка', 'Основной'],
    schema: ['$component(FieldArray)', '"initialValue"'],
    rules: ['"exclusiveFlag"', '"children.childName"'],
  },
  {
    ids: '10.2',
    title: 'блок — в часть, часть подключена дважды',
    request: 'Адрес регистрации вынеси в часть и подключи её ещё раз для адреса проживания.',
    replies: [
      call('insert_node', { parent: '/root', nodes: [{ component: 'Box' }] }),
      call('insert_node', {
        parent: '/root/children/1',
        nodes: [inputNode('registration.city', 'Город'), inputNode('registration.street', 'Улица')],
      }),
      call('extract_part', { ref: '/root/children/1', name: 'address', model: 'registration' }),
      call('insert_node', { parent: '/root', nodes: [{ part: 'address', model: 'residence' }] }),
      call('generate_code', {}),
      say('Адрес — общей частью.'),
    ],
    schema: ['"parts"', '$part(address)', '$model(residence)'],
  },
  {
    ids: '11.1, 11.2',
    title: 'раскладка в две колонки',
    request: 'Добавь почту и телефон и расположи форму в две колонки.',
    replies: [
      call('insert_node', {
        parent: '/root',
        nodes: [inputNode('email', 'Почта'), inputNode('phone', 'Телефон')],
      }),
      call('set_layout', { ref: '/root', columns: 2, gap: 'md' }),
      say('Две колонки.'),
    ],
    labels: ['Почта', 'Телефон'],
    schema: ['grid-cols-2'],
  },
  {
    ids: '20.2',
    title: 'поле заблокировано всегда',
    request: 'Сделай ФИО недоступным для правки.',
    replies: [
      call('set_node_prop', { refs: ['/root/children/0'], props: { $disabled: true } }),
      say('Поле заблокировано.'),
    ],
    labels: [FORM_B_FIELD],
    schema: ['"disabled": true'],
  },
];

test.describe('Ассистент: сценарии разработки форм', () => {
  test.setTimeout(150_000);

  for (const scenario of SCENARIOS) {
    test(`[${scenario.ids}] ${scenario.title}`, async ({ builder, disk, model, page, panel }) => {
      await builder.goto();
      await disk.seed({ plugins: ['reformer/ai'] });
      await seedFormB(disk);
      await builder.openFolder();
      await builder.openFile(FORM_B);
      await panel.connect();

      model.reply(...scenario.replies);
      await panel.ask(scenario.request);

      // Ни один вызов не отказал, ход закрыт без замечания.
      await expect(panel.failedToolLines(panel.answer(-1))).toHaveCount(0);
      await expect(panel.errorAlert).toBeHidden();
      if (generates(scenario)) {
        const lines = panel.toolLines(panel.answer(-1));
        await expect(lines.filter({ hasText: 'Код формы сгенерирован' })).toHaveCount(1);
      }

      for (const label of scenario.labels ?? []) {
        await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
      }
      for (const label of scenario.gone ?? []) {
        await expect(page.getByText(label, { exact: true })).toHaveCount(0);
      }
      if (scenario.schema !== undefined) {
        const text = await savedText(builder, disk, FORM_B);
        for (const fragment of scenario.schema) {
          if (typeof fragment === 'string') expect(text).toContain(fragment);
          else expect(text).toMatch(fragment);
        }
      }
      if (scenario.rules !== undefined) {
        await builder.openFile(RULES_B);
        const text = await savedText(builder, disk, RULES_B);
        for (const fragment of scenario.rules) expect(text).toContain(fragment);
      }
      for (const [path, fragments] of Object.entries(scenario.files ?? {})) {
        await builder.openFile(path);
        const text = await savedText(builder, disk, path);
        for (const fragment of fragments) expect(text).toContain(fragment);
      }
    });
  }
});
