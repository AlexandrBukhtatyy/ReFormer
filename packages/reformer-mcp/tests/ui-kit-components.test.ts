/**
 * Поля ui-kit в генераторе и валидаторе: registry-имя ↔ экспорт, удалённые `*Field`.
 *
 * Зачем. `*Field`-версии компонентов ui-kit удалены без алиасов: в `component` поля кладётся
 * сам компонент, а число, подсказки и варианты загрузки файлов стали отдельными компонентами
 * (`InputNumber`, `InputSuggest`, `FileUploadDropzone`, `FileUploadInput`). Генератор, который
 * печатает `import { InputField }` или `$component(Input)` с `type: 'number'`, выдаёт код,
 * который не собирается либо молча пишет в модель строку вместо числа.
 *
 * Таблица registry → экспорт продублирована в MCP (ui-kit — опциональный peer, в рантайме
 * сервера его каталога может не быть), поэтому её сверка с `component-catalog.json` — здесь.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeFieldComponent,
  REMOVED_FIELD_EXPORTS,
  UI_KIT_FIELD_EXPORTS,
} from '../src/core/generate/ui-kit-components';
import { buildBundle, buildRegistryTs } from '../src/core/generate/builders';
import { normalizeIntent, readIntent } from '../src/core/generate/form-intent';
import { validateCode } from '../src/core/validate/code';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const catalogPath = resolve(repoRoot, 'packages/reformer-ui-kit/component-catalog.json');
const hasCatalog = existsSync(catalogPath);

interface CatalogEntry {
  name: string;
  role?: string;
  exportName?: string;
}

describe('таблица полей ui-kit', () => {
  it.runIf(hasCatalog)('совпадает с x-registryName / x-exportName каталога ui-kit', () => {
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as {
      components: CatalogEntry[];
    };
    const fromCatalog = Object.fromEntries(
      catalog.components
        .filter((c) => c.role === 'field')
        .map((c) => [c.name, c.exportName ?? c.name])
    );
    expect({ ...UI_KIT_FIELD_EXPORTS }).toEqual(fromCatalog);
  });

  it('каждый удалённый *Field ведёт в существующее registry-имя', () => {
    const dangling = Object.entries(REMOVED_FIELD_EXPORTS).filter(
      ([, registry]) => !UI_KIT_FIELD_EXPORTS[registry]
    );
    expect(dangling).toEqual([]);
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
    expect(
      normalizeFieldComponent('FileUploadField', 'object', { variant: 'input' }).component
    ).toBe('FileUploadInput');
  });

  it('удалённый *Field и имя экспорта приводятся к registry-имени', () => {
    expect(normalizeFieldComponent('CheckboxField', 'boolean').component).toBe('Checkbox');
    expect(normalizeFieldComponent('SelectAsync', 'string').component).toBe('Select');
    expect(normalizeFieldComponent('InputField', 'number').component).toBe('InputNumber');
    expect(normalizeFieldComponent('Textarea', 'string').notes).toEqual([]);
  });
});

describe('генератор', () => {
  it('поле number без компонента и с Input рисует InputNumber, и это видно в warnings', () => {
    const { intent } = readIntent({
      formName: 'Order',
      target: 'renderer-json',
      fields: [
        { name: 'qty', type: 'number' },
        { name: 'price', type: 'number', component: 'Input', componentProps: { type: 'number' } },
        { name: 'agree', type: 'boolean', component: 'CheckboxField' },
      ],
    });
    expect(intent.fields.map((f) => f.component)).toEqual([
      'InputNumber',
      'InputNumber',
      'Checkbox',
    ]);
    expect(intent.fields[1].componentProps ?? {}).not.toHaveProperty('type');
    expect(intent.warnings.join('\n')).toMatch(/InputNumber/);
    expect(intent.warnings.join('\n')).toMatch(/CheckboxField.*удалён/);
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
    const { content, warnings } = buildRegistryTs(intent);
    expect(warnings).toEqual([]);
    expect(content).toContain("reg.component('InputNumber', InputNumber);");
    expect(content).toContain("reg.component('Checkbox', CheckboxWithLabel);");
    expect(content).toContain("reg.component('Select', SelectAsync);");
    expect(content).toContain("reg.component('FileUploadDropzone', FileUploadDropzone);");
    expect(content).not.toMatch(/\w+Field\b(?<!FormField)/);

    const layout = buildBundle(intent).layoutJson;
    expect(layout).toContain('$component(InputNumber)');
    expect(layout).not.toMatch(/"type":\s*"number"/);
  });
});

describe('validate_form kind=code', () => {
  const k = cliKnowledge();

  it('удалённый *Field — RF010 с названной заменой', async () => {
    const { diagnostics } = await validateCode(
      k,
      "import { CheckboxField, InputField } from '@reformer/ui-kit';\n"
    );
    const rf010 = diagnostics.filter((d) => d.code === 'RF010');
    expect(rf010.map((d) => d.message).join('\n')).toMatch(/CheckboxField/);
    expect(rf010.map((d) => d.suggestion).join('\n')).toMatch(/CheckboxWithLabel/);
    expect(diagnostics.some((d) => d.code === 'RF002')).toBe(false);
  });

  it("Input + type: 'number' и FileUpload + variant — RF010", async () => {
    const code = [
      "{ value: model.$.qty, component: Input, componentProps: { type: 'number' } },",
      "{ value: '$model(scan)', component: '$component(FileUpload)', componentProps: { variant: 'dropzone' } },",
      '{ value: model.$.qty, component: InputNumber },',
    ].join('\n');
    const lines = (await validateCode(k, code)).diagnostics
      .filter((d) => d.code === 'RF010')
      .map((d) => d.line);
    expect(lines).toEqual([1, 2]);
  });
});
