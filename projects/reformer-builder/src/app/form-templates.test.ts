import { describe, expect, it } from 'vitest';
import { registryTsTemplate, indexTsxTemplate } from './form-templates';

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
  it('собирает форму одним проходом: createJsonForm + form.json + registry + behavior → JsonFormRenderer', () => {
    expect(src).toContain("import rawSchema from './form.json'");
    expect(src).toContain("import { createRegistry } from './registry'");
    expect(src).toContain("import { initialFormModel, type FormShape } from './model'");
    expect(src).toContain("import { formBehavior } from './form-behavior'");
    expect(src).toContain("import { formRenderBehavior } from './render-behavior'");
    expect(src).toContain('createJsonForm<FormShape>(');
    expect(src).toContain('useJsonForm(');
    expect(src).toContain('<JsonFormRenderer<FormShape>');
    expect(src).toContain('form={jsonForm}');
    expect(src).toContain('renderBehavior={formRenderBehavior}');
  });
  it('стратегия валидации берётся из validation.ts, submit — штатным useFormValidation', () => {
    // Одна точка истины: тот же `validationOptions` читает Renderer-превью билдера, поэтому в
    // превью форма валидируется ровно так же, как в приложении.
    expect(src).toContain("import { formValidation, validationOptions } from './validation'");
    expect(src).toContain('useFormValidation({');
    expect(src).toContain('...validationOptions');
    expect(src).toContain('await validation.submit()');
  });
  it('PascalCase: дефис/пробел → одно имя, ведущая цифра защищена, суффикс не задваивается', () => {
    expect(indexTsxTemplate('loan-application')).toContain(
      'export default function LoanApplicationForm()'
    );
    expect(indexTsxTemplate('2fa form')).toContain('export default function Form2faForm()');
    expect(indexTsxTemplate('profile form')).toContain('export default function ProfileForm()');
  });
});
