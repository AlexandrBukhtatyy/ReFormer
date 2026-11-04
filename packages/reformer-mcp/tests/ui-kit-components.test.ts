/**
 * Поля ui-kit в генераторе и валидаторе: registry-имя ↔ экспорт ↔ модуль импорта, компонент вместо
 * пропа.
 *
 * Зачем. `*Field`-версии компонентов ui-kit удалены без алиасов: в `component` поля кладётся
 * сам компонент, а число, подсказки и варианты загрузки файлов стали отдельными компонентами
 * (`InputNumber`, `InputSuggest`, `FileUploadDropzone`, `FileUploadInput`). Генератор, который
 * печатает `import { InputField }` или `$component(Input)` с `type: 'number'`, выдаёт код,
 * который не собирается либо молча пишет в модель строку вместо числа.
 *
 * Имена, экспорты и подпути генератор берёт из `component-catalog.json` кита (`uiKitFromCatalog`):
 * своей таблицы у сервера нет. Без каталога имена идут в код как есть.
 */

import { describe, it, expect } from 'vitest';
import { CATALOGS } from './support/catalogs';
import {
  groupUiKitImports,
  NO_UI_KIT,
  normalizeFieldComponent,
  uiKitFromCatalog,
} from '../src/core/generate/ui-kit-components';
import { buildBundle, buildRegistryTs } from '../src/core/generate/builders';
import { buildFormSchemaTs } from '../src/core/generate/schema-emit';
import { normalizeIntent, readIntent } from '../src/core/generate/form-intent';
import { validateCode } from '../src/core/validate/code';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

const kit = CATALOGS.uiKit;

describe('каталог кита', () => {
  const fixture = uiKitFromCatalog({
    components: [
      { name: 'Input', role: 'field', propsSchema: {} },
      { name: 'Checkbox', role: 'field', exportName: 'CheckboxWithLabel' },
      { name: 'Calendar', role: 'field', exportName: 'CalendarSingle', subpath: 'calendar' },
      { name: 'Box', role: 'container' },
      { name: 'Carousel', role: 'container', subpath: 'carousel' },
      { role: 'field' },
    ],
  });

  it('поля, экспорты и подпути — из записей каталога', () => {
    expect(fixture.found).toBe(true);
    expect(fixture.fields).toEqual({
      Input: 'Input',
      Checkbox: 'CheckboxWithLabel',
      Calendar: 'CalendarSingle',
    });
    expect(fixture.exports).toMatchObject({ Box: 'Box', Carousel: 'Carousel' });
    expect(fixture.subpaths).toEqual({ CalendarSingle: 'calendar', Carousel: 'carousel' });
  });

  it('не каталог — пустой справочник', () => {
    for (const value of [undefined, null, 'x', {}, { components: 'x' }, { components: [] }]) {
      expect(uiKitFromCatalog(value)).toBe(NO_UI_KIT);
    }
  });

  it('каталог монорепо: поля кита и подпути тяжёлых компонентов', () => {
    expect(kit.fields).toMatchObject({ Checkbox: 'CheckboxWithLabel', Select: 'SelectAsync' });
    expect(groupUiKitImports(['CalendarSingle', 'Input', 'Carousel'], kit)).toEqual([
      ['@reformer/ui-kit', ['Input']],
      ['@reformer/ui-kit/calendar', ['CalendarSingle']],
      ['@reformer/ui-kit/carousel', ['Carousel']],
    ]);
  });
});

describe('без каталога кита', () => {
  const intent = () =>
    normalizeIntent({
      formName: 'Order',
      target: 'renderer-json',
      fields: [{ name: 'day', type: 'date', component: 'Calendar' }],
    });

  it('имена идут в код как есть, из корня пакета, с одним предупреждением', () => {
    const { content, warnings } = buildRegistryTs(intent(), NO_UI_KIT);
    expect(content).toContain("reg.component('Calendar', Calendar);");
    expect(content).toContain("from '@reformer/ui-kit';");
    expect(content).not.toContain('TODO');
    expect(warnings).toEqual([expect.stringMatching(/Каталог @reformer\/ui-kit не найден/)]);
  });

  it('с каталогом то же поле импортируется из подпути', () => {
    const { content } = buildFormSchemaTs({ ...intent(), target: 'renderer-react' }, kit);
    expect(content).toContain("import { CalendarSingle } from '@reformer/ui-kit/calendar';");
  });

  it('имя компонента в type узнаётся только по каталогу', () => {
    const raw = { fields: [{ name: 'city', type: 'Select' }] };
    expect(readIntent(raw, { uiKit: kit }).intent.fields[0].component).toBe('Select');
    expect(readIntent(raw).intent.fields[0].component).not.toBe('Select');
  });

  it('контейнер кита в раскладке получает импорт, а не TODO', () => {
    const withCard = normalizeIntent({
      formName: 'Order',
      target: 'renderer-json',
      fields: [{ name: 'title', type: 'string', component: 'Input' }],
      layoutRoot: {
        kind: 'container',
        component: 'Card',
        children: [{ kind: 'field', ref: 'title' }],
      },
    });
    const { content, warnings } = buildRegistryTs(withCard, kit);
    expect(content).toContain("reg.component('Card', Card);");
    expect(warnings).toEqual([]);
  });
});

describe('normalizeFieldComponent', () => {
  it('числовое поле на Input → InputNumber без type', () => {
    expect(
      normalizeFieldComponent('Input', 'number', { type: 'number', label: 'Сумма' })
    ).toMatchObject({
      component: 'InputNumber',
      componentProps: { label: 'Сумма' },
    });
    expect(normalizeFieldComponent('Input', 'string', { type: 'number' }).component).toBe(
      'InputNumber'
    );
  });

  it('Input с suggestions → InputSuggest', () => {
    expect(normalizeFieldComponent('Input', 'string', { suggestions: ['a'] }).component).toBe(
      'InputSuggest'
    );
  });

  it('FileUpload + variant → отдельный компонент, variant снят', () => {
    const dz = normalizeFieldComponent('FileUpload', 'object', { variant: 'dropzone' });
    expect(dz.component).toBe('FileUploadDropzone');
    expect(dz.componentProps).not.toHaveProperty('variant');
    expect(normalizeFieldComponent('FileUpload', 'object', { variant: 'input' }).component).toBe(
      'FileUploadInput'
    );
  });

  it('имя экспорта приводится к registry-имени', () => {
    expect(normalizeFieldComponent('CheckboxWithLabel', 'boolean', {}, kit).component).toBe(
      'Checkbox'
    );
    expect(normalizeFieldComponent('SelectAsync', 'string', {}, kit).component).toBe('Select');
    expect(normalizeFieldComponent('Textarea', 'string', {}, kit).notes).toEqual([]);
  });

  it('чужое имя не подменяется: его называет сборка', () => {
    expect(normalizeFieldComponent('CheckboxField', 'boolean')).toEqual({
      component: 'CheckboxField',
      componentProps: {},
      notes: [],
    });
  });
});

describe('генератор', () => {
  it('поле number без компонента и с Input рисует InputNumber, и это видно в warnings', () => {
    const { intent } = readIntent(
      {
        formName: 'Order',
        target: 'renderer-json',
        fields: [
          { name: 'qty', type: 'number' },
          { name: 'price', type: 'number', component: 'Input', componentProps: { type: 'number' } },
          { name: 'agree', type: 'boolean', component: 'CheckboxWithLabel' },
        ],
      },
      { uiKit: kit }
    );
    expect(intent.fields.map((f) => f.component)).toEqual([
      'InputNumber',
      'InputNumber',
      'Checkbox',
    ]);
    expect(intent.fields[1].componentProps ?? {}).not.toHaveProperty('type');
    expect(intent.warnings.join('\n')).toMatch(/InputNumber/);
    expect(intent.warnings.join('\n')).toMatch(/CheckboxWithLabel.*имя экспорта/);
  });

  it('registry.ts импортирует сами компоненты, а не *Field', () => {
    const intent = normalizeIntent({
      formName: 'Order',
      target: 'renderer-json',
      fields: [
        { name: 'qty', type: 'number', component: 'InputNumber' },
        { name: 'agree', type: 'boolean', component: 'Checkbox' },
        { name: 'kind', type: 'string', component: 'Select' },
        { name: 'scan', type: 'object', component: 'FileUploadDropzone' },
      ],
    });
    const { content, warnings } = buildRegistryTs(intent, CATALOGS.uiKit);
    expect(warnings).toEqual([]);
    expect(content).toContain("reg.component('InputNumber', InputNumber);");
    expect(content).toContain("reg.component('Checkbox', CheckboxWithLabel);");
    expect(content).toContain("reg.component('Select', SelectAsync);");
    expect(content).toContain("reg.component('FileUploadDropzone', FileUploadDropzone);");
    expect(content).not.toMatch(/\w+Field\b(?<!FormField)/);

    const layout = buildBundle(intent, CATALOGS).layoutJson;
    expect(layout).toContain('$component(InputNumber)');
    expect(layout).not.toMatch(/"type":\s*"number"/);
  });
});

describe('validate_form kind=code', () => {
  const k = cliKnowledge();

  it('прежние *Field и withFormControl — обычное «не существует»', async () => {
    const { diagnostics } = await validateCode(
      k,
      "import { CheckboxField, withFormControl } from '@reformer/ui-kit';\n"
    );
    expect(diagnostics.map((d) => d.code)).toEqual(['RF002', 'RF002']);
  });

  it('прежнее имя компонента массива — RF010 с новым именем, а не «не существует»', async () => {
    const { diagnostics } = await validateCode(
      k,
      [
        "import { FormArray, FormArraySection } from '@reformer/ui-kit';",
        "import { useFormArray } from '@reformer/cdk/form-array';",
      ].join('\n')
    );
    const rf010 = diagnostics.filter((d) => d.code === 'RF010');

    expect(rf010.map((d) => d.line)).toEqual([1, 1, 2]);
    expect(rf010.map((d) => d.suggestion).join('\n')).toMatch(
      /`FieldArray`[\s\S]*`FieldArraySection`[\s\S]*`useFieldArray`/
    );
    expect(rf010[2].message).toContain('@reformer/cdk');
    expect(diagnostics.some((d) => d.code === 'RF002' || d.code === 'RF003')).toBe(false);
  });

  it('новые имена компонента массива диагностик не дают', async () => {
    const { diagnostics } = await validateCode(
      k,
      [
        "import { FieldArray, FieldArraySection } from '@reformer/ui-kit';",
        "import { useFieldArray } from '@reformer/cdk/field-array';",
      ].join('\n')
    );

    expect(diagnostics).toEqual([]);
  });

  it('имя вне семейства и имя без замены в пакете остаются обычной ошибкой', async () => {
    const { diagnostics } = await validateCode(
      k,
      [
        "import { FormArrayNoSuchPart } from '@reformer/ui-kit';",
        "import { FormArray } from '@reformer/renderer-json';",
      ].join('\n')
    );

    expect(diagnostics.some((d) => d.code === 'RF010')).toBe(false);
    // RF002 «не существует» либо RF003 «живёт в другом пакете» — но не переименование.
    const unknown = diagnostics.filter((d) => d.code === 'RF002' || d.code === 'RF003');
    expect(unknown.map((d) => d.line)).toEqual([1, 2]);
  });

  it("Input + type: 'number' и FileUpload + variant — RF010", async () => {
    const code = [
      "{ model: model.$.qty, component: Input, componentProps: { type: 'number' } },",
      "{ model: '$model(scan)', component: '$component(FileUpload)', componentProps: { variant: 'dropzone' } },",
      '{ model: model.$.qty, component: InputNumber },',
    ].join('\n');
    const lines = (await validateCode(k, code)).diagnostics
      .filter((d) => d.code === 'RF010')
      .map((d) => d.line);
    expect(lines).toEqual([1, 2]);
  });
});
