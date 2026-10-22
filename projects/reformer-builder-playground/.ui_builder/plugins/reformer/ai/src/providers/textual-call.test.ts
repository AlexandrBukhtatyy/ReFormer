import { describe, expect, it } from 'vitest';
import { fileModeTools } from '../tools/files';
import { textualCallOf } from './textual-call';

/** Инструменты режима файлов — те, что видит модель в ходе, где сбой и наблюдался. */
const TOOLS = fileModeTools().map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema }));

describe('вызов инструмента, написанный текстом', () => {
  it('родной вызов Gemma 4, отвергнутый парсером сервера и отданный текстом', () => {
    // Дословно из журнала Ollama (gemma4:26b): строка old_string не закрыта, разбор упал, и
    // сервер отдал вызов содержимым ответа.
    const leaked =
      'call:edit_file{edits:[{new_string:<|"|>      {\n        "component": "$component($html(div))",' +
      '\n        "componentProps": {\n          "className": "space-y-4"\n        },<|"|>,old_string:<|"|>' +
      '      {\n        "selector": "personal-section",\n        "className": "space"]}],' +
      'path:<|"|>schema/form.schema.json<|"|>}';
    expect(textualCallOf(leaked, TOOLS)).toBe('edit_file');
  });

  it('аргументы вызова JSON-блоком в ответе, без имени инструмента', () => {
    // Живой шаг той же модели: файл прочитан, затем вместо вызова — блок и отчёт «добавил».
    const answer =
      '```json\n{\n  "edits": [\n    {\n      "new_string": "  hideWhen(schema.node(\'extra-section\'), ' +
      '() => !model.$.email);",\n      "old_string": "  // Условная видимость секций",\n      "path": ' +
      '"behavior/index.ts"\n    }\n  ]\n}\n```\nДобавил правило: секция «Дополнительно» скрывается.';
    expect(textualCallOf(answer, TOOLS)).toBe('edit_file');
  });

  it('конверт вызова JSON-ом — <tool_call> у Qwen и Hermes', () => {
    const answer =
      '<tool_call>\n{"name": "write_file", "arguments": {"path": "validation/x.ts", "content": ""}}' +
      '\n</tool_call>';
    expect(textualCallOf(answer, TOOLS)).toBe('write_file');
  });

  it('вызов функцией с именованными аргументами', () => {
    expect(textualCallOf('read_file(path="behavior/index.ts")', TOOLS)).toBe('read_file');
    expect(textualCallOf('edit_file({ "path": "a" })', TOOLS)).toBe('edit_file');
  });

  it('имя инструмента в объяснении — не вызов', () => {
    expect(textualCallOf('Сначала прочитаю файл через read_file, потом поправлю.', TOOLS)).toBe(
      undefined
    );
    expect(textualCallOf('Инструмент edit_file() меняет текст файла.', TOOLS)).toBe(undefined);
  });

  it('незнакомое имя — просто слово в тексте', () => {
    expect(textualCallOf('call:delete_everything{path:"x"}', TOOLS)).toBe(undefined);
    expect(textualCallOf('{"name": "email", "label": "Почта"}', TOOLS)).toBe(undefined);
  });

  it('фрагмент формы в ответе — не вызов', () => {
    const node =
      '```json\n{"model": "$model(phone)", "component": "$component(InputMask)", ' +
      '"componentProps": {"label": "Телефон"}}\n```';
    expect(textualCallOf(node, TOOLS)).toBe(undefined);
  });

  it('один обязательный ключ — слишком слабый признак для голого объекта', () => {
    expect(textualCallOf('{"path": "schema/form.schema.json"}', TOOLS)).toBe(undefined);
  });

  it('пустой ответ — не вызов', () => {
    expect(textualCallOf('  \n', TOOLS)).toBe(undefined);
  });
});
