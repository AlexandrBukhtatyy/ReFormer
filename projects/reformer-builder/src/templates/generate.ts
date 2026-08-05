/**
 * Подготовка файлов формы из шаблона: раскрытие зависимостей выбора, подстановка имени формы вместо
 * плейсхолдеров и поиск схемы, которую после генерации открыть в canvas.
 *
 * Чистый слой — запись на диск в `app/template-actions`.
 *
 * @module reformer-builder/templates/generate
 */

import { isFormSchema } from '../model';
import { materialize } from './placeholders';
import type { FormTemplate, TemplateFile } from './types';

/**
 * Раскрыть выбор файлов по зависимостям шаблона ({@link FormTemplate.requires}), транзитивно:
 * отметили `index.tsx` — в набор попадут модель, реестр и остальное, без чего страница не соберётся.
 */
export function resolvePicked(
  picked: Iterable<string>,
  requires: Record<string, string[]> | undefined
): Set<string> {
  const out = new Set(picked);
  if (!requires) return out;
  const queue = [...out];
  while (queue.length) {
    const path = queue.pop() as string;
    for (const dep of requires[path] ?? []) {
      if (out.has(dep)) continue;
      out.add(dep);
      queue.push(dep);
    }
  }
  return out;
}

/** Отобранные файлы шаблона с подставленным именем формы — и в содержимом, и в пути. */
export function materializeFiles(
  template: FormTemplate,
  picked: Iterable<string>,
  formName: string
): TemplateFile[] {
  const keep = resolvePicked(picked, template.requires);
  return template.files
    .filter((f) => keep.has(f.path))
    .map((f) => ({
      path: materialize(f.path, formName),
      content: materialize(f.content, formName),
    }));
}

/**
 * Какой из сгенерированных файлов открыть в canvas: первый `.json`, распознанный как схема формы.
 * `null` — в наборе схемы нет (тогда после генерации ничего не открываем).
 */
export function formSchemaFileOf(files: TemplateFile[]): TemplateFile | null {
  for (const f of files) {
    if (!f.path.endsWith('.json')) continue;
    try {
      if (isFormSchema(JSON.parse(f.content))) return f;
    } catch {
      /* не JSON — не схема */
    }
  }
  return null;
}
