import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkRefs, refsTrailer } from './refs-trailer.mjs';

const HEADER = 'feat(reformer): тема';
const BODY = 'Тело: что и зачем.\nВторая строка тела.';

/** Сообщение из абзацев: заголовок, затем переданные абзацы. */
const message = (...paragraphs) => [HEADER, ...paragraphs].join('\n\n') + '\n';

const passes = (raw) => assert.equal(checkRefs(raw), null);
const fails = (raw, fragment) => {
  const error = checkRefs(raw);
  assert.ok(error, 'ожидалась ошибка');
  assert.match(error, fragment);
};

test('секция необязательна', () => {
  passes(`${HEADER}\n`);
  passes(message(BODY));
});

test('Refs с одним ID и с несколькими разных видов', () => {
  passes(message(BODY, 'Refs: ReFormer-syj9'));
  passes(message(BODY, 'Refs: ReFormer-k152.13, ReFormer-3548, #12, owner/repo#7'));
});

test('Refs сразу после заголовка, без тела', () => {
  passes(message('Refs: ReFormer-syj9'));
});

test('Refs + Closes; Refs рядом с другими трейлерами git', () => {
  passes(message(BODY, 'Refs: ReFormer-syj9, #12\nCloses: #12'));
  passes(message(BODY, 'Refs: ReFormer-syj9\nCo-authored-by: Имя <mail@example.com>'));
});

test('BREAKING CHANGE отдельным абзацем выше', () => {
  passes(message(BODY, 'BREAKING CHANGE: удалён метод\nвторая строка', 'Refs: ReFormer-syj9'));
});

test('ID в прозе тела — не секция ссылок', () => {
  passes(message('Продолжение ReFormer-k152: см. ReFormer-u880 и #12.'));
  passes(message('Заведена и закрыта ReFormer-ahke: тесты падали.'));
});

test('комментарии git и дифф после ножниц не считаются', () => {
  const raw =
    message(BODY, 'Refs: ReFormer-syj9') +
    '# Please enter the commit message\n' +
    '# ------------------------ >8 ------------------------\n' +
    'diff --git a/x b/x\n\nrefs: что угодно\n';
  passes(raw);
});

test('опечатка в ключе', () => {
  fails(message(BODY, 'refs: ReFormer-syj9'), /ключом «Refs:»/);
  fails(message(BODY, 'REFS: ReFormer-syj9'), /ключом «Refs:»/);
  fails(message(BODY, 'Ref: ReFormer-syj9'), /ключом «Refs:»/);
  fails(message(BODY, 'References: ReFormer-syj9'), /ключом «Refs:»/);
  fails(message(BODY, 'Task: ReFormer-syj9'), /ключом «Refs:»/);
  fails(message(BODY, 'Refs ReFormer-syj9'), /ключом «Refs:»/);
});

test('ключевые слова GitHub без формы Closes:', () => {
  fails(message(BODY, 'Refs: #12\nCloses #12'), /«Closes:»/);
  fails(message(BODY, 'Fixes #12'), /«Closes:»/);
  fails(message(BODY, 'Resolves: #12'), /«Closes:»/);
});

test('старый стиль — голая строка с ID последним абзацем', () => {
  fails(message(BODY, 'ReFormer-ahke'), /оформи как «Refs: ReFormer-ahke»/);
  fails(message(BODY, 'ReFormer-u880, ReFormer-ffxb'), /Refs: ReFormer-u880, ReFormer-ffxb/);
});

test('Refs не в последнем абзаце', () => {
  fails(message('Refs: ReFormer-syj9', BODY), /последний абзац/);
});

test('в абзаце с Refs только трейлеры', () => {
  fails(message(BODY, 'BREAKING CHANGE: удалён метод\nRefs: ReFormer-syj9'), /BREAKING CHANGE/);
  fails(message(`${BODY}\nRefs: ReFormer-syj9`), /только строки/);
});

test('число и порядок строк Refs и Closes', () => {
  fails(message(BODY, 'Refs: ReFormer-syj9\nRefs: #12'), /одна строка/);
  fails(message(BODY, 'Refs: #12\nCloses: #12\nCloses: #12'), /одна строка/);
  fails(message(BODY, 'Closes: #12\nRefs: #12'), /после Refs/);
  fails(message(BODY, 'Closes: #12'), /без Refs/);
});

test('формат списка ID', () => {
  fails(message(BODY, 'Refs:'), /пустой элемент/);
  fails(message(BODY, 'Refs: ReFormer-syj9,, #12'), /пустой элемент/);
  fails(message(BODY, 'Refs: ReFormer-syj9,#12'), /запятой с пробелом/);
  fails(message(BODY, 'Refs: ReFormer-syj9 #12'), /не по формату/);
});

test('ID не по формату', () => {
  fails(message(BODY, 'Refs: Reformer-syj9'), /«Reformer-syj9» не по формату/);
  fails(message(BODY, 'Refs: ReFormer-SYJ9'), /не по формату/);
  fails(message(BODY, 'Refs: gh-12'), /не по формату/);
});

test('дубль ID', () => {
  fails(message(BODY, 'Refs: ReFormer-syj9, #12, ReFormer-syj9'), /указан дважды/);
});

test('Closes — только GitHub issue из Refs', () => {
  fails(message(BODY, 'Refs: ReFormer-syj9\nCloses: ReFormer-syj9'), /bd close/);
  fails(message(BODY, 'Refs: ReFormer-syj9, #12\nCloses: #13'), /«#13» нет в Refs/);
});

test('обёртка для commitlint возвращает [ok, сообщение]', () => {
  assert.deepEqual(refsTrailer({ raw: message(BODY, 'Refs: ReFormer-syj9') }), [true]);
  const [ok, error] = refsTrailer({ raw: message(BODY, 'refs: ReFormer-syj9') });
  assert.equal(ok, false);
  assert.match(error, /Refs:/);
});
