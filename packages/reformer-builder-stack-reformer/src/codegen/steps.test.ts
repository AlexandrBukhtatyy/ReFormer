import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { plainSchema } from './__fixtures__/kit';
import { prepare } from './context';
import { stepDirName } from './steps';
import { builtinKit } from './__fixtures__/kit';

/** Визард из шагов с заданными заголовками; в каждом шаге — одно обязательное поле. */
function wizardOf(titles: readonly unknown[]): JsonFormSchema {
  return {
    root: {
      component: '$component(Box)',
      children: [
        {
          component: '$component(Wizard)',
          componentProps: {
            steps: titles.map((title, i) => ({
              component: '$component(Step)',
              componentProps: title === undefined ? {} : { title },
              children: [
                {
                  value: `$model(field${i + 1})`,
                  component: '$component(Input)',
                  componentProps: { label: `Поле ${i + 1}`, required: true },
                },
              ],
            })),
          },
        },
      ],
    },
  } as unknown as JsonFormSchema;
}

function layoutOfSchema(schema: JsonFormSchema) {
  return prepare({ schema, formName: 'Анкета', kit: builtinKit() }).layout;
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

  it('визард: шаги по порядку, с папками, полями и обязательными', () => {
    const layout = layoutOfSchema(wizardOf(['Данные', 'Контакты']));
    expect(layout.kind).toBe('wizard');
    expect(layout.steps.map((s) => s.dir)).toEqual(['dannye', 'kontakty']);
    expect(layout.steps.map((s) => s.alias)).toEqual(['step1', 'step2']);
    expect(layout.steps[1]).toMatchObject({
      index: 2,
      path: 'steps/kontakty',
      title: 'Контакты',
      required: ['field2'],
      fields: ['field2'],
      files: {
        validation: 'steps/kontakty/form.validation.ts',
        render: 'steps/kontakty/form.render.ts',
      },
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

  it('селекторы шага включают сам шаг — по ним делятся render-правила', () => {
    const layout = layoutOfSchema(wizardOf(['Данные']));
    const step = layout.steps[0];
    expect(step?.selector).not.toBeNull();
    expect(step?.selectors).toContain(step?.selector);
    expect(step?.sections.map((s) => s.selector)).toContain(step?.selector);
  });
});
