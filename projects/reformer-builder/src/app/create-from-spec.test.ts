/**
 * Сквозной путь «текст спеки → вкладка с формой».
 *
 * Проверяется то, что нельзя проверить по частям: разбор в MCP, перевод словаря компонентов и
 * гейт билдера сходятся только здесь. Каждое звено по отдельности уже зелено, а вместе они
 * до сих пор ни разу не запускались — ровно так и живут расхождения контрактов между пакетами.
 *
 * Спека берётся настоящая (фикстура MCP, формат `docs/specs/*.md`), а не выдуманная под тест:
 * выдуманная проверяла бы разбор, которого в проекте нет.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { editorStore } from '../store';
import * as R from '../store/reducers';
import { createFormFromSpec } from './create-from-spec';

const SPEC = readFileSync(
  join(process.cwd(), '../../packages/reformer-mcp/tests/fixtures/spec-loan-request.md'),
  'utf8'
);

describe('createFormFromSpec', () => {
  beforeEach(() => {
    editorStore.setState(() => R.initialState());
  });

  it('из настоящей спеки получается открытая вкладка с полями', () => {
    const res = createFormFromSpec(SPEC);
    expect(res.status).toBe('created');

    const state = editorStore.getState();
    const tab = state.tabs[res.tab!];
    expect(tab).toBeDefined();
    expect(tab.kind).toBe('form');

    // Поля спеки доехали до разметки — иначе «форма создана» означало бы пустую вкладку.
    const json = JSON.stringify(tab.schema);
    expect(json).toContain('$model(loanType)');
  });

  it('правила спеки приземляются вместе со схемой, одной вкладкой', () => {
    const res = createFormFromSpec(SPEC);
    const tab = editorStore.getState().tabs[res.tab!];
    // Валидация в спеке задана колонкой — без неё форма выглядела бы разобранной, но не была.
    expect(tab.rules.validation.length).toBeGreaterThan(0);
    // Вкладка рождается целой: правила не «изменение», которое надо сохранять отдельно.
    expect(R.isDirty(tab)).toBe(false);
  });

  it('предупреждения разбора доходят до вызывающего', () => {
    // plan_form честно говорит, что формулы вычисляемых полей не извлекаются. Если проглотить
    // это, пользователь примет «форма создана» за «спека разобрана правильно».
    const res = createFormFromSpec(SPEC);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('текст без полей не создаёт вкладку-пустышку', () => {
    const res = createFormFromSpec('# Просто заметка\n\nНикаких полей здесь нет.');
    expect(res.status).toBe('empty');
    expect(Object.keys(editorStore.getState().tabs)).toHaveLength(0);
  });

  it('имя вкладки не перетирает уже открытую', () => {
    const first = createFormFromSpec(SPEC);
    const second = createFormFromSpec(SPEC);
    expect(second.status).toBe('created');
    expect(second.tab).not.toBe(first.tab);
    expect(Object.keys(editorStore.getState().tabs)).toHaveLength(2);
  });
});
