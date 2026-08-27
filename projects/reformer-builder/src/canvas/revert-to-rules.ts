/**
 * «Вернуть к правилам» — собрать файл схемы формы заново из сайдкара.
 *
 * Отдельно от {@link module:reformer-builder/canvas/FormSourceEditor}, потому что тот файл обязан
 * экспортировать только компонент (иначе ломается fast refresh), и потому что операция сама по себе
 * не про рендер: её зовёт и кнопка панели, и — в будущем — пункт меню.
 *
 * Дифф здесь обязателен, а не любезность: текст, написанный руками, — работа пользователя, и
 * заменить её содержимым генератора без предъявления разницы значит потерять её без спроса.
 *
 * @module reformer-builder/canvas/revert-to-rules
 */

import { toast } from '@reformer/ui-kit/sonner';
import type { TabState } from '../store';
import { readWorkdirFile, writeWorkdirFile } from '../io/opfs';
import { regenerateFile, type FormSchemaFile } from '../codegen/regenerate';
import { formNameFromSchemaFile } from '../app/save-actions';
import { effectiveMock } from './mock-data';
import { reloadLiveForm } from './useLiveForm';
import { diffLines } from '../io/diff';

/** Вернуть файл к правилам. `true` — файл переписан. */
export async function revertToRules(tab: TabState, file: FormSchemaFile): Promise<boolean> {
  const current = (await readWorkdirFile(tab.id, file)) ?? '';
  const next = await regenerateFile(
    file,
    tab.schema,
    tab.rules,
    formNameFromSchemaFile(tab.source.name, tab.source.path),
    effectiveMock(tab.schema, tab.mock)
  );
  if (next == null) {
    toast('Не удалось собрать файл из правил');
    return false;
  }
  if (next === current) {
    toast.info('Файл и так собран из правил');
    return false;
  }

  const changed = diffLines(current, next).filter((l) => l.type !== 'same').length;
  const ok = window.confirm(
    `Вернуть «${file}» к правилам формы?\n\n` +
      `Изменится строк: ${changed}. Всё, что вы дописали в этот файл руками, будет заменено ` +
      'содержимым, собранным из правил.'
  );
  if (!ok) return false;

  await writeWorkdirFile(tab.id, file, next);
  reloadLiveForm();
  toast('Файл собран из правил заново');
  return true;
}
