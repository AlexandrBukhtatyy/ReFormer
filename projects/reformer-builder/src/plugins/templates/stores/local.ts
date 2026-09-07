/**
 * Локальные шаблоны: живут в браузере и не зависят от открытого проекта.
 *
 * Хранилище приходит портом ({@link TemplateKeyValue}), а не зашито в IndexedDB, как было в v1.
 * Разница не стилистическая: там `io/template-repo.ts` звал `idbTx(TEMPLATES_STORE, …)` прямо
 * из функций, и подменить движок в тесте было нечем — тесты локальных шаблонов не существовали.
 *
 * Отказ движка (приватный режим, отключённое хранилище) — это ПУСТОЙ список, а не бросок:
 * панель, падающая из-за недоступной IndexedDB, не показала бы и встроенные шаблоны.
 *
 * @module plugins/templates/stores/local
 */

import type { FormTemplate, TemplateStore } from '../contract';
import type { TemplateKeyValue } from '../host';

/** Прочитанная запись похожа на шаблон. Дискриминатор структурный: чужой ключ — не наш шаблон. */
function isTemplateLike(value: unknown): value is FormTemplate {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Partial<FormTemplate>;
  return typeof record.id === 'string' && Array.isArray(record.files);
}

export function createLocalStore(storage?: TemplateKeyValue): TemplateStore {
  if (storage === undefined) {
    return { source: 'local', available: () => false, list: async () => [] };
  }

  const listAll = async (): Promise<readonly FormTemplate[]> => {
    try {
      const keys = await storage.keys();
      const out: FormTemplate[] = [];
      for (const key of keys) {
        const value = await storage.get(key);
        // `source` проставляем при чтении, а не доверяем записанному: запись могла приехать
        // из экспорта проектного шаблона, и её вид определяется тем, ГДЕ она лежит.
        if (isTemplateLike(value)) out.push({ ...value, id: key, source: 'local' });
      }
      return out;
    } catch (error) {
      console.warn('[templates] локальные шаблоны недоступны', error);
      return [];
    }
  };

  return {
    source: 'local',
    available: () => true,
    list: listAll,

    async save(template: FormTemplate): Promise<FormTemplate> {
      const taken = new Set((await listAll()).map((t) => t.id));
      let id = template.id;
      for (let index = 2; taken.has(id); index += 1) id = `${template.id}-${index}`;
      const stored: FormTemplate = { ...template, id, source: 'local' };
      await storage.put(id, stored);
      return stored;
    },

    async update(template: FormTemplate): Promise<void> {
      await storage.put(template.id, template);
    },

    async remove(id: string): Promise<void> {
      await storage.remove(id);
    },
  };
}
