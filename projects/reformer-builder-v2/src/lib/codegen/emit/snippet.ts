/**
 * Сниппет для ручной регистрации формы в приложении-хосте. Без автопатча: показывается после
 * генерации и дублируется в `README.md`.
 *
 * Текст живёт в `templates/_snippet.eta` и отсюда только рендерится. Потребителей у него два —
 * панель экспорта (через эту функцию) и шаблон README (через `include`), — и две копии одного
 * текста разошлись бы на первой же правке: человек скопировал бы из панели одно, а в README
 * прочитал другое.
 *
 * @module reformer-builder/lib/codegen/emit/snippet
 */

import type { Names } from '../naming';
import { renderTemplate } from '../render';
import { SNIPPET_PARTIAL, snippetTemplate } from '../templates';

export function appSnippet(n: Names): string {
  // Хвостовой перевод строки снимается: `_snippet.eta` — текстовый ФАЙЛ и оканчивается им,
  // как всякий файл, а сниппет — ФРАГМЕНТ, который вставляют внутрь блока кода. В README
  // этой правки не нужно: там перевод строки съедает закрывающий тег включения.
  return renderTemplate(SNIPPET_PARTIAL, snippetTemplate, { names: n }).replace(/\n$/, '');
}
