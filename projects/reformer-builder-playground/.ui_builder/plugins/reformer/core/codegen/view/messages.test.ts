/**
 * Тексты замечаний формы: какие коды попадают в словарь и как словарь печатается.
 *
 * Снимки держат вывод на трёх-четырёх формах; здесь — правила отбора, которые снимком не
 * перечислить: код замечания не всегда совпадает с именем валидатора, свой код правила заменяет
 * код по умолчанию, а без правил в словарь идёт только то, что напечатает заготовка валидации.
 *
 * @module plugins/reformer/core/codegen/view/messages.test
 */

import { describe, expect, it } from 'vitest';
import { renderTemplate } from '@reformer/builder-toolkit';
import { ru } from '@reformer/core/locale/ru';
import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  builtinKit,
  foreignKit,
  plainSchema,
  seededRules,
  wizardRulesSchema,
  wizardRules,
} from '../__fixtures__/kit';
import { prepare, type CodegenInput } from '../context';
import type { FormRules } from '../../form-model/rules';
import { messagesTemplate, pageTemplate, validationTemplate } from '../templates';
import { buildView, type CodegenView } from './index';

function viewOf(over: Partial<CodegenInput> = {}): CodegenView {
  return buildView(
    prepare({ schema: plainSchema(), formName: 'Анкета', kit: builtinKit(), ...over })
  );
}

const rulesOf = (validation: FormRules['validation']): FormRules => ({
  validation,
  behavior: [],
  render: [],
});

describe('словарь замечаний: какие коды в него попадают', () => {
  it('коды валидаторов, которыми пользуются правила, — в порядке первого появления', () => {
    const { entries } = viewOf({ rules: seededRules() }).messages;
    expect(entries.map((entry) => entry.code)).toEqual(['required', 'minLength']);
    expect(entries[0]?.text).toBe('Обязательное поле');
  });

  it('длина у коллекции — в элементах: мультивыбор и массив получают код maxItems / minItems', () => {
    // Ядро различает вид значения само; кодоген узнаёт его по цели правила. Без этого под
    // набором навыков стояло бы «Не больше 3 символов».
    const schema = {
      format: 2,
      root: {
        component: '$component(Box)',
        children: [
          { model: '$model(name)', component: '$component(Input)' },
          { model: '$model(skills)', component: '$component(ComboboxMulti)' },
        ],
      },
    } as unknown as JsonFormSchema;
    const { entries } = viewOf({
      schema,
      rules: rulesOf([
        { target: 'name', rules: ['maxLength(20)'] },
        { target: 'skills', rules: ['minLength(1)', 'maxLength(3)'] },
      ]),
    }).messages;

    expect(entries.map((entry) => entry.code)).toEqual(['maxLength', 'minItems', 'maxItems']);
    expect(entries.find((entry) => entry.code === 'maxItems')?.text).toContain('элемент');
    expect(entries.find((entry) => entry.code === 'maxLength')?.text).toContain('символ');
  });

  it('тексты — из русской локали ядра, а не свои', () => {
    const { entries } = viewOf({
      rules: rulesOf([{ target: 'fullName', rules: ['email'] }]),
    }).messages;
    expect(entries).toEqual([
      { code: 'email', text: (ru.messages as Record<string, string>)['validation.email'] },
    ]);
  });

  it('код замечания не всегда равен имени валидатора', () => {
    // `futureDate` требует дату в будущем и потому жалуется на прошлую — код `date_past`.
    const { entries } = viewOf({
      rules: rulesOf([
        { target: 'fullName', rules: ['futureDate()', 'minAge(18)', 'isDate', 'url'] },
      ]),
    }).messages;
    expect(entries.map((entry) => entry.code)).toEqual([
      'date_past',
      'date_min_age',
      'date_invalid',
      'url',
      'url_protocol',
    ]);
  });

  it('свой код правила заменяет код валидатора; текст — по умолчанию для этого валидатора', () => {
    const { entries } = viewOf({
      rules: rulesOf([
        { target: 'fullName', rules: ["required({ code: 'fullName.required' })", 'required'] },
      ]),
    }).messages;
    expect(entries).toEqual([
      { code: 'fullName.required', text: 'Обязательное поле' },
      { code: 'required', text: 'Обязательное поле' },
    ]);
  });

  it('свой валидатор приложения в словарь не попадает: текста для него взять негде', () => {
    const { entries } = viewOf({
      rules: rulesOf([{ target: 'fullName', rules: ['innChecksum()', 'required'] }]),
    }).messages;
    expect(entries.map((entry) => entry.code)).toEqual(['required']);
  });

  it('без правил — `required`, если в схеме есть обязательные поля: его печатает заготовка', () => {
    expect(viewOf().messages.entries.map((entry) => entry.code)).toEqual(['required']);
    const optional = plainSchema();
    const fields = (optional.root as unknown as { children: { componentProps: object }[] })
      .children;
    fields.forEach((field) => {
      field.componentProps = { label: 'Поле' };
    });
    const empty = viewOf({ schema: optional }).messages;
    expect(empty.entries).toEqual([]);
    expect(empty.code).toBe('export const formMessages = defineIssueMessages({});');
  });

  it('у визарда словарь один на все шаги и правила вне шагов', () => {
    const { entries } = viewOf({ schema: wizardRulesSchema(), rules: wizardRules() }).messages;
    expect(entries.map((entry) => entry.code)).toEqual([
      'required',
      'minLength',
      'email',
      'maxLength',
    ]);
  });
});

describe('словарь замечаний: печать и подключение', () => {
  it('файл объявляет `formMessages` — под этим именем его ждут страница и превью', () => {
    const code = renderTemplate(
      'test.messages',
      messagesTemplate,
      viewOf({ rules: seededRules() })
    );
    expect(code).toContain(
      "import { defineIssueMessages, type FormLocale } from '@reformer/core/i18n';"
    );
    expect(code).toContain('export const formMessages = defineIssueMessages({');
    expect(code).toContain("  required: 'Обязательное поле',");
    // Длинный шаблон с `plural` уходит под ключ целиком — так его оставит форматтер.
    expect(code).toContain("  minLength:\n    'Не меньше {minLength, plural,");
  });

  it('файл объявляет язык формы — русскую локаль кита, а у кита без своей — локаль ядра', () => {
    // Шаблон словаря форматируется по ЯЗЫКУ активной локали: без своего языка форма в приложении
    // с английской локалью склоняла бы русские тексты по-английски («Не больше 3 символа»).
    const builtin = renderTemplate('test.messages', messagesTemplate, viewOf());
    expect(builtin).toContain("import { ru } from '@reformer/ui-kit/locale/ru';");
    expect(builtin).toContain('export const formLocale: FormLocale | undefined = ru;');

    const foreign = renderTemplate(
      'test.messages',
      messagesTemplate,
      viewOf({ kit: foreignKit() })
    );
    expect(foreign).toContain("import { ru } from '@reformer/core/locale/ru';");
  });

  it('страница оборачивает форму провайдером со словарём формы и задаёт ей язык словаря', () => {
    const code = renderTemplate('test.page', pageTemplate, viewOf());
    expect(code).toContain("import { ValidationMessagesProvider } from '@reformer/cdk';");
    expect(code).toContain("import { I18nProvider, useFormBundle } from '@reformer/core/react';");
    expect(code).toContain("import { formLocale, formMessages } from './validation/messages';");
    expect(code).toContain('<ValidationMessagesProvider messages={formMessages}>');
    expect(code.indexOf('<FormRenderer form={bundle} />')).toBeGreaterThan(
      code.indexOf('<ValidationMessagesProvider')
    );
    expect(code.indexOf('</ValidationMessagesProvider>')).toBeGreaterThan(
      code.indexOf('<FormRenderer form={bundle} />')
    );
    // Язык снаружи словаря: провайдер замечаний живёт в поддереве с локалью формы.
    expect(code).toContain(
      'return formLocale === undefined ? page : <I18nProvider locale={formLocale}>{page}</I18nProvider>;'
    );
  });

  it('простая форма включает живую проверку `change` вместе с правилами', () => {
    const code = renderTemplate('test.validation', validationTemplate, viewOf());
    expect(code).toContain(
      "export const formValidation: FormValidation<AnketaForm> = { rules: formRules, strategy: 'change' };"
    );
    // Варианты стратегии названы на месте — выбирать её будет человек.
    for (const kind of ["'submit'", "'blur'", "'change'", "'afterFirstSubmit'"]) {
      expect(code).toContain(kind);
    }
  });
});
