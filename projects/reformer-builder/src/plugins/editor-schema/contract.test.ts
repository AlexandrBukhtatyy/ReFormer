/**
 * Идентификатор провайдера модели — одно значение в двух местах, и это сверяется.
 *
 * Лист `./contract` держит идентификатор литералом: его читает композиция, и лист обязан
 * остаться без импортов значений. Пакет стека держит тот же идентификатор для валидатора,
 * превью и остальных плагинов стека — они редактор схемы импортировать не могут. Разойдись
 * строки, редактор вносил бы провайдера, чьи документы никто в стеке не узнаёт своими.
 *
 * @module plugins/editor-schema/contract.test
 */

import { describe, expect, it } from 'vitest';
import { FORM_SCHEMA_PROVIDER_ID } from '@reformer/builder-stack-reformer/form-model';
import { SCHEMA_MODEL_PROVIDER_ID } from './contract';

describe('идентификатор провайдера схемы формы', () => {
  it('совпадает с тем, по которому плагины стека узнают свой документ', () => {
    expect(SCHEMA_MODEL_PROVIDER_ID).toBe(FORM_SCHEMA_PROVIDER_ID);
  });
});
