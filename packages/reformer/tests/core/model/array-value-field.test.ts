/**
 * Массив как ОДНО значение поля: мультивыбор, теги, список файлов.
 *
 * До этого любой массив в начальных данных был только набором под-форм: `createForm` его
 * пропускал, запись `.value` в его узел молча терялась, а `validate` отвергал узел по типам.
 * Мультивыборы жили на обходе `string[] | null` + `model.signalAt(path)!`, и у обхода были свои
 * ловушки: начальное `[]` убирало поле, `patch` массивом до `createForm` — тоже.
 *
 * Здесь проверяется шов целиком: узел-массив — записываемая ручка значения; форма строит над ней
 * обычную ноду поля, когда схема привязала компонент; правила и поведение принимают её как лист.
 * Файл написан без приведений типов намеренно — он же служит проверкой типов контракта.
 */

import { describe, it, expect } from 'vitest';
import {
  createModel,
  eachLeafSignal,
  eachValueSignal,
  isModelContainerSignal,
  isValueSignal,
} from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { getNodeForSignal } from '../../../src/form/signal-node-registry';
import { isFieldNode } from '../../../src/form/type-guards';
import {
  createFormValidation,
  defineValidationSchema,
  validate,
  validateModel,
} from '../../../src/form/validation/index';
import { required } from '../../../src/form/validators/required';
import { maxLength } from '../../../src/form/validators/max-length';
import { copyFrom, defineFormBehavior, enableWhen } from '../../../src/form/behaviors';
import type { FormModel } from '../../../src/model/index';

const Select = () => null;
const Box = () => null;
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

interface Row {
  label: string;
}
interface Form {
  name: string;
  tags: string[];
  backup: string[];
  maybe: string[] | null;
  enabled: boolean;
  profile: { city: string; langs: string[] };
  rows: Row[];
}

const initial = (): Form => ({
  name: '',
  tags: [],
  backup: [],
  maybe: null,
  enabled: true,
  profile: { city: '', langs: [] },
  rows: [],
});

describe('узел-массив модели — ручка значения', () => {
  it('запись .value заменяет массив целиком и будит подписчиков', () => {
    const model = createModel<Form>(initial());
    const seen: string[][] = [];
    model.$.tags.subscribe((value) => seen.push(value));

    model.$.tags.value = ['a', 'b'];

    expect(model.get().tags).toEqual(['a', 'b']);
    expect(model.$.tags.value).toEqual(['a', 'b']);
    expect(model.$.tags.length).toBe(2);
    expect(model.$.tags[0]?.value).toBe('a');
    expect(seen.at(-1)).toEqual(['a', 'b']);
    // Отдаётся копия: мутация того, что прочитали, модель не трогает.
    model.$.tags.value.push('c');
    expect(model.get().tags).toEqual(['a', 'b']);
  });

  it('пустое значение — пустой массив: null и undefined у узла-массива не хранятся', () => {
    const model = createModel<Form>(initial());
    model.$.tags.value = ['a'];

    // Контролы мультивыбора отдают null на пустом выборе — узел приводит его к [].
    (model.$.tags as { value: string[] | null }).value = null;

    expect(model.get().tags).toEqual([]);
  });

  it('любая другая запись в контейнер — ошибка, а не молча осевшее свойство', () => {
    const model = createModel<Form>(initial());

    expect(() => {
      (model.$.profile as unknown as { value: unknown }).value = { city: 'x', langs: [] };
    }).toThrow(/узла-группы невозможна/);
    expect(() => {
      (model.$.tags as unknown as Record<string, unknown>)[0] = 'x';
    }).toThrow(/узла-массива невозможна/);
    expect(model.get().profile).toEqual({ city: '', langs: [] });
  });

  it('signalAt отдаёт ту же ручку для пути массива; для группы — undefined', () => {
    const model = createModel<Form>(initial());

    expect(model.signalAt('tags')).toBe(model.$.tags);
    expect(model.signalAt('profile.langs')).toBe(model.$.profile.langs);
    expect(model.signalAt('profile')).toBeUndefined();
    // Обход, записанный в документации для мультивыборов, работает и на массиве.
    model.signalAt('tags')!.value = ['x'];
    expect(model.get().tags).toEqual(['x']);
  });

  it('isValueSignal: лист и массив — да, группа — нет', () => {
    const model = createModel<Form>(initial());

    expect(isValueSignal(model.$.name)).toBe(true);
    expect(isValueSignal(model.$.tags)).toBe(true);
    expect(isValueSignal(model.$.maybe)).toBe(true);
    expect(isValueSignal(model.$.profile)).toBe(false);
    expect(isValueSignal(model.tags)).toBe(false);
    expect(isValueSignal(null)).toBe(false);
    // Контейнером массив при этом остаётся: обходчики дерева в него по-прежнему спускаются.
    expect(isModelContainerSignal(model.$.tags)).toBe(true);
  });

  it('eachValueSignal видит и массивы; eachLeafSignal — только листья', () => {
    const model = createModel<Form>({ ...initial(), tags: ['a'], rows: [{ label: 'x' }] });
    const pathsOf = (walk: typeof eachLeafSignal): string[] => {
      const paths: string[] = [];
      walk(model, (signal) => paths.push(signal.__path));
      return paths.sort();
    };

    const leaves = pathsOf(eachLeafSignal);
    expect(leaves).toContain('tags.0');
    expect(leaves).not.toContain('tags');
    expect(pathsOf(eachValueSignal)).toEqual(
      [...leaves, 'backup', 'profile.langs', 'rows', 'tags'].sort()
    );
  });
});

describe('поле формы над массивом', () => {
  const build = (model: FormModel<Form>) =>
    createFormFromModel<Form>({
      model,
      schema: {
        component: Box,
        children: [
          { value: model.$.name, component: Select },
          { value: model.$.tags, component: Select, componentProps: { label: 'Теги' } },
          { value: model.$.maybe, component: Select },
          { value: model.$.profile.langs, component: Select },
        ],
      },
    });

  it('начальное [] даёт обычную ноду поля: значение, компонент и пропсы на месте', () => {
    const model = createModel<Form>(initial());
    const form = build(model);

    expect(isFieldNode(form.tags)).toBe(true);
    expect(form.tags.component).toBe(Select);
    expect(form.tags.componentProps.value).toEqual({ label: 'Теги' });
    expect(form.tags.value.value).toEqual([]);
    expect(getNodeForSignal(model.$.tags)).toBe(form.tags);
  });

  it('значение ходит в обе стороны, вложенная группа — так же', () => {
    const model = createModel<Form>(initial());
    const form = build(model);

    form.tags.setValue(['ru', 'by']);
    expect(model.get().tags).toEqual(['ru', 'by']);

    model.$.tags.value = ['kz'];
    expect(form.tags.value.value).toEqual(['kz']);
    // Мутации value-фасада — тот же массив: нода видит и их.
    model.tags.push('am');
    expect(form.tags.value.value).toEqual(['kz', 'am']);

    form.profile.langs.setValue(['en']);
    expect(model.get().profile.langs).toEqual(['en']);
    expect(getNodeForSignal(model.$.profile.langs)).toBe(form.profile.langs);
  });

  it('сброс ноды возвращает начальный массив', () => {
    const model = createModel<Form>({ ...initial(), tags: ['ru'] });
    const form = build(model);

    form.tags.setValue(['by', 'kz']);
    form.tags.reset();

    expect(model.get().tags).toEqual(['ru']);
    expect(form.tags.dirty.value).toBe(false);
  });

  it('массив без привязки в схеме полем не становится — чем он является, решает схема', () => {
    const model = createModel<Form>(initial());
    const form = build(model);

    // `backup` в схеме не упомянут, `rows` — набор под-форм без item-схемы.
    expect(form.getFieldByPath('backup')).toBeUndefined();
    expect(form.getFieldByPath('rows')).toBeUndefined();
  });

  it('массив с item-схемой остаётся набором под-форм, даже если к нему привязали компонент', () => {
    const model = createModel<Form>({ ...initial(), rows: [{ label: 'x' }] });
    const form = createFormFromModel<Form>({
      model,
      schema: {
        children: [
          { value: model.$.rows, component: Box },
          {
            array: model.rows,
            item: (row: FormModel<Row>) => ({ value: row.$.label, component: Select }),
          },
        ],
      },
    });

    expect(isFieldNode(form.rows)).toBe(false);
    expect(form.rows.length.value).toBe(1);
  });

  it('nullable-поле: лист с начальным null — то же поле, и patch до createForm его не убирает', () => {
    const model = createModel<Form>(initial());
    // Данные с сервера пришли раньше сборки формы — раньше поле после этого пропадало: обход
    // шёл по текущему значению, а лист с массивом выглядел как массив.
    model.patch({ maybe: ['a'] });
    const form = build(model);

    expect(isFieldNode(form.maybe)).toBe(true);
    expect(form.maybe.value.value).toEqual(['a']);
    form.maybe.setValue(null);
    expect(model.get().maybe).toBeNull();
  });
});

describe('валидация массива как значения', () => {
  const schema = defineValidationSchema<Form>(({ model }) => {
    // Без приведений типов и без signalAt: узел-массив — PathAwareSignal.
    validate(model.$.tags, [required({ message: 'Выберите тег' }), maxLength(2)]);
    validate(model.$.maybe, [required({ message: 'Выберите значение' })]);
  });
  const build = (model: FormModel<Form>) =>
    createFormFromModel<Form>({
      model,
      schema: {
        children: [
          { value: model.$.tags, component: Select },
          { value: model.$.maybe, component: Select },
        ],
      },
    });

  it('ошибка доезжает до ноды поля и гаснет после исправления', async () => {
    const model = createModel<Form>(initial());
    const form = build(model);

    expect(await validateModel(model, schema)).toBe(false);
    expect(form.tags.errors.value.map((error) => error.message)).toEqual(['Выберите тег']);
    expect(form.maybe.errors.value).toHaveLength(1);

    form.tags.setValue(['a']);
    form.maybe.setValue(['b']);
    expect(await validateModel(model, schema)).toBe(true);
    expect(form.tags.errors.value).toEqual([]);

    form.tags.setValue(['a', 'b', 'c']);
    expect(await validateModel(model, schema)).toBe(false);
    expect(form.tags.errors.value).toHaveLength(1);
  });

  it('стратегия blur видит ноду поля-массива: уход фокуса запускает проверку', async () => {
    const model = createModel<Form>(initial());
    const form = build(model);
    const validation = createFormValidation(model, schema, { strategy: 'blur' });
    const stop = validation.start();

    form.tags.markAsTouched();
    await tick(10);

    expect(form.tags.errors.value).toHaveLength(1);
    stop();
  });
});

describe('поведение над массивом как значением', () => {
  it('copyFrom копирует массив целиком — и скаляром, и внутри группы', async () => {
    const model = createModel<Form & { copy: { city: string; langs: string[] } }>({
      ...initial(),
      copy: { city: '', langs: [] },
    });
    const behavior = defineFormBehavior<typeof model extends FormModel<infer T> ? T : never>(
      ({ model: m }) => {
        copyFrom(m.$.tags, m.$.backup);
        copyFrom(m.$.profile, m.$.copy);
      }
    );
    const form = createFormFromModel({ model, behavior });

    model.$.tags.value = ['a', 'b'];
    model.$.profile.langs.value = ['en'];
    model.profile.city = 'Минск';
    await tick(10);

    expect(model.get().backup).toEqual(['a', 'b']);
    expect(model.get().copy).toEqual({ city: 'Минск', langs: ['en'] });
    form.dispose();
  });

  it('enableWhen выключает и включает ноду поля-массива', async () => {
    const model = createModel<Form>(initial());
    const behavior = defineFormBehavior<Form>(({ model: m }) => {
      enableWhen(m.$.tags, () => m.enabled);
    });
    const form = createFormFromModel<Form>({
      model,
      schema: { children: [{ value: model.$.tags, component: Select }] },
      behavior,
    });

    model.enabled = false;
    await tick(10);
    expect(form.tags.disabled.value).toBe(true);

    model.enabled = true;
    await tick(10);
    expect(form.tags.disabled.value).toBe(false);
    form.dispose();
  });
});
