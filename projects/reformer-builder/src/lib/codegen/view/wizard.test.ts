/**
 * Предикат шима визарда — тот же ответ служит `applies` у цели генерации.
 *
 * Текст файла `renderer.wizard.tsx` удерживают побайтовые снимки
 * (`plugins/codegen/golden.test.ts`, комбинации `wizard-builtin` и `wizard-foreign`).
 * Здесь проверяется РЕШЕНИЕ: печатать ли его вообще. Снимком оно не выражается — отсутствие
 * файла там видно только по составу модуля, а причину отсутствия состав не называет.
 *
 * @module lib/codegen/view/wizard.test
 */

import { describe, expect, it } from 'vitest';
import {
  builtinKit,
  foreignKit,
  noWizardKit,
  plainSchema,
  wizardSchema,
} from '../__fixtures__/kit';
import { prepare, type CodegenInput, type EmitContext } from '../context';
import { wizardShimOf } from './wizard';

function ctxOf(input: Partial<CodegenInput> = {}): EmitContext {
  return prepare({
    schema: input.schema ?? plainSchema(),
    formName: input.formName ?? 'Заявка на кредит',
    kit: input.kit ?? builtinKit(),
  });
}

describe('нужен ли форме шим визарда', () => {
  it('визард в схеме и адаптер у кита — шим печатается', () => {
    const shim = wizardShimOf(ctxOf({ schema: wizardSchema() }));
    expect(shim?.symbol).toBe('FormWizard');
    expect(shim?.importFrom).toBe('@reformer/ui-kit/form-wizard');
  });

  it('чужой кит даёт свой символ и свой subpath', () => {
    const shim = wizardShimOf(ctxOf({ schema: wizardSchema(), kit: foreignKit() }));
    expect(shim?.symbol).toBe('HexWizard');
    expect(shim?.importFrom).toBe('@hexa/ui/wizard');
  });

  it('кит без адаптера визарда шима не получает вовсе', () => {
    // Отказ, который это удерживает: раньше в таком случае печатался импорт из пакета,
    // которого у кита нет, и форма не собиралась у пользователя. Теперь файла просто нет,
    // а визард регистрируется заглушкой с причиной — см. снимок `wizard-no-adapter`.
    expect(wizardShimOf(ctxOf({ schema: wizardSchema(), kit: noWizardKit() }))).toBeNull();
  });

  it('форма без визарда шима не требует', () => {
    expect(wizardShimOf(ctxOf())).toBeNull();
  });
});
