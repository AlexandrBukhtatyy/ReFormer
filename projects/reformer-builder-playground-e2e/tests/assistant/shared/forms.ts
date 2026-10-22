/**
 * Формы сценариев ассистента.
 *
 * Форма A — `forms/contact` из playground: плоская раскладка, документ в корне модуля.
 * Форма B — засевается тестом: вложенная раскладка (`<модуль>/schema/form.schema.json`) и
 * своё приметное поле, по которому видно, в какую из двух форм легла правка.
 *
 * Тесты не опираются на прочие формы playground: копия «диска» берёт и неотслеживаемые файлы
 * рабочего дерева, и чужие черновики в `forms/` там бывают.
 *
 * @module tests/assistant/shared/forms
 */

import { expect } from '@playwright/test';
import type { BuilderApp } from '../../shared/builder-app.pom';
import type { PlaygroundDisk } from '../../shared/playground-disk';

/**
 * Сохраняет документ формы (если в нём есть несохранённые правки) и возвращает его текст с
 * «диска».
 *
 * Вкладка активируется кликом: сочетание сохранения работает по активному документу и только
 * когда фокус не в поле ввода ассистента, — а после кнопок панели он остаётся там или на
 * исчезнувшей кнопке. Конец сохранения — снятая метка несохранённых правок, иначе текст «диска»
 * читался бы до записи и проверка проходила бы впустую.
 */
export async function savedText(
  builder: BuilderApp,
  disk: PlaygroundDisk,
  path: string
): Promise<string> {
  await builder.activateTab(path);
  if ((await builder.dirtyMark(path).count()) > 0) {
    await builder.save();
    await expect(builder.dirtyMark(path)).toHaveCount(0);
  }
  return disk.readText(path);
}

/** Форма A — плоская раскладка, поля «Имя», «Email», «Как связаться». */
export const FORM_A = 'forms/contact/form.schema.json';

/** Модуль формы B и её документ. */
export const FORM_B_MODULE = 'forms/e2e-b';
export const FORM_B = `${FORM_B_MODULE}/schema/form.schema.json`;

/** Подпись единственного поля формы B — по ней форму B видно в дереве структуры. */
export const FORM_B_FIELD = 'ФИО заявителя';

/** Текст документа формы B — так его печатает билдер (отступ два пробела, перевод строки). */
export const FORM_B_TEXT = `${JSON.stringify(
  {
    $schema: './form-schema.schema.json',
    format: 2,
    version: '1.0',
    root: {
      $nodeId: 'e2ebroot',
      component: '$component(Box)',
      componentProps: { className: 'space-y-6' },
      children: [
        {
          $nodeId: 'e2ebname',
          selector: 'fullName',
          model: '$model(fullName)',
          component: '$component(Input)',
          componentProps: { label: FORM_B_FIELD },
        },
      ],
    },
  },
  null,
  2
)}\n`;

/** Кладёт форму B на «диск». Зовётся между `disk.seed()` и открытием папки. */
export async function seedFormB(disk: PlaygroundDisk): Promise<void> {
  await disk.writeText(FORM_B, FORM_B_TEXT);
}

/** Узел поля для `insert_node` структурного режима. */
export function inputNode(model: string, label: string): Record<string, unknown> {
  return { component: 'Input', model, props: { label } };
}
