/**
 * Коды диагностик `RF0xx` — машиночитаемая обратная связь вместо простыни текста.
 *
 * Зачем коды. Ответ «так нельзя, вот три абзаца почему» модель обязана перечитывать целиком
 * и каждый раз заново решать, что с ним делать. Код плюс `fix` превращают это в действие:
 * агент видит, ЧТО не так, ГДЕ и КАКИМ вызовом это выяснить дальше. Это и есть разница между
 * документацией и компилятором.
 *
 * Коды стабильны: на них ссылаются сообщения, тесты и (в перспективе) отчёты. Значение кода
 * менять нельзя — только добавлять новые.
 */

/** Стабильный идентификатор диагностики. */
export type DiagnosticCode =
  | 'RF001' // некорректное использование API (сигнатура/контекст)
  | 'RF002' // неизвестный символ @reformer/*
  | 'RF003' // символ импортирован не из того пакета
  | 'RF004' // валидация объявлена вне схемы валидации
  | 'RF005' // поведение объявлено вне схемы поведения
  | 'RF006' // цикл в вычисляемых полях
  | 'RF007' // некорректная layout-схема
  | 'RF008' // неизвестный компонент
  | 'RF009' // неизвестный источник данных
  | 'RF010'; // использование снятого/устаревшего API

export interface Diagnostic {
  code: DiagnosticCode;
  severity: 'error' | 'warning';
  message: string;
  /** Строка в переданном коде, 1-based. Отсутствует для проверок не по коду. */
  line?: number;
  /** Путь внутри JSON-схемы, если диагностика про неё. */
  path?: string;
  /** Что сделать. Формулируется как действие, а не как описание проблемы. */
  suggestion?: string;
  /** Куда пойти за контекстом — готовый вызов, а не намёк. */
  fix?: { tool: string; arguments: Record<string, unknown> };
}

/** Человекочитаемое имя кода — для заголовков отчёта. */
export const CODE_TITLES: Record<DiagnosticCode, string> = {
  RF001: 'INVALID_API_USAGE',
  RF002: 'UNKNOWN_SYMBOL',
  RF003: 'WRONG_PACKAGE',
  RF004: 'VALIDATION_OUTSIDE_SCHEMA',
  RF005: 'BEHAVIOR_OUTSIDE_SCHEMA',
  RF006: 'BEHAVIOR_CYCLE',
  RF007: 'INVALID_RENDER_SCHEMA',
  RF008: 'UNKNOWN_COMPONENT',
  RF009: 'UNKNOWN_DATASOURCE',
  RF010: 'DEPRECATED_API',
};

/** Отрисовать диагностики так, чтобы каждая читалась как задача, а не как жалоба. */
export function renderDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics
    .map((d) => {
      const where = d.line !== undefined ? `:${d.line}` : d.path ? ` at ${d.path}` : '';
      const head = `- **${d.code}** ${CODE_TITLES[d.code]}${where} — ${d.message}`;
      const fix = d.suggestion ? `\n  → ${d.suggestion}` : '';
      const call = d.fix ? `\n  → \`${d.fix.tool}(${JSON.stringify(d.fix.arguments)})\`` : '';
      return head + fix + call;
    })
    .join('\n');
}
