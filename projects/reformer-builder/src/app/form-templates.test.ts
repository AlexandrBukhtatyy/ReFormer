import { describe, expect, it } from 'vitest';
import {
  registryTsTemplate,
  indexTsxTemplate,
  resolveFormDirFiles,
  type FormDirFiles,
} from './form-templates';

describe('registryTsTemplate', () => {
  const src = registryTsTemplate('profile');
  it('обёртка полей + Input→InputField', () => {
    expect(src).toContain('reg.component(FIELD_WRAPPER, FormField)');
    expect(src).toContain("reg.component('Input', InputField)");
  });
  it('импорты ui-kit + renderer-json, экспорт createRegistry', () => {
    expect(src).toContain("from '@reformer/ui-kit'");
    expect(src).toContain("from '@reformer/renderer-json'");
    expect(src).toContain('export function createRegistry(): ComponentRegistry');
  });
});

describe('indexTsxTemplate', () => {
  const src = indexTsxTemplate('profile');
  it('default-export компонент с PascalCase-именем', () => {
    expect(src).toContain('export default function ProfileForm()');
  });
  it('собирает форму: модель + form.json + registry + behavior → JsonFormRenderer', () => {
    expect(src).toContain("import rawSchema from './form.json'");
    expect(src).toContain("import { createRegistry } from './registry'");
    expect(src).toContain("import { initialFormModel, type FormShape } from './model'");
    expect(src).toContain('convertJsonToM1Tree(schema, registry, model)');
    expect(src).toContain('<JsonFormRenderer<FormShape>');
    expect(src).toContain('renderBehavior={formUiBehavior}');
  });
  it('submit гоняет валидацию модели', () => {
    expect(src).toContain('validateModel(model, formValidation)');
    expect(src).toContain('form.markAsTouched()');
  });
  it('PascalCase: дефис/пробел → одно имя, ведущая цифра защищена, суффикс не задваивается', () => {
    expect(indexTsxTemplate('loan-application')).toContain(
      'export default function LoanApplicationForm()'
    );
    expect(indexTsxTemplate('2fa form')).toContain('export default function Form2faForm()');
    expect(indexTsxTemplate('profile form')).toContain('export default function ProfileForm()');
  });
});

describe('resolveFormDirFiles', () => {
  const off: FormDirFiles = {
    model: false,
    form: false,
    validation: false,
    behavior: false,
    ui: false,
    registry: false,
    component: false,
  };

  it('component=true форсит все зависимости', () => {
    const r = resolveFormDirFiles({ ...off, component: true });
    expect(r).toEqual({
      model: true,
      form: true,
      validation: true,
      behavior: true,
      ui: true,
      registry: true,
      component: true,
    });
  });

  it('component=false — набор не меняется', () => {
    const picked: FormDirFiles = { ...off, model: true, form: true };
    expect(resolveFormDirFiles(picked)).toEqual(picked);
  });
});
