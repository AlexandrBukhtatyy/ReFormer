import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { partsWizardSchema, plainSchema, wizardSplitSource } from './__fixtures__/kit';
import { prepare, type CodegenInput } from './context';
import { joinFormSchema, STEP_SCHEMA_MARKER } from '../form-model/composite';
import { stepDirName } from '../form-model/step-dir';
import { moduleFilesOf, RESERVED_STEP_NAMES, stepValidationPath } from './layout';
import { builtinKit } from './__fixtures__/kit';

/** Визард из шагов с заданными заголовками; в каждом шаге — одно обязательное поле. */
function wizardOf(titles: readonly unknown[]): JsonFormSchema {
  return {
    format: 2,
    root: {
      component: '$component(Box)',
      children: [
        {
          component: '$component(Wizard)',
          children: titles.map((title, i) => ({
            component: '$component(Step)',
            componentProps: title === undefined ? {} : { title },
            children: [
              {
                model: `$model(field${i + 1})`,
                component: '$component(Input)',
                componentProps: { label: `Поле ${i + 1}`, required: true },
              },
            ],
          })),
        },
      ],
    },
  } as unknown as JsonFormSchema;
}

function layoutOfSchema(schema: JsonFormSchema, over: Partial<CodegenInput> = {}) {
  return prepare({ schema, formName: 'Анкета', kit: builtinKit(), ...over }).layout;
}

describe('stepDirName', () => {
  it('папка шага — транслит заголовка, без номера', () => {
    expect(stepDirName(2, 'Контакты', null)).toBe('kontakty');
  });

  it('заголовок-оператор словами не считается: берётся селектор', () => {
    expect(stepDirName(1, '$i18n(steps.contacts)', 'contacts-section')).toBe('contacts');
  });

  it('без заголовка и селектора — номер шага', () => {
    expect(stepDirName(3, undefined, null)).toBe('step-3');
  });

  it('длинный заголовок обрезается по границе слова', () => {
    const dir = stepDirName(1, 'Очень длинное название шага анкеты для проверки обрезки', null);
    expect(dir.length).toBeLessThanOrEqual(32);
    expect(dir.endsWith('-')).toBe(false);
  });
});

describe('layoutOf', () => {
  it('форма без шагов — простая', () => {
    expect(layoutOfSchema(plainSchema())).toEqual({ kind: 'simple', steps: [] });
  });

  it('визард: шаги по порядку, с именами, полями и обязательными', () => {
    const layout = layoutOfSchema(wizardOf(['Данные', 'Контакты']));
    expect(layout.kind).toBe('wizard');
    expect(layout.steps.map((s) => s.dir)).toEqual(['dannye', 'kontakty']);
    expect(layout.steps.map((s) => s.alias)).toEqual(['step1', 'step2']);
    expect(layout.steps[1]).toMatchObject({
      index: 2,
      slug: 'kontakty',
      title: 'Контакты',
      required: ['field2'],
      fields: ['field2'],
      rulesAlias: 'kontaktyRules',
      // Правила шага — в папке валидации; схемы у шага нет, пока визард не разбит по шагам.
      files: { validation: 'validation/kontakty.ts', schema: null, schemaSource: null },
    });
  });

  it('одинаковые заголовки разводятся суффиксом, а не номером в начале', () => {
    const layout = layoutOfSchema(wizardOf(['Контакты', 'Контакты']));
    expect(layout.steps.map((s) => s.dir)).toEqual(['kontakty', 'kontakty-2']);
  });

  it('шаг без заголовка получает имя по селектору или номеру', () => {
    const layout = layoutOfSchema(wizardOf([undefined, 'Итог']));
    expect(layout.steps[0]?.dir).toMatch(/^step-1$|^[a-z0-9-]+$/);
    expect(layout.steps[1]?.dir).toBe('itog');
  });

  it('селекторы шага включают сам шаг — по ним делятся правила узлов', () => {
    const layout = layoutOfSchema(wizardOf(['Данные']));
    const step = layout.steps[0];
    expect(step?.selector).not.toBeNull();
    expect(step?.selectors).toContain(step?.selector);
    expect(step?.sections.map((s) => s.selector)).toContain(step?.selector);
  });

  it('шаг без заголовка тоже несёт селектор — он станет id шага в потоке', () => {
    const layout = layoutOfSchema(wizardOf([undefined, 'Итог']));
    expect(layout.steps[0]?.selector).toBe('step-1');
    expect(layout.steps[0]?.slug).toBe('step-1');
  });
});

describe('имя шага и файл его правил', () => {
  it('шаг не может занять имя файла правил формы: «Form» разводится суффиксом', () => {
    const layout = layoutOfSchema(wizardOf(['Form', 'Контакты']));
    // `validation/form.ts` — файл формы; шаг с таким именем лёг бы на тот же путь.
    expect(layout.steps.map((s) => s.files.validation)).toEqual([
      'validation/form-2.ts',
      'validation/kontakty.ts',
    ]);
    expect(layout.steps[0]).toMatchObject({ dir: 'form-2', slug: 'form-2' });
  });

  it('шаг не может занять имя словаря замечаний: «Messages» разводится суффиксом', () => {
    const layout = layoutOfSchema(wizardOf(['Messages', 'Контакты']));
    // `validation/messages.ts` — тексты замечаний формы; файл правил шага с тем же именем затёр
    // бы словарь (или словарь — правила шага: кто печатается последним).
    expect(layout.steps.map((s) => s.files.validation)).toEqual([
      'validation/messages-2.ts',
      'validation/kontakty.ts',
    ]);
    expect(layout.steps[0]).toMatchObject({ dir: 'messages-2', slug: 'messages-2' });
  });

  it('зарезервированы оба имени файлов формы в validation/', () => {
    expect([...RESERVED_STEP_NAMES].sort()).toEqual(['form', 'messages']);
    expect(moduleFilesOf({ dir: 'x', TypeName: 'XForm' }).messages).toBe(
      stepValidationPath('messages')
    );
  });

  it('псевдонимы правил — camelCase имени шага; не-идентификатор получает приставку', () => {
    const layout = layoutOfSchema(wizardOf(['Контакты', 'Контакты', '2024 год']));
    expect(layout.steps.map((s) => s.rulesAlias)).toEqual([
      'kontaktyRules',
      'kontakty2Rules',
      'step2024GodRules',
    ]);
  });

  it('совпавшие псевдонимы разводятся: имена шагов разные, а их camelCase — один', () => {
    const layout = layoutOfSchema(wizardOf(['A 1', 'A1']));
    expect(layout.steps.map((s) => s.slug)).toEqual(['a-1', 'a1']);
    expect(layout.steps.map((s) => s.rulesAlias)).toEqual(['a1Rules', 'a1Rules2']);
  });
});

describe('шаги разбитого визарда', () => {
  it('папка шага — из ссылки; схема шага лежит рядом с корневым документом', () => {
    const { schema, origins } = wizardSplitSource();
    const layout = layoutOfSchema(schema, { origins });
    // Первый шаг назван «Данные», но лежит в `steps/anketa/`: папку задаёт ссылка.
    expect(layout.steps[0]).toMatchObject({
      dir: 'anketa',
      slug: 'anketa',
      schemaRef: './steps/anketa/form.schema.json',
      files: {
        validation: 'validation/anketa.ts',
        schema: 'schema/steps/anketa/form.schema.json',
        schemaSource: 'schema/steps/anketa/form.schema.json',
      },
    });
  });

  it('документ в корне модуля — и схемы шагов рядом с ним, а не в schema/', () => {
    const { schema, origins } = wizardSplitSource();
    const layout = layoutOfSchema(schema, { origins, schemaPath: 'form.schema.json' });
    expect(layout.steps[0]?.files.schema).toBe('steps/anketa/form.schema.json');
    // Код шага от места документа не зависит.
    expect(layout.steps[0]?.files.validation).toBe('validation/anketa.ts');
  });

  it('шаг в папке steps/form: папка — из ссылки, а файл правил разводится отдельно', () => {
    const step = (id: string, title: string, path: string) => ({
      component: '$component(Step)',
      componentProps: { title },
      $nodeId: id,
      children: [{ model: `$model(${path})`, component: '$component(Input)', $nodeId: `${id}f` }],
    });
    const skeleton = {
      format: 2,
      root: {
        component: '$component(Box)',
        $nodeId: 'root0000',
        children: [
          {
            component: '$component(Wizard)',
            $nodeId: 'wizard00',
            children: [{ $ref: './steps/form/form.schema.json' }, step('second00', 'Form', 'b')],
          },
        ],
      },
    } as unknown as JsonFormSchema;
    const { schema, origins } = joinFormSchema(
      skeleton,
      new Map([
        [
          './steps/form/form.schema.json',
          { $schema: STEP_SCHEMA_MARKER, node: step('first000', 'Анкета', 'a') },
        ],
      ])
    );

    const layout = layoutOfSchema(schema, { origins });
    const [first, second] = layout.steps;
    // Второй шаг назван «Form» и при разбиении получил свою папку — занятую `form` он обошёл.
    expect(second).toMatchObject({ dir: 'form-2', slug: 'form-2' });
    // Папку первого шага менять нельзя: на неё ссылается корневой документ. Разводится только
    // имя файла правил — и с файлом формы, и с именами остальных шагов.
    expect(first).toMatchObject({
      dir: 'form',
      slug: 'form-3',
      files: {
        validation: 'validation/form-3.ts',
        schema: 'schema/steps/form/form.schema.json',
      },
    });
    expect(layout.steps.map((s) => s.files.validation)).not.toContain('validation/form.ts');
  });
});

describe('части документа в шагах визарда', () => {
  it('подформа — поле шага своей группой; массив с частью — своим путём', () => {
    const [addresses, guests] = layoutOfSchema(partsWizardSchema()).steps;
    expect(addresses.fields).toEqual(['sameAddress', 'home', 'work']);
    expect(guests.fields).toEqual(['guests']);
    expect(addresses.required).toEqual(['home.city', 'work.city']);
  });

  it('селекторы узлов части шагу не принадлежат: они живут в области части', () => {
    const [addresses, guests] = layoutOfSchema(partsWizardSchema()).steps;
    expect(addresses.selectors).toEqual(['adresa-section', 'work-section']);
    expect(guests.selectors).toEqual(['gosti-section', 'guests']);
  });
});
