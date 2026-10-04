/**
 * Образец формы RJSF в проекте-образце (`forms/contact.rjsf.json`).
 *
 * Форму открывает редактор домена, только если его проба узнаёт формат: иначе файл молча
 * открывается текстом, и образец перестаёт быть образцом.
 *
 * @module plugins/rjsf/integration/playground-forms.test
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { looksLikeRjsfForm } from '../core';

/** Образец формы — в корне проекта-образца. */
const FORM = fileURLToPath(new URL('../../../../forms/contact.rjsf.json', import.meta.url));

describe('образец формы RJSF', () => {
  it('распознаётся редактором RJSF', () => {
    expect(looksLikeRjsfForm(readFileSync(FORM, 'utf8'))).toBe(true);
  });
});
